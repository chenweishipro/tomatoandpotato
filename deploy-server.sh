#!/usr/bin/env bash
# 在服务器上执行的部署脚本
set -e

REMOTE_DIR="/opt/tomato"
TARBALL="$1"
NEXTAUTH_SECRET="$2"

if [ -z "$TARBALL" ] || [ -z "$NEXTAUTH_SECRET" ]; then
  echo "Usage: $0 <tarball> <nextauth-secret>"
  exit 1
fi

cd "$REMOTE_DIR"

echo "==> 0. sudo 验证"
sudo -n true 2>/dev/null || SUDO="sudo" || SUDO=""
SUDO="sudo"

echo "==> 1. 备份旧版 + 清空"
if [ -d "$REMOTE_DIR/.next" ]; then
  $SUDO rm -rf "${REMOTE_DIR}.bak.$(date +%Y%m%d-%H%M%S)" || true
  $SUDO mv "$REMOTE_DIR" "${REMOTE_DIR}.bak.$(date +%Y%m%d-%H%M%S)" || true
fi
$SUDO mkdir -p "$REMOTE_DIR"
$SUDO chown ubuntu:ubuntu "$REMOTE_DIR"

echo "==> 2. 解压"
tar -xzf "$TARBALL" -C "$REMOTE_DIR"
ls "$REMOTE_DIR"

echo "==> 3. 复制 .next/static 到 standalone"
cp -r .next/static .next/standalone/.next/static

echo "==> 4. 写 .env.production"
cat > .env.production <<EOF
DATABASE_URL="file:/opt/tomato/prisma/tomato.db"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="https://ml.chenweishi.cn/tomato"
EOF

echo "==> 5. npm install --omit=dev (装 production deps)"
npm install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | tail -10

echo "==> 6. prisma generate"
npx prisma generate 2>&1 | tail -3

echo "==> 7. prisma db push (建表 + 建 db 文件)"
npx prisma db push --skip-generate --accept-data-loss 2>&1 | tail -3
ls -la prisma/

echo "==> 8. 复制 node_modules/.prisma 到 standalone (确保 prisma client 在 standalone 找得到)"
mkdir -p .next/standalone/node_modules
cp -rn node_modules/.prisma .next/standalone/node_modules/ 2>&1 || true
ls .next/standalone/node_modules/

echo "==> 9. 创建 systemd service"
$SUDO tee /etc/systemd/system/tomato.service > /dev/null <<EOF
[Unit]
Description=Tomato Pomodoro App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/tomato/.next/standalone
Environment="DATABASE_URL=file:/opt/tomato/prisma/tomato.db"
Environment="NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
Environment="NEXTAUTH_URL=https://ml.chenweishi.cn/tomato"
Environment="PORT=7893"
Environment="HOSTNAME=127.0.0.1"
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/tomato.log
StandardError=append:/var/log/tomato.err

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable tomato

echo "==> 10. 停掉旧 service, 启动新 service"
$SUDO systemctl stop tomato 2>/dev/null || true
sleep 1
$SUDO systemctl restart tomato
sleep 3
$SUDO systemctl status tomato --no-pager -l | head -15

echo "==> 11. 健康检查"
curl -sI -m 5 http://127.0.0.1:7893/login | head -2 || echo "service check failed"
echo ""
curl -sI -m 5 http://127.0.0.1:7893/ | head -2 || true

echo "==> 12. nginx 加 /tomato location"
NGINX_CONF="/etc/nginx/sites-enabled/ml-learning-80"
if [ -f "$NGINX_CONF" ]; then
  if $SUDO grep -q "location /tomato" "$NGINX_CONF"; then
    echo "已有 /tomato location"
  else
    # 在 server_name 后面插入 /tomato location block
    $SUDO sed -i '/server_name.*;/a\
\
    # 🍅 Tomato Pomodoro\
    location /tomato/ {\
        proxy_pass http://127.0.0.1:7893/;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_redirect off;\
    }\
\
    location = /tomato {\
        return 301 $scheme://$host/tomato/;\
    }' "$NGINX_CONF"
    $SUDO nginx -t
    $SUDO systemctl reload nginx
    echo "nginx reload ok"
  fi
else
  echo "⚠️ 没找到 nginx conf: $NGINX_CONF"
fi

echo "==> 部署完成"
echo "访问: https://ml.chenweishi.cn/tomato"
