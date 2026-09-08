FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production \
    API_PORT=8787 \
    TZ=Asia/Shanghai

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8787/api/health >/dev/null || exit 1

CMD ["npm", "run", "server"]
