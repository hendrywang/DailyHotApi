# DailyHot API 服务

这是一个用于查询DailyHot新闻数据的API服务，提供了安全的API接口，使用API密钥和签名进行身份验证。

## 功能特点

- 使用API密钥和签名进行身份验证，确保API调用的安全性
- 提供多种查询参数，支持按数据源、日期、时间范围等进行过滤
- 支持分页和排序功能
- 提供统计数据接口，可查看各数据源的数据量和时间分布

## API端点

服务运行在端口6690上，提供以下API端点：

### 1. 健康检查

```
GET /
```

返回服务状态信息。

### 2. 获取新闻数据

```
GET /api/news
```

查询参数：
- `source`: 数据源名称
- `date`: 日期（YYYY-MM-DD格式）
- `startDate`: 开始日期
- `endDate`: 结束日期
- `limit`: 每页数据量，默认50
- `offset`: 偏移量，用于分页
- `orderBy`: 排序字段，可选值：created_at, hot, source
- `order`: 排序方式，可选值：ASC, DESC，默认DESC

### 3. 获取可用的数据源

```
GET /api/sources
```

返回所有可用的数据源列表。

### 4. 获取统计数据

```
GET /api/stats
```

返回数据统计信息，包括总数据量、各数据源数据量和时间分布。

## 身份验证

所有API请求（除了健康检查）都需要进行身份验证。身份验证使用以下HTTP头：

- `X-API-Key`: API密钥
- `X-Timestamp`: 当前时间戳（Unix时间戳，秒）
- `X-Signature`: 请求签名

签名生成方法：

1. 构建签名字符串：`${apiKey}${path}${queryString}${timestamp}${apiSecret}`
2. 使用SHA-256算法计算签名字符串的哈希值

示例代码（Node.js）：

```javascript
const crypto = require('crypto');

function generateSignature(apiKey, apiSecret, path, queryString, timestamp) {
  const stringToSign = `${apiKey}${path}${queryString}${timestamp}${apiSecret}`;
  return crypto.createHash('sha256').update(stringToSign).digest('hex');
}
```

## 使用示例

请参考 `src/api-client-example.ts` 文件，了解如何使用API服务。

## 部署

使用Docker Compose部署：

```bash
docker-compose up -d
```

API服务将在端口6690上运行。

## 环境变量

可以通过环境变量配置API服务：

- `API_PORT`: API服务端口，默认6690
- `API_KEY`: API密钥
- `API_SECRET`: API密钥对应的密钥

## 安全建议

在生产环境中：

1. 使用强密码作为API密钥和密钥
2. 使用HTTPS保护API通信
3. 限制API访问IP
4. 定期轮换API密钥 