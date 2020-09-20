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
api.tx['carbonExchange']['makeOrder'](assetId, moneyId, price, amount, direction)
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
                "orderId": "0x880f7d4a081ba11386c180dfb0aca24b69af31c0215e0d7cf861b21c3b93c7c4", 
                "owner": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 
                "closed": 0, 
                "timestamp": 1600575534000, 
                "_id": "RQjniocRC0DK7ppY"
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
                "orderId": "0x18ca494a53b5926c668ea580bb7875a28931df03a27107bb5305ddeda9d4e8c1", 
                "maker": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", 
                "taker": "5GRdmMkKeKaV94qU3JjDr2ZwRAgn3xwzd2FEJYKjjSFipiAe", 
                "price": "50", 
                "amount": "1000", 
                "timestamp": 1600576944000, 
                "direction": 1, 
                "_id": "XTD1Qhvl7DHtT7Gx"
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
            "_id": "M7ZkFuymjrPPUhfC"
        }
    ]
}
```