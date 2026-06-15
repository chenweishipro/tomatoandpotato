# 🍅 番茄土豆 (Tomato)

极简好用的番茄工作法 + Todo Web 应用。

## 特性

- 🍅 番茄钟（25/5/15 分钟可配 + 白噪音 + 桌面通知）
- ✅ Todo 列表（三栏 + 优先级 P0/P1/P2 + 关联番茄数）
- 📊 统计（今日/本周/365 天热力图）
- 🔐 邮箱密码注册/登录
- 📱 响应式（手机浏览器也能用）

## 本地开发

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

访问 http://localhost:3000

## 部署

参见 `deploy.sh`（生产环境 `ml.chenweishi.cn/tomato`）。
