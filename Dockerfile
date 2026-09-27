# ---------- Build frontend ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Serve frontend and proxy API ----------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf '%s\n' \
  'server {' \
  '    listen 80;' \
  '    client_max_body_size 1024k;' \
  '    add_header X-Content-Type-Options "nosniff" always;' \
  '    add_header X-Frame-Options "DENY" always;' \
  '    add_header Referrer-Policy "strict-origin-when-cross-origin" always;' \
  '    root /usr/share/nginx/html;' \
  '    index index.html;' \
  '    # 仅信任内网反代（如 Nginx Proxy Manager）覆写的 X-Real-IP；直连流量保持' \
  '    # 真实连接地址，客户端伪造的头不会影响 $remote_addr，防止限流键被绕过。' \
  '    set_real_ip_from 10.0.0.0/8;' \
  '    set_real_ip_from 172.16.0.0/12;' \
  '    set_real_ip_from 192.168.0.0/16;' \
  '    real_ip_header X-Real-IP;' \
  '    real_ip_recursive on;' \
  '    location /api/ {' \
  '        proxy_pass http://travel-plan-api:8787;' \
  '        proxy_http_version 1.1;' \
  '        proxy_set_header Host $host;' \
  '        proxy_set_header X-Real-IP $remote_addr;' \
  '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '        proxy_set_header X-Forwarded-Proto $scheme;' \
  '        proxy_read_timeout 180s;' \
  '    }' \
  '    # location 块内的 add_header 会取消继承 server 级安全头，这里需要重复声明。' \
  '    location /assets/ {' \
  '        try_files $uri =404;' \
  '        add_header X-Content-Type-Options "nosniff" always;' \
  '        add_header X-Frame-Options "DENY" always;' \
  '        add_header Referrer-Policy "strict-origin-when-cross-origin" always;' \
  '        add_header Cache-Control "public, max-age=31536000, immutable";' \
  '    }' \
  '    location / {' \
  '        try_files $uri $uri/ =404;' \
  '    }' \
  '    error_page 404 /404.html;' \
  '    location = /404.html {' \
  '        internal;' \
  '    }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
