# 云函数运行器镜像:先在宿主机 node prepare.mjs 生成 functions/,再 docker compose build
FROM node:24-alpine
WORKDIR /app
# 函数没有第三方依赖(admin-data 已换成 extra/ 里的无依赖版本),不用 npm install
COPY blobs.mjs server.mjs ./
COPY functions ./functions
ENV PORT=8787 BLOBS_DIR=/data/blobs NODE_ENV=production
EXPOSE 8787
CMD ["node", "server.mjs"]
