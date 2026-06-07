FROM node:20-alpine

WORKDIR /app

# 复制依赖文件（如果存在）
COPY package*.json ./
RUN npm ci --only=production 2>/dev/null || true

# 复制应用文件
COPY file-manager.js .
COPY src/ ./src/

# 创建数据目录并设置权限
RUN mkdir -p /data && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /data

# 切换到非 root 用户
USER nodejs

EXPOSE 8888

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8888 || exit 1

CMD ["node", "file-manager.js"]