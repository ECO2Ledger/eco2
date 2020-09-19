import { ApiPromise, WsProvider } from '@polkadot/api'

const Datastore = require('nedb')
const db = {
    carbonProjects: new Datastore({ filename: './carbon_projects.db', autoload: true }),
    carbonAssets: new Datastore({ filename: './carbon_assets.db', autoload: true }),
    carbonIssues: new Datastore({ filename: './carbon_issues.db', autoload: true }),
    carbonBurns: new Datastore({ filename: './carbon_burns.db', autoload: true }),
    orders: new Datastore({ filename: './orders.db', autoload: true }),
    deals: new Datastore({ filename: './deals.db', autoload: true }),
    standardAssets: new Datastore({ filename: './standard_assets.db', autoload: true }),
    potentialBalances: new Datastore({ filename: './potential_balances.db', autoload: true }),
}

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

function dbErrorHandler(err) {
    if (err) {
        console.log('db error:', err)
    }
}

function constructPotentialBalanceDoc(account: string, assetId: string, type: 'carbon' | 'standard') {
    const key = [account.slice(0, 6), assetId.slice(0, 8)].join(':')
    return { key, account, assetId, type }
}

const eco2EventHandlers = {
    'carbonAssets:ProjectSubmited': (_, data) => {
        const projectId = data[0].toString()
        const owner = data[1].toString()
        const name = Buffer.from(data[2]).toString('utf8')
        const doc = { projectId, owner, name, approved: 0 }
        console.log('ProjectSubmited', doc)
        db.carbonProjects.insert(doc, dbErrorHandler)
    },

    'carbonAssets:ProjectApproved': (_, data) => {
        const projectId = data[0].toString()
        console.log('ProjectApproved', projectId)
        db.carbonProjects.update({ projectId }, { $set: { approved: 1 } }, {}, dbErrorHandler)
    },

    'carbonAssets:AssetSubmited': (_, data) => {
        const projectId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const symbol = Buffer.from(data[3]).toString('utf8')
        const doc = { projectId, assetId, owner, symbol, approved: 0 }
        console.log('AssetSubmited', doc)
        db.carbonAssets.insert(doc, dbErrorHandler)
    },

    'carbonAssets:AssetApproved': (_, data) => {
        const assetId = data[0].toString()
        console.log('AssetApproved', assetId)
        db.carbonAssets.update({ assetId }, { $set: { approved: 1 } }, {}, dbErrorHandler)
        db.carbonAssets.find({ assetId }, (err, doc) => {
            if (err) {
                console.log('failed to find carbon asset:', err)
                return
            }
            if (!doc || !doc.length) {
                console.log('invalid query result:', doc)
                return
            }
            db.potentialBalances.insert(constructPotentialBalanceDoc(doc[0].owner, assetId, 'carbon'), dbErrorHandler)
        })
    },

    'carbonAssets:IssueSubmited': (_, data) => {
        const issueId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const amount = data[3].toString()
        const doc = { issueId, assetId, owner, amount, approved: 0 }
        console.log('IssueSubmited', doc)
        db.carbonIssues.insert(doc, dbErrorHandler)
    },

    'carbonAssets:IssueApproved': (_, data) => {
        const issueId = data[0].toString()
        console.log('IssueApproved', issueId)
        db.carbonIssues.update({ issueId }, { $set: { approved: 1 } }, {}, dbErrorHandler)
    },

    'carbonAssets:BurnSubmited': (_, data) => {
        const burnId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const amount = data[3].toString()
        const doc = { burnId, assetId, owner, amount, approved: 0 }
        console.log('BurnSubmited', doc)
        db.carbonBurns.insert(doc, dbErrorHandler)
    },

    'carbonAssets:BurnApproved': (_, data) => {
        const burnId = data[0].toString()
        console.log('BurnApproved', burnId)
        db.carbonIssues.update({ burnId }, { $set: { approved: 1 } }, {}, dbErrorHandler)
    },

    'carbonAssets:Transferred': (_, data) => {
        const assetId = data[0].toString()
        const from = data[1].toString()
        const to = data[2].toString()
        const amount = data[3].toString()
        console.log('carbonAssets:Transferred', assetId, from, to, amount)
        db.potentialBalances.insert(constructPotentialBalanceDoc(to, assetId, 'carbon'), dbErrorHandler)
    },

    'carbonExchange:NewOrder': (_, data) => {
        const orderId = data[0].toString()
        const owner = data[1].toString()
        const doc = { orderId, owner, closed: 0 }
        console.log('NewOrder', doc)
        db.orders.insert(doc, dbErrorHandler)
    },

    'carbonExchange:NewDeal': (_, data) => {
        const orderId = data[0].toString()
        const maker = data[1].toString()
        const taker = data[2].toString()
        const price = data[3].toString()
        const amount = data[4].toString()
        const doc = { orderId, maker, taker, price, amount }
        console.log('NewDeal', doc)
        db.deals.insert(doc, dbErrorHandler)
    },

    'carbonExchange:OrderCanceled': (_, data) => {
        const orderId = data[0].toString()
        console.log('OrderCanceled', orderId)
        db.orders.update({ orderId }, { $set: { closed: 1 } }, {}, dbErrorHandler)
    },

    'carbonExchange:OrderFinished': (_, data) => {
        const orderId = data[0].toString()
        console.log('OrderFinished', orderId)
        db.orders.update({ orderId }, { $set: { closed: 1 } }, {}, dbErrorHandler)
    },

    'standardAssets:NewAsset': (_, data) => {
        const assetId = data[0].toString()
        const symbol = Buffer.from(data[1]).toString('utf8')
        const owner = data[2].toString()
        const doc = { assetId, symbol, owner }
        console.log('standardAssets:NewAsset', doc)
        db.standardAssets.insert(doc, dbErrorHandler)
        db.potentialBalances.insert(constructPotentialBalanceDoc(owner, assetId, 'standard'), dbErrorHandler)
    },

    'standardAssets:Transferred': (_, data) => {
        const assetId = data[0].toString()
        const to = data[2].toString()
        console.log('standardAssets:Transferred', assetId, to)
        db.potentialBalances.insert(constructPotentialBalanceDoc(to, assetId, 'standard'), dbErrorHandler)
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

function startServer() {
    const fastify = require('fastify')({
        logger: true
    })

    function fail(reply, error) {
        reply.send({
            success: false,
            error
        })
    }

    function ok(reply, result) {
        reply.send({
            success: true,
            result
        })
    }

    fastify.get('/carbon_projects', (request, reply) => {
        db.carbonProjects.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/carbon_assets', (request, reply) => {
        db.carbonAssets.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/carbon_issues', (request, reply) => {
        db.carbonIssues.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/carbon_burns', (request, reply) => {
        db.carbonBurns.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/carbon_orders', (request, reply) => {
        db.orders.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/carbon_deals', (request, reply) => {
        db.deals.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/standard_assets', (request, reply) => {
        db.standardAssets.find({}, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.get('/potential_balances', (request, reply) => {
        const query = {
            account: request.query.account
        }
        db.potentialBalances.find(query, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.listen(3000, (err, address) => {
        if (err) throw err
        fastify.log.info(`server listening on ${address}`)
    })
}

function initDB() {
    db.carbonProjects.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)
    db.carbonProjects.ensureIndex({ fieldName: 'approved' }, dbErrorHandler)
    db.carbonAssets.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)
    db.carbonAssets.ensureIndex({ fieldName: 'approved' }, dbErrorHandler)
    db.carbonIssues.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)
    db.carbonIssues.ensureIndex({ fieldName: 'approved' }, dbErrorHandler)
    db.carbonBurns.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)
    db.carbonBurns.ensureIndex({ fieldName: 'approved' }, dbErrorHandler)

    db.orders.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)
    db.orders.ensureIndex({ fieldName: 'closed' }, dbErrorHandler)
    db.deals.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)

    db.standardAssets.ensureIndex({ fieldName: 'owner' }, dbErrorHandler)

    db.potentialBalances.ensureIndex({ fieldName: 'key', unique: true }, dbErrorHandler)
    db.potentialBalances.ensureIndex({ fieldName: 'account' }, dbErrorHandler)
}

async function main() {
    const wsProvider = new WsProvider('ws://127.0.0.1:9944')
    const api = await ApiPromise.create({ provider: wsProvider })

    await api.isReady

    // listenBlocks(api)
    // processEventsAtBlock(api, '0x7e6500c8af6d02a132fdfbbf538fe0f81430d257827adfd1572f4d4104a4fb97')
    lastBlockNumber = readLastBlockNumber()
    initDB()

    listenBlocks(api)
    startServer()
}

main().then().catch(console.error)
