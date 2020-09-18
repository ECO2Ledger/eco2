#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{decl_error, decl_event, decl_module, decl_storage, dispatch, traits::Get};
use frame_system::ensure_signed;
use sp_runtime::{traits::Hash, DispatchResult, RuntimeDebug};
use sp_std::prelude::*;

// #[cfg(test)]
// mod mock;

// #[cfg(test)]
// mod tests;

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct Project<AccountId> {
	pub name: Vec<u8>,
	pub max_supply: u64,
	pub total_supply: u64,
	pub status: u8,
	pub owner: AccountId,
	pub additional: Vec<u8>,
}

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct Asset<Hash> {
	pub project_id: Hash,
	pub symbol: Vec<u8>,
	pub initial_supply: u64,
	pub total_supply: u64,
	pub status: u8,
	pub additional: Vec<u8>,
}

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct IssueInfo<Hash> {
	pub asset_id: Hash,
	pub amount: u64,
	pub status: u8,
	pub additional: Vec<u8>,
}

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct BurnInfo<Hash> {
	pub asset_id: Hash,
	pub amount: u64,
	pub status: u8,
	pub additional: Vec<u8>,
}

pub trait Trait: frame_system::Trait {
	type Event: From<Event<Self>> + Into<<Self as frame_system::Trait>::Event>;
}

decl_storage! {
	trait Store for Module<T: Trait> as CarbonAssets {
		// pub Issuers get(fn issuers): map hasher(blake2_128_concat) T::AccountId => Issuer;
		pub Projects get(fn get_project) : map hasher(identity) T::Hash=> Option<Project<T::AccountId>>;
		pub Assets get(fn get_asset): map hasher(identity) T::Hash =>  Option<Asset< T::Hash>>;
		pub Issues get(fn get_issue): map hasher(identity) T::Hash =>  Option<IssueInfo<T::Hash>>;
		pub Burns get(fn get_burn): map hasher(identity) T::Hash =>  Option<BurnInfo<T::Hash>>;
		pub Balances get(fn get_balance): map hasher(blake2_128_concat) (T::Hash, T::AccountId) => u64;
	}
}

decl_event!(
	pub enum Event<T>
	where
		AccountId = <T as frame_system::Trait>::AccountId,
		Hash = <T as frame_system::Trait>::Hash,
	{
		ProjectSubmited(Hash, AccountId, Vec<u8>),
		ProjectApproved(Hash),
		AssetSubmited(Hash, AccountId, Vec<u8>),
		AssetApproved(Hash),
		IssueSubmited(Hash, Hash, AccountId, u64),
		IssueApproved(Hash),
		BurnSubmited(Hash, Hash, AccountId, u64),
		BurnApproved(Hash),
		Transferred(Hash, AccountId, AccountId, u64),
	}
);

decl_error! {
	pub enum Error for Module<T: Trait> {
		InvalidIndex,
		StorageOverflow,
	}
}

decl_module! {
	pub struct Module<T: Trait> for enum Call where origin: T::Origin {
		type Error = Error<T>;

		fn deposit_event() = default;

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_project(origin, name: Vec<u8>, max_supply: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let project = Project {
				name: name.clone(),
				max_supply,
				total_supply: 0,
				status: 0,
				owner: sender.clone(),
				additional,
			};
			let project_id = T::Hashing::hash_of(&project);
			<Projects<T>>::insert(project_id, project);

			Self::deposit_event(RawEvent::ProjectSubmited(project_id, sender, name));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_project(origin, project_id: T::Hash) -> dispatch::DispatchResult {
			let _ = ensure_signed(origin)?;

			let mut project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;
			project.status = 1;
			<Projects<T>>::insert(project_id, &project);

			Self::deposit_event(RawEvent::ProjectApproved(project_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_asset(origin, project_id: T::Hash, symbol: Vec<u8>, initial_supply: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let asset = Asset {
				project_id,
				symbol: symbol.clone(),
				initial_supply,
				total_supply: 0,
				status: 0,
				additional,
			};
			let asset_id = T::Hashing::hash_of(&asset);
			<Assets<T>>::insert(asset_id, asset);

			Self::deposit_event(RawEvent::AssetSubmited(asset_id, sender, symbol));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_asset(origin, asset_id: T::Hash) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let mut asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;
			asset.status = 1;
			asset.total_supply = asset.initial_supply;

			let mut project = Self::get_project(asset.project_id).ok_or(Error::<T>::InvalidIndex)?;
			project.total_supply += asset.initial_supply;

			<Assets<T>>::insert(asset_id, &asset);

			<Balances<T>>::insert((asset_id, sender), asset.initial_supply);

			Self::deposit_event(RawEvent::AssetApproved(asset_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_issue(origin, asset_id: T::Hash, amount: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let issue_info = IssueInfo {
				asset_id,
				amount,
				status: 0,
				additional,
			};
			let issue_id = T::Hashing::hash_of(&issue_info);
			<Issues<T>>::insert(issue_id, issue_info);

			Self::deposit_event(RawEvent::IssueSubmited(issue_id, asset_id, sender, amount));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_issue(origin, issue_id: T::Hash) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let mut issue_info = Self::get_issue(issue_id).ok_or(Error::<T>::InvalidIndex)?;
			issue_info.status = 1;

			let asset_id = issue_info.asset_id;
			let mut asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;

			let project_id = asset.project_id;
			let mut project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;

			// TODO(check project total_supply <= max_supply)
			project.total_supply += issue_info.amount;
			asset.total_supply += issue_info.amount;

			<Assets<T>>::insert(asset_id, &asset);
			<Projects<T>>::insert(project_id, &project);
			<Issues<T>>::insert(issue_id, &issue_info);

			<Balances<T>>::mutate((asset_id, sender), |balance| *balance += issue_info.amount);

			Self::deposit_event(RawEvent::IssueApproved(issue_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_burn(origin, asset_id: T::Hash, amount: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let burn_info = BurnInfo {
				asset_id,
				amount,
				status: 0,
				additional,
			};
			let burn_id = T::Hashing::hash_of(&burn_info);
			<Burns<T>>::insert(burn_id, burn_info);

			Self::deposit_event(RawEvent::BurnSubmited(burn_id, asset_id, sender, amount));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_burn(origin, burn_id: T::Hash) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let mut burn_info = Self::get_burn(burn_id).ok_or(Error::<T>::InvalidIndex)?;
			burn_info.status = 1;

			let asset_id = burn_info.asset_id;
			let mut asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;

			let project_id = asset.project_id;
			let mut project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;

			project.total_supply -= burn_info.amount;
			asset.total_supply -= burn_info.amount;

			<Assets<T>>::insert(asset_id, &asset);
			<Projects<T>>::insert(project_id, &project);
			<Burns<T>>::insert(burn_id, &burn_info);
			<Balances<T>>::mutate((asset_id, sender), |balance| *balance -= burn_info.amount);

			Self::deposit_event(RawEvent::IssueApproved(burn_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn transfer(origin, asset_id: T::Hash, to: T::AccountId, amount: u64) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			Self::make_transfer(&asset_id, &sender, &to, amount);

			Self::deposit_event(RawEvent::Transferred(asset_id, sender, to, amount));

			Ok(())
		}
	}
}

impl<T: Trait> Module<T> {
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
