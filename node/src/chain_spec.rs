use eco2_runtime::{
	AccountId, AuraConfig, Balance, BalancesConfig, CarbonMembershipConfig, GenesisConfig,
	GrandpaConfig, Signature, SudoConfig, SystemConfig, WASM_BINARY, SessionKeys,
	AuthorityDiscoveryConfig,DemocracyConfig,ImOnlineConfig, IndicesConfig, SessionConfig,StakingConfig, StakerStatus
};
use sc_service::ChainType;
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use pallet_im_online::ed25519::AuthorityId as ImOnlineId;
use sp_authority_discovery::AuthorityId as AuthorityDiscoveryId;
use sp_core::{sr25519, Pair, Public};
use sp_finality_grandpa::AuthorityId as GrandpaId;
use sp_runtime::traits::{IdentifyAccount, Verify};
use sp_runtime::Perbill;

// The URL for the telemetry server.
// const STAGING_TELEMETRY_URL: &str = "wss://telemetry.polkadot.io/submit/";
const COIN: Balance = 100_000_000; 
const STASH: Balance = 1000 * COIN;
const DEFAULT_PROTOCOL_ID: &str = "eco2";

/// Specialized `ChainSpec`. This is a specialization of the general Substrate ChainSpec type.
pub type ChainSpec = sc_service::GenericChainSpec<GenesisConfig>;

/// Generate a crypto pair from seed.
pub fn get_from_seed<TPublic: Public>(seed: &str) -> <TPublic::Pair as Pair>::Public {
	TPublic::Pair::from_string(&format!("//{}", seed), None)
		.expect("static values are valid; qed")
		.public()
}

type AccountPublic = <Signature as Verify>::Signer;

/// Generate an account ID from seed.
pub fn get_account_id_from_seed<TPublic: Public>(seed: &str) -> AccountId
where
	AccountPublic: From<<TPublic::Pair as Pair>::Public>,
{
	AccountPublic::from(get_from_seed::<TPublic>(seed)).into_account()
}

/// Generate an Aura authority key.
pub fn authority_keys_from_seed(seed: &str) -> (
	AccountId,
	AccountId,
	GrandpaId,
	AuraId,
	ImOnlineId,
	AuthorityDiscoveryId,
) {
	(
		get_account_id_from_seed::<sr25519::Public>(&format!("{}//stash", seed)),
		get_account_id_from_seed::<sr25519::Public>(seed),
		get_from_seed::<GrandpaId>(seed),
		get_from_seed::<AuraId>(seed),
		get_from_seed::<ImOnlineId>(seed),
		get_from_seed::<AuthorityDiscoveryId>(seed),
	)
}

pub fn development_config() -> Result<ChainSpec, String> {
	let wasm_binary = WASM_BINARY.ok_or("Development wasm binary not available".to_string())?;

	Ok(ChainSpec::from_genesis(
		// Name
		"Development",
		// ID
		"dev",
		ChainType::Development,
		move || {
			testnet_genesis(
				wasm_binary,
				// Initial PoA authorities
				vec![authority_keys_from_seed("Alice")],
				// Sudo account
				get_account_id_from_seed::<sr25519::Public>("Alice"),
				// Pre-funded accounts
				vec![
					(get_account_id_from_seed::<sr25519::Public>("Alice"), 999997000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Bob"), 1000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Charlie"), 1000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Dave"), 1000 * COIN),
				],
			)
		},
		// Bootnodes
		vec![],
		// Telemetry
		None,
		// Protocol ID
		None,
		// Properties
		None,
		// Extensions
		None,
	))
}

pub fn local_testnet_config() -> Result<ChainSpec, String> {
	let wasm_binary = WASM_BINARY.ok_or("Development wasm binary not available".to_string())?;
	let data = r#"
	{
		"ss58Format": 42,
		"tokenDecimals": 8,
		"tokenSymbol": "ECO2"
	}"#;
	let properties = serde_json::from_str(data).unwrap();

	Ok(ChainSpec::from_genesis(
		// Name
		"ECO2 Local Testnet",
		// ID
		"local_testnet",
		ChainType::Local,
		move || {
			testnet_genesis(
				wasm_binary,
				// Initial PoA authorities
				vec![authority_keys_from_seed("Alice"), authority_keys_from_seed("Bob")],
				// Sudo account
				get_account_id_from_seed::<sr25519::Public>("Alice"),
				// Pre-funded accounts
				vec![
					(get_account_id_from_seed::<sr25519::Public>("Alice"), 999997000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Alice//stash"), 1000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Bob"), 1000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Bob//stash"), 1000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Charlie"), 1000 * COIN),
					(get_account_id_from_seed::<sr25519::Public>("Dave"), 1000 * COIN),
				],
			)
		},
		// Bootnodes
		vec![],
		// Telemetry
		None,
		// Protocol ID
		Some(DEFAULT_PROTOCOL_ID),
		// Properties
		Some(properties),
		// Extensions
		None,
	))
}

fn session_keys(
	grandpa: GrandpaId,
	aura: AuraId,
	im_online: ImOnlineId,
	authority_discovery: AuthorityDiscoveryId,
) -> SessionKeys {
	SessionKeys {
		grandpa,
		aura,
		im_online,
		authority_discovery,
	}
}

/// Configure initial storage state for FRAME modules.
fn testnet_genesis(
	wasm_binary: &[u8],
	initial_authorities: Vec<(AccountId, AccountId, GrandpaId, AuraId, ImOnlineId, AuthorityDiscoveryId)>,
	root_key: AccountId,
	endowed_accounts: Vec<(AccountId, Balance)>,
) -> GenesisConfig {
	GenesisConfig {
		frame_system: Some(SystemConfig {
			// Add Wasm runtime to storage.
			code: wasm_binary.to_vec(),
			changes_trie_config: Default::default(),
		}),
		pallet_balances: Some(BalancesConfig {
			balances: endowed_accounts
				.iter()
				.cloned()
				.map(|k| (k.0.clone(), k.1))
				.collect(),
		}),
		pallet_aura: Default::default(),
		pallet_grandpa: Default::default(),
		pallet_sudo: Some(SudoConfig {
			// Assign network admin rights.
			key: root_key,
		}),
		pallet_collective_Instance1: Some(Default::default()),
		pallet_membership_Instance1: Some(CarbonMembershipConfig {
			members: endowed_accounts[1..4].iter().map(|x| x.0.clone()).collect(),
			phantom: Default::default(),
		}),
		pallet_collective_Instance2: Some(Default::default()),
		pallet_indices: Some(IndicesConfig { indices: vec![] }),
		pallet_session: Some(SessionConfig {
			keys: initial_authorities
				.iter()
				.map(|x| {
					(
						x.0.clone(),
						x.0.clone(),
						session_keys(x.2.clone(), x.3.clone(), x.4.clone(), x.5.clone()),
					)
				})
				.collect::<Vec<_>>(),
		}),
		pallet_staking: Some(StakingConfig {
			validator_count: 20,
			minimum_validator_count: initial_authorities.len() as u32,
			stakers: initial_authorities
				.iter()
				.map(|x| (x.0.clone(), x.1.clone(), STASH, StakerStatus::Validator))
				.collect(),
			invulnerables: initial_authorities.iter().map(|x| x.0.clone()).collect(),
			slash_reward_fraction: Perbill::from_percent(10),
			..Default::default()
		}),
		pallet_democracy: Some(DemocracyConfig::default()),
		pallet_im_online: Some(ImOnlineConfig { keys: vec![] }),
		pallet_authority_discovery: Some(AuthorityDiscoveryConfig { keys: vec![] }),
		pallet_treasury: Some(Default::default()),
		pallet_elections_phragmen: Some(Default::default()),
	}
}
