#!/usr/bin/env bash
# 番茄土豆 — promote: 测试通过后推到生产
# 用法: bash scripts/promote.sh
# 流程: 切到 test, 合并到 main, 推 origin, 跑 deploy.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log() { echo -e "${GREEN}[promote]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err() { echo -e "${RED}[err]${NC} $*"; }

# 1. 确认 test 比 main 新
log "1. 检查 test vs main"
git fetch origin 2>&1 | tail -2 || true
BEHIND=$(git rev-list --count main..origin/test 2>/dev/null || echo "0")
AHEAD=$(git rev-list --count origin/main..test 2>/dev/null || echo "0")
log "  test 领先 main: $AHEAD commits, 落后 main: $BEHIND commits"

if [ "$AHEAD" = "0" ]; then
  err "test 分支没有领先 main 的 commit, 无需 promote"
  exit 1
fi

# 2. 显示要 promote 的 commits
log "2. 要 promote 的 commits:"
git log --oneline origin/main..test | head -20
echo ""

# 3. 询问确认
read -p "$(echo -e "${YELLOW}[promote]${NC} 确认合并 test → main 并部署到生产? (yes/no): ")" CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  err "取消 promote"
  exit 1
fi

# 4. 切到 main, merge test, push
log "4. 合并 test → main"
git checkout main
git merge --no-ff test -m "promote: merge test → main (user approved)"
git push origin main 2>&1 | tail -3 || {
  err "push main 失败, 请检查网络 / PAT"
  exit 1
}

# 5. 部署到生产
log "5. 部署到生产环境 (http://122.51.221.63/tomato/)"
bash scripts/deploy.sh

log ""
log "════════════════════════════════════════"
log "  ✅ 测试代码已推到生产"
log "  生产 URL: http://122.51.221.63/tomato/"
log "════════════════════════════════════════"
