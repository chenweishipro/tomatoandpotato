# 📝 Tomato v1.0 — Changelog

## v1.0（2026-06-15）初始版本

### 核心功能
- 番茄钟（25/5/15 可配置时长）
- Web Audio API 合成白噪音（雨声/咖啡馆/森林/海浪，零网络依赖）
- Todo 任务（增删改查 + 优先级 P0/P1/P2 + 状态）
- 用户认证（NextAuth 邮箱密码 + JWT）
- 4 卡片统计 + 周/月/年热力图（GitHub 风格，max 归一化）
- 移动端响应式（双 tab 切换）

### 开发流程
- 4 象限管理（艾森豪威尔矩阵：按重要性+deadline+预计番茄数排序）
- Markdown 详情（react-markdown + remark-gfm）
- 休息/暂停/放弃番茄逻辑优化（去歧义）
- 页面刷新 timer 持久化（localStorage）

### 部署
- 路径：`/tomato/`
- systemd service: `tomato.service`（端口 7893）
- nginx 配 location `/tomato/`（80 → 7893）
- 部署脚本：`bash scripts/deploy.sh`（一键 build + scp + restart）
- DB 初始化：`node scripts/db-init.js [--reset]`

## Git Commits

```
39b48da fix(stats): 日周月热力图修复
2086804 fix(timer): 休息/暂停逻辑调整 + 页面刷新 timer 持久化
8165437 fix(timer): 当点击短休、长休时，不重置进行中的番茄钟
5d33129 feat(todo): 四象限管理（艾森豪威尔矩阵）
1d28e5f feat(todo): Markdown 详情 + 长文本支持
61be6ef feat: 番茄土豆 v1.0 初始版本
```

## Bug 修复历史

### v1.0.3（fix(timer) 短休/长休不打断）
- **症状**: focus 阶段点短休/长休按钮，timer 强制停止
- **根因**: `useEffect` 监听 phase 变化时调用了 `setRunning(false)`
- **修复**: 删除该行，phase 切时只重置 remaining

### v1.0.4（fix(timer) 休息/暂停 + 刷新持久化）
- **症状 1**: 短休/长休/专注 phase 切换按钮语义不清，用户歧义
- **修复**: 去掉短休/长休按钮，加"放弃番茄"按钮（带 confirm 二次确认）
- **症状 2**: 页面刷新 timer 重置回 25:00
- **修复**: localStorage 存 phase + remaining + startedAt，加载时根据 elapsed 恢复

### v1.0.5（fix(stats) 热力图修复）
- **症状 1**: 周/月热力图第一个星期标签"一"看着像破折号"-"
- **修复**: 改为完整"周一/二/..."
- **症状 2**: 年热力图没有月份标签
- **修复**: 顶部加 Jan/Feb/Mar 月份标签
- **症状 3**: 颜色分档太绝对，数据稀疏时断层
- **修复**: 改用 max 归一化
