# SMTP 邮件配置

胡萝卜 (carrot) 用 nodemailer 发送找回密码邮件。没配 SMTP 时 fallback 到 console log。

## 配置步骤

### 1. 准备 SMTP 凭据

任选一个 SMTP 服务商（推荐 阿里云邮箱，免费）：

| 服务 | HOST | PORT | 说明 |
|---|---|---|---|
| 阿里云邮箱 | smtp.mxhichina.com | 465 (SSL) | 免费企业邮箱，绑域名 |
| QQ 邮箱 | smtp.qq.com | 465 (SSL) | 需开启 SMTP 服务拿授权码 |
| 163 邮箱 | smtp.163.com | 465 (SSL) | 需开启 SMTP 服务拿授权码 |
| Gmail | smtp.gmail.com | 587 (TLS) | 需 App Password |

### 2. 把凭据存到 secret（**别贴 chat 里**）

```bash
secret create --name=SMTP_HOST --value="smtp.mxhichina.com"
secret create --name=SMTP_PORT --value="465"
secret create --name=SMTP_USER --value="noreply@珍惜时间.website"
secret create --name=SMTP_PASS --value="your-password-here"
secret create --name=SMTP_FROM --value="noreply@珍惜时间.website"
```

### 3. 告诉我 secret 名，我会：

- 写到 `/opt/carrot/.next/standalone/.env`
- 写入 systemd service 环境变量
- 重启 service
- 验证邮件发送

## 验证

```bash
curl -sX POST http://122.51.221.63/carrot/api/auth/forgot-password/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com"}'
```

成功响应：

```json
{"ok":true,"message":"如果该邮箱已注册，重置链接已发送","mode":"smtp"}
```

`mode: "smtp"` = 真发；`mode: "log"` = 写到 `/tmp/tomato-reset-emails.log`（dev 模式）。
