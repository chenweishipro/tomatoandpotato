#!/usr/bin/env bash
# 番茄土豆 — 测试环境部署 (本地步骤)
# build 完打 tarball, 然后调 deploy-test-server.py 上 server
#
# 用法:
#   bash scripts/deploy-test.sh          # 拉 test 分支, build, deploy
#   bash scripts/deploy-test.sh main     # 拉 main 分支
#   bash scripts/deploy-test.sh --no-pull  # 用当前 checkout 部署

set -euo pipefail

HOST="ubuntu@122.51.221.63"
SSH_PASS='Cws647378?!'
APP_DIR="/opt/tomato-test"
APP_PORT="7894"
BASE_PATH="/tomato-test"
PUBLIC_URL="http://${HOST#*@}/tomato-test/"
TARBALL="/tmp/tomato-test-$(date +%Y%m%d-%H%M%S).tar.gz"
BRANCH="test"
DO_PULL=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    main|test) BRANCH="$arg" ;;
    *) echo "unknown arg: $arg"; exit 1 ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[deploy-test]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err() { echo -e "${RED}[err]${NC} $*"; }

# === 0. 拉分支 ===
if [ "$DO_PULL" = "1" ]; then
  log "0. 切到 $BRANCH 分支"
  git fetch origin 2>&1 | tail -2 || true
  git checkout $BRANCH 2>&1 | tail -2
  git pull origin $BRANCH 2>&1 | tail -3 || true
fi

# === 0.5 临时改 basePath ===
log "0.5 临时改 basePath 为 $BASE_PATH"
cp next.config.mjs next.config.mjs.bak
sed -i "s|basePath: \"/tomato\"|basePath: \"$BASE_PATH\"|" next.config.mjs
trap 'mv next.config.mjs.bak next.config.mjs 2>/dev/null || true' EXIT

# === 1. Build ===
log "1.0 npm install (含 dev deps)"
npm install --no-audit --no-fund 2>&1 | tail -3
log "1. npx next build"
npx next build 2>&1 | tail -5
cp -r .next/static .next/standalone/.next/static

# === 1.5 复制 app-level deps ===
log "1.5 copying app-level deps to standalone"
mkdir -p .next/standalone/node_modules
for pkg in bcryptjs next-auth zod clsx tailwind-merge framer-motion lucide-react \
           react-markdown rehype-highlight remark-gfm date-fns @auth/prisma-adapter; do
  [ -d "node_modules/$pkg" ] && cp -r "node_modules/$pkg" ".next/standalone/node_modules/"
done
for pkg in bail ccount character-entities character-entities-html4 character-entities-legacy \
           character-reference-invalid comma-separated-tokens decode-named-character-reference \
           is-plain-obj property-information remark-parse remark-rehype space-separated-tokens \
           mdast-util-from-markdown mdast-util-to-hast mdast-util-to-string micromark \
           micromark-core-commonmark micromark-factory-destination micromark-factory-label \
           micromark-factory-space micromark-factory-title micromark-factory-whitespace \
           micromark-util-character micromark-util-chunked micromark-util-classify-character \
           micromark-util-combine-extensions micromark-util-decode-numeric-character-reference \
           micromark-util-encode micromark-util-html-tag-name micromark-util-normalize-identifier \
           micromark-util-resolve-all micromark-util-sanitize-uri micromark-util-subtokenize \
           micromark-util-symbol micromark-util-types trim-lines unist-util-position \
           unist-util-stringify-position unist-util-visit unist-util-visit-parents unist-util-is \
           unist-util-generated vfile vfile-message hast-util-whitespace hast-util-to-jsx-runtime \
           html-url-attributes devlop estree-util-is-identifier-name longest-streak \
           escape-string-regexp zwitch style-to-object inline-style-parser; do
  [ -d "node_modules/$pkg" ] && cp -r "node_modules/$pkg" ".next/standalone/node_modules/"
done
log "  standalone node_modules: $(ls .next/standalone/node_modules | wc -l) packages"

# === 2. 改 standalone/.env ===
log "2. 改 standalone/.env"
if [ -f ".next/standalone/.env" ]; then
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:'"$APP_DIR"'/prisma/tomato-test.db"|' .next/standalone/.env
  sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL="http://'"${HOST#*@}"'/tomato-test"|' .next/standalone/.env
  sed -i 's|HOSTNAME=.*|HOSTNAME="127.0.0.1"|' .next/standalone/.env
  log "  patched:"
  grep -E "DATABASE_URL|NEXTAUTH_URL|HOSTNAME" .next/standalone/.env | sed 's/^/    /'
fi

# === 3. Tarball ===
log "3. tarball $TARBALL"
find .next/standalone -name "dev.db" -delete 2>/dev/null || true
tar -czf "$TARBALL" \
  --exclude='./node_modules' \
  --exclude='./node_modules/*' \
  --exclude='.next/cache' \
  --exclude='prisma/*.db' \
  --exclude='prisma/*.db-journal' \
  --exclude='prisma/prisma/' \
  --exclude='screenshots/' \
  --exclude='scripts/deploy.sh' \
  --exclude='scripts/deploy-test.sh' \
  --exclude='scripts/promote.sh' \
  --exclude='.git/' \
  .next/standalone .next/static package.json package-lock.json prisma scripts
log "  size: $(ls -lh $TARBALL | awk '{print $5}')"

# === 4. 恢复 next.config.mjs (build 完成, 恢复) ===
mv next.config.mjs.bak next.config.mjs
trap - EXIT

# === 5. 调 server-side deploy script ===
log "5. 调 server-side 部署"
python3 "$(dirname "$0")/deploy-test-server.py" \
  --host="$HOST" --password="$SSH_PASS" \
  --app-dir="$APP_DIR" --port="$APP_PORT" --base-path="$BASE_PATH" \
  --tarball="$TARBALL"

# === 6. 验证 ===
log "6. verify"
sleep 2
HTTP_CODE=$(curl -sI -m 5 -o /dev/null -w "%{http_code}" "$PUBLIC_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  log "✓ $PUBLIC_URL 200 OK"
  log ""
  log "════════════════════════════════════════"
  log "  🧪 测试环境就绪"
  log "  URL:    $PUBLIC_URL"
  log "  Branch: $BRANCH"
  log "  Port:   $APP_PORT"
  log "  DB:     $APP_DIR/prisma/tomato-test.db"
  log "════════════════════════════════════════"
  log "👉 请在浏览器打开 $PUBLIC_URL 测试"
  log "   测试通过后告诉我, 我用 scripts/promote.sh 推到生产"
else
  err "测试环境访问失败 (HTTP $HTTP_CODE), 请看 server log /tmp/tomato-test.err"
  exit 1
fi

log "DONE 🎉"
