import type { OutgoingMail } from './mailer.js';

const BRAND = 'email4vibecoder';

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function layout(
  heading: string,
  intro: string,
  button: string,
  link: string,
  outro: string,
): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e7ea;border-radius:12px;padding:32px">
        <tr><td>
          <p style="margin:0 0 24px;font-weight:600;font-size:15px">${BRAND}</p>
          <h1 style="margin:0 0 12px;font-size:20px">${heading}</h1>
          <p style="margin:0 0 24px;line-height:1.6;color:#3f3f46">${intro}</p>
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${button}</a>
          <p style="margin:24px 0 0;line-height:1.6;font-size:13px;color:#71717a">${outro}</p>
          <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;word-break:break-all">${escapeHtml(link)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function verificationEmail(to: string, name: string, link: string): OutgoingMail {
  const hi = `Hi ${name},`;
  return {
    to,
    subject: `Confirm your email for ${BRAND}`,
    text: `${hi}\n\nConfirm your email address to activate your ${BRAND} account:\n${link}\n\nThis link expires in 24 hours. If you did not sign up, you can ignore this email.`,
    html: layout(
      'Confirm your email',
      `${escapeHtml(hi)} confirm your email address to activate your ${BRAND} account.`,
      'Confirm email',
      link,
      'This link expires in 24 hours. If you did not sign up, you can ignore this email.',
    ),
  };
}

export function passwordResetEmail(to: string, name: string, link: string): OutgoingMail {
  const hi = `Hi ${name},`;
  return {
    to,
    subject: `Reset your ${BRAND} password`,
    text: `${hi}\n\nWe received a request to reset your password. Choose a new one here:\n${link}\n\nThis link expires in 1 hour and signs you out everywhere once used. If you did not ask for this, ignore this email - your password stays the same.`,
    html: layout(
      'Reset your password',
      `${escapeHtml(hi)} we received a request to reset your ${BRAND} password.`,
      'Choose a new password',
      link,
      'This link expires in 1 hour and signs you out everywhere once used. If you did not ask for this, ignore this email — your password stays the same.',
    ),
  };
}
