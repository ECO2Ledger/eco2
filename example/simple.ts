import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { TypeRegistry, createTypeUnsafe } from '@polkadot/types'
import { KeyringPair } from '@polkadot/keyring/types'
import { cryptoWaitReady } from '@polkadot/util-crypto'

const typeRegistry = new TypeRegistry()

function toUtf8(data: Uint8Array) {
    return Buffer.from(data).toString('utf8')
}

async function submitTx(label: string, tx, sender) {
    const unsub = await tx.signAndSend(sender, (result) => {
        console.log(`==========================${label}==========================`)
        console.log(`Current status is ${result.status}`)
        if (result.status.isInBlock) {
            console.log(`Transaction included at blockHash ${result.status.asInBlock}`)
            result.events.forEach(({ event: { data, method, section }, phase }) => {
                console.log('\t', phase.toString(), `: ${section}.${method}`, data.toString());
            });
        } else if (result.status.isFinalized) {
            console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`)
            unsub()
        }
    })
}

async function queryBalance(api: ApiPromise, address: string) {
    const account = await api.query.system.account(address)
    console.log('balance:', address, account.data.free.toString())
}

async function transfer(api: ApiPromise, sender: KeyringPair, to: string, amount: string) {
    await submitTx('transfer', api.tx.balances.transfer(to, amount), sender)
}

async function submitProject(api: ApiPromise, sender: KeyringPair, symbol: string, maxSupply: string, additional: {}) {
    const tx = api.tx['carbonAssets']['submitProject'](symbol, maxSupply, JSON.stringify(additional))
    await submitTx('submitProject', tx, sender)
}

async function queryProject(api: ApiPromise, projectId: string) {
    const project = await api.query['carbonAssets']['projects'](projectId)
    const additionals = await api.query['carbonAssets']['projectAdditionals'](projectId)
    console.log('queryProject:', project.toJSON(), JSON.parse(toUtf8(additionals.toU8a(true))))
}

async function approveProject(api: ApiPromise, sender: KeyringPair, projectId: string) {
    const tx = api.tx['carbonAssets']['approveProject'](projectId)
    await submitTx('approveProject', tx, sender)
}

async function submitAsset(api: ApiPromise, sender: KeyringPair, projectId: string, vintage: string, initialSupply: string, additional: {}) {
    const tx = api.tx['carbonAssets']['submitAsset'](projectId, vintage, initialSupply, JSON.stringify(additional))
    await submitTx('submitAsset', tx, sender)
}

async function approveAsset(api: ApiPromise, sender: KeyringPair, assetId: string) {
    const tx = api.tx['carbonAssets']['approveAsset'](assetId)
    await submitTx('approveAsset', tx, sender)
}

async function queryAsset(api: ApiPromise, assetId: string) {
    const asset = await api.query['carbonAssets']['assets'](assetId)
    const additionals = await api.query['carbonAssets']['assetAdditionals'](assetId)
    console.log('queryAssett:', asset.toJSON(), JSON.parse(toUtf8(additionals.toU8a(true))))
}

async function submitIssue(api: ApiPromise, sender: KeyringPair, assetId: string, amount: string, additional: {}) {
    const tx = api.tx['carbonAssets']['submitIssue'](assetId, amount, JSON.stringify(additional))
    await submitTx('submitIssue', tx, sender)
}

async function approveIssue(api: ApiPromise, sender: KeyringPair, issueId: string) {
    const tx = api.tx['carbonAssets']['approveIssue'](issueId)
    await submitTx('approveIssue', tx, sender)
}

async function submitBurn(api: ApiPromise, sender: KeyringPair, assetId: string, amount: string, additional: {}) {
    const tx = api.tx['carbonAssets']['submitBurn'](assetId, amount, JSON.stringify(additional))
    await submitTx('submitBurn', tx, sender)
}

async function approveBurn(api: ApiPromise, sender: KeyringPair, burnId: string) {
    const tx = api.tx['carbonAssets']['approveBurn'](burnId)
    await submitTx('approveBurn', tx, sender)
}

async function queryCarbonBalance(api: ApiPromise, assetId: string, address: string) {
    const key = createTypeUnsafe(typeRegistry, '(Hash, AccountId)', [[assetId, address]])
    const balance = await api.query['carbonAssets']['balances'](key.toHex())
    console.log(`queryCarbonBalance: (${assetId}, ${address}) => ${balance.toHuman()}`)
}

async function transferCarbonAsset(api: ApiPromise, sender: KeyringPair, assetId: string, to: string, amount: string) {
    const tx = api.tx['carbonAssets']['transfer'](assetId, to, amount)
    await submitTx('transferCarbonAsset', tx, sender)
}

async function issueStandardAsset(api: ApiPromise, sender: KeyringPair, symbol: string, name: string, decimals: number, maxSupply: string, firstSupply: string) {
    const tx = api.tx['standardAssets']['issue'](symbol, name, decimals, maxSupply, firstSupply)
    await submitTx('issueStandardAsset', tx, sender)
}

async function transferStandardAsset(api: ApiPromise, sender: KeyringPair, moneyId: string, to: string, amount: string) {
    const tx = api.tx['standardAssets']['transfer'](moneyId, to, amount)
    await submitTx('transferStandardAsset', tx, sender)
}

async function queryStandardAsset(api: ApiPromise, moneyId: string) {
    const asset = await api.query['standardAssets']['assetInfos'](moneyId)
    console.log('queryStandardBalance:', asset.toJSON())
}

async function queryStandardBalance(api: ApiPromise, moneyId: string, address: string) {
    const key = createTypeUnsafe(typeRegistry, '(Hash, AccountId)', [[moneyId, address]])
    const balance = await api.query['standardAssets']['balances'](key.toHex())
    console.log(`queryStandardBalance: (${moneyId}, ${address}) => ${balance.toHuman()}`)
}

async function makeOrder(api: ApiPromise, sender: KeyringPair, assetId: string, moneyId: string, price: string, amount: string, direction: number) {
    const tx = api.tx['carbonExchange']['makeOrder'](assetId, moneyId, price, amount, direction)
    await submitTx('makeOrder', tx, sender)
}

async function queryOrder(api: ApiPromise, orderId: string) {
    const order = await api.query['carbonExchange']['orders'](orderId)
    console.log('queryOrder:', order.toJSON())
}

async function takeOrder(api: ApiPromise, sender: KeyringPair, orderId: string, amount: string) {
    const tx = api.tx['carbonExchange']['takeOrder'](orderId, amount)
    await submitTx('takeOrder', tx, sender)
}

async function cancelOrder(api: ApiPromise, sender: KeyringPair, orderId: string) {
    const tx = api.tx['carbonExchange']['cancelOrder'](orderId)
    await submitTx('cancelOrder', tx, sender)
}

async function main() {
    await cryptoWaitReady()

    const wsProvider = new WsProvider('ws://127.0.0.1:9944')
    const types = {
        Address: 'AccountId',
        LookupSource: 'AccountId',
        CarbonProject: {
            name: 'Vec<u8>',
            max_supply: 'u64',
            total_supply: 'u64',
            status: 'u8',
            owner: 'AccountId',
        },
        CarbonAsset: {
            project_id: 'Hash',
            symbol: 'Vec<u8>',
            initial_supply: 'u64',
            total_supply: 'u64',
            status: 'u8',
            additional: 'Vec<u8>',
        },
        IssueInfo: {
            asset_id: 'Hash',
            amount: 'u64',
            status: 'u8',
            additional: 'Vec<u8>',
        },
        BurnInfo: {
            asset_id: 'Hash',
            amount: 'u64',
            status: 'u8',
            additional: 'Vec<u8>',
        },
        OrderOf: {
            asset_id: 'Hash',
            money_id: 'Hash',
            maker: 'AccountId',
            status: 'u8',
            amount: 'u64',
            price: 'u64',
            left_amount: 'u64',
            direction: 'u8',
        },
        ECRC10: {
            symbol: 'Vec<u8>',
            name: 'Vec<u8>',
            decimals: 'u8',
            max_supply: 'u64',
        }
    }
    const api = await ApiPromise.create({ provider: wsProvider, types })
    const keyring = new Keyring({ type: 'sr25519' })
    const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })
    const jack = keyring.addFromUri('entire material egg meadow latin bargain dutch coral blood melt acoustic thought')

    await api.isReady

    // await queryBalance(api, alice.address)
    // await transfer(api, alice, jack.address, '200000000000')

    // await submitProject(api, alice, 'ABC', '10000000', { registerDate: '2020-09-20', lifetime: '2020-2025' })

    const projectId = '0x58965ddaa7cdd74c23eba6f0141b1ef8128e9d0a0145073c51306c1d7679b676'
    // await queryProject(api, projectId)
    // await approveProject(api, alice, projectId)

    // await submitAsset(api, alice, projectId, '2020', '2000000', { remark: 'register asset remark' })
    const assetId = '0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86'
    // await queryAsset(api, assetId)

    // await approveAsset(api, alice, assetId)
    // await queryCarbonBalance(api, assetId, alice.address)

    // await transferCarbonAsset(api, alice, assetId, jack.address, '50000')

    // await submitIssue(api, alice, assetId, '100000', { remark: 'issue remark 1' })
    const issueId = '0xc57c94b5fc225426ab52a6b9bdb63c919ef8171faafd01535d9c824843a60233'
    // await approveIssue(api, alice, issueId)

    // await submitBurn(api, alice, assetId, '200000', { remark: 'burn remark 1' })
    const burnId = ''
    // await approveBurn(api, alice, burnId)

    // await issueStandardAsset(api, jack, 'USTE', 'ECO2 backed USD coin', 8, '100000000000000000', '100000000000000')
    const moneyId = '0x460a321af0d1b29e4948837d550780aa7af5e2722b40782c0b4fc54f51e6a799'
    // await queryStandardAsset(api, moneyId)
    // await queryStandardBalance(api, moneyId, jack.address)
    // await transferStandardAsset(api, jack, moneyId, alice.address, '60000000')

    // await makeOrder(api, alice, assetId, moneyId, '50', '2000000', 0);
    const orderId = '0x18ca494a53b5926c668ea580bb7875a28931df03a27107bb5305ddeda9d4e8c1'
    // await queryOrder(api, orderId)

    // await takeOrder(api, jack, orderId, '1000')
    // await cancelOrder(api, alice, orderId)

    // await queryStandardBalance(api, moneyId, alice.address)
    // await queryStandardBalance(api, moneyId, jack.address)
    // await queryCarbonBalance(api, assetId, alice.address)
    // await queryCarbonBalance(api, assetId, jack.address)
    // await queryOrder(api, orderId)
}

main().then().catch(console.error)