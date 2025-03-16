import dotenv from "dotenv";
import { getEnvVariable } from "./utils/getEnvVariable.js";

// 环境变量
dotenv.config();

// 配置接口
interface Config {
  PORT: number;
  ALLOWED_HOST: string;
  ALLOWED_DOMAIN: string;
  CACHE_TTL: number;
  REQUEST_TIMEOUT: number;
  RSS_MODE: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  // 数据库配置
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  // 定时任务配置
  CRON_SCHEDULE: string;
  RUN_ON_START: boolean;
  // API配置
  ENABLE_HISTORY_API: boolean;
  // 兼容旧配置
  DISALLOW_ROBOT: boolean;
  USE_LOG_FILE: boolean;
}

// 将环境变量转换为数值
const getNumericEnvVariable = (key: string, defaultValue: number): number => {
  const value = getEnvVariable(key) ?? String(defaultValue);
  const parsedValue = parseInt(value, 10);
  if (isNaN(parsedValue)) return defaultValue;
  return parsedValue;
};

// 将环境变量转换为布尔值
const getBooleanEnvVariable = (key: string, defaultValue: boolean): boolean => {
  const value = getEnvVariable(key) ?? String(defaultValue);
  return value.toLowerCase() === "true";
};

// 获取配置
export const config: Config = {
  // 端口
  PORT: getNumericEnvVariable("PORT", 6688),
  // 允许的域名
  ALLOWED_HOST: getEnvVariable("ALLOWED_HOST") || "",
  // 允许的域名
  ALLOWED_DOMAIN: getEnvVariable("ALLOWED_DOMAIN") || "*",
  // 缓存过期时间（ 秒 ）
  CACHE_TTL: getNumericEnvVariable("CACHE_TTL", 60 * 60),
  // 请求超时时间（ 毫秒 ）
  REQUEST_TIMEOUT: getNumericEnvVariable("REQUEST_TIMEOUT", 10000),
  // RSS 模式
  RSS_MODE: getBooleanEnvVariable("RSS_MODE", false),
  // Redis 配置
  REDIS_HOST: getEnvVariable("REDIS_HOST") || "127.0.0.1",
  REDIS_PORT: getNumericEnvVariable("REDIS_PORT", 6379),
  REDIS_PASSWORD: getEnvVariable("REDIS_PASSWORD") || "",
  // 数据库配置
  DB_HOST: getEnvVariable("DB_HOST") || "localhost",
  DB_PORT: getNumericEnvVariable("DB_PORT", 6689),
  DB_NAME: getEnvVariable("DB_NAME") || "dailyhot",
  DB_USER: getEnvVariable("DB_USER") || "postgres",
  DB_PASSWORD: getEnvVariable("DB_PASSWORD") || "postgres",
  // 定时任务配置
  CRON_SCHEDULE: getEnvVariable("CRON_SCHEDULE") || "0 * * * *", // 默认每小时执行一次
  RUN_ON_START: getBooleanEnvVariable("RUN_ON_START", true),
  // API配置
  ENABLE_HISTORY_API: getBooleanEnvVariable("ENABLE_HISTORY_API", true),
  // 兼容旧配置
  DISALLOW_ROBOT: getBooleanEnvVariable("DISALLOW_ROBOT", true),
  USE_LOG_FILE: getBooleanEnvVariable("USE_LOG_FILE", true),
};
