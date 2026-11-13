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
  return `<!doctype html><html><body style="margin:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#18202e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d8dee8;border-radius:10px">
<tr><td style="padding:22px 24px 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5d6879;font-weight:bold">Gestor de Tareas</td></tr>
<tr><td style="padding:0 24px 8px;font-size:20px;font-weight:bold;line-height:1.3">${esc(heading)}</td></tr>
${intro ? `<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.5;color:#18202e">${esc(intro)}</td></tr>` : ""}
${bodyHtml ? `<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.5">${bodyHtml}</td></tr>` : ""}
${cta ? `<tr><td style="padding:8px 24px 24px"><a href="${esc(cta.href)}" style="display:inline-block;background:#2d4fd6;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">${esc(cta.label)}</a></td></tr>` : ""}
</table>
<p style="font-size:12px;color:#5d6879;margin:14px 0 0">Recibes este correo porque eres parte del Gestor de Tareas.</p>
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
    await t.sendMail({ from: `"Gestor de Tareas" <${process.env.GMAIL_USER}>`, to: list.join(", "), subject, html });
  } catch (err) {
    console.error("[correo] Error enviando", subject, err);
  }
}
