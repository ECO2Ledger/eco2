#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
	decl_error, decl_event, decl_module, decl_storage, dispatch, ensure,
	traits::{EnsureOrigin, Get},
};
use frame_system::ensure_signed;
use sp_runtime::{traits::Hash, DispatchResult, RuntimeDebug};
use sp_std::prelude::*;

// #[cfg(test)]
// mod mock;

// #[cfg(test)]
// mod tests;

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct CarbonProject<AccountId> {
	pub symbol: Vec<u8>,
	pub max_supply: u64,
	pub total_supply: u64,
	pub status: u8,
	pub owner: AccountId,
}

#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug)]
pub struct CarbonAsset<Hash> {
	pub project_id: Hash,
	pub vintage: Vec<u8>,
	pub initial_supply: u64,
	pub total_supply: u64,
	pub status: u8,
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

pub trait Trait: frame_system::Trait + pallet_timestamp::Trait {
	type Event: From<Event<Self>> + Into<<Self as frame_system::Trait>::Event>;
	type ApproveOrigin: EnsureOrigin<Self::Origin>;
}

decl_storage! {
	trait Store for Module<T: Trait> as CarbonAssets {
		pub ProjectAdditionals: map hasher(identity) T::Hash => Vec<u8>;
		pub Projects get(fn get_project) : map hasher(identity) T::Hash => Option<CarbonProject<T::AccountId>>;
		pub AssetAdditionals: map hasher(identity) T::Hash => Vec<u8>;
		pub Assets get(fn get_asset): map hasher(identity) T::Hash =>  Option<CarbonAsset< T::Hash>>;
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
		Moment = <T as pallet_timestamp::Trait>::Moment,
	{
		/// Some project was submitted. \[project_id, owner, symbol, timestamp\]
		ProjectSubmited(Hash, AccountId, Vec<u8>, Moment),
		/// The project was approved. \[project_id\]
		ProjectApproved(Hash),
		/// Some assets was submitted. \[project_id, asset_id, symbol, vintage, owner, timestamp\]
		AssetSubmited(Hash, Hash, Vec<u8>, Vec<u8>, AccountId, Moment),
		/// The asset was approved. \[asset_id\]
		AssetApproved(Hash),
		/// Asset issue was submitted. \[issue_id, asset_id, owner, amount, timestamp\]
		IssueSubmited(Hash, Hash, AccountId, u64, Moment),
		/// Asset issue was approved. \[issue_id\]
		IssueApproved(Hash),
		/// Asset burn was submitted. \[burn_id, asset_id, owner, amount, timestamp\]
		BurnSubmited(Hash, Hash, AccountId, u64, Moment),
		/// Asset burn was approved. \[burn_id\]
		BurnApproved(Hash),
		/// Some assets were transferred. \[asset_id, from, to, amount, timestamp]\
		Transferred(Hash, AccountId, AccountId, u64, Moment),
		/// Carbon neutralization. \[asset_id, owner, amount,  timestamp]\
		Neutralized(Hash, AccountId, u64, Moment),
	}
);

decl_error! {
	pub enum Error for Module<T: Trait> {
		InvalidIndex,
		StorageOverflow,
		DuplicatedKey,
		AlreadyApproved,
		ProjectNotApproved,
		PermissionDenied,
		OverIssueLimit,
		AssetNotApproved,
		AmountZero,
		BalanceLow,
	}
}

decl_module! {
	pub struct Module<T: Trait> for enum Call where origin: T::Origin {
		type Error = Error<T>;

		fn deposit_event() = default;

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_project(origin, symbol: Vec<u8>, max_supply: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let project_id = T::Hashing::hash_of(&(b"project", &sender, &symbol, max_supply, &additional));
			ensure!(!<Projects<T>>::contains_key(project_id), Error::<T>::DuplicatedKey);

			let project = CarbonProject {
				symbol: symbol.clone(),
				max_supply,
				total_supply: 0,
				status: 0,
				owner: sender.clone(),
			};
			<Projects<T>>::insert(project_id, project);
			<ProjectAdditionals<T>>::insert(project_id, additional);

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::ProjectSubmited(project_id, sender, symbol, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_project(origin, project_id: T::Hash) -> dispatch::DispatchResult {
			T::ApproveOrigin::ensure_origin(origin)?;

			let mut project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(project.status == 0, Error::<T>::AlreadyApproved);

			project.status = 1;
			<Projects<T>>::insert(project_id, &project);

			Self::deposit_event(RawEvent::ProjectApproved(project_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_asset(origin, project_id: T::Hash, vintage: Vec<u8>, initial_supply: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(project.status == 1, Error::<T>::ProjectNotApproved);
			ensure!(project.owner == sender, Error::<T>::PermissionDenied);
			ensure!(initial_supply + project.total_supply <= project.max_supply, Error::<T>::OverIssueLimit);

			let asset_id = T::Hashing::hash_of(&(b"asset", &sender, project_id, &vintage, initial_supply, &additional));
			ensure!(!<Assets<T>>::contains_key(asset_id), Error::<T>::DuplicatedKey);

			let asset = CarbonAsset {
				project_id,
				vintage: vintage.clone(),
				initial_supply,
				total_supply: 0,
				status: 0,
			};
			<Assets<T>>::insert(asset_id, asset);
			<AssetAdditionals<T>>::insert(asset_id, additional);

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::AssetSubmited(project_id, asset_id, project.symbol, vintage, sender, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_asset(origin, asset_id: T::Hash) -> dispatch::DispatchResult {
			T::ApproveOrigin::ensure_origin(origin)?;

			let mut asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(asset.status == 0, Error::<T>::AlreadyApproved);

			let mut project = Self::get_project(asset.project_id).ok_or(Error::<T>::InvalidIndex)?;
			let owner = project.owner.clone();

			ensure!(asset.initial_supply + project.total_supply <= project.max_supply, Error::<T>::OverIssueLimit);

			asset.status = 1;
			asset.total_supply = asset.initial_supply;

			project.total_supply += asset.initial_supply;

			<Assets<T>>::insert(asset_id, &asset);

			<Balances<T>>::insert((asset_id, owner), asset.initial_supply);

			Self::deposit_event(RawEvent::AssetApproved(asset_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_issue(origin, asset_id: T::Hash, amount: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(asset.status == 1, Error::<T>::AssetNotApproved);

			let project = Self::get_project(asset.project_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(project.owner == sender, Error::<T>::PermissionDenied);
			ensure!(amount + project.total_supply <= project.max_supply, Error::<T>::OverIssueLimit);

			let issue_id = T::Hashing::hash_of(&(b"issue", &sender, asset_id, amount, &additional));
			ensure!(!<Issues<T>>::contains_key(issue_id), Error::<T>::DuplicatedKey);

			let issue_info = IssueInfo {
				asset_id,
				amount,
				status: 0,
				additional,
			};
			<Issues<T>>::insert(issue_id, issue_info);

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::IssueSubmited(issue_id, asset_id, sender, amount, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_issue(origin, issue_id: T::Hash) -> dispatch::DispatchResult {
			T::ApproveOrigin::ensure_origin(origin)?;

			let mut issue_info = Self::get_issue(issue_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(issue_info.status == 0, Error::<T>::AlreadyApproved);

			let asset_id = issue_info.asset_id;
			let mut asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;

			let project_id = asset.project_id;
			let mut project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;
			let owner = project.owner.clone();

			ensure!(issue_info.amount + project.total_supply <= project.max_supply, Error::<T>::OverIssueLimit);

			issue_info.status = 1;

			project.total_supply += issue_info.amount;
			asset.total_supply += issue_info.amount;

			<Assets<T>>::insert(asset_id, &asset);
			<Projects<T>>::insert(project_id, &project);
			<Issues<T>>::insert(issue_id, &issue_info);

			<Balances<T>>::mutate((asset_id, owner), |balance| *balance += issue_info.amount);

			Self::deposit_event(RawEvent::IssueApproved(issue_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn submit_burn(origin, asset_id: T::Hash, amount: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(asset.status == 1, Error::<T>::AssetNotApproved);

			let project = Self::get_project(asset.project_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(project.owner == sender, Error::<T>::PermissionDenied);

			let burn_id = T::Hashing::hash_of(&(b"burn", &sender, asset_id, amount, &additional));
			ensure!(!<Projects<T>>::contains_key(burn_id), Error::<T>::DuplicatedKey);

			let balance = Self::get_balance((asset_id, sender.clone()));
			ensure!(amount <= balance, Error::<T>::BalanceLow);

			let burn_info = BurnInfo {
				asset_id,
				amount,
				status: 0,
				additional,
			};
			<Burns<T>>::insert(burn_id, burn_info);

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::BurnSubmited(burn_id, asset_id, sender, amount, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn approve_burn(origin, burn_id: T::Hash) -> dispatch::DispatchResult {
			T::ApproveOrigin::ensure_origin(origin)?;

			let mut burn_info = Self::get_burn(burn_id).ok_or(Error::<T>::InvalidIndex)?;
			ensure!(burn_info.status == 0, Error::<T>::AlreadyApproved);

			let asset_id = burn_info.asset_id;
			let mut asset = Self::get_asset(asset_id).ok_or(Error::<T>::InvalidIndex)?;

			let project_id = asset.project_id;
			let mut project = Self::get_project(project_id).ok_or(Error::<T>::InvalidIndex)?;
			let owner = project.owner.clone();

			burn_info.status = 1;
			project.total_supply -= burn_info.amount;
			asset.total_supply -= burn_info.amount;

			<Assets<T>>::insert(asset_id, &asset);
			<Projects<T>>::insert(project_id, &project);
			<Burns<T>>::insert(burn_id, &burn_info);
			<Balances<T>>::mutate((asset_id, owner), |balance| *balance -= burn_info.amount);

			Self::deposit_event(RawEvent::IssueApproved(burn_id));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn transfer(origin, asset_id: T::Hash, to: T::AccountId, amount: u64) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let origin_account = (asset_id, sender.clone());
			let origin_balance = <Balances<T>>::get(&origin_account);

			ensure!(amount != 0, Error::<T>::AmountZero);
			ensure!(origin_balance >= amount, Error::<T>::BalanceLow);

			Self::make_transfer(&asset_id, &sender, &to, amount)?;

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::Transferred(asset_id, sender, to, amount, now));

			Ok(())
		}

		#[weight = 10_000 + T::DbWeight::get().writes(1)]
		pub fn neutralize(origin, asset_id: T::Hash, amount: u64, additional: Vec<u8>) -> dispatch::DispatchResult {
			let sender = ensure_signed(origin)?;

			let origin_account = (asset_id, sender.clone());
			let origin_balance = <Balances<T>>::get(&origin_account);

			ensure!(amount != 0, Error::<T>::AmountZero);
			ensure!(origin_balance >= amount, Error::<T>::BalanceLow);

			<Balances<T>>::mutate(origin_account, |balance| *balance -= amount);

			let now = <pallet_timestamp::Module<T>>::get();
			Self::deposit_event(RawEvent::Neutralized(asset_id, sender, amount, now));

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
