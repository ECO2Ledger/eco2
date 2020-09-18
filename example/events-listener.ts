import { ApiPromise, WsProvider } from '@polkadot/api'

// const Datastore = require('nedb')
// const db = new Datastore({ filename: './eco2_list.db', autoload: true })

let lastBlockNumber = 0
let latestBlockNumber = 0
let initialized = false

const fs = require('fs')
function readLastBlockNumber() {
    try {
        const content = fs.readFileSync('./.lastBlockNumber', 'utf8')
        return Number.parseInt(content)
    } catch (e) {
        return 1
    }
}

function saveLastBlockNumber(n) {
    fs.writeFileSync('./.lastBlockNumber', n.toString(), 'utf8')
}

type Task = {
    blockHash: string
}

const taskQueue: Task[] = []

const eco2EventHandlers = {
    'carbonAssets:ProjectSubmited': (_, data) => {
        const projectId = data[0].toString()
        const owner = data[1].toString()
        const name = Buffer.from(data[2]).toString('utf8')
        console.log('ProjectSubmited', projectId, owner, name)
    },

    'carbonAssets:ProjectApproved': (_, data) => {
        const projectId = data[0].toString()
        console.log('ProjectApproved', projectId)
    },

    'carbonAssets:AssetSubmited': (_, data) => {
        const projectId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const symbol = Buffer.from(data[3]).toString('utf8')
        console.log('AssetSubmited', projectId, assetId, owner, symbol)
    },

    'carbonAssets:AssetApproved': (_, data) => {
        const assetId = data[0].toString()
        console.log('AssetApproved', assetId)
    },

    'carbonAssets:IssueSubmited': (_, data) => {
        const issueId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const amount = data[3].toString()
        console.log('IssueSubmited', issueId, assetId, owner, amount)
    },

    'carbonAssets:IssueApproved': (_, data) => {
        const issueId = data[0].toString()
        console.log('IssueApproved', issueId)
    },

    'carbonAssets:BurnSubmited': (_, data) => {
        const burnId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const amount = data[3].toString()
        console.log('BurnSubmited', burnId, assetId, owner, amount)
    },

    'carbonAssets:BurnApproved': (_, data) => {
        const burnId = data[0].toString()
        console.log('BurnApproved', burnId)
    },

    'carbonAssets:Transferred': (_, data) => {
        const assetId = data[0].toString()
        const from = data[1].toString()
        const to = data[2].toString()
        const amount = data[3].toString()
        console.log('Transferred', assetId, from, to, amount)
    },

    'carbonExchange:NewOrder': (_, data) => {
        const orderId = data[0].toString()
        const owner = data[1].toString()
        console.log('NewOrder', orderId, owner)
    },

    'carbonExchange:NewDeal': (_, data) => {
        const orderId = data[0].toString()
        const owner = data[1].toString()
        const price = data[2].toString()
        const amount = data[3].toString()
        console.log('NewDeal', orderId, owner, price, amount)
    },

    'carbonExchange:OrderCanceled': (_, data) => {
        const orderId = data[0].toString()
        const owner = data[1].toString()
        console.log('OrderCanceled', orderId, owner)
    },
}

// function processBlock(api: ApiPromise, hash: string) {
//     console.log('======================processBlock======================')
//     const events = await api.query.system.events.at(hash)
//     for (let record of events) {
//         const { event, phase } = record
//         const types = event.typeDef

//         console.log(`\t${event.section}:${event.method}:: (phase=${phase.toString()})`)
//         console.log(`\t\t${event.meta.documentation.toString()}`)

//         event.data.forEach((data, index) => {
//             console.log(`\t\t\t${types[index].type}: ${data.toString()}`)
//         });
//     }
// }

async function processEventsAtBlockHash(api, hash: string) {
    const events = await api.query.system.events.at(hash)
    for (let record of events) {
        const eventFullPath = `${record.event.section}:${record.event.method}`
        const handler = eco2EventHandlers[eventFullPath]
        if (handler) {
            handler(record, record.event.data)
        }
    }
}

async function processEventsAtBlockNumber(api, n: number) {
    const hash = await api.rpc.chain.getBlockHash(n)
    await processEventsAtBlockHash(api, hash)
}

function listenBlocks(api: ApiPromise) {
    api.rpc.chain.subscribeNewHeads((header) => {
        console.log('New block:', header.number.toNumber(), header.hash.toString())
    })
    api.rpc.chain.subscribeFinalizedHeads((header) => {
        console.log('New Finalized block:', header.number.toNumber(), header.hash.toString())
        latestBlockNumber = header.number.toNumber()
        if (!initialized) {
            startWorker(api).then(() => {
                console.log('worker finished')
            }).catch(e => {
                console.log('worker error:', e)
            })
            initialized = true
        }
    })
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startWorker(api) {
    while (true) {
        if (lastBlockNumber < latestBlockNumber) {
            console.log(`process events from block ${lastBlockNumber + 1} to ${latestBlockNumber}`)
            for (let i = lastBlockNumber + 1; i <= latestBlockNumber; i++) {
                await processEventsAtBlockNumber(api, i)
            }
            lastBlockNumber = latestBlockNumber
            saveLastBlockNumber(lastBlockNumber)
        }
        await sleep(1000)
    }
}

async function main() {
    const wsProvider = new WsProvider('ws://127.0.0.1:9944')
    const api = await ApiPromise.create({ provider: wsProvider })

    await api.isReady

    // listenBlocks(api)
    // processEventsAtBlock(api, '0x7e6500c8af6d02a132fdfbbf538fe0f81430d257827adfd1572f4d4104a4fb97')
    lastBlockNumber = readLastBlockNumber()
    listenBlocks(api)
}

main().then().catch(console.error)
