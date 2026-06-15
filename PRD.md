# 🍅 番茄土豆 v1.0 — 产品方案

> 一个极简、好用的番茄工作法 + Todo 工具。Web 响应式，单域名部署。

---

## 1. 目标

- **核心**：让"开始专注"这件事的阻力降到零——打开就能开始，无需复杂设置
- **特色**：番茄钟和 Todo 深度绑定，每个番茄钟都挂在某个 todo 上，做完一目了然
- **氛围**：白噪音 + 番茄钟红色主题 + 简洁 UI，让人想用

---

## 2. 核心功能（MVP）

### 2.1 番茄钟 🍅

| 状态 | 行为 |
|------|------|
| 空闲 | 显示「开始专注」+ 选 todo（或快速专注） |
| 专注中 | 大字倒计时、进度环、可暂停/取消 |
| 休息中 | 短休息 5min / 长休息 15min（每 4 个番茄自动长休息） |
| 完成 | 弹完成提示 + 桌面通知 + 滴一声（可静音） |

**可配置**（设置页）：
- 专注时长：默认 25 min（15-60 范围）
- 短休息：默认 5 min
- 长休息：默认 15 min
- 几个番茄后长休息：默认 4
- 自动开始休息：默认开
- 桌面通知：默认开

### 2.2 Todo ✅

- 增删改查（标题必填，可选描述、优先级 P0/P1/P2、标签）
- 三栏：待办 / 进行中 / 已完成（归档可恢复）
- 排序：拖拽 / 优先级 / 创建时间
- 一个 todo 可挂多个已完成番茄钟（显示累计番茄数）

### 2.3 统计 📊

- **今日**：完成番茄数、专注总分钟
- **本周**：每日条形图
- **热力图**：最近 365 天（绿到深绿）
- **Todo 完成率**：本周完成/创建比

### 2.4 用户系统 🔐

- 邮箱 + 密码注册/登录（bcrypt 加密）
- Session 用 NextAuth.js（JWT）
- 个人设置页：昵称、头像（首字母）、密码修改

### 2.5 加分项（看时间）

- 白噪音（雨声/咖啡馆/海浪，可调音量）
- 番茄历史详情页（看每个番茄的 todo、时间）
- 数据导出（JSON）
- 番茄完成庆祝动画

---

## 3. 数据 Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String?   // 昵称
  createdAt     DateTime  @default(now())

  todos         Todo[]
  pomodoros     Pomodoro[]
  settings      Settings?
}

model Settings {
  id              String   @id @default(cuid())
  userId          String   @unique
  focusMinutes    Int      @default(25)
  shortBreakMin   Int      @default(5)
  longBreakMin    Int      @default(15)
  pomosBeforeLong Int      @default(4)
  autoStartBreak  Boolean  @default(true)
  desktopNotif    Boolean  @default(true)
  soundEnabled    Boolean  @default(true)
  soundType       String   @default("bell")  // bell/chime/digital
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Todo {
  id          String     @id @default(cuid())
  userId      String
  title       String
  description String?
  priority    Int        @default(1)  // 0=P0, 1=P1, 2=P2
  status      String     @default("todo")  // todo / doing / done / archived
  order       Int        @default(0)
  tags        String?    // 逗号分隔
  createdAt   DateTime   @default(now())
  completedAt DateTime?
  updatedAt   DateTime   @updatedAt

  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  pomodoros   Pomodoro[]

  @@index([userId, status])
  @@index([userId, createdAt])
}

model Pomodoro {
  id          String   @id @default(cuid())
  userId      String
  todoId      String?
  type        String   // focus / short_break / long_break
  durationMin Int      // 实际分钟
  completedAt DateTime @default(now())
  // 不存 startedAt 节省空间；分析时按 completedAt 聚合

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  todo        Todo?    @relation(fields: [todoId], references: [id], onDelete: SetNull)

  @@index([userId, completedAt])
  @@index([todoId])
}
```

---

## 4. API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/[...nextauth]` | NextAuth 登录 |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
| GET | `/api/todos?status=todo` | 列表 |
| POST | `/api/todos` | 创建 |
| PATCH | `/api/todos/:id` | 更新（标题/状态/优先级/排序） |
| DELETE | `/api/todos/:id` | 删除（软删，移归档） |
| POST | `/api/pomodoros/start` | 开始一个番茄（返回 todoId） |
| POST | `/api/pomodoros/complete` | 完成一个番茄（写库） |
| POST | `/api/pomodoros/cancel` | 取消（不写库） |
| GET | `/api/stats/today` | 今日统计 |
| GET | `/api/stats/heatmap?year=2026` | 热力图数据 |
| GET | `/api/stats/week` | 本周每日条形图 |

**实时性**：番茄钟计时完全在客户端（setInterval），完成后才写库。
- 好处：服务器无状态、刷新页面会丢当前会话（但 MVP 可接受）
- 后续：localStorage 存正在进行的番茄，刷新可恢复

---

## 5. 页面结构

```
/                  → 已登录跳 /app，否则跳 /login
/login             → 登录
/register          → 注册
/app               → 主界面（番茄钟 + Todo 双栏，移动端切换 tab）
/app/stats         → 统计页
/app/settings      → 设置
/app/history       → 番茄历史
```

**主界面布局**（桌面）：
```
┌─────────────────────────────────────┐
│  🍅 番茄土豆    [统计][设置][头像]   │
├──────────────┬──────────────────────┤
│              │  ▶ 待办 (3)          │
│   25:00      │  □ 写完 PRD          │
│   专注中     │  □ 部署新版本         │
│  [暂停][取消] │  □ 开会               │
│              │  ─── 进行中 ───      │
│  ⏸ 休息 5min │  ▶ 改 Bug #42  🍅×2  │
│              │  ─── 已完成 ───      │
│  🔊 雨声     │  ☑ 学完 React 18  🍅×4│
└──────────────┴──────────────────────┘
```

---

## 6. 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS + shadcn/ui 风格手搓 |
| 数据库 | SQLite (Prisma) |
| 认证 | NextAuth.js (Credentials Provider) |
| 状态 | React Server Components + Client Components |
| 动画 | Framer Motion（番茄完成庆祝） |
| 部署 | 复用 ml-learning 那套 (next standalone + nginx) |

---

## 7. 部署

- 子路径：`https://ml.chenweishi.cn/tomato`
- 新建 nginx location 转发到 Node 7893 端口
- 单独 SQLite db：`/opt/tomato/prisma/tomato.db`
- 系统服务：`tomato.service` (systemd)

---

## 8. 范围之外（先不做）

- 团队/好友功能
- 移动 App
- 番茄预估 vs 实际
- AI 任务拆解
- 日历集成

---

## 9. 时间线

| Day | 任务 |
|-----|------|
| D1 | 项目骨架 + Prisma + NextAuth + 登录注册 |
| D2 | 番茄钟核心（计时器 + 状态机 + 通知） |
| D3 | Todo 模块（CRUD + 关联） |
| D4 | 统计页 + UI 美化 + 部署 |

---

## 10. 你需要拍板的几件事

1. **白噪音资源**：用免费 CDN（Pixabay/YouTube 音频）还是本地 mp3？我倾向 CDN，省空间
2. **域名路径**：`/tomato` 还是 `tomato.chenweishi.cn` 子域名？子路径最简单
3. **数据保留**：要不要定期归档超过 1 年的数据？MVP 不做也行
4. **优先级色**：P0 红 / P1 橙 / P2 灰，OK 吗？

你看完回个"OK 开干"或者改改，我马上动。
