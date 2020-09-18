#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
	decl_error, decl_event, decl_module, decl_storage, dispatch, ensure, traits::Get,
};
use frame_system::ensure_signed;
use sp_runtime::{traits::Hash, RuntimeDebug};
use sp_std::prelude::*;

type MoneyIdOf<T> = <T as pallet_standard_assets::Trait>::AssetId;

// #[cfg(test)]
// mod mock;

// #[cfg(test)]
// mod tests;

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct Order<AccountId, Hash, MoneyId> {
	pub asset_id: Hash,
	pub money_id: MoneyId,
	pub maker: AccountId,
	pub status: u8,
	pub amount: u64,
	pub price: u64,
	pub left_amount: u64,
	pub direction: u8,
}

type OrderOf<T> =
	Order<<T as frame_system::Trait>::AccountId, <T as frame_system::Trait>::Hash, MoneyIdOf<T>>;

pub trait Trait:
	frame_system::Trait + pallet_carbon_assets::Trait + pallet_standard_assets::Trait
{
	type Event: From<Event<Self>> + Into<<Self as frame_system::Trait>::Event>;
}

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
	{
		NewOrder(Hash, AccountId),
		NewDeal(Hash, AccountId, u64, u64),
		OrderCanceled(Hash),
	}
);

decl_error! {
	pub enum Error for Module<T: Trait> {
		InvalidIndex,
		StorageOverflow,
		InsuffientMoney,
		AmountHigh,
		PermissionDenied,
	}
}

decl_module! {
	pub struct Module<T: Trait> for enum Call where origin: T::Origin {
		type Error = Error<T>;

		fn deposit_event() = default;

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn make_order(origin, asset_id: T::Hash, money_id: MoneyIdOf<T>, price: u64, amount: u64, direction: u8) -> dispatch::DispatchResult {
			let maker = ensure_signed(origin)?;

			let order = Order {
				asset_id,
				money_id,
				price,
				amount,
				direction,
				maker: maker.clone(),
				left_amount: amount,
				status: 0,
			};
			let order_id = T::Hashing::hash_of(&order);
			<Orders<T>>::insert(order_id, order);
			Self::deposit_event(RawEvent::NewOrder(order_id, maker));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn take_order(origin, order_id: T::Hash, amount: u64) -> dispatch::DispatchResult {
			let taker = ensure_signed(origin)?;

			 let mut order = Self::get_order(order_id).ok_or(Error::<T>::InvalidIndex)?;
			 ensure!(order.left_amount >= amount, Error::<T>::AmountHigh);

			 let price = order.price;
			let money_amount = price * amount;
			let money_balance = <pallet_standard_assets::Module<T>>::balance(order.money_id, taker.clone());
			ensure!(money_balance >= money_amount, Error::<T>::InsuffientMoney);

			 let maker = order.maker.clone();
			<pallet_standard_assets::Module<T>>::make_transfer(&order.money_id, &taker, &maker, amount);
			<pallet_carbon_assets::Module<T>>::make_transfer(&order.asset_id, &maker, &taker, amount);

			order.left_amount -= amount;

			if order.left_amount > 0 {
				<Orders<T>>::insert(order_id, order);
			} else {
				<Orders<T>>::remove(order_id);
			}

			Self::deposit_event(RawEvent::NewDeal(order_id, taker, price, amount));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn cancel_order(origin, order_id: T::Hash) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let mut order = Self::get_order(order_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(order.maker == sender, Error::<T>::PermissionDenied);
			<Orders<T>>::remove(order_id);

			Self::deposit_event(RawEvent::OrderCanceled(order_id));
			Ok(())
		}
	}
}
