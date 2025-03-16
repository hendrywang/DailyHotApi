import { Hono } from 'hono';
import { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger as loggerMiddleware } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { jwt } from 'hono/jwt';
import { config } from './config.js';
import pkg from 'pg';
import crypto from 'crypto';
import logger from './utils/logger.js';

const { Pool } = pkg;

// 数据库连接
const pool = new Pool({
  host: config.DB_HOST || 'postgres',
  port: typeof config.DB_PORT === 'string' ? parseInt(config.DB_PORT) : (config.DB_PORT as number) || 5432,
  database: config.DB_NAME || 'dailyhot',
  user: config.DB_USER || 'postgres',
  password: config.DB_PASSWORD || 'postgres',
});

// API密钥 - 在生产环境中应该从环境变量或安全存储中获取
const API_KEY = process.env.API_KEY || 'dailyhot-api-secret-key';
const API_SECRET = process.env.API_SECRET || 'dailyhot-api-secret-value';

// 创建Hono应用
const app = new Hono();

// 中间件
app.use('*', loggerMiddleware());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['X-API-Key', 'Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  maxAge: 86400,
}));

// API密钥验证中间件
const apiKeyAuth = async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  const timestamp = c.req.header('X-Timestamp');
  const signature = c.req.header('X-Signature');
  
  if (!apiKey || !timestamp || !signature) {
    return c.json({ error: 'Missing authentication headers' }, 401);
  }
  
  // 验证API密钥
  if (apiKey !== API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  // 验证时间戳（防止重放攻击）
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp);
  
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 300) { // 5分钟有效期
    return c.json({ error: 'Request expired' }, 401);
  }
  
  // 验证签名
  const path = c.req.path;
  const query = new URL(c.req.url).search || '';
  const stringToSign = `${apiKey}${path}${query}${timestamp}${API_SECRET}`;
  const expectedSignature = crypto.createHash('sha256').update(stringToSign).digest('hex');
  
  if (signature !== expectedSignature) {
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  await next();
};

// 健康检查端点
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'DailyHot API Service is running' });
});

// 定义数据库项目类型
interface NewsItem {
  id: number;
  source: string;
  item_id: string;
  title: string;
  description: string;
  url: string;
  mobile_url: string;
  cover: string;
  hot: number;
  created_at: string;
  raw_data: any;
}

// 获取新闻数据
app.get('/api/news', apiKeyAuth, async (c) => {
  try {
    // 获取查询参数
    const source = c.req.query('source'); // 数据源
    const date = c.req.query('date'); // 日期 YYYY-MM-DD
    const startDate = c.req.query('startDate'); // 开始日期
    const endDate = c.req.query('endDate'); // 结束日期
    const limit = parseInt(c.req.query('limit') || '50'); // 限制条数
    const offset = parseInt(c.req.query('offset') || '0'); // 偏移量
    const orderBy = c.req.query('orderBy') || 'created_at'; // 排序字段
    const order = c.req.query('order')?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'; // 排序方式
    
    // 构建查询条件
    let conditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (source) {
      conditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }
    
    if (date) {
      conditions.push(`DATE(created_at) = $${paramIndex}`);
      params.push(date);
      paramIndex++;
    } else if (startDate && endDate) {
      conditions.push(`DATE(created_at) BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      conditions.push(`DATE(created_at) >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    } else if (endDate) {
      conditions.push(`DATE(created_at) <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }
    
    // 构建查询语句
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    
    // 获取总数
    const countQuery = `SELECT COUNT(*) FROM news_data ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // 获取数据
    const validOrderColumns = ["created_at", "hot", "source"];
    const safeOrderBy = validOrderColumns.includes(orderBy) ? orderBy : "created_at";
    
    const dataQuery = `
      SELECT 
        id, source, item_id, title, description, url, mobile_url, cover, hot, created_at, raw_data
      FROM 
        news_data 
      ${whereClause} 
      ORDER BY ${safeOrderBy} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const dataParams = [...params, limit, offset];
    const dataResult = await pool.query(dataQuery, dataParams);
    
    // 格式化数据
    const data = dataResult.rows.map((item: NewsItem) => ({
      id: item.id,
      source: item.source,
      itemId: item.item_id,
      title: item.title,
      description: item.description,
      url: item.url,
      mobileUrl: item.mobile_url,
      cover: item.cover,
      hot: item.hot,
      createdAt: item.created_at,
      rawData: item.raw_data
    }));
    
    return c.json({
      status: 'success',
      total,
      data,
      pagination: {
        limit,
        offset,
        hasMore: offset + data.length < total
      }
    });
  } catch (error) {
    logger.error(`❌ [ERROR] API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return c.json({ 
      status: 'error', 
      message: `查询出错: ${error instanceof Error ? error.message : "未知错误"}` 
    }, 500);
  }
});

// 获取可用的数据源
app.get('/api/sources', apiKeyAuth, async (c) => {
  try {
    const query = `SELECT DISTINCT source FROM news_data ORDER BY source`;
    const result = await pool.query(query);
    
    return c.json({
      status: 'success',
      data: result.rows.map((row: { source: string }) => row.source)
    });
  } catch (error) {
    logger.error(`❌ [ERROR] API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return c.json({ 
      status: 'error', 
      message: `查询出错: ${error instanceof Error ? error.message : "未知错误"}` 
    }, 500);
  }
});

// 获取统计数据
app.get('/api/stats', apiKeyAuth, async (c) => {
  try {
    const sourceCountQuery = `
      SELECT source, COUNT(*) as count 
      FROM news_data 
      GROUP BY source 
      ORDER BY count DESC
    `;
    
    const dateCountQuery = `
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM news_data 
      GROUP BY DATE(created_at) 
      ORDER BY date DESC 
      LIMIT 30
    `;
    
    const totalCountQuery = `SELECT COUNT(*) as count FROM news_data`;
    
    const sourceResult = await pool.query(sourceCountQuery);
    const dateResult = await pool.query(dateCountQuery);
    const totalResult = await pool.query(totalCountQuery);
    
    return c.json({
      status: 'success',
      data: {
        total: parseInt(totalResult.rows[0].count),
        bySource: sourceResult.rows,
        byDate: dateResult.rows
      }
    });
  } catch (error) {
    logger.error(`❌ [ERROR] API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return c.json({ 
      status: 'error', 
      message: `查询出错: ${error instanceof Error ? error.message : "未知错误"}` 
    }, 500);
  }
});

// 启动服务器
const startServer = async () => {
  try {
    // 测试数据库连接
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('📊 Database connected successfully');
    
    // 启动服务器
    const port = 6690;
    console.log(`🔥 DailyHot API Service successfully runs on port ${port}`);
    console.log(`🔗 Local: 👉 http://localhost:${port}`);
    
    return app;
  } catch (error) {
    logger.error(`❌ Database connection failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
};

export { startServer, app }; 