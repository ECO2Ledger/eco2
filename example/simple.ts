import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { TypeRegistry, createTypeUnsafe } from '@polkadot/types'
import { KeyringPair } from '@polkadot/keyring/types'
import { cryptoWaitReady } from '@polkadot/util-crypto'

const typeRegistry = new TypeRegistry()

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

async function submitProject(api: ApiPromise, sender: KeyringPair, name: string, maxSupply: string, additional: {}) {
    const tx = api.tx['carbonAssets']['submitProject'](name, maxSupply, JSON.stringify(additional))
    await submitTx('submitProject', tx, sender)
}

async function queryProject(api: ApiPromise, projectId: string) {
    const project = await api.query['carbonAssets']['projects'](projectId)
    console.log('queryProject:', project.toJSON())
}

async function submitAsset(api: ApiPromise, sender: KeyringPair, projectId: string, symbol: string, initialSupply: string, additional: {}) {
    const tx = api.tx['carbonAssets']['submitAsset'](projectId, symbol, initialSupply, JSON.stringify(additional))
    await submitTx('submitAsset', tx, sender)
}

async function approveAsset(api: ApiPromise, sender: KeyringPair, assetId: string) {
    const tx = api.tx['carbonAssets']['approveAsset'](assetId)
    await submitTx('approveAsset', tx, sender)
}

async function queryAsset(api: ApiPromise, assetId: string) {
    const asset = await api.query['carbonAssets']['assets'](assetId)
    console.log('queryAssett:', asset.toJSON())
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

async function issueStandardAsset(api: ApiPromise, sender: KeyringPair, amount: string) {
    const tx = api.tx['standardAssets']['issue'](amount)
    await submitTx('issueStandardAsset', tx, sender)
}

async function queryStandardBalance(api: ApiPromise, moneyId: number, address: string) {
    const key = createTypeUnsafe(typeRegistry, '(u32, AccountId)', [[moneyId, address]])
    const balance = await api.query['standardAssets']['balances'](key.toHex())
    console.log(`queryStandardBalance: (${moneyId}, ${address}) => ${balance.toHuman()}`)
}

async function makeOrder(api: ApiPromise, sender: KeyringPair, assetId: string, moneyId: number, price: string, amount: string, direction: number) {
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
        MoneyIdOf: 'u32',
        Project: {
            name: 'Vec<u8>',
            max_supply: 'u64',
            total_supply: 'u64',
            status: 'u8',
            owner: 'AccountId',
            additional: 'Vec<u8>',
        },
        Asset: {
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
            money_id: 'MoneyIdOf',
            maker: 'AccountId',
            status: 'u8',
            amount: 'u64',
            price: 'u64',
            left_amount: 'u64',
            direction: 'u8',
        }
    }
    const api = await ApiPromise.create({ provider: wsProvider, types })
    const keyring = new Keyring({ type: 'sr25519' })
    const alice = keyring.addFromUri('//Alice', { name: 'Alice default' })
    const jack = keyring.addFromUri('entire material egg meadow latin bargain dutch coral blood melt acoustic thought')

    await api.isReady

    // await queryBalance(api, alice.address)
    // await transfer(api, alice, jack.address, '200000000000')

    // await submitProject(api, alice, 'testproject3', '10000000', { registerDate: '2020-09-20', assetYears: 10 })

    const projectId = '0xbdbaf156861c0b47c2783cfe1efb0001323afbbcb9e573b699a650fab99ab5d8'
    // await queryProject(api, projectId)

    // await submitAsset(api, alice, '0xbdbaf156861c0b47c2783cfe1efb0001323afbbcb9e573b699a650fab99ab5d8', 'ABC.2019', '2000000', { remark: 'register asset remark' })
    const assetId = '0x1cb8b1b80d1d1b34da106279bdfe5e9236561033aee5bcf7257af04c3d55f2a3'
    // await queryAsset(api, assetId)

    // await approveAsset(api, alice, assetId)
    // await queryCarbonBalance(api, assetId, alice.address)

    // await submitIssue(api, alice, assetId, '100000', { remark: 'issue remark 1' })
    const issueId = ''
    // await approveIssue(api, alice, issueId)

    // await submitBurn(api, alice, assetId, '200000', {remark: 'burn remark 1'})
    const burnId = ''
    // await approveBurn(api, alice, burnId)

    // await issueStandardAsset(api, jack, '30000000')
    const moneyId = 0
    // await queryStandardBalance(api, moneyId, jack.address)

    // await makeOrder(api, alice, assetId, moneyId, '50', '2000000', 0);
    const orderId = '0x4965c24e63492f51a65aa4819d203187b4d4f01eab1ccde18aa888859b54e928'
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