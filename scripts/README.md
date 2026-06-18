# Deploy 脚本

## deploy.py — 统一部署

```bash
python3 scripts/deploy.py --target prod            # 部署 main → /opt/tomato
python3 scripts/deploy.py --target test            # 部署 test → /opt/tomato-test
python3 scripts/deploy.py --target prod --skip-build  # 跳过 build
python3 scripts/deploy.py --target test --reset-db    # 重建 db
python3 scripts/deploy.py --target prod --local-only  # 只打 tarball
```

**目标配置**:
| target | app_dir | port | basePath | branch | db |
|---|---|---|---|---|---|
| `prod` | `/opt/tomato` | 7896 | `/tomato` | main | tomato.db |
| `test` | `/opt/tomato-test` | 7895 | `/tomato-test` | test | tomato-test.db |

**注意**:
- 7893 端口被 `fund-stock-analysis` 后端占用, prod 用 7896
- 不用 sshpass（sandbox 没装），用 pexpect 处理 ssh
- tarball 始终含 `app/ components/ lib/` source，防止 server 端源码丢失
- server 端自动检测 systemd service 端口变化 + nginx proxy_pass 是否匹配，必要时更新

## promote.sh — 合并 + 部署生产

```bash
bash scripts/promote.sh
```

流程: `git fetch → 检查 test 是否领先 main → 用户确认 → merge test → main → push → 调 deploy.py --target prod`

## db-init.js — 数据库初始化

```bash
cd /opt/tomato
node scripts/db-init.js            # idempotent 建表
node scripts/db-init.js --reset    # 删库 + 创表（清空所有数据！）
```

`DATABASE_URL` 从 cwd 的 `.env` 或 `/opt/tomato/.env` 读，app_dir 从 cwd 推断。
