import { ApiPromise, WsProvider } from '@polkadot/api'

let gApi: ApiPromise

const { promisify } = require('util')
const Datastore = require('nedb')
const autoload = false;
const db = {
    carbonProjects: new Datastore({ filename: './.data/carbon_projects.db', autoload }),
    carbonAssets: new Datastore({ filename: './.data/carbon_assets.db', autoload }),
    // carbonIssues: new Datastore({ filename: './.data/carbon_issues.db', autoload }),
    // carbonBurns: new Datastore({ filename: './.data/carbon_burns.db', autoload }),
    orders: new Datastore({ filename: './.data/orders.db', autoload }),
    deals: new Datastore({ filename: './.data/deals.db', autoload }),
    userDeals: new Datastore({ filename: './.data/user_deals.db', autoload }),
    standardAssets: new Datastore({ filename: './.data/standard_assets.db', autoload }),
    potentialBalances: new Datastore({ filename: './.data/potential_balances.db', autoload }),
    carbonProposals: new Datastore({ filename: './.data/carbon_proposals.db', autoload }),

    findOneAsync: (collection) => {
        return promisify(collection.findOne.bind(collection))
    },
    findAsync: (collection) => {
        return promisify(collection.find.bind(collection))
    },
    insertAsync: (collection) => {
        return promisify(collection.insert.bind(collection))
    },
    updateAsync: (collection) => {
        return promisify(collection.update.bind(collection))
    },
    countAsync: (collection) => {
        return promisify(collection.count.bind(collection))
    },
    removeAsync: (collection) => {
        return promisify(collection.remove.bind(collection))
    }
}

let lastBlockNumber = 0
let latestBlockNumber = 0
let initialized = false
const lastBlockNumberFile = './.data/lastBlockNumber'

const fs = require('fs')
function readLastBlockNumber() {
    try {
        const content = fs.readFileSync(lastBlockNumberFile, 'utf8')
        return Number.parseInt(content)
    } catch (e) {
        return 1
    }
}

function saveLastBlockNumber(n) {
    fs.writeFileSync(lastBlockNumberFile, n.toString(), 'utf8')
}

function constructPotentialBalanceDoc(account: string, assetId: string, type: 'carbon' | 'standard') {
    const key = [account.slice(0, 6), assetId.slice(0, 8)].join(':')
    return { key, account, assetId, type }
}

const eco2EventHandlers = {
    'carbonAssets:ProjectSubmited': async (_, data) => {
        const projectId = data[0].toString()
        const owner = data[1].toString()
        const symbol = Buffer.from(data[2]).toString('utf8')
        const timestamp = data[3].toNumber()
        const doc = { projectId, owner, symbol, approved: 0, timestamp }
        console.log('ProjectSubmited', doc)
        await db.insertAsync(db.carbonProjects)(doc)

        const result = await gApi.query['carbonAssets']['projects'](projectId)
        if (!result.isEmpty) {
            const project = result.toJSON()
            console.log('project:', project)
            if (project['status'] === 1) {
                console.log('\tSkip the already approved proposal')
                return
            }
            console.log('\tAdd new project proposal doc')
            await db.insertAsync(db.carbonProposals)({
                title: `Proposal for new project(${symbol})`,
                type: 'project',
                proposalId: '',
                proposalIndex: -1,
                key: projectId,
                timestamp,
            })
        }
    },

    'carbonAssets:ProjectApproved': async (_, data) => {
        const projectId = data[0].toString()
        console.log('ProjectApproved', projectId)
        await db.updateAsync(db.carbonProjects)({ projectId }, { $set: { approved: 1 } }, {})
    },

    'carbonAssets:AssetSubmited': async (_, data) => {
        const projectId = data[0].toString()
        const assetId = data[1].toString()
        const symbol = Buffer.from(data[2]).toString('utf8')
        const vintage = Buffer.from(data[3]).toString('utf8')
        const owner = data[4].toString()
        const timestamp = data[5].toNumber()
        const doc = { projectId, assetId, owner, approved: 0, timestamp, symbol, vintage }
        console.log('AssetSubmited', doc)
        await db.insertAsync(db.carbonAssets)(doc)

        const result = await gApi.query['carbonAssets']['assets'](assetId)
        if (!result.isEmpty) {
            const asset = result.toJSON()
            console.log('\tThe asset is', asset)
            if (asset['status'] === 1) {
                console.log('\tSkip the already approved proposal')
                return
            }
            console.log('\tAdd new asset proposal doc')
            await db.insertAsync(db.carbonProposals)({
                title: `Proposal for new asset(${symbol}.${vintage})`,
                type: 'asset',
                proposalId: '',
                proposalIndex: -1,
                key: assetId,
                timestamp,
            })
        }
    },

    'carbonAssets:AssetApproved': async (_, data) => {
        const assetId = data[0].toString()
        console.log('AssetApproved', assetId)
        await db.updateAsync(db.carbonAssets)({ assetId }, { $set: { approved: 1 } }, {})
        const asset = await db.findOneAsync(db.carbonAssets)({ assetId })
        await db.insertAsync(db.potentialBalances)(constructPotentialBalanceDoc(asset.owner, assetId, 'carbon'))
    },

    'carbonAssets:IssueSubmited': async (_, data) => {
        const issueId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const amount = data[3].toString()
        const timestamp = data[4].toNumber()
        console.log('carbonAssets:IssueSubmited', issueId, assetId, owner, amount, timestamp)
        const asset = await db.findOneAsync(db.carbonAssets)({ assetId })

        const result = await gApi.query['carbonAssets']['issues'](issueId)
        if (!result.isEmpty) {
            const issue = result.toJSON()
            if (issue['status'] === 1) {
                console.log('\tSkip the already approved proposal')
                return
            }
            console.log('\tAdd new issue proposal doc')
            await db.insertAsync(db.carbonProposals)({
                title: `Proposal for new issuing asset(${asset.symbol}.${asset.vintage})`,
                type: 'issue',
                proposalId: '',
                proposalIndex: -1,
                key: issueId,
                timestamp,
            })
        }
    },

    // 'carbonAssets:IssueApproved': async (_, data) => {
    //     const issueId = data[0].toString()
    //     console.log('IssueApproved', issueId)
    //     db.carbonIssues.update({ issueId }, { $set: { approved: 1 } }, {}, dbErrorHandler)
    // },

    'carbonAssets:BurnSubmited': async (_, data) => {
        const burnId = data[0].toString()
        const assetId = data[1].toString()
        const owner = data[2].toString()
        const amount = data[3].toString()
        const timestamp = data[4].toNumber()
        console.log('BurnSubmited', burnId, assetId, owner, amount, timestamp)
        const asset = await db.findOneAsync(db.carbonAssets)({ assetId })
        const result = await gApi.query['carbonAssets']['burns'](burnId)
        if (!result.isEmpty) {
            const burn = result.toJSON()
            if (burn['status'] === 1) {
                console.log('\tSkip the already approved proposal')
                return
            }
            console.log('\tAdd new burn proposal doc')
            await db.insertAsync(db.carbonProposals)({
                title: `Proposal for burning asset(${asset.symbol}.${asset.vintage})`,
                type: 'burn',
                proposalId: '',
                proposalIndex: -1,
                key: burnId,
                timestamp,
            })
        }
    },

    // 'carbonAssets:BurnApproved': async (_, data) => {
    //     const burnId = data[0].toString()
    //     console.log('BurnApproved', burnId)
    //     db.carbonIssues.update({ burnId }, { $set: { approved: 1 } }, {}, dbErrorHandler)
    // },

    'carbonAssets:Transferred': async (_, data) => {
        const assetId = data[0].toString()
        const from = data[1].toString()
        const to = data[2].toString()
        const amount = data[3].toString()
        const timestamp = data[4].toNumber()
        console.log('carbonAssets:Transferred', assetId, from, to, amount, timestamp)
        await db.insertAsync(db.potentialBalances)(constructPotentialBalanceDoc(to, assetId, 'carbon'))
    },

    'carbonExchange:NewOrder': async (_, data) => {
        const orderId = data[0].toString()
        const owner = data[1].toString()
        const timestamp = data[2].toNumber()
        const doc = { orderId, owner, closed: 0, timestamp }

        console.log('NewOrder', doc)
        await db.insertAsync(db.orders)(doc)
    },

    'carbonExchange:NewDeal': async (_, data) => {
        const orderId = data[0].toString()
        const maker = data[1].toString()
        const taker = data[2].toString()
        const price = data[3].toString()
        const amount = data[4].toString()
        const direction = data[5].toNumber()
        const timestamp = data[6].toNumber()
        const doc = { orderId, maker, taker, price, amount, timestamp, direction: 1 - direction }
        console.log('NewDeal', doc)
        await db.insertAsync(db.deals)(doc)

        const makerDealDoc = { orderId, owner: maker, price, amount, timestamp, direction }
        const takerDealDoc = { orderId, owner: taker, price, amount, timestamp, direction: 1 - direction }
        await db.insertAsync(db.userDeals)(makerDealDoc)
        await db.insertAsync(db.userDeals)(takerDealDoc)
    },

    'carbonExchange:OrderCanceled': async (_, data) => {
        const orderId = data[0].toString()
        console.log('OrderCanceled', orderId)
        await db.updateAsync(db.orders)({ orderId }, { $set: { closed: 1 } }, {})
    },

    'carbonExchange:OrderFinished': async (_, data) => {
        const orderId = data[0].toString()
        console.log('OrderFinished', orderId)
        await db.updateAsync(db.orders)({ orderId }, { $set: { closed: 1 } }, {})
    },

    'standardAssets:NewAsset': async (_, data) => {
        const assetId = data[0].toString()
        const symbol = Buffer.from(data[1]).toString('utf8')
        const owner = data[2].toString()
        // const firstSupply = data[3].toString()
        const timestamp = data[4].toNumber()
        const doc = { assetId, symbol, owner, timestamp }
        console.log('standardAssets:NewAsset', doc)
        await db.insertAsync(db.standardAssets)(doc)
        await db.insertAsync(db.potentialBalances)(constructPotentialBalanceDoc(owner, assetId, 'standard'))
    },

    'standardAssets:Transferred': async (_, data) => {
        const assetId = data[0].toString()
        const to = data[2].toString()
        console.log('standardAssets:Transferred', assetId, to)
        await db.insertAsync(db.potentialBalances)(constructPotentialBalanceDoc(to, assetId, 'standard'))
    },

    'carbonCommittee:Proposed': async (_, data) => {
        const proposalIndex = data[1].toNumber()
        const proposalId = data[2].toString()
        console.log('carbonCommittee:Proposed', proposalIndex, proposalId)

        const result = await gApi.query['carbonCommittee']['proposalOf'](proposalId)
        if (result.isEmpty) return

        let proposal = result.toJSON()
        console.log('\tThe proposal is:', proposal)

        let key: string
        switch (proposal['callIndex']) {
            case '0x0901':
                key = proposal['args']['project_id']
                break;
            case '0x0903':
                key = proposal['args']['asset_id']
                break;
            case '0x0905':
                key = proposal['args']['issue_id']
                break;
            case '0x0907':
                key = proposal['args']['burn_id']
                break;
            default:
                console.log('\tUnexpected callIndex')
        }
        console.log(`\tUpdate proposal at ${key}: $set proposalId: ${proposalId}`)
        await db.updateAsync(db.carbonProposals)({ key }, { $set: { proposalId, proposalIndex } }, {})
    },
    'carbonCommittee:Closed': async (_, data) => {
        const proposalId = data[0].toString()
        console.log('carbonCommittee:Closed', proposalId)
        await db.removeAsync(db.carbonProposals)({ proposalId }, {})
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

    const LIMIT = 25

    function parseIntOr(val, dft) {
        let n = Number.parseInt(val)
        return Number.isNaN(n) ? dft : n
    }

    function getPaginationParams(request) {
        return {
            offset: parseIntOr(request.query.offset, 0),
            limit: parseIntOr(request.query.limit, LIMIT)
        }
    }

    function findWithComplexCondition(collection, request, filter, cb) {
        const { offset, limit } = getPaginationParams(request)
        const reverse = parseIntOr(request.query.reverse, 0)
        const sortBy = {
            timestamp: reverse ? -1 : 1
        }
        collection.count(filter, (err1, count) => {
            if (err1) return cb(err1)
            collection.find(filter).sort(sortBy).skip(offset).limit(limit).exec((err2, docs) => {
                if (err2) return cb(err2)
                return cb(null, { count, docs })
            })
        })
    }

    fastify.get('/carbon_projects', (request, reply) => {
        let filter: { owner?: string, approved?: number } = {}
        if (request.query.owner) {
            filter.owner = request.query.owner
        }
        if (request.query.approved) {
            filter.approved = parseIntOr(request.query.approved, 1)
        }
        findWithComplexCondition(db.carbonProjects, request, filter, (err, result) => {
            err ? fail(reply, err) : ok(reply, result)
        })
    })

    fastify.get('/carbon_assets', (request, reply) => {
        let filter: { owner?: string, approved?: number } = {}
        if (request.query.owner) {
            filter.owner = request.query.owner
        }
        if (request.query.approved) {
            filter.approved = parseIntOr(request.query.approved, 1)
        }
        findWithComplexCondition(db.carbonAssets, request, filter, (err, result) => {
            err ? fail(reply, err) : ok(reply, result)
        })
    })

    // fastify.get('/carbon_issues', (request, reply) => {
    //     let filter: { owner?: string, approved?: number } = {}
    //     if (request.query.owner) {
    //         filter.owner = request.query.owner
    //     }
    //     if (request.query.approved) {
    //         filter.approved = parseIntOr(request.query.approved, 1)
    //     }
    //     findWithComplexCondition(db.carbonIssues, request, filter, (err, result) => {
    //         err ? fail(reply, err) : ok(reply, result)
    //     })
    // })

    // fastify.get('/carbon_burns', (request, reply) => {
    //     let filter: { owner?: string, approved?: number } = {}
    //     if (request.query.owner) {
    //         filter.owner = request.query.owner
    //     }
    //     if (request.query.approved) {
    //         filter.approved = parseIntOr(request.query.approved, 1)
    //     }
    //     findWithComplexCondition(db.carbonBurns, request, filter, (err, result) => {
    //         err ? fail(reply, err) : ok(reply, result)
    //     })
    // })

    fastify.get('/carbon_proposals', (request, reply) => {
        findWithComplexCondition(db.carbonProposals, request, {}, (err, result) => {
            err ? fail(reply, err) : ok(reply, result)
        })
    })

    fastify.get('/carbon_orders', (request, reply) => {
        let filter: { owner?: string, closed?: number } = {}
        if (request.query.owner) {
            filter.owner = request.query.owner
        }
        if (request.query.closed) {
            filter.closed = parseIntOr(request.query.approved, 0)
        }
        findWithComplexCondition(db.orders, request, filter, (err, result) => {
            err ? fail(reply, err) : ok(reply, result)
        })
    })

    fastify.get('/carbon_deals', (request, reply) => {
        let filter: { owner?: string } = {}
        let collection = db.deals
        if (request.query.owner) {
            filter.owner = request.query.owner
            collection = db.userDeals
        }
        findWithComplexCondition(collection, request, filter, (err, result) => {
            err ? fail(reply, err) : ok(reply, result)
        })
    })

    fastify.get('/standard_assets', (request, reply) => {
        let filter: { owner?: string } = {}
        if (request.query.owner) {
            filter.owner = request.query.owner
        }
        findWithComplexCondition(db.standardAssets, request, filter, (err, result) => {
            err ? fail(reply, err) : ok(reply, result)
        })
    })

    fastify.get('/potential_balances', (request, reply) => {
        const filter = {
            account: request.query.account
        }
        db.potentialBalances.find(filter, (err, docs) => {
            err ? fail(reply, err) : ok(reply, docs)
        })
    })

    fastify.listen(3000, '0.0.0.0', (err, address) => {
        if (err) throw err
        fastify.log.info(`server listening on ${address}`)
    })
}

function ensureIndexAsync(collection, params) {
    return promisify(collection.ensureIndex.bind(collection))(params)
}

function loadDatabaseAsync(collection) {
    return promisify(collection.loadDatabase.bind(collection))()
}

async function initDB() {
    await loadDatabaseAsync(db.carbonProjects)
    await ensureIndexAsync(db.carbonProjects, { fieldName: 'projectId', unique: true })
    await ensureIndexAsync(db.carbonProjects, { fieldName: 'owner' })
    await ensureIndexAsync(db.carbonProjects, { fieldName: 'approved' })
    await ensureIndexAsync(db.carbonProjects, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.carbonAssets)
    await ensureIndexAsync(db.carbonAssets, { fieldName: 'assetId', unique: true })
    await ensureIndexAsync(db.carbonAssets, { fieldName: 'projectId' })
    await ensureIndexAsync(db.carbonAssets, { fieldName: 'owner' })
    await ensureIndexAsync(db.carbonAssets, { fieldName: 'approved' })
    await ensureIndexAsync(db.carbonAssets, { fieldName: 'timestamp' })

    // await loadDatabaseAsync(db.carbonIssues)
    // await ensureIndexAsync(db.carbonIssues, { fieldName: 'issueId', unique: true })
    // await ensureIndexAsync(db.carbonIssues, { fieldName: 'owner' })
    // await ensureIndexAsync(db.carbonIssues, { fieldName: 'approved' })
    // await ensureIndexAsync(db.carbonIssues, { fieldName: 'timestamp' })

    // await loadDatabaseAsync(db.carbonBurns)
    // await ensureIndexAsync(db.carbonBurns, { fieldName: 'burnId', unique: true })
    // await ensureIndexAsync(db.carbonBurns, { fieldName: 'owner' })
    // await ensureIndexAsync(db.carbonBurns, { fieldName: 'approved' })
    // await ensureIndexAsync(db.carbonBurns, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.carbonProposals)
    await ensureIndexAsync(db.carbonProposals, { fieldName: 'proposalId' })
    await ensureIndexAsync(db.carbonProposals, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.orders)
    await ensureIndexAsync(db.orders, { fieldName: 'orderId', unique: true })
    await ensureIndexAsync(db.orders, { fieldName: 'owner' })
    await ensureIndexAsync(db.orders, { fieldName: 'closed' })
    await ensureIndexAsync(db.orders, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.deals)
    await ensureIndexAsync(db.deals, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.userDeals)
    await ensureIndexAsync(db.userDeals, { fieldName: 'owner' })
    await ensureIndexAsync(db.userDeals, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.standardAssets)
    await ensureIndexAsync(db.standardAssets, { fieldName: 'assetId', unique: true })
    await ensureIndexAsync(db.standardAssets, { fieldName: 'owner' })
    await ensureIndexAsync(db.standardAssets, { fieldName: 'timestamp' })

    await loadDatabaseAsync(db.potentialBalances)
    await ensureIndexAsync(db.potentialBalances, { fieldName: 'key', unique: true })
    await ensureIndexAsync(db.potentialBalances, { fieldName: 'account' })
}

async function main() {
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
    gApi = api

    await api.isReady

    // listenBlocks(api)
    // processEventsAtBlock(api, '0x7e6500c8af6d02a132fdfbbf538fe0f81430d257827adfd1572f4d4104a4fb97')
    lastBlockNumber = readLastBlockNumber()
    await initDB()

    listenBlocks(api)
    startServer()
}

main().then().catch(console.error)
