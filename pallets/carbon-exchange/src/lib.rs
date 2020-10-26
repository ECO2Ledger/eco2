#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
	decl_error, decl_event, decl_module, decl_storage, dispatch, ensure, traits::Get,
};
use frame_system::ensure_signed;
use sp_runtime::{
	traits::{AccountIdConversion, Hash, SaturatedConversion, StaticLookup},
	ModuleId, RuntimeDebug,
};
use sp_std::prelude::*;

// #[cfg(test)]
// mod mock;

// #[cfg(test)]
// mod tests;

const PALLET_ID: ModuleId = ModuleId(*b"cbex/pot");

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct Order<AccountId, Hash> {
	pub asset_id: Hash,
	pub money_id: Hash,
	pub maker: AccountId,
	pub amount: u64,
	pub price: u64,
	pub left_amount: u64,
	pub direction: u8,
	pub locked_balance: u64,
	pub salt: u64,
}

enum Direction {
	ASK = 0,
	BID = 1,
}

pub trait Trait:
	frame_system::Trait
	+ pallet_balances::Trait
	+ pallet_timestamp::Trait
	+ pallet_carbon_assets::Trait
	+ pallet_standard_assets::Trait
{
	type Event: From<Event<Self>> + Into<<Self as frame_system::Trait>::Event>;
}

type OrderOf<T> = Order<<T as frame_system::Trait>::AccountId, <T as frame_system::Trait>::Hash>;

decl_storage! {
	trait Store for Module<T: Trait> as CarbonExchange {
		pub Orders get(fn get_order) : map hasher(identity) T::Hash=> Option<OrderOf<T>>;
	}
}

decl_event!(
	pub enum Event<T>
	where
		AccountId = <T as frame_system::Trait>::AccountId,
		Hash = <T as frame_system::Trait>::Hash,
		Moment = <T as pallet_timestamp::Trait>::Moment,
	{
		/// Some order was created. \[order_id, maker, asset_id, money_id, timestamp\]
		NewOrder(Hash, AccountId, Hash, Hash, Moment),
		/// Some order dealed. \[order_id, asset_id, money_id, maker, taker, price, amount, direction, timestamp\]
		NewDeal(Hash, Hash, Hash, AccountId, AccountId, u64, u64, u8, Moment),
		/// Some order was finished. \[order_id\]
		OrderFinished(Hash),
		/// Some order was canceled. \[order_id\]
		OrderCanceled(Hash),
	}
);

decl_error! {
	pub enum Error for Module<T: Trait> {
		InvalidIndex,
		AssetNotExist,
		InvalidMoneyID,
		InvalidDirection,
		DuplicatedKey,
		StorageOverflow,
		InsuffientMoney,
		InsuffientAsset,
		InsuffientPotAsset,
		PriceZero,
		InvalidAmount,
		AmountZero,
		AmountHigh,
		PermissionDenied,
	}
}

decl_module! {
	pub struct Module<T: Trait> for enum Call where origin: T::Origin {
		type Error = Error<T>;

		fn deposit_event() = default;

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn make_order(origin, asset_id: T::Hash, money_id: T::Hash, price: u64, amount: u64, direction: u8, salt: u64) -> dispatch::DispatchResult {
			let maker = ensure_signed(origin.clone())?;

			// Now the quote currency only support ECO2 repsented by zero hash
			ensure!(money_id == T::Hash::default(), Error::<T>::InvalidMoneyID);
			ensure!(price > 0, Error::<T>::PriceZero);
			ensure!(amount > 0, Error::<T>::AmountZero);
			ensure!(<pallet_carbon_assets::Module<T>>::has_asset(&asset_id), Error::<T>::AssetNotExist);

			let order_id = T::Hashing::hash_of(&(b"order", &maker, asset_id, money_id, price, amount, direction, salt));
			ensure!(!<Orders<T>>::contains_key(order_id), Error::<T>::DuplicatedKey);

			let pot_account = Self::pot_account_id();
			let mut locked_balance: u64 = 0;

			if direction == Direction::ASK as u8 {
				let asset_balance = <pallet_carbon_assets::Module<T>>::balance(&asset_id, &maker);
				ensure!(asset_balance >= amount, Error::<T>::InsuffientAsset);

				<pallet_carbon_assets::Module<T>>::make_transfer(&asset_id, &maker, &pot_account, amount)?;
			} else if direction == Direction::BID as u8 {
				locked_balance = amount / price;
				<pallet_balances::Module<T>>::transfer(
					origin,
					<T::Lookup as StaticLookup>::unlookup(pot_account),
					locked_balance.saturated_into(),
				)?;
			} else {
				return Err(Error::<T>::InvalidDirection)?;
			}

			let order = Order {
				asset_id,
				money_id,
				price,
				amount,
				direction,
				maker: maker.clone(),
				left_amount: amount,
				locked_balance,
				salt,
			};
			<Orders<T>>::insert(order_id, order);

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::NewOrder(order_id, maker, asset_id, money_id, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn take_order(origin, order_id: T::Hash, amount: u64) -> dispatch::DispatchResult {
			let taker = ensure_signed(origin.clone())?;

			let mut order = Self::get_order(order_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(order.left_amount >= amount, Error::<T>::AmountHigh);

			let asset_id = order.asset_id;
			let money_id = order.money_id;
			let price = order.price;
			let direction = order.direction;
			let maker = order.maker.clone();

			let money_amount = amount / price;
			let pot_account = Self::pot_account_id();
			if direction == Direction::ASK as u8 {
				let pot_asset_balance = <pallet_carbon_assets::Module<T>>::balance(&asset_id, &pot_account);
				ensure!(pot_asset_balance >= amount, Error::<T>::InsuffientPotAsset);

				<pallet_balances::Module<T>>::transfer(
					origin,
					<T::Lookup as StaticLookup>::unlookup(maker.clone()),
					money_amount.saturated_into(),
				)?;
				<pallet_carbon_assets::Module<T>>::make_transfer(&asset_id, &pot_account, &taker, amount)?;
			} else {
				 // order.direction == Direction::BID as u8
				 let asset_balance = <pallet_carbon_assets::Module<T>>::balance(&asset_id, &taker);
				 ensure!(asset_balance >= amount, Error::<T>::InsuffientAsset);

				 <pallet_carbon_assets::Module<T>>::make_transfer(&asset_id, &taker, &maker, amount)?;
				 <pallet_balances::Module<T>>::transfer(
					T::Origin::from(Some(pot_account.clone()).into()),
					<T::Lookup as StaticLookup>::unlookup(taker.clone()),
					money_amount.saturated_into(),
				)?;
				order.locked_balance -= money_amount;
			}
			// let money_amount = price * amount;
			// let money_balance = <pallet_standard_assets::Module<T>>::balance(order.money_id, taker.clone());
			// ensure!(money_balance >= money_amount, Error::<T>::InsuffientMoney);

			// let maker = order.maker.clone();
			// <pallet_standard_assets::Module<T>>::make_transfer(&order.money_id, &taker, &maker, amount)?;
			// <pallet_carbon_assets::Module<T>>::make_transfer(&order.asset_id, &maker, &taker, amount)?;

			order.left_amount -= amount;

			if order.left_amount > 0 {
				<Orders<T>>::insert(order_id, order);
			} else {
				<Orders<T>>::remove(order_id);
				Self::deposit_event(RawEvent::OrderFinished(order_id));
			}

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::NewDeal(order_id, asset_id, money_id, maker, taker, price, amount, direction, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn cancel_order(origin, order_id: T::Hash) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let order = Self::get_order(order_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(order.maker == sender, Error::<T>::PermissionDenied);

			let pot_account = Self::pot_account_id();
			if order.direction == Direction::ASK as u8 {
				<pallet_carbon_assets::Module<T>>::make_transfer(&order.asset_id, &pot_account, &sender, order.left_amount)?;
			} else {
				// order.direction == Direction::BID as u8
				<pallet_balances::Module<T>>::transfer(
					T::Origin::from(Some(pot_account).into()),
					<T::Lookup as StaticLookup>::unlookup(sender),
					order.locked_balance.saturated_into(),
				)?;
			}
			<Orders<T>>::remove(order_id);

			Self::deposit_event(RawEvent::OrderCanceled(order_id));
			Ok(())
		}
	}
}

impl<T: Trait> Module<T> {
	/// The account ID of the exchange pot.
	pub fn pot_account_id() -> T::AccountId {
		PALLET_ID.into_account()
	}
}
