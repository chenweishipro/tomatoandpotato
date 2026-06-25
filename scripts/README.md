# 部署脚本

| 脚本 | 用途 | 部署到 | 端口 | basePath |
|---|---|---|---|---|
| `deploy-prod.sh` | 生产环境 | `/opt/tomato` | 7893 | `/tomato` |
| `deploy-test.sh` | 测试环境 (test 分支) | `/opt/tomato-test` | 7895 | `/tomato-test` |

## 通用流程
1. `rm -rf .next` (避免 zombie 老代码)
2. `tar xzf /tmp/tomato-*.tar.gz` (来自 sandbox `scp`)
3. 写 `standalone/.env` (含绝对路径 DATABASE_URL + PORT + NEXTAUTH_URL)
4. cp `public/` → `standalone/public/` (next.js 14 standalone 不自动 cp)
5. 建 prisma client symlinks (避免 next 找不到 dev.db)
6. **🆕 Deploy 验证**: grep 关键 marker 确认新代码到位 (至少 1 命中)
7. `pkill -9 -f server.js` + `systemctl start tomato[-test]`
8. 验证 service `is-active = active` + 端口 listen

## 用法
```bash
# 在 sandbox 端
python3 -c "import pexpect; c=pexpect.spawn('scp ...'); ..."
# 1. scp tarball 到 /tmp/tomato-prod.tar.gz
# 2. scp scripts/deploy-prod.sh 到 /tmp/tomato-deploy.sh
# 3. ssh 跑: nohup bash /tmp/tomato-deploy.sh > /tmp/td.log 2>&1 &

# 在 server 端 (调试)
bash /tmp/tomato-deploy.sh   # 直接跑 (前台, 输出到 stdout)
```

## 验证 marker 列表
- `今日进度` (desktop daily stats card)
- `setTodayCount` / `setTodayMinutes` (state)
- `todayCount` (render)
- `行为` (settings section)
- `DayDetailModal` (heatmap click)
- `hidden lg:grid` (desktop only)
