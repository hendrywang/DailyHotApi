// 验证并提取环境变量
export const getEnvVariable = (key: string): string | undefined => {
  const value = process.env[key];
  if (value === undefined) return undefined;
  return value;
};

// 将环境变量转换为数值
export const getNumericEnvVariable = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const numericValue = Number(value);
  return isNaN(numericValue) ? defaultValue : numericValue;
};

// 将环境变量转换为布尔值
export const getBooleanEnvVariable = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}; 