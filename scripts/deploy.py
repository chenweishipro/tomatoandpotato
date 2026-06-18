#!/usr/bin/env python3
"""
deploy.py — 番茄土豆统一部署脚本
=================================

支持:
  --target prod    部署到 /opt/tomato     (port 7896, basePath /tomato)
  --target test    部署到 /opt/tomato-test (port 7895, basePath /tomato-test)

流程:
  1. 拉/切到目标分支
  2. 临时改 next.config.mjs 的 basePath (build 用)
  3. npm install + npx next build
  4. 复制 app-level deps 到 .next/standalone/node_modules
  5. 改写 .next/standalone/.env (绝对路径 + basePath)
  6. tarball 打包 (含 source, 防止 server 端 app/ 缺失)
  7. scp 到 server
  8. server 端: 停 service + 备份 db + 清旧 + extract + 写 env + symlinks + db init + restart
  9. 验证 HTTP

注意:
  - 7893 端口被 fund-stock-analysis 占用, 所以 prod 用 7896
  - sandbox 没 sshpass, 用 pexpect 处理 ssh
  - tarball 始终含 app/ components/ lib/ (deploy 流程假设 server 上源码不完整)

用法:
  python3 scripts/deploy.py --target prod              # 部署当前 branch 到 prod
  python3 scripts/deploy.py --target test              # 部署 test 分支
  python3 scripts/deploy.py --target prod --skip-build # 用现有 .next
  python3 scripts/deploy.py --target test --reset-db    # 重建 db
"""
import argparse
import atexit
import base64
import os
import subprocess
import sys
import time
from pathlib import Path

# ============ 配置 ============

HOST = "ubuntu@122.51.221.63"
SSH_PASS = "Cws647378?!"

TARGETS = {
    "prod": {
        "app_dir": "/opt/tomato",
        "port": "7896",        # 7893 被 fund-stock-analysis 占用了
        "base_path": "/tomato",
        "branch": "main",
        "service": "tomato",
        "db_name": "tomato.db",
        "tarball_name": "tomato-prod.tar.gz",
    },
    "test": {
        "app_dir": "/opt/tomato-test",
        "port": "7895",
        "base_path": "/tomato-test",
        "branch": "test",
        "service": "tomato-test",
        "db_name": "tomato-test.db",
        "tarball_name": "tomato-test.tar.gz",
    },
}

NGINX_CONF = "/etc/nginx/sites-enabled/ml-learning-80"

# app-level 依赖 (deploy 不会自动 include, 需手动 copy)
APP_DEPS = [
    "bcryptjs", "next-auth", "zod", "clsx", "tailwind-merge", "framer-motion",
    "lucide-react", "react-markdown", "rehype-highlight", "remark-gfm",
    "date-fns", "@auth/prisma-adapter",
]
# 这些的 transitive deps (markdown 链)
APP_DEPS_TRANSITIVE = [
    "bail", "ccount", "character-entities", "character-entities-html4",
    "character-entities-legacy", "character-reference-invalid",
    "comma-separated-tokens", "decode-named-character-reference",
    "is-plain-obj", "property-information", "remark-parse", "remark-rehype",
    "space-separated-tokens", "mdast-util-from-markdown", "mdast-util-to-hast",
    "mdast-util-to-string", "micromark", "micromark-core-commonmark",
    "micromark-factory-destination", "micromark-factory-label",
    "micromark-factory-space", "micromark-factory-title", "micromark-factory-whitespace",
    "micromark-util-character", "micromark-util-chunked",
    "micromark-util-classify-character", "micromark-util-combine-extensions",
    "micromark-util-decode-numeric-character-reference", "micromark-util-encode",
    "micromark-util-html-tag-name", "micromark-util-normalize-identifier",
    "micromark-util-resolve-all", "micromark-util-sanitize-uri",
    "micromark-util-subtokenize", "micromark-util-symbol", "micromark-util-types",
    "trim-lines", "unist-util-position", "unist-util-stringify-position",
    "unist-util-visit", "unist-util-visit-parents", "unist-util-is",
    "unist-util-generated", "vfile", "vfile-message",
    "hast-util-whitespace", "hast-util-to-jsx-runtime", "html-url-attributes",
    "devlop", "estree-util-is-identifier-name", "longest-streak",
    "escape-string-regexp", "zwitch", "style-to-object", "inline-style-parser",
]

# ============ 颜色 ============

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"

def log(msg):  print(f"{GREEN}[deploy]{NC} {msg}", flush=True)
def warn(msg): print(f"{YELLOW}[warn]{NC} {msg}", flush=True)
def err(msg):  print(f"{RED}[err]{NC} {msg}", flush=True)

# ============ 子命令 ============

def sh(cmd, cwd=None, check=True):
    """跑 shell, 返回 CompletedProcess"""
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        err(f"cmd failed: {cmd}\n{r.stderr}")
        sys.exit(1)
    return r


def local_build(cfg, skip_build):
    """1-6: 改 basePath / build / copy deps / 改 env / tarball"""
    app_dir = cfg["app_dir"]
    port = cfg["port"]
    base_path = cfg["base_path"]
    branch = cfg["branch"]

    # 1. 切到目标分支
    log(f"1. checkout branch: {branch}")
    sh(f"git fetch origin {branch} 2>&1 | tail -2 || true")
    sh(f"git checkout {branch}")
    sh(f"git pull origin {branch} 2>&1 | tail -3 || true")
    sh("git log --oneline -1")

    # 2. 临时改 basePath
    log(f"2. 临时改 basePath → {base_path}")
    bak = Path("next.config.mjs.bak")
    if not bak.exists():
        sh(f"cp next.config.mjs {bak}")

    def restore_config():
        if bak.exists():
            sh(f"mv {bak} next.config.mjs", check=False)

    atexit.register(restore_config)

    try:
        # 3. build
        if not skip_build:
            log("3.0 npm install")
            sh("npm install --no-audit --no-fund 2>&1 | tail -3")
            log("3.1 npx next build")
            sh("npx next build 2>&1 | tail -5")
        else:
            log("3. skip build (--skip-build)")
        sh("cp -r .next/static .next/standalone/.next/static")

        # 4. copy app-level deps
        log("4. copy app-level deps to standalone")
        sh("mkdir -p .next/standalone/node_modules")
        all_deps = [p for p in APP_DEPS + APP_DEPS_TRANSITIVE if Path(f"node_modules/{p}").exists()]
        log(f"  need to copy {len(all_deps)} packages")
        for i, pkg in enumerate(all_deps, 1):
            sh(f"cp -r node_modules/{pkg} .next/standalone/node_modules/")
            if i % 15 == 0 or i == len(all_deps):
                log(f"  [{i}/{len(all_deps)}] {pkg}")
        pkg_count = subprocess.run(
            "ls .next/standalone/node_modules | wc -l",
            shell=True, capture_output=True, text=True
        ).stdout.strip()
        log(f"  standalone node_modules: {pkg_count} packages")

        # 5. 改 standalone/.env
        log("5. patch .next/standalone/.env")
        env_file = Path(".next/standalone/.env")
        if not env_file.exists():
            env_file.write_text(
                f'DATABASE_URL="file:{app_dir}/prisma/{cfg["db_name"]}"\n'
                f'NEXTAUTH_URL="http://122.51.221.63{base_path}"\n'
                f'HOSTNAME="127.0.0.1"\n'
                f'NEXTAUTH_SECRET="dev-secret-change-me-in-production-please-make-this-random-32-chars"\n'
            )
        else:
            sh(f'sed -i \'s|DATABASE_URL=.*|DATABASE_URL="file:{app_dir}/prisma/{cfg["db_name"]}"|\' .next/standalone/.env')
            sh(f'sed -i \'s|NEXTAUTH_URL=.*|NEXTAUTH_URL="http://122.51.221.63{base_path}"|\' .next/standalone/.env')
            sh('sed -i \'s|HOSTNAME=.*|HOSTNAME="127.0.0.1"|\' .next/standalone/.env')
        sh('grep -E "DATABASE_URL|NEXTAUTH_URL|HOSTNAME" .next/standalone/.env | sed "s/^/    /"')

    finally:
        # 6. 改回 next.config.mjs
        restore_config()
        try:
            atexit.unregister(restore_config)
        except: pass

    # 7. tarball (含 source 保险)
    tarball = f"/tmp/{cfg['tarball_name']}.{time.strftime('%Y%m%d-%H%M%S')}"
    log(f"7. tarball → {tarball}")
    sh("find .next/standalone -name dev.db -delete 2>/dev/null || true")
    sh(f"tar -czf {tarball} "
       f"--exclude='./node_modules' --exclude='./node_modules/*' "
       f"--exclude='.next/cache' "
       f"--exclude='prisma/*.db' --exclude='prisma/*.db-journal' --exclude='prisma/prisma/' "
       f"--exclude='screenshots/' --exclude='.git/' "
       f".next/standalone .next/static package.json package-lock.json prisma scripts "
       f"app components lib next.config.mjs tsconfig.json")
    log(f"  size: {os.path.getsize(tarball) // 1024 // 1024} MB")
    return tarball


def server_deploy(cfg, tarball, reset_db):
    """8-9: scp + server-side deploy + verify"""
    import pexpect

    app_dir = cfg["app_dir"]
    port = cfg["port"]
    base_path = cfg["base_path"]
    service = cfg["service"]
    db_name = cfg["db_name"]
    remote_tar = f"/tmp/{cfg['tarball_name']}"

    # 8.1 scp
    log(f"8.1 scp {tarball} → {HOST}:{remote_tar}")
    c = pexpect.spawn(
        f"scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
        f"{tarball} {HOST}:{remote_tar}",
        timeout=300, encoding="utf-8"
    )
    i = c.expect(["password:", pexpect.TIMEOUT], timeout=30)
    if i != 0:
        err("scp 等 password 超时")
        sys.exit(1)
    c.sendline(SSH_PASS)
    c.expect(pexpect.EOF, timeout=180)
    log("  scp done")

    # 8.2 server 端 deploy (用 base64 传内联脚本)
    log(f"8.2 server: 部署到 {app_dir}")
    remote_script = """
set -e
APP_DIR="__APP_DIR__"
SERVICE="__SERVICE__"
PORT="__PORT__"
BASE_PATH="__BASE_PATH__"
DB_NAME="__DB_NAME__"
SSHP="__SSHP__"
NGINX_FILE="__NGINX_FILE__"

echo "--- 1. stop service ---"
echo "$SSHP" | sudo -S systemctl stop $SERVICE 2>/dev/null || true
sleep 2

echo "--- 2. backup db ---"
if [ -f "$APP_DIR/prisma/$DB_NAME" ] && [ -s "$APP_DIR/prisma/$DB_NAME" ]; then
  cp "$APP_DIR/prisma/$DB_NAME" "/tmp/$DB_NAME.bak.$(date +%Y%m%d-%H%M%S)"
fi

echo "--- 3. clean old source + standalone ---"
rm -rf $APP_DIR/app $APP_DIR/components $APP_DIR/lib $APP_DIR/types $APP_DIR/.next/standalone

echo "--- 4. extract ---"
cd $APP_DIR
tar xzf __REMOTE_TAR__

echo "--- 5. write .env ---"
cat > $APP_DIR/.env <<EOF
DATABASE_URL="file:$APP_DIR/prisma/$DB_NAME"
NEXTAUTH_URL="http://122.51.221.63$BASE_PATH"
NEXTAUTH_SECRET="dev-secret-change-me-in-production-please-make-this-random-32-chars"
EOF
cat > $APP_DIR/.next/standalone/.env <<EOF
DATABASE_URL="file:$APP_DIR/prisma/$DB_NAME"
NEXTAUTH_URL="http://122.51.221.63$BASE_PATH"
NEXTAUTH_SECRET="dev-secret-change-me-in-production-please-make-this-random-32-chars"
HOSTNAME="127.0.0.1"
EOF
echo "  .env written"

echo "--- 6. npm install ---"
npm install --no-audit --no-fund 2>&1 | tail -2

echo "--- 7. prisma generate + copy to standalone ---"
npx prisma generate 2>&1 | tail -1
rm -rf $APP_DIR/.next/standalone/node_modules/.prisma $APP_DIR/.next/standalone/node_modules/@prisma
cp -r node_modules/.prisma $APP_DIR/.next/standalone/node_modules/
cp -r node_modules/@prisma $APP_DIR/.next/standalone/node_modules/

echo "--- 8. symlinks for prisma dev.db ---"
mkdir -p $APP_DIR/prisma/prisma
for loc in \\
  "$APP_DIR/.next/standalone/node_modules/.prisma/client/dev.db" \\
  "$APP_DIR/prisma/dev.db" \\
  "$APP_DIR/prisma/prisma/dev.db"; do
  if [ -e "$loc" ] && [ ! -L "$loc" ]; then rm -f "$loc"; fi
  [ ! -e "$loc" ] && ln -sf "$APP_DIR/prisma/$DB_NAME" "$loc"
done

echo "--- 9. db init ---"
node scripts/db-init.js __RESET_FLAG__ 2>&1 | tail -2

echo "--- 10. update systemd service port (if changed) ---"
SVC_FILE="/etc/systemd/system/$SERVICE.service"
if [ -f "$SVC_FILE" ]; then
  if ! grep -q "PORT=$PORT" "$SVC_FILE"; then
    echo "  updating PORT in $SVC_FILE"
    echo "$SSHP" | sudo -S sed -i 's|PORT=[0-9]*|PORT='$PORT'|' "$SVC_FILE"
    echo "$SSHP" | sudo -S sed -i 's|HOSTNAME=.*|HOSTNAME=127.0.0.1|' "$SVC_FILE"
    echo "$SSHP" | sudo -S systemctl daemon-reload
  fi
fi

echo "--- 11. restart service ---"
echo "$SSHP" | sudo -S systemctl restart $SERVICE
sleep 5
echo "$SSHP" | sudo -S systemctl is-active $SERVICE

echo "--- 12. update nginx (if location port mismatch) ---"
if [ -f "$NGINX_FILE" ]; then
  if grep -A5 "location $BASE_PATH" "$NGINX_FILE" | grep -q "proxy_pass http://127.0.0.1:"; then
    echo "  updating nginx proxy_pass for $BASE_PATH"
    echo "$SSHP" | sudo -S sed -i "/location $BASE_PATH/,/proxy_pass http:/ s|proxy_pass http://127.0.0.1:[0-9]*|proxy_pass http://127.0.0.1:$PORT|" "$NGINX_FILE"
    echo "$SSHP" | sudo -S nginx -t > /tmp/nginx-test.txt 2>&1 && echo "$SSHP" | sudo -S nginx -s reload
  fi
fi

echo "--- 13. verify ---"
PAGE=$(ls -t $APP_DIR/.next/standalone/.next/static/chunks/app/app/page-*.js 2>/dev/null | head -1)
echo "PAGE: $PAGE"
curl -sI -m 5 "http://127.0.0.1:$PORT$BASE_PATH/login/" | head -1
echo "DEPLOY_OK $APP_DIR"
"""
    # 用占位符 replace 避免 f-string / bash ${VAR} 冲突
    remote_script = remote_script.replace("__APP_DIR__", app_dir)
    remote_script = remote_script.replace("__SERVICE__", service)
    remote_script = remote_script.replace("__PORT__", port)
    remote_script = remote_script.replace("__BASE_PATH__", base_path)
    remote_script = remote_script.replace("__DB_NAME__", db_name)
    remote_script = remote_script.replace("__SSHP__", SSH_PASS)
    remote_script = remote_script.replace("__NGINX_FILE__", NGINX_CONF)
    remote_script = remote_script.replace("__REMOTE_TAR__", remote_tar)
    remote_script = remote_script.replace("__RESET_FLAG__", "--reset" if reset_db else "")

    c = pexpect.spawn(
        f"ssh -tt -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {HOST}",
        timeout=600, encoding="utf-8"
    )
    c.expect("password:")
    c.sendline(SSH_PASS)
    time.sleep(2)
    c.expect(r"\$", timeout=10)

    b64 = base64.b64encode(remote_script.encode()).decode()
    cmd = f'echo "{b64}" | base64 -d > /tmp/deploy-remote.sh && bash /tmp/deploy-remote.sh > /tmp/deploy-remote.log 2>&1 ; echo DONE_LOG=/tmp/deploy-remote.log'
    c.sendline(cmd)
    i = c.expect(["DONE_LOG=", pexpect.TIMEOUT], timeout=300)
    if i != 0:
        err("server deploy 超时, 看 server log")
        try:
            err(c.before[-500:])
        except: pass
        sys.exit(1)
    c.close()

    # 下载 server log
    log("  server deploy 完成, 下载日志...")
    c2 = pexpect.spawn(
        f"scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {HOST}:/tmp/deploy-remote.log /tmp/last-deploy.log",
        timeout=30, encoding="utf-8"
    )
    c2.expect("password:")
    c2.sendline(SSH_PASS)
    c2.expect(pexpect.EOF, timeout=15)
    c2.close()

    with open("/tmp/last-deploy.log") as f:
        content = f.read()
    print(content)
    if "DEPLOY_OK" not in content:
        err("server deploy 失败, 看 /tmp/last-deploy.log")
        sys.exit(1)

    # 9. 验证
    log(f"9. verify http://122.51.221.63{base_path}/")
    r = subprocess.run(
        ["curl", "-sI", "-m", "5", f"http://122.51.221.63{base_path}/login/"],
        capture_output=True, text=True
    )
    first = r.stdout.split("\n")[0] if r.stdout else "no response"
    if "200" in first:
        log(f"  ✓ {first}")
    else:
        warn(f"  {first}")

    log("════════════════════════════════════════")
    log(f"  ✅ 部署完成")
    log(f"  URL:    http://122.51.221.63{base_path}/")
    log(f"  Branch: {cfg['branch']}")
    log(f"  Port:   {port}")
    log(f"  DB:     {app_dir}/prisma/{db_name}")
    log("════════════════════════════════════════")


# ============ main ============

def main():
    p = argparse.ArgumentParser(description="番茄土豆统一部署")
    p.add_argument("--target", required=True, choices=["prod", "test"],
                   help="部署目标: prod (生产) / test (测试)")
    p.add_argument("--skip-build", action="store_true",
                   help="跳过本地 build, 用现有 .next/standalone")
    p.add_argument("--reset-db", action="store_true",
                   help="重建 db (慎用! 用户数据会清空)")
    p.add_argument("--local-only", action="store_true",
                   help="只本地 build + tarball, 不部署到 server")
    args = p.parse_args()

    cfg = TARGETS[args.target]
    log(f"target: {args.target} → {cfg['app_dir']} (port {cfg['port']}, basePath {cfg['base_path']})")

    tarball = local_build(cfg, args.skip_build)
    if args.local_only:
        log(f"local-only: tarball saved at {tarball}")
        return
    server_deploy(cfg, tarball, args.reset_db)


if __name__ == "__main__":
    main()
