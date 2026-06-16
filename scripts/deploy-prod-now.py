#!/usr/bin/env python3
import pexpect, time, sys, base64

tarball = "/tmp/tomato-20260616-101132.tar.gz"

# 1. scp
print("=== scp tarball ===", flush=True)
c = pexpect.spawn(
    f'scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {tarball} ubuntu@122.51.221.63:/tmp/tomato.tar.gz',
    timeout=180, encoding='utf-8'
)
c.expect('password:')
c.sendline('Cws647378?!')
c.expect(pexpect.EOF, timeout=180)
print(c.before if c.before else "scp done", flush=True)

deploy_script = r'''#!/usr/bin/env bash
set -e
APP_DIR="/opt/tomato"
cd $APP_DIR

tar xzf /tmp/tomato.tar.gz

NEED_INSTALL=0
for pkg in bcryptjs next zod; do
  [ ! -d ".next/standalone/node_modules/$pkg" ] && NEED_INSTALL=1 && break
done

if [ "$NEED_INSTALL" = "1" ]; then
  echo "[deploy] standalone 缺核心依赖, 跑 npm install..."
  npm install --no-audit --no-fund 2>&1 | tail -2
  npx prisma generate 2>&1 | tail -1
  mkdir -p .next/standalone/node_modules
  cp -r node_modules/.prisma .next/standalone/node_modules/ 2>/dev/null || true
  cp -r node_modules/@prisma .next/standalone/node_modules/ 2>/dev/null || true
  for pkg in bcryptjs next next-auth zod clsx tailwind-merge framer-motion lucide-react react-markdown rehype-highlight remark-gfm date-fns @auth/prisma-adapter; do
    [ -d "node_modules/$pkg" ] && cp -r "node_modules/$pkg" ".next/standalone/node_modules/" 2>/dev/null || true
  done
  for pkg in bail ccount character-entities character-entities-html4 character-entities-legacy character-reference-invalid comma-separated-tokens decode-named-character-reference is-plain-obj property-information remark-parse remark-rehype space-separated-tokens mdast-util-from-markdown mdast-util-to-hast mdast-util-to-string micromark micromark-core-commonmark micromark-factory-destination micromark-factory-label micromark-factory-space micromark-factory-title micromark-factory-whitespace micromark-util-character micromark-util-chunked micromark-util-classify-character micromark-util-combine-extensions micromark-util-decode-numeric-character-reference micromark-util-encode micromark-util-html-tag-name micromark-util-normalize-identifier micromark-util-resolve-all micromark-util-sanitize-uri micromark-util-subtokenize micromark-util-symbol micromark-util-types trim-lines unist-util-position unist-util-stringify-position unist-util-visit unist-util-visit-parents unist-util-is unist-util-generated vfile vfile-message hast-util-whitespace hast-util-to-jsx-runtime html-url-attributes devlop estree-util-is-identifier-name longest-streak escape-string-regexp zwitch style-to-object inline-style-parser; do
    [ -d "node_modules/$pkg" ] && cp -r "node_modules/$pkg" ".next/standalone/node_modules/" 2>/dev/null || true
  done
fi

[ -f .next/standalone/.env ] || cp .env .next/standalone/.env 2>/dev/null || true
sed -i 's|DATABASE_URL=.*|DATABASE_URL="file:/opt/tomato/prisma/tomato.db"|' .next/standalone/.env
sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL="http://122.51.221.63/tomato"|' .next/standalone/.env
sed -i 's|HOSTNAME=.*|HOSTNAME="127.0.0.1"|' .next/standalone/.env
echo "[deploy] .env patched:"
grep -E "DATABASE_URL|NEXTAUTH_URL|HOSTNAME" .next/standalone/.env | sed 's/^/    /'

echo "[deploy] db init..."
node scripts/db-init.js 2>&1 | tail -3

mkdir -p prisma/prisma
for loc in ".next/standalone/node_modules/.prisma/client/dev.db" "prisma/dev.db" "prisma/prisma/dev.db"; do
  if [ -e "$loc" ] && [ ! -L "$loc" ]; then rm -f "$loc"; fi
  if [ ! -e "$loc" ]; then ln -sf /opt/tomato/prisma/tomato.db "$loc"; fi
done

echo "[deploy] restart..."
echo "Cws647378?!" | sudo -S systemctl restart tomato
sleep 5
echo "Cws647378?!" | sudo -S systemctl is-active tomato
echo "---"
PAGE=$(ls -t .next/standalone/.next/static/chunks/app/app/page-*.js 2>/dev/null | head -1)
echo "PAGE: $PAGE"
echo "--- verify HTTP ---"
curl -s -o /dev/null -w "login HTTP %{http_code}\n" -L http://122.51.221.63/tomato/login/
curl -s -o /dev/null -w "app   HTTP %{http_code}\n" -L http://122.51.221.63/tomato/app/
echo "---"
echo "Cws647378?!" | sudo -S journalctl -u tomato -n 5 --no-pager 2>&1 | tail -5
'''

print("=== deploy on server ===", flush=True)
c = pexpect.spawn(
    'ssh -tt -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@122.51.221.63',
    timeout=300, encoding='utf-8'
)
c.expect('password:')
c.sendline('Cws647378?!')
time.sleep(2)
c.expect(r'\$', timeout=10)

b64 = base64.b64encode(deploy_script.encode()).decode()
c.sendline(f'echo "{b64}" | base64 -d > /tmp/deploy-prod.sh && chmod +x /tmp/deploy-prod.sh && bash /tmp/deploy-prod.sh ; echo "===END==="')
c.expect(['===END===', pexpect.TIMEOUT], timeout=240)
print(c.before, flush=True)
c.sendline('exit')
try: c.expect(pexpect.EOF, timeout=5)
except: pass
