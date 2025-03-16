import type { RouterData } from "../types.js";
import type { RouterType } from "../router.types.js";
import { get } from "../utils/getData.js";
import { genHeaders } from "../utils/getToken/coolapk.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "coolapk",
    title: "酷安",
    type: "热榜",
    link: "https://www.coolapk.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

// 清理字符串中的无效UTF-8字符
const cleanString = (str: string): string => {
  if (!str) return '';
  // 移除null字节(0x00)和其他控制字符
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
};

// 清理对象中的所有字符串属性
const cleanObject = (obj: any): any => {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item));
  }
  
  const result: any = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      result[key] = cleanString(obj[key]);
    } else if (typeof obj[key] === 'object') {
      result[key] = cleanObject(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
};

const getList = async (noCache: boolean) => {
  const url = `https://api.coolapk.com/v6/page/dataList?url=/feed/statList?cacheExpires=300&statType=day&sortField=detailnum&title=今日热门&title=今日热门&subTitle=&page=1`;
  try {
    const result = await get({
      url,
      noCache,
      headers: genHeaders(),
    });
    
    // 清理数据中的无效UTF-8字符
    const cleanedData = cleanObject(result.data.data);
    
    return {
      ...result,
      data: cleanedData.map((v: RouterType["coolapk"]) => ({
        id: v.id,
        title: cleanString(v.message),
        cover: cleanString(v.tpic),
        author: cleanString(v.username),
        desc: cleanString(v.ttitle),
        timestamp: undefined,
        hot: undefined,
        url: cleanString(v.shareUrl),
        mobileUrl: cleanString(v.shareUrl),
      })),
    };
  } catch (error) {
    logger.error(`❌ Error fetching coolapk data: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { data: [], fromCache: false, updateTime: new Date().toISOString() };
  }
};
