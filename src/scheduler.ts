import { config } from "./config.js";
import logger from "./utils/logger.js";
import pkg from "pg";
const { Pool } = pkg;
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { get } from "./utils/getData.js";

// 记录最近处理的路由时间，用于去重
const routeProcessTimes = new Map<string, number>();
// 最小处理间隔（毫秒），设置为30分钟
const MIN_PROCESS_INTERVAL = 30 * 60 * 1000;

// 模拟 __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库连接
const pool = new Pool({
  host: config.DB_HOST || "postgres",
  port: typeof config.DB_PORT === 'string' ? parseInt(config.DB_PORT) : (config.DB_PORT as number) || 5432,
  database: config.DB_NAME || "dailyhot",
  user: config.DB_USER || "postgres",
  password: config.DB_PASSWORD || "postgres",
});

// 初始化数据库
async function initDatabase() {
  const client = await pool.connect();
  try {
    // 创建新闻数据表
    await client.query(`
      CREATE TABLE IF NOT EXISTS news_data (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        item_id VARCHAR(255),
        title TEXT NOT NULL,
        description TEXT,
        url TEXT,
        mobile_url TEXT,
        cover TEXT,
        hot BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        raw_data JSONB
      );
    `);
    
    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_news_source ON news_data(source);
      CREATE INDEX IF NOT EXISTS idx_news_created_at ON news_data(created_at);
      CREATE INDEX IF NOT EXISTS idx_news_source_item_id ON news_data(source, item_id);
    `);
    
    logger.info("📊 Database initialized successfully");
  } catch (error) {
    logger.error(`❌ Database initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  } finally {
    client.release();
  }
}

// 获取所有路由路径
function getAllRoutes() {
  const routesDir = path.join(__dirname, "routes");
  const routes = [];
  
  if (fs.existsSync(routesDir) && fs.statSync(routesDir).isDirectory()) {
    const files = fs.readdirSync(routesDir);
    for (const file of files) {
      if ((file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")) {
        routes.push(file.replace(/\.(ts|js)$/, ""));
      }
    }
  }
  
  return routes;
}

// 获取单个路由的数据并存入数据库
async function fetchAndStoreRouteData(route: string, forceUpdate = false) {
  // 检查是否在短时间内已经处理过该路由
  const lastProcessTime = routeProcessTimes.get(route) || 0;
  const now = Date.now();
  
  if (!forceUpdate && now - lastProcessTime < MIN_PROCESS_INTERVAL) {
    logger.info(`⏭️ Skipping route ${route}: recently processed (${Math.round((now - lastProcessTime) / 1000 / 60)} minutes ago)`);
    return;
  }
  
  logger.info(`🔄 Fetching data for route: ${route}`);
  try {
    // 动态导入路由处理函数
    const { handleRoute } = await import(`./routes/${route}.js`);
    // 强制不使用缓存获取最新数据
    // 创建一个更完善的模拟请求对象
    const mockReq = { 
      req: { 
        headers: {}, 
        url: `/${route}`,
        query: (key: string) => {
          // 为不同路由提供默认参数
          if (route === '36kr' && key === 'type') return 'hot';
          if (route === 'bilibili' && key === 'type') return 'all';
          return null;
        },
        param: (key: string) => null,
        json: () => ({}),
        get: (key: string) => null
      } 
    };
    const routeData = await handleRoute(mockReq, true);
    
    if (!routeData || !routeData.data || !Array.isArray(routeData.data)) {
      logger.warn(`⚠️ No valid data returned for route: ${route}`);
      return;
    }
    
    // 存储数据到数据库
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const item of routeData.data) {
        // 处理热度值，移除逗号并转换为数字
        let hotValue = 0;
        if (item.hot !== undefined && item.hot !== null) {
          // 如果是字符串且包含逗号，移除逗号后转换为数字
          if (typeof item.hot === 'string') {
            hotValue = parseInt(item.hot.replace(/,/g, ''));
          } else {
            hotValue = parseInt(item.hot);
          }
          
          // 如果转换结果不是数字，设为0
          if (isNaN(hotValue)) {
            hotValue = 0;
          }
        }
        
        // 准备插入数据
        await client.query(`
          INSERT INTO news_data 
            (source, item_id, title, description, url, mobile_url, cover, hot, raw_data)
          VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          route,
          item.id || `${item.title}-${Date.now()}`, // 使用ID或生成唯一标识
          item.title || '',
          item.desc || '',
          item.url || '',
          item.mobileUrl || item.url || '',
          item.cover || '',
          hotValue,
          JSON.stringify(item)
        ]);
      }
      
      await client.query('COMMIT');
      logger.info(`✅ Stored ${routeData.data.length} items for route: ${route}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`❌ Error storing data for route ${route}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      client.release();
    }
    
    // 更新处理时间
    routeProcessTimes.set(route, now);
  } catch (error) {
    logger.error(`❌ Error fetching data for route ${route}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// 获取所有路由的数据
async function fetchAllRoutesData(forceUpdate = false) {
  logger.info("🚀 Starting scheduled data fetch for all routes");
  const routes = getAllRoutes();
  
  // 串行执行以避免过多并发请求
  for (const route of routes) {
    await fetchAndStoreRouteData(route, forceUpdate);
    // 添加延迟以避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
  
  logger.info("✅ Completed scheduled data fetch for all routes");
}

// 启动定时任务
async function startScheduler() {
  // 初始化数据库
  await initDatabase();
  
  // 定义定时任务 - 每小时执行一次
  cron.schedule(config.CRON_SCHEDULE || "0 * * * *", async () => {
    logger.info("⏰ Running scheduled task to fetch all news data");
    await fetchAllRoutesData(false); // 定时任务不强制更新
  });
  
  // 启动时立即执行一次
  if (config.RUN_ON_START) {
    logger.info("🚀 Running initial data fetch on startup");
    await fetchAllRoutesData(true); // 启动时强制更新
  }
  
  logger.info(`📅 Scheduler started with cron pattern: ${config.CRON_SCHEDULE || "0 * * * *"}`);
}

// 导出启动函数
export default startScheduler; 