#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{decl_error, decl_event, decl_module, decl_storage, ensure};
use frame_system::ensure_signed;
use sp_runtime::DispatchResult;
use sp_runtime::{traits::Hash, RuntimeDebug};
use sp_std::prelude::*;

/// The module configuration trait.
pub trait Trait: frame_system::Trait {
	/// The overarching event type.
	type Event: From<Event<Self>> + Into<<Self as frame_system::Trait>::Event>;
}

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct ECRC10 {
	pub symbol: Vec<u8>,
	pub name: Vec<u8>,
	pub decimals: u8,
	pub max_supply: u64,
}

decl_event! {
	pub enum Event<T> where
		<T as frame_system::Trait>::Hash,
		<T as frame_system::Trait>::AccountId,
	{
		/// Some assets were issued. \[asset_id, owner, symbol, first_supply\]
		NewAsset(Hash, Vec<u8>, AccountId, u64),
		/// Some assets were transferred. \[asset_id, from, to, amount\]
		Transferred(Hash, AccountId, AccountId, u64),
		/// Some assets were minted. \[asset_id, owner, amount\]
		Minted(Hash,AccountId, u64),
		/// Some assets were destroyed. \[asset_id, owner, amount\]
		Burned(Hash, AccountId, u64),
	}
}

decl_error! {
	pub enum Error for Module<T: Trait> {
		/// Transfer amount should be non-zero
		AmountZero,
		/// Account balance must be greater than or equal to the transfer amount
		BalanceLow,
		/// Balance should be non-zero
		BalanceZero,
	}
}

decl_storage! {
	trait Store for Module<T: Trait> as StandardAssets {
		AssetInfos: map hasher(identity) T::Hash => Option<ECRC10>;
		/// The number of units of assets held by any given account.
		Balances: map hasher(blake2_128_concat) (T::Hash, T::AccountId) => u64;
		/// The total unit supply of an asset.
		///
		/// TWOX-NOTE: `AssetId` is trusted, so this is safe.
		TotalSupply: map hasher(twox_64_concat) T::Hash => u64;
	}
}

decl_module! {
	pub struct Module<T: Trait> for enum Call where origin: T::Origin {
		type Error = Error<T>;

		fn deposit_event() = default;
		/// Issue a new class of fungible assets. There are, and will only ever be, `total`
		/// such assets and they'll all belong to the `origin` initially. It will have an
		/// identifier `AssetId` instance: this will be specified in the `Issued` event.
		///
		/// # <weight>
		/// - `O(1)`
		/// - 1 storage mutation (codec `O(1)`).
		/// - 2 storage writes (condec `O(1)`).
		/// - 1 event.
		/// # </weight>
		#[weight = 0]
		fn issue(origin, symbol: Vec<u8>, name: Vec<u8>, decimals: u8,  max_supply: u64, first_supply: u64) {
			let origin = ensure_signed(origin)?;

			let asset_info = ECRC10 {
				symbol: symbol.clone(),
				name,
				decimals,
				max_supply,
			};
			let asset_id = T::Hashing::hash_of(&asset_info);
			<AssetInfos<T>>::insert(asset_id, asset_info);
			<Balances<T>>::insert((asset_id, &origin), first_supply);
			<TotalSupply<T>>::insert(asset_id, first_supply);

			Self::deposit_event(RawEvent::NewAsset(asset_id, symbol, origin, first_supply));
		}

		/// Move some assets from one holder to another.
		///
		/// # <weight>
		/// - `O(1)`
		/// - 1 static lookup
		/// - 2 storage mutations (codec `O(1)`).
		/// - 1 event.
		/// # </weight>
		#[weight = 0]
		fn transfer(origin,	id: T::Hash, target: T::AccountId,  amount: u64) {
			let origin = ensure_signed(origin)?;
			let origin_account = (id, origin.clone());
			let origin_balance = <Balances<T>>::get(&origin_account);
			ensure!(amount != 0, Error::<T>::AmountZero);
			ensure!(origin_balance >= amount, Error::<T>::BalanceLow);

			Self::deposit_event(RawEvent::Transferred(id, origin, target.clone(), amount));
			<Balances<T>>::insert(origin_account, origin_balance - amount);
			<Balances<T>>::mutate((id, target), |balance| *balance += amount);
		}

		/// Mint any assets of `id` owned by `origin`.
		///
		/// # <weight>
		/// - `O(1)`
		/// - 1 storage mutation (codec `O(1)`).
		/// - 1 storage deletion (codec `O(1)`).
		/// - 1 event.
		/// # </weight>
		#[weight = 0]
		fn mint(origin, id: T::Hash, amount: u64) {
			let origin = ensure_signed(origin)?;

			let origin_account = (id, origin.clone());
			<Balances<T>>::mutate(origin_account, |balance| *balance += amount);
			<TotalSupply<T>>::mutate(id, |total_supply| *total_supply += amount);
			Self::deposit_event(RawEvent::Minted(id, origin, amount));
		}

		/// Burn any assets of `id` owned by `origin`.
		///
		/// # <weight>
		/// - `O(1)`
		/// - 1 storage mutation (codec `O(1)`).
		/// - 1 storage deletion (codec `O(1)`).
		/// - 1 event.
		/// # </weight>
		#[weight = 0]
		fn burn(origin, id: T::Hash, amount: u64) {
			let origin = ensure_signed(origin)?;

			let origin_account = (id, origin.clone());
			let origin_balance = <Balances<T>>::get(&origin_account);
			ensure!(origin_balance >= amount, Error::<T>::BalanceLow);
			<Balances<T>>::insert(origin_account, origin_balance - amount);
			<TotalSupply<T>>::mutate(id, |total_supply| *total_supply -= amount);
			Self::deposit_event(RawEvent::Burned(id, origin, amount));
		}
	}
}

// The main implementation block for the module.
impl<T: Trait> Module<T> {
	// Public immutables

	/// Get the asset `id` balance of `who`.
	pub fn balance(id: T::Hash, who: T::AccountId) -> u64 {
		<Balances<T>>::get((id, who))
	}

	/// Get the total supply of an asset `id`.
	pub fn total_supply(id: T::Hash) -> u64 {
		<TotalSupply<T>>::get(id)
	}

	pub fn make_transfer(
		asset_id: &T::Hash,
		from: &T::AccountId,
		to: &T::AccountId,
		amount: u64,
	) -> DispatchResult {
		if from != to {
			<Balances<T>>::mutate((asset_id, from), |balance| *balance -= amount);
			<Balances<T>>::mutate((asset_id, to), |balance| *balance += amount);
		}

		Ok(())
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	use frame_support::{
		assert_noop, assert_ok, impl_outer_origin, parameter_types, weights::Weight,
	};
	use sp_core::H256;
	use sp_runtime::{
		testing::Header,
		traits::{BlakeTwo256, IdentityLookup},
		Perbill,
	};

	impl_outer_origin! {
		pub enum Origin for Test where system = frame_system {}
	}

	#[derive(Clone, Eq, PartialEq)]
	pub struct Test;
	parameter_types! {
		pub const BlockHashCount: u64 = 250;
		pub const MaximumBlockWeight: Weight = 1024;
		pub const MaximumBlockLength: u32 = 2 * 1024;
		pub const AvailableBlockRatio: Perbill = Perbill::one();
	}
	impl frame_system::Trait for Test {
		type BaseCallFilter = ();
		type Origin = Origin;
		type Index = u64;
		type Call = ();
		type BlockNumber = u64;
		type Hash = H256;
		type Hashing = BlakeTwo256;
		type AccountId = u64;
		type Lookup = IdentityLookup<Self::AccountId>;
		type Header = Header;
		type Event = ();
		type BlockHashCount = BlockHashCount;
		type MaximumBlockWeight = MaximumBlockWeight;
		type DbWeight = ();
		type BlockExecutionWeight = ();
		type ExtrinsicBaseWeight = ();
		type MaximumExtrinsicWeight = MaximumBlockWeight;
		type AvailableBlockRatio = AvailableBlockRatio;
		type MaximumBlockLength = MaximumBlockLength;
		type Version = ();
		type ModuleToIndex = ();
		type AccountData = ();
		type OnNewAccount = ();
		type OnKilledAccount = ();
		type SystemWeightInfo = ();
	}
	impl Trait for Test {
		type Event = ();
		type AssetId = u32;
	}
	type Assets = Module<Test>;

	fn new_test_ext() -> sp_io::TestExternalities {
		frame_system::GenesisConfig::default()
			.build_storage::<Test>()
			.unwrap()
			.into()
	}

	#[test]
	fn issuing_asset_units_to_issuer_should_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
		});
	}

	#[test]
	fn querying_total_supply_should_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
			assert_ok!(Assets::transfer(Origin::signed(1), 0, 2, 50));
			assert_eq!(Assets::balance(0, 1), 50);
			assert_eq!(Assets::balance(0, 2), 50);
			assert_ok!(Assets::transfer(Origin::signed(2), 0, 3, 31));
			assert_eq!(Assets::balance(0, 1), 50);
			assert_eq!(Assets::balance(0, 2), 19);
			assert_eq!(Assets::balance(0, 3), 31);
			assert_ok!(Assets::destroy(Origin::signed(3), 0));
			assert_eq!(Assets::total_supply(0), 69);
		});
	}

	#[test]
	fn transferring_amount_above_available_balance_should_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
			assert_ok!(Assets::transfer(Origin::signed(1), 0, 2, 50));
			assert_eq!(Assets::balance(0, 1), 50);
			assert_eq!(Assets::balance(0, 2), 50);
		});
	}

	#[test]
	fn transferring_amount_more_than_available_balance_should_not_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
			assert_ok!(Assets::transfer(Origin::signed(1), 0, 2, 50));
			assert_eq!(Assets::balance(0, 1), 50);
			assert_eq!(Assets::balance(0, 2), 50);
			assert_ok!(Assets::destroy(Origin::signed(1), 0));
			assert_eq!(Assets::balance(0, 1), 0);
			assert_noop!(
				Assets::transfer(Origin::signed(1), 0, 1, 50),
				Error::<Test>::BalanceLow
			);
		});
	}

	#[test]
	fn transferring_less_than_one_unit_should_not_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
			assert_noop!(
				Assets::transfer(Origin::signed(1), 0, 2, 0),
				Error::<Test>::AmountZero
			);
		});
	}

	#[test]
	fn transferring_more_units_than_total_supply_should_not_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
			assert_noop!(
				Assets::transfer(Origin::signed(1), 0, 2, 101),
				Error::<Test>::BalanceLow
			);
		});
	}

	#[test]
	fn destroying_asset_balance_with_positive_balance_should_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 1), 100);
			assert_ok!(Assets::destroy(Origin::signed(1), 0));
		});
	}

	#[test]
	fn destroying_asset_balance_with_zero_balance_should_not_work() {
		new_test_ext().execute_with(|| {
			assert_ok!(Assets::issue(Origin::signed(1), 100));
			assert_eq!(Assets::balance(0, 2), 0);
			assert_noop!(
				Assets::destroy(Origin::signed(2), 0),
				Error::<Test>::BalanceZero
			);
		});
	}
}
