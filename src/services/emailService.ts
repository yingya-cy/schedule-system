import nodemailer from 'nodemailer';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationEmail(to: string, username: string, token: string) {
  const transporter = getTransporter();
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const verifyUrl = `${appUrl}/login?verify=${token}`;

  const html = `
    <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#6366f1">学术空间 · 邮箱验证</h2>
      <p>你好，<strong>${username}</strong></p>
      <p>请点击下方按钮验证邮箱以激活账号：</p>
      <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">验证邮箱</a>
      <p style="margin-top:24px;color:#888;font-size:13px">如果按钮无法点击，请复制以下链接到浏览器：<br><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p style="color:#888;font-size:13px">此链接 24 小时内有效。如非本人操作请忽略。</p>
    </div>`;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: '学术空间 - 邮箱验证',
    html,
  });
}
