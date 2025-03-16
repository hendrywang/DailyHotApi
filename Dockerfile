FROM node:20-alpine AS base

ENV NODE_ENV=docker
ENV TZ=Asia/Shanghai

# 安装 tzdata 并设置时区
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 清理缓存
RUN rm -rf /var/cache/apk/*

# 构建阶段
FROM base AS builder

RUN npm install -g pnpm
WORKDIR /app

COPY package*json tsconfig.json pnpm-lock.yaml .env.example ./
COPY src ./src
COPY public ./public

# 复制环境变量
RUN [ ! -e ".env" ] && cp .env.example .env || true

# 创建类型声明文件
RUN mkdir -p src/types && \
    echo "declare module 'pg';" > src/types/pg.d.ts && \
    echo "declare module 'node-cron';" > src/types/node-cron.d.ts

# 安装依赖
RUN pnpm install
RUN pnpm build
RUN pnpm prune --production

# 运行阶段
FROM base AS runner

# 确保时区设置正确
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone
# 不删除 tzdata 包，保留时区数据

# 创建用户和组
RUN addgroup --system --gid 114514 nodejs
RUN adduser --system --uid 114514 hono

# 创建日志目录
RUN mkdir -p /app/logs && chown -R hono:nodejs /app/logs
RUN ln -s /app/logs /logs

# 复制文件
COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder /app/public /app/public
COPY --from=builder /app/.env /app/.env
COPY --from=builder /app/package.json /app/package.json

# 切换用户
USER hono

# 暴露端口
EXPOSE 6688

# 运行
CMD ["node", "/app/dist/index.js"]