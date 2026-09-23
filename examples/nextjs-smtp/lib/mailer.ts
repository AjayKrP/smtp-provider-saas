import nodemailer from 'nodemailer';

/**
 * One transporter for the whole app.
 *
 * Module scope matters on serverless hosts: a warm invocation reuses the open connection
 * instead of doing a TCP handshake, TLS negotiation and AUTH for every single message.
 */
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  // 587 starts in the clear and upgrades with STARTTLS; set this true only for 465.
  secure: Number(process.env.SMTP_PORT ?? 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html });
}
