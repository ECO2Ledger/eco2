## 1 链上交互接口

### 1.1 申请碳汇项目

```
const symbol = 'ABC'
const maxSupply = '10000000000'
const additionals = JSON.stringify({ registerDate: '2020-09-20', lifetime: '2020-2025' })
api.tx['carbonAssets']['submitProject'](symbol, maxSupply, additionals)
```

在注册碳汇项目页面输入的字段中
symbol为【资产名称】，注意不是【项目名称】
maxSupply为【项目碳汇总数】
其余字段全部放入json对象中

### 1.2 申请碳汇资产

```
const projectId = '0x58965ddaa7cdd74c23eba6f0141b1ef8128e9d0a0145073c51306c1d7679b676'
const vintage = '2020'
const initialSupply = '2000000'
const additionals = JSON.stringify({remark: 'register asset remark'})
api.tx['carbonAssets']['submitAsset'](projectId, vintage, initialSupply, additionals)
```

vintage为【资产年限】
initialSupply为【项目发行数量】
其余字段全部放入json对象中

### 1.3 申请增发碳汇资产

```
const assetId = '0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86'
const amount = '1000000'
const additionals = JSON.stringify({ remark: 'issue remark 1' })
api.tx['carbonAssets']['submitIssue'](assetId, amount, additionals)
```

### 1.4 申请销毁碳汇资产

```
const assetId = '0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86'
const amount = '1000000'
const additionals = JSON.stringify({ remark: 'issue remark 1' })
api.tx['carbonAssets']['submitBurn'](assetId, amount, additionals)
```

### 1.5 查询碳汇项目详情

```
const projectId = '0x58965ddaa7cdd74c23eba6f0141b1ef8128e9d0a0145073c51306c1d7679b676'
const project = await api.query['carbonAssets']['projects'](projectId)
const additionals = await api.query['carbonAssets']['projectAdditionals'](projectId)
console.log('queryProject:', project.toJSON(), JSON.parse(toUtf8(additionals.toU8a(true))))
```

项目的动态数据与静态数据是分开存储的，所以要查询两次，每个项目的additionals只需要查询一次即可

### 1.6 查询碳汇资产详情

```
const assetId = '0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86'
const asset = await api.query['carbonAssets']['assets'](assetId)
const additionals = await api.query['carbonAssets']['assetAdditionals'](assetId)
 console.log('queryAssett:', asset.toJSON(), JSON.parse(toUtf8(additionals.toU8a(true))))
```

碳汇资产的动态数据与静态数据是分开存储的，所以要查询两次，每个资产的additionals只需要查询一次即可

### 1.7 查询碳汇资产余额

```
import { createTypeUnsafe } from '@polkadot/types'
const key = createTypeUnsafe(typeRegistry, '(Hash, AccountId)', [[assetId, address]])
 const balance = await api.query['carbonAssets']['balances'](key.toHex())
 console.log(`queryCarbonBalance: (${assetId}, ${address}) => ${balance.String()}`)
```

### 1.8 碳汇资产转账

```
const assetId = '0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86'
const to = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const amount = '100000'
const tx = api.tx['carbonAssets']['transfer'](assetId, to, amount)
```

### 1.9 查询标准资产余额

```
import { createTypeUnsafe } from '@polkadot/types'
const assetId = '0xb2514c5e056cdf38fa3708917c4b04d85363c8186884cb7a28d0456d8d4d49b6'
const account = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
const key = createTypeUnsafe(typeRegistry, '(Hash, AccountId)', [[assetId, account]])
 const balance = await api.query['standardAssets']['balances'](key.toHex())
 console.log(`queryStandardBalance: (${moneyId}, ${address}) => ${balance.toHuman()}`)
```

### 1.10 make order

```
const assetId = '0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86'
const moneyId = '0xb2514c5e056cdf38fa3708917c4b04d85363c8186884cb7a28d0456d8d4d49b6'
const price = '1000'
const amount = '200000'
const direction = 0 // 0: 卖 1: 买
const salt = Date.now()
api.tx['carbonExchange']['makeOrder'](assetId, moneyId, price, amount, direction, salt)
```

### 1.11 take order

```
const orderId = '0x4965c24e63492f51a65aa4819d203187b4d4f01eab1ccde18aa888859b54e928'
const amount = '1000000'
api.tx['carbonExchange']['takeOrder'](orderId, amount)
```

### 1.12 cancel order

```
const orderId = '0x4965c24e63492f51a65aa4819d203187b4d4f01eab1ccde18aa888859b54e928'
api.tx['carbonExchange']['cancelOrder'](orderId)
```

### 1.13 查询挂单详情

```
const orderId = '0x4965c24e63492f51a65aa4819d203187b4d4f01eab1ccde18aa888859b54e928'
await api.query['carbonExchange']['orders'](orderId)
```

### 1.14 发起提案

```
# 发起批准项目的提案
async function proposeProject(api: ApiPromise, sender: KeyringPair, projectId: string) {
    const proposal = api.tx['carbonAssets']['approveProject'](projectId)
    const threshold = 2
    const lengthBound = 1000
    const tx = api.tx['carbonCommittee']['propose'](threshold, proposal, lengthBound)
    await submitTx('proposeProject', tx, sender)
}

# 发起注册资产的提案
async function proposeAsset(api: ApiPromise, sender: KeyringPair, projectId: string) {
    const proposal = api.tx['carbonAssets']['approveAsset'](projectId)
    const threshold = 2
    const lengthBound = 1000
    const tx = api.tx['carbonCommittee']['propose'](threshold, proposal, lengthBound)
    await submitTx('proposeAsset', tx, sender)
}

# 发起增发资产的提案
async function proposeIssue(api: ApiPromise, sender: KeyringPair, projectId: string) {
    const proposal = api.tx['carbonAssets']['approveIssue'](projectId)
    const threshold = 2
    const lengthBound = 1000
    const tx = api.tx['carbonCommittee']['propose'](threshold, proposal, lengthBound)
    await submitTx('proposeIssue', tx, sender)
}

# 发起销毁资产的提案
async function proposeBurn(api: ApiPromise, sender: KeyringPair, projectId: string) {
    const proposal = api.tx['carbonAssets']['approveBurn'](projectId)
    const threshold = 2
    const lengthBound = 1000
    const tx = api.tx['carbonCommittee']['propose'](threshold, proposal, lengthBound)
    await submitTx('proposeBurn', tx, sender)
}
```

### 1.15 提案投票

```
async function voteProposal(api: ApiPromise, sender: KeyringPair, id: string, index: number, approve: boolean) {
    const tx = api.tx['carbonCommittee']['vote'](id, index, approve)
    await submitTx('voteProposal', tx, sender)
}
```

### 1.16 结束提案

```
async function closeProposal(api: ApiPromise, sender: KeyringPair, id: string, index: number) {
    const maxWeight = 1000000000
    const lengthBound = 1000
    const tx = api.tx['carbonCommittee']['close'](id, index, maxWeight, lengthBound)
    await submitTx('closeProposal', tx, sender)
}
```

### 1.17 查询提案投票详情

```
async function queryProposalVoting(api: ApiPromise, id: string) {
    const voting = await api.query['carbonCommittee']['voting'](id)
    console.log('queryProposalVoting:', voting.toJSON())
}
```

### 1.18 查询碳汇审查委员会成员

```
async function queryCarbonCommitteeMembers(api: ApiPromise) {
    const members = await api.query['carbonCommittee']['members']()
    console.log('carbonCommittee members:', members.toJSON())
}
```

### 1.19 碳中和

```
async function neutralize(api: ApiPromise, sender: KeyringPair, assetId: string, amount: string, additional: {}) {
    const tx = api.tx['carbonAssets']['neutralize'](assetId, amount, JSON.stringify(additional))
    await submitTx('neutralize', tx, sender)
}

await neutralize(api, alice, assetId, '500000', { type: '交通', name: '马云', reason: '阿里云' })
```

## 2 列表查询接口

### 2.1 碳汇项目列表


GET /carbon_projects

参数:

- owner: 所有者账户地址
- approved: 是否通过审核，0或1, 默认: 全部
 - reverse: 是否按时间逆序排列, 0或1, 默认: 0
- offset
- limit

返回：
```
{
    "success": true, 
    "result": {
        "count": 2, 
        "docs": [
            {
                "projectId": "0x58965ddaa7cdd74c23eba6f0141b1ef8128e9d0a0145073c51306c1d7679b676", 
                "owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 
                "symbol": "ABC", 
                "approved": 1, 
                "timestamp": 1600545798000, 
                "_id": "YxQVbmBfCBWjhxdg"
            }, 
            {
                "projectId": "0x57f0c4ffee131c79296095d31b7550a5fe5f61257644d25ec071e3d503283265", 
                "owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 
                "symbol": "ABCD", 
                "approved": 0, 
                "timestamp": 1600546788000, 
                "_id": "3IgymiM5Q14AtdT1"
            }
        ]
    }
}
```

### 2.2 碳汇资产列表

GET /carbon_assets

参数:

- owner: 所有者账户地址
- approved: 是否通过审核，0或1, 默认:: 全部
 - reverse: 是否按时间逆序排列, 0或1, 默认: 0
- offset
 - limit

返回：
```
{
    "success": true, 
    "result": {
        "count": 1, 
        "docs": [
            {
                "projectId": "0x58965ddaa7cdd74c23eba6f0141b1ef8128e9d0a0145073c51306c1d7679b676", 
                "assetId": "0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86", 
                "owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 
                "approved": 1, 
                "timestamp": 1600545954000, 
                "_id": "3vLZM7eRKgPpniN5"
            }
        ]
    }
}
```

### 2.3 挂单列表

GET /carbon_orders

参数:

- owner: 所有者账户地址
- closed: 是否全部交易完成，0或1, 默认: 全部
- reverse: 是否按时间逆序排列, 0或1, 默认: 0
- offset
- limit

```
{
    "success": true, 
    "result": {
        "count": 1, 
        "docs": [
            {
                orderId: "0xd0b4ba48d4cbdc5b9c22975b11f81ea5d39a87e6bc6b1b69698712a6e2ee6b0a",
                owner: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
                closed: 0,
                timestamp: 1603391406000,
                assetId: "0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86",
                moneyId: "0x0000000000000000000000000000000000000000000000000000000000000000",
                assetSymbol: "ABC.2020",
                moneySymbol: "ECO2",
                pair: "ABC.2020/ECO2",
                _id: "N7XWIMPkQLO3UHXF"
            }
        ]
    }
}
```

### 2.4 成交列表

GET /carbon_deals

参数:

- owner: 所有者账户地址
 - reverse: 是否按时间逆序排列, 0或1, 默认: 0
- offset
- limit

```
{
    "success": true, 
    "result": {
        "count": 2, 
        "docs": [
            {
                orderId: "0xd0b4ba48d4cbdc5b9c22975b11f81ea5d39a87e6bc6b1b69698712a6e2ee6b0a",
                maker: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
                taker: "5GRdmMkKeKaV94qU3JjDr2ZwRAgn3xwzd2FEJYKjjSFipiAe",
                price: "50",
                amount: "500000",
                timestamp: 1603391532000,
                direction: 1,
                assetId: "0x75b8a626a38d10a72799709e28d96da122cc914cc7df8f0d3a3c364bb6c29c86",
                moneyId: "0x0000000000000000000000000000000000000000000000000000000000000000",
                assetSymbol: "ABC.2020",
                moneySymbol: "ECO2",
                pair: "ABC.2020/ECO2",
                _id: "wlhZiYvKBee9xRl8"
            }
        ]
    }
}
```

### 2.5 可能有余额的资产列表

GET /carbon_deals

参数:

 - account: 账户地址

返回:
```
{
    "success": true, 
    "result": [
        {
            "key": "5Grwva:0xb2514c", 
            "account": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 
            "assetId": "0xb2514c5e056cdf38fa3708917c4b04d85363c8186884cb7a28d0456d8d4d49b6", 
            "type": "standard", 
            "symbol": "ABC.2020",
            "_id": "M7ZkFuymjrPPUhfC"
        }
    ]
}
```

### 2.6 碳汇审查委员会提案列表

GET /carbon_proposals

参数:

 - reverse: 是否按时间逆序排列, 0或1, 默认: 0
- offset
- limit

返回字段说明:

- title: 提案的标题
- type: 提案的类型, project | asset | issue | burn，分别表示注册碳汇项目、注册碳汇资产、增发碳汇资产、销毁碳汇资产
- proposalId: 提案id，为空表示所有者刚提交了申请，委员会的成员还没有发起提案
- key: 申请项的id，如project_id, asset_id, issue_id, burn_id

返回:

```
{
    "success": true, 
    "result": {
        "count": 1, 
        "docs": [
            {
                "title": "Proposal for new project(ABC1)", 
                "type": "project", 
                "proposalId": "", 
                "key": "0x03e250d57b6988580b81cb29a51ec93aa86cf2f45bbee2e587a032c088a6557c", 
                "timestamp": 1600693218000, 
                "_id": "FOal2faZ4L52yh9g"
            }
        ]
    }
}
```

