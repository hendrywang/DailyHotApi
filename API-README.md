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

**响应数据结构**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "唯一标识符",
      "title": "新闻标题",
      "description": "新闻描述或摘要",
      "url": "原始新闻链接",
      "mobileUrl": "移动端链接",
      "cover": "新闻封面图片URL",
      "hot": 热度值(数字),
      "source": "数据源名称",
      "created_at": "创建时间(ISO格式)"
    }
    // ... 更多新闻项
  ],
  "total": 总记录数,
  "pagination": {
    "limit": 每页记录数,
    "offset": 当前偏移量,
    "hasMore": 是否有更多数据(布尔值)
  }
}
```

### 3. 获取可用的数据源

```
GET /api/sources
```

返回所有可用的数据源列表。

**响应数据结构**:
```json
{
  "status": "success",
  "data": ["source1", "source2", "source3", "..."]
}
```

### 4. 获取统计数据

```
GET /api/stats
```

返回数据统计信息，包括总数据量、各数据源数据量和时间分布。

**响应数据结构**:
```json
{
  "status": "success",
  "data": {
    "totalCount": 总数据量,
    "sourceStats": {
      "source1": 数据量,
      "source2": 数据量
      // ... 更多数据源
    },
    "dateStats": {
      "date1": 数据量,
      "date2": 数据量
      // ... 更多日期
    }
  }
}
```

## 身份验证

所有API请求（除了健康检查）都需要进行身份验证。身份验证使用以下HTTP头：

- `X-API-Key`: API密钥
- `X-Timestamp`: 当前时间戳（Unix时间戳，秒）
- `X-Signature`: 请求签名

签名生成方法：

1. 构建签名字符串：`${apiKey}${path}${queryString}${timestamp}${apiSecret}`
2. 使用SHA-256算法计算签名字符串的哈希值

## 客户端代码示例

### Node.js 示例

```javascript
const crypto = require('crypto');
const fetch = require('node-fetch');

const API_URL = 'https://htapi.arlife.cn';
const API_KEY = '4e74d3a6dc6750db26b4009b64e91f5b91dcd5cd6c1f9c10b28ea640906cc527';
const API_SECRET = '94ac9cb5cc67a27f2da7066edf7d076aa0d24fac30a947ba586ce66dbb37acf8';

// 生成API请求头
function generateHeaders(path, queryParams = {}) {
  const queryString = Object.keys(queryParams).length > 0
    ? '?' + new URLSearchParams(queryParams).toString()
    : '';
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `${API_KEY}${path}${queryString}${timestamp}${API_SECRET}`;
  const signature = crypto.createHash('sha256').update(stringToSign).digest('hex');
  
  return {
    'X-API-Key': API_KEY,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'Content-Type': 'application/json'
  };
}

// 获取新闻数据
async function getNews(params = {}) {
  const path = '/api/news';
  const headers = generateHeaders(path, params);
  
  const url = `${API_URL}${path}${Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''}`;
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
}

// 获取数据源
async function getSources() {
  const path = '/api/sources';
  const headers = generateHeaders(path);
  
  try {
    const response = await fetch(`${API_URL}${path}`, { headers });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching sources:', error);
    throw error;
  }
}

// 获取统计数据
async function getStats() {
  const path = '/api/stats';
  const headers = generateHeaders(path);
  
  try {
    const response = await fetch(`${API_URL}${path}`, { headers });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}
```

### Python 示例

```python
import time
import hashlib
import requests
from urllib.parse import urlencode

API_URL = 'https://htapi.arlife.cn'
API_KEY = '您的API密钥'
API_SECRET = '您的API密钥密钥'

def generate_headers(path, query_params=None):
    """生成API请求所需的头部"""
    if query_params is None:
        query_params = {}
    
    # 构建查询字符串
    query_string = ''
    if query_params:
        query_string = '?' + urlencode(query_params)
    
    # 生成时间戳
    timestamp = str(int(time.time()))
    
    # 构建签名字符串
    string_to_sign = f"{API_KEY}{path}{query_string}{timestamp}{API_SECRET}"
    
    # 计算签名
    signature = hashlib.sha256(string_to_sign.encode()).hexdigest()
    
    # 返回头部
    return {
        'X-API-Key': API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json'
    }

def get_news(params=None):
    """获取新闻数据"""
    if params is None:
        params = {}
    
    path = '/api/news'
    headers = generate_headers(path, params)
    
    url = f"{API_URL}{path}"
    if params:
        url += '?' + urlencode(params)
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()  # 如果请求失败则抛出异常
    
    return response.json()

def get_sources():
    """获取可用的数据源"""
    path = '/api/sources'
    headers = generate_headers(path)
    
    url = f"{API_URL}{path}"
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    return response.json()

def get_stats():
    """获取统计数据"""
    path = '/api/stats'
    headers = generate_headers(path)
    
    url = f"{API_URL}{path}"
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    return response.json()
```

### Swift 示例

```swift
import Foundation
import CryptoKit

class DailyHotAPI {
    static let apiURL = "https://htapi.arlife.cn"
    static let apiKey = "您的API密钥"
    static let apiSecret = "您的API密钥密钥"
    
    struct ApiResponse<T: Decodable>: Decodable {
        let status: String
        let data: T
        let total: Int?
        let pagination: Pagination?
        let message: String?
        
        struct Pagination: Decodable {
            let limit: Int
            let offset: Int
            let hasMore: Bool
        }
    }
    
    struct NewsItem: Decodable {
        let id: String
        let title: String
        let description: String?
        let url: String
        let mobileUrl: String
        let cover: String
        let hot: Int
        let source: String
        let created_at: String
    }
    
    // 生成API请求头
    static func generateHeaders(path: String, queryParams: [String: String] = [:]) -> [String: String] {
        // 构建查询字符串
        var queryString = ""
        if !queryParams.isEmpty {
            queryString = "?" + queryParams.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        }
        
        // 生成时间戳
        let timestamp = String(Int(Date().timeIntervalSince1970))
        
        // 构建签名字符串
        let stringToSign = "\(apiKey)\(path)\(queryString)\(timestamp)\(apiSecret)"
        
        // 计算签名
        let signature = SHA256.hash(data: Data(stringToSign.utf8))
            .compactMap { String(format: "%02x", $0) }
            .joined()
        
        // 返回头部
        return [
            "X-API-Key": apiKey,
            "X-Timestamp": timestamp,
            "X-Signature": signature,
            "Content-Type": "application/json"
        ]
    }
    
    // 获取新闻数据
    static func getNews(params: [String: String] = [:]) async throws -> ApiResponse<[NewsItem]> {
        let path = "/api/news"
        let headers = generateHeaders(path: path, queryParams: params)
        
        var url = URL(string: apiURL + path)!
        if !params.isEmpty {
            var components = URLComponents(url: url, resolvingAgainstBaseURL: true)!
            components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
            url = components.url!
        }
        
        var request = URLRequest(url: url)
        headers.forEach { request.addValue($0.value, forHTTPHeaderField: $0.key) }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONDecoder().decode(ApiResponse<[NewsItem]>.self, from: data)
    }
    
    // 获取可用数据源
    static func getSources() async throws -> ApiResponse<[String]> {
        let path = "/api/sources"
        let headers = generateHeaders(path: path)
        
        let url = URL(string: apiURL + path)!
        
        var request = URLRequest(url: url)
        headers.forEach { request.addValue($0.value, forHTTPHeaderField: $0.key) }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONDecoder().decode(ApiResponse<[String]>.self, from: data)
    }
    
    // 获取统计数据
    static func getStats() async throws -> ApiResponse<[String: Any]> {
        let path = "/api/stats"
        let headers = generateHeaders(path: path)
        
        let url = URL(string: apiURL + path)!
        
        var request = URLRequest(url: url)
        headers.forEach { request.addValue($0.value, forHTTPHeaderField: $0.key) }
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse, 
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        // 注意：这里需要自定义解码逻辑，因为统计数据的结构可能比较复杂
        // 这里简化为使用 [String: Any] 类型
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let status = json["status"] as? String,
           let responseData = json["data"] as? [String: Any] {
            return ApiResponse(status: status, data: responseData, total: nil, pagination: nil, message: nil)
        } else {
            throw URLError(.cannotParseResponse)
        }
    }
}
```

## 使用示例

### 实现热门新闻展示

```javascript
// 获取并显示热门新闻
async function displayHotNews() {
  try {
    // 获取前10条热门新闻
    const newsData = await getNews({ 
      limit: '10', 
      orderBy: 'hot', 
      order: 'DESC' 
    });
    
    if (newsData.status === 'success' && newsData.data.length > 0) {
      // 处理并显示新闻数据
      newsData.data.forEach(item => {
        console.log(`标题: ${item.title}`);
        console.log(`热度: ${item.hot}`);
        console.log(`来源: ${item.source}`);
        console.log(`链接: ${item.url}`);
        console.log('--------------------------');
      });
    }
  } catch (error) {
    console.error('获取热门新闻失败:', error);
  }
}
```

### 多数据源聚合展示

```javascript
// 获取多个数据源的新闻并聚合展示
async function displayMultiSourceNews() {
  try {
    // 首先获取所有可用数据源
    const sourcesData = await getSources();
    
    if (sourcesData.status === 'success' && sourcesData.data.length > 0) {
      // 选择前3个数据源
      const selectedSources = sourcesData.data.slice(0, 3);
      
      // 对每个数据源获取最新5条新闻
      const newsPromises = selectedSources.map(source => 
        getNews({ source, limit: '5', orderBy: 'created_at', order: 'DESC' })
      );
      
      // 等待所有请求完成
      const newsResults = await Promise.all(newsPromises);
      
      // 处理结果
      selectedSources.forEach((source, index) => {
        const sourceNews = newsResults[index];
        
        console.log(`===== ${source}的最新新闻 =====`);
        if (sourceNews.status === 'success' && sourceNews.data.length > 0) {
          sourceNews.data.forEach(item => {
            console.log(`- ${item.title}`);
          });
        } else {
          console.log('没有找到新闻');
        }
        console.log('\n');
      });
    }
  } catch (error) {
    console.error('获取多源新闻失败:', error);
  }
}
```

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