// Branded transactional/lifecycle email templates.
//
// Each builder returns a subject + HTML + plain-text pair. The HTML uses inline
// styles only (email clients strip <style>/external CSS) and mirrors the app's
// dark premium look. Content is static and safe; the only interpolated value is
// an optional first name, which is escaped.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "Comply-Quick";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";
const APP_HREF = `${SITE_URL}/dashboard`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared dark shell so every email is visually consistent. */
function shell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#030712;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#030712;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0b1220;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="${SITE_URL}/brand/mark-64.png" width="28" height="28" alt="" style="display:block;border:0;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:Segoe UI,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${BRAND}</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 32px 32px 32px;font-family:Segoe UI,Arial,sans-serif;color:#d1d5db;font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #1f2937;font-family:Segoe UI,Arial,sans-serif;color:#6b7280;font-size:12px;line-height:1.5;">
          ${BRAND} is compliance software, not a law firm; its output is not legal advice.<br/>
          <a href="${SITE_URL}" style="color:#818cf8;text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:10px;">${label}</a>`;
}

function greeting(firstName?: string): string {
  const safe = firstName ? escapeHtml(firstName.trim()).slice(0, 60) : "";
  return safe ? `Hi ${safe},` : "Hi there,";
}

export interface LeadMagnetOptions {
  firstName?: string;
  /** When set, the recipient qualified for the Founding 100 giveaway. */
  foundingCode?: string;
  foundingReward?: string;
}

/** Landing-page lead magnet — sent the moment an email is captured. */
export function leadMagnetEmail(options: LeadMagnetOptions = {}): EmailContent {
  const { firstName, foundingCode, foundingReward } = options;
  const subject = foundingCode
    ? `You're a ${BRAND} founding member — free premium scan inside`
    : "Your free compliance scan is ready";

  const foundingBlockHtml = foundingCode
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;background:#1e1b4b;border:1px solid #4f46e5;border-radius:12px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 6px 0;color:#c7d2fe;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Founding 100</p>
          <p style="margin:0 0 10px 0;color:#e0e7ff;">You're one of our first 100 members — enjoy ${escapeHtml(foundingReward ?? "a free premium scan")} on us.</p>
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;letter-spacing:1px;">Code: ${escapeHtml(foundingCode)}</p>
        </td></tr>
      </table>`
    : "";

  const html = shell(`
    <p style="margin:0 0 16px 0;">${greeting(firstName)}</p>
    <p style="margin:0 0 16px 0;">Thanks for your interest in ${BRAND}. You're one link away from seeing exactly where your site stands.</p>
    ${foundingBlockHtml}
    <p style="margin:0 0 16px 0;">Paste any URL and, in under a minute, we'll scan its live tech stack and generate the privacy policy, liability waiver, and pre-launch checklist it needs — plus a compliance score.</p>
    <p style="margin:0 0 24px 0;">${button("Run my free scan", APP_HREF)}</p>
    <p style="margin:0;color:#9ca3af;">No credit card required. The free preview shows your score and contract shield before you pay a cent.</p>
  `);

  const foundingBlockText = foundingCode
    ? `\nFOUNDING 100: You're one of our first 100 members — enjoy ${foundingReward ?? "a free premium scan"} on us. Code: ${foundingCode}\n`
    : "";

  const text = `${firstName ? `Hi ${firstName},` : "Hi there,"}

Thanks for your interest in ${BRAND}. Paste any URL and, in under a minute, we'll scan its live tech stack and generate the documents it needs — plus a compliance score.
${foundingBlockText}
Run your free scan: ${APP_HREF}

No credit card required.

— ${BRAND}. This is compliance software, not legal advice.`;
  return { subject, html, text };
}

/** Welcome — sent when a new customer signs up. */
export function welcomeEmail(firstName?: string): EmailContent {
  const subject = `Welcome to ${BRAND} — here's how to get value in 5 minutes`;
  const html = shell(`
    <p style="margin:0 0 16px 0;">${greeting(firstName)}</p>
    <p style="margin:0 0 16px 0;">Welcome aboard! Your account is ready. Here's the fastest path to your first compliant package:</p>
    <ol style="margin:0 0 20px 0;padding-left:20px;color:#d1d5db;">
      <li style="margin-bottom:8px;">Run a scan on any site you manage.</li>
      <li style="margin-bottom:8px;">Review the auto-generated documents and compliance score.</li>
      <li style="margin-bottom:8px;">Download the package or embed your score badge.</li>
    </ol>
    <p style="margin:0 0 24px 0;">${button("Open your dashboard", APP_HREF)}</p>
    <p style="margin:0;color:#9ca3af;">Managing multiple client sites? Reply to this email and we'll help you set up your agency workspace.</p>
  `);
  const text = `${firstName ? `Hi ${firstName},` : "Hi there,"}

Welcome to ${BRAND}! Your account is ready. Fastest path to value:
1. Run a scan on any site you manage.
2. Review the auto-generated documents and compliance score.
3. Download the package or embed your score badge.

Open your dashboard: ${APP_HREF}

— ${BRAND}. This is compliance software, not legal advice.`;
  return { subject, html, text };
}

/** Returning customer — sent to re-engage a customer who's back on the site. */
export function returningCustomerEmail(firstName?: string): EmailContent {
  const subject = `Welcome back to ${BRAND}`;
  const html = shell(`
    <p style="margin:0 0 16px 0;">${greeting(firstName)}</p>
    <p style="margin:0 0 16px 0;">Good to see you back. A lot can change between visits — regulations shift, and sites pick up new tracking pixels.</p>
    <p style="margin:0 0 16px 0;">Re-scan your sites to refresh your compliance score, and check your dashboard for any regulation-autopilot proposals waiting on your approval.</p>
    <p style="margin:0 0 24px 0;">${button("Re-scan & review", APP_HREF)}</p>
    <p style="margin:0;color:#9ca3af;">Your documents update automatically as the rules change — you just approve.</p>
  `);
  const text = `${firstName ? `Hi ${firstName},` : "Hi there,"}

Good to see you back at ${BRAND}. Regulations shift and sites pick up new pixels between visits — re-scan to refresh your score and review any autopilot proposals waiting for approval.

Re-scan & review: ${APP_HREF}

— ${BRAND}. This is compliance software, not legal advice.`;
  return { subject, html, text };
}
