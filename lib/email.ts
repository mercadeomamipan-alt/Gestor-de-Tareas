import "server-only";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!process.env.GMAIL_USER) return null;
  if (!transporter) {
    // SMTP_HOST es opcional: solo para pruebas con un servidor de correo local.
    transporter = process.env.SMTP_HOST
      ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 1025), secure: false })
      : process.env.GMAIL_APP_PASSWORD
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, "") },
          })
        : null;
  }
  return transporter;
}

export const appUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plantilla sencilla y legible en cualquier cliente de correo. */
export function layout(opts: { heading: string; intro?: string; bodyHtml?: string; cta?: { label: string; href: string } }) {
  const { heading, intro, bodyHtml = "", cta } = opts;
  return `<!doctype html><html><body style="margin:0;background:#fff8ee;font-family:Arial,Helvetica,sans-serif;color:#2b1a0e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ecdcc4;border-top:4px solid #fdc900;border-radius:10px">
<tr><td style="padding:18px 24px 6px">${appUrl() ? `<img src="${esc(appUrl())}/logo-correo.png" width="96" height="72" alt="Mamipan" style="display:block;border:0">` : `<span style="font-size:14px;font-weight:bold;color:#e3002f">MAMIPAN</span>`}</td></tr>
<tr><td style="padding:4px 24px 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a5c43;font-weight:bold">Gestor de tareas</td></tr>
<tr><td style="padding:0 24px 8px;font-size:20px;font-weight:bold;line-height:1.3">${esc(heading)}</td></tr>
${intro ? `<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.5;color:#2b1a0e">${esc(intro)}</td></tr>` : ""}
${bodyHtml ? `<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.5">${bodyHtml}</td></tr>` : ""}
${cta ? `<tr><td style="padding:8px 24px 24px"><a href="${esc(cta.href)}" style="display:inline-block;background:#e3002f;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">${esc(cta.label)}</a></td></tr>` : ""}
</table>
<p style="font-size:12px;color:#7a5c43;margin:14px 0 0">Recibes este correo porque eres parte del gestor de tareas de Mamipan.</p>
</td></tr></table></body></html>`;
}

export { esc };

/** Envía un correo. Nunca lanza error: si falla, lo registra y sigue. */
export async function sendMail(to: string | string[], subject: string, html: string) {
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!list.length) return;
  const t = getTransporter();
  if (!t) {
    console.warn("[correo] Falta GMAIL_USER o GMAIL_APP_PASSWORD; no se envió:", subject);
    return;
  }
  try {
    await t.sendMail({ from: `"Tareas Mamipan" <${process.env.GMAIL_USER}>`, to: list.join(", "), subject, html });
  } catch (err) {
    console.error("[correo] Error enviando", subject, err);
  }
}
