#!/usr/bin/env node
/**
 * DB 初始化 / 重建脚本
 * 用法：
 *   node scripts/db-init.js            # 创表（idempotent）
 *   node scripts/db-init.js --reset    # 删库 + 创表
 *
 * 在 server 上跑（不打包）：
 *   cd /opt/tomato && node scripts/db-init.js
 *
 * 依赖 prisma client（/opt/tomato/.next/standalone/node_modules/.prisma/client）
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// prisma client 在 load time 就读 env，所以必须在 require 前设好
const DB_PATH = "/opt/tomato/prisma/tomato.db";
process.env.DATABASE_URL = `file:${DB_PATH}`;
const PRISMA_CLIENT_PATH = "/opt/tomato/node_modules/.prisma/client";
const SQL = `
  CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "Settings" (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE NOT NULL,
    focusMinutes INTEGER NOT NULL DEFAULT 25,
    shortBreakMin INTEGER NOT NULL DEFAULT 5,
    longBreakMin INTEGER NOT NULL DEFAULT 15,
    pomosBeforeLong INTEGER NOT NULL DEFAULT 4,
    autoStartBreak INTEGER NOT NULL DEFAULT 1,
    desktopNotif INTEGER NOT NULL DEFAULT 1,
    soundEnabled INTEGER NOT NULL DEFAULT 1,
    soundType TEXT NOT NULL DEFAULT 'bell',
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "Todo" (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'todo',
    "order" INTEGER NOT NULL DEFAULT 0,
    tags TEXT,
    deadline DATETIME,
    estimatedPomodoros INTEGER,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS "Pomodoro" (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    todoId TEXT,
    type TEXT NOT NULL,
    durationMin INTEGER NOT NULL,
    completedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (todoId) REFERENCES Todo(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_settings_userId ON Settings(userId);
  CREATE INDEX IF NOT EXISTS idx_todo_userId_status ON Todo(userId, status);
  CREATE INDEX IF NOT EXISTS idx_todo_userId_createdAt ON Todo(userId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_todo_deadline ON Todo(deadline);
  CREATE INDEX IF NOT EXISTS idx_todo_priority ON Todo(priority);
  CREATE INDEX IF NOT EXISTS idx_pomo_userId_completedAt ON Pomodoro(userId, completedAt);
  CREATE INDEX IF NOT EXISTS idx_pomo_todoId ON Pomodoro(todoId);
`;

const reset = process.argv.includes("--reset");

async function main() {
  // 找 prisma client
  let prismaClientPath = PRISMA_CLIENT_PATH;
  if (!fs.existsSync(prismaClientPath)) {
    // 退到 local
    prismaClientPath = path.join(process.cwd(), "node_modules", "@prisma", "client");
  }
  if (!fs.existsSync(prismaClientPath)) {
    // 退到 standalone
    prismaClientPath = "/opt/tomato/.next/standalone/node_modules/.prisma/client";
  }
  if (!fs.existsSync(prismaClientPath)) {
    console.error(`prisma client not found at ${prismaClientPath}`);
    console.error("请先 npm install --omit=dev 装 prod deps");
    process.exit(1);
  }

  const { PrismaClient } = require(prismaClientPath);
  const db = new PrismaClient();

  if (reset) {
    console.log("⚠️  --reset: 删库重建（清空所有数据！）");
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log(`  rm ${DB_PATH}`);
    }
  }

  // 确保 db 文件存在（如果 prisma create 需要）
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, "");
    console.log(`  created empty ${DB_PATH}`);
  }

  for (const stmt of SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.$executeRawUnsafe(stmt);
  }
  console.log("✓ schema synced");

  const counts = {
    User: await db.user.count(),
    Settings: await db.settings.count(),
    Todo: await db.todo.count(),
    Pomodoro: await db.pomodoro.count(),
  };
  console.log("  current counts:", counts);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
