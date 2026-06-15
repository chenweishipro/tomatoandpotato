import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const RegisterSchema = z.object({
  email: z.string().email("邮箱格式不对"),
  name: z.string().min(1, "昵称不能为空").max(40, "昵称太长"),
  password: z.string().min(6, "密码至少 6 位").max(100, "密码太长"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数错误" },
      { status: 400 }
    );
  }

  const { email, name, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "这个邮箱已注册" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      settings: {
        create: {}, // 用默认设置
      },
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
