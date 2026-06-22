import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// 邮件发送: 优先用 SMTP, 否则写日志
async function sendResetEmail(email: string, link: string) {
  const subject = "【番茄土豆】重置密码";
  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #fa472f; margin: 0 0 16px;">🍅 番茄土豆</h2>
      <p>你好,</p>
      <p>我们收到了重置你密码的请求。点击下方按钮重置（链接 1 小时内有效）：</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #fa472f; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">重置密码</a>
      </p>
      <p>或复制链接到浏览器：</p>
      <p style="word-break: break-all; color: #666; font-size: 13px;">${link}</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">如果不是你本人操作, 请忽略此邮件。</p>
    </div>
  `;
  const text = `重置密码链接: ${link} (1 小时内有效)`;

  // 1. 阿里云 DirectMail (SMTP)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        text,
        html,
      });
      console.log(`[reset-email] sent via SMTP to ${email}`);
      return { mode: "smtp" };
    } catch (e) {
      console.error(`[reset-email] SMTP failed:`, e);
    }
  }

  // 2. 兜底: 写到日志 + 临时文件 (dev mode)
  const log = `\n========== ${new Date().toISOString()} ==========\nTo: ${email}\nSubject: ${subject}\nLink: ${link}\n`;
  console.log(`[reset-email] (dev mode, no SMTP) ${email} → ${link}`);
  const fs = await import("fs/promises");
  await fs.appendFile("/tmp/tomato-reset-emails.log", log).catch(() => {});
  return { mode: "log" };
}

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "请提供邮箱" }, { status: 400 });
  }

  // 始终返 200 防止邮箱枚举
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  // 生成 token, hash 存 DB
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  // 失效旧 token
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  // 发邮件
  const baseUrl = process.env.NEXTAUTH_URL || "http://122.51.221.63/tomato";
  const link = `${baseUrl.replace(/\/$/, "")}/reset-password/?token=${token}`;
  const result = await sendResetEmail(user.email, link);

  return NextResponse.json({ ok: true, mode: result.mode });
}
