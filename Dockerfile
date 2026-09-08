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
  '    client_max_body_size 256k;' \
  '    add_header X-Content-Type-Options "nosniff" always;' \
  '    add_header X-Frame-Options "DENY" always;' \
  '    add_header Referrer-Policy "strict-origin-when-cross-origin" always;' \
  '    root /usr/share/nginx/html;' \
  '    index index.html;' \
  '    location /api/ {' \
  '        proxy_pass http://travel-plan-api:8787;' \
  '        proxy_http_version 1.1;' \
  '        proxy_set_header Host $host;' \
  '        proxy_set_header X-Real-IP $http_x_real_ip;' \
  '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
  '        proxy_set_header X-Forwarded-Proto $scheme;' \
  '        proxy_read_timeout 180s;' \
  '    }' \
  '    location /assets/ {' \
  '        try_files $uri =404;' \
  '        add_header Cache-Control "public, max-age=31536000, immutable";' \
  '    }' \
  '    location / {' \
  '        try_files $uri $uri/ /index.html;' \
  '    }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
