import type { Context } from "hono";
import type { RouterData } from "../types.js";
import { config } from "../config.js";
import pkg from "pg";
const { Pool } = pkg;
import logger from "../utils/logger.js";

// 数据库连接
const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
});

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
}

export const handleRoute = async (c: Context, _: boolean) => {
  // 如果未启用历史API，返回错误
  if (!config.ENABLE_HISTORY_API) {
    return {
      name: "history",
      title: "历史数据",
      type: "查询",
      link: "",
      total: 0,
      data: [],
      message: "历史数据API未启用",
      updateTime: new Date().toISOString(),
      fromCache: false,
    };
  }

  // 获取查询参数
  const source = c.req.query("source"); // 数据源
  const date = c.req.query("date"); // 日期 YYYY-MM-DD
  const startDate = c.req.query("startDate"); // 开始日期
  const endDate = c.req.query("endDate"); // 结束日期
  const limit = parseInt(c.req.query("limit") || "50"); // 限制条数
  const offset = parseInt(c.req.query("offset") || "0"); // 偏移量
  const orderBy = c.req.query("orderBy") || "created_at"; // 排序字段
  const order = c.req.query("order")?.toUpperCase() === "ASC" ? "ASC" : "DESC"; // 排序方式

  try {
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
        id, source, item_id, title, description, url, mobile_url, cover, hot, created_at
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
      id: item.item_id,
      title: item.title,
      desc: item.description,
      url: item.url,
      mobileUrl: item.mobile_url,
      cover: item.cover,
      hot: item.hot,
      source: item.source,
      timestamp: item.created_at,
    }));

    // 返回结果
    const routeData: RouterData = {
      name: "history",
      title: "历史数据",
      type: "查询",
      link: "",
      total,
      data,
      updateTime: new Date().toISOString(),
      fromCache: false,
    };

    return routeData;
  } catch (error) {
    logger.error(`❌ [ERROR] History API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    
    return {
      name: "history",
      title: "历史数据",
      type: "查询",
      link: "",
      total: 0,
      data: [],
      message: `查询出错: ${error instanceof Error ? error.message : "未知错误"}`,
      updateTime: new Date().toISOString(),
      fromCache: false,
    };
  }
};
