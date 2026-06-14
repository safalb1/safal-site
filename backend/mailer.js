// Transactional email via Resend's HTTP API — no SDK dependency, just fetch.
// Set RESEND_API_KEY to enable; without it, sending is silently skipped so the
// app still runs (signups are stored either way).
//
// EMAIL_FROM must be an address on a domain you've verified in Resend. Until
// you verify a domain you can use the shared "onboarding@resend.dev" sender,
// which Resend only delivers to the email you signed up to Resend with.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "SAFAL <onboarding@resend.dev>";
const SITE_URL = process.env.SITE_URL || "https://safalb1.github.io/safal-site/";

export const mailerEnabled = Boolean(RESEND_API_KEY);

function welcomeHtml(to) {
  return `<!doctype html><html><body style="margin:0;background:#05060A;">
  <div style="background:#05060A;color:#E8ECF5;font-family:Arial,Helvetica,sans-serif;padding:40px 20px;">
    <div style="max-width:480px;margin:0 auto;background:#0A0C14;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:34px;">
      <div style="font-size:13px;letter-spacing:4px;color:#19E3FF;font-weight:bold;">● SAFAL</div>
      <h1 style="font-size:24px;line-height:1.2;margin:18px 0 14px;color:#E8ECF5;">You're on the list.</h1>
      <p style="color:#9aa2bd;line-height:1.7;font-size:15px;margin:0 0 14px;">
        Thanks for requesting early access to the <strong style="color:#E8ECF5;">SAFAL neural compute mesh</strong>.
        You're in the queue — we're rolling out by region and will send your invite the moment the mesh reaches you.
      </p>
      <a href="${SITE_URL}" style="display:inline-block;margin:8px 0 4px;padding:12px 22px;border-radius:999px;
        background:linear-gradient(110deg,#19E3FF,#7C5CFF);color:#04060c;text-decoration:none;font-weight:bold;font-size:14px;">
        Back to SAFAL →</a>
      <div style="margin-top:26px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;font-size:12px;color:#4b5573;">
        You received this because <span style="color:#7A82A0;">${to}</span> requested access at SAFAL. If this wasn't you, ignore this email.
      </div>
    </div>
  </div></body></html>`;
}

const welcomeText = (to) =>
  `You're on the SAFAL waitlist.\n\nThanks for requesting early access to the SAFAL neural compute mesh. ` +
  `You're in the queue — we'll send your invite as the mesh reaches your region.\n\n${SITE_URL}\n\n` +
  `You received this because ${to} requested access at SAFAL.`;

export async function sendWelcome(to) {
  if (!RESEND_API_KEY) return { skipped: true };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject: "You're on the SAFAL waitlist",
      html: welcomeHtml(to),
      text: welcomeText(to),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return res.json();
}
