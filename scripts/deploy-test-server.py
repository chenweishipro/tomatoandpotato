#!/usr/bin/env python3
"""
deploy-test-server.py — 跑在 server 端, scp tarball + ssh 部署到 /opt/tomato-test
用法: deploy-test-server.py --host=... --password=... --app-dir=... --port=... --base-path=... --tarball=...
"""
import argparse
import pexpect
import sys
import time

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--app-dir", required=True)
    p.add_argument("--port", required=True)
    p.add_argument("--base-path", required=True)
    p.add_argument("--tarball", required=True)
    args = p.parse_args()

    # 1. scp tarball
    print(f"[scp] {args.tarball} -> {args.host}:/tmp/tomato-test.tar.gz", flush=True)
    scp_cmd = (
        f"scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
        f"{args.tarball} {args.host}:/tmp/tomato-test.tar.gz"
    )
    c = pexpect.spawn(scp_cmd, timeout=300, encoding='utf-8')
    i = c.expect(['password:', pexpect.TIMEOUT], timeout=30)
    if i != 0:
        print("[err] scp 等待 password 超时", flush=True)
        sys.exit(1)
    c.sendline(args.password)
    c.expect(pexpect.EOF, timeout=120)
    print("[scp] done", flush=True)

    # 2. ssh 部署
    print(f"[ssh] 部署到 {args.app_dir}", flush=True)
    c = pexpect.spawn(
        f"ssh -tt -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {args.host}",
        timeout=600, encoding='utf-8'
    )
    c.expect('password:')
    c.sendline(args.password)
    c.expect(r'\$', timeout=10)
    time.sleep(1)

    remote = f"""
set -e

echo "--- stop test service ---"
echo "{args.password}" | sudo -S systemctl stop tomato-test 2>/dev/null || true
sleep 2

echo "--- backup test db ---"
if [ -f "{args.app_dir}/prisma/tomato-test.db" ] && [ -s "{args.app_dir}/prisma/tomato-test.db" ]; then
  cp {args.app_dir}/prisma/tomato-test.db /tmp/tomato-test.db.bak.$(date +%Y%m%d-%H%M%S)
fi

echo "--- extract ---"
rm -rf {args.app_dir}.new
mkdir -p {args.app_dir}.new
cd {args.app_dir}.new
tar -xzf /tmp/tomato-test.tar.gz

echo "--- restore db ---"
LATEST_BAK=$(ls -t /tmp/tomato-test.db.bak.* 2>/dev/null | head -1 || true)
if [ -n "$LATEST_BAK" ] && [ -f "$LATEST_BAK" ]; then
  cp "$LATEST_BAK" {args.app_dir}.new/prisma/tomato-test.db
fi

echo "--- mv new to app ---"
echo "{args.password}" | sudo -S rm -rf {args.app_dir}
echo "{args.password}" | sudo -S mv {args.app_dir}.new {args.app_dir}
echo "{args.password}" | sudo -S chown -R ubuntu:ubuntu {args.app_dir}

cd {args.app_dir}

echo "--- npm install (含 dev deps) ---"
npm install --no-audit --no-fund 2>&1 | tail -3

echo "--- prisma generate ---"
npx prisma generate 2>&1 | tail -3

echo "--- copy prisma client to standalone ---"
rm -rf {args.app_dir}/.next/standalone/node_modules/.prisma
rm -rf {args.app_dir}/.next/standalone/node_modules/@prisma
cp -r {args.app_dir}/node_modules/.prisma {args.app_dir}/.next/standalone/node_modules/ 2>/dev/null
cp -r {args.app_dir}/node_modules/@prisma {args.app_dir}/.next/standalone/node_modules/ 2>/dev/null

echo "--- create dev.db symlinks ---"
for loc in \\
  "{args.app_dir}/.next/standalone/node_modules/.prisma/client/dev.db" \\
  "{args.app_dir}/prisma/dev.db" \\
  "{args.app_dir}/prisma/prisma/dev.db"; do
  if [ -e "$loc" ] || [ -L "$loc" ]; then
    [ ! -L "$loc" ] && rm -f "$loc"
  fi
  ln -sf {args.app_dir}/prisma/tomato-test.db "$loc"
done

echo "--- init db (idempotent) ---"
node scripts/db-init.js || echo 'db-init skipped'

echo "--- start service ---"
echo "{args.password}" | sudo -S systemctl start tomato-test
sleep 5
echo "{args.password}" | sudo -S systemctl is-active tomato-test

echo "--- verify ---"
curl -sI -m 5 http://127.0.0.1:{args.port}{args.base_path}/login/ | head -1
"""

    c.sendline(remote + 'echo "=== END ==="')
    i = c.expect(['=== END ===', pexpect.TIMEOUT], timeout=300)
    print(c.before, flush=True)
    c.sendline('exit')
    print("[ssh] done", flush=True)

if __name__ == "__main__":
    main()
