import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureRecurrences } from "@/lib/recurrence";
import { ensureEventRecurrences, listEvents } from "@/lib/events";
import { sendMail, layout, appUrl, esc } from "@/lib/email";
import { daysUntil, dueInfo, fmtLongToday, fmtTimeRange, todayISO } from "@/lib/dates";
import { CLOSED, PRIORITY, type Profile, type Task } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resumen diario por correo. Vercel lo llama de lunes a sábado a las 8:00 a. m. (Colombia)
 * según vercel.json. También puedes probarlo a mano:
 *   curl -H "Authorization: Bearer TU_CRON_SECRET" https://tu-app.vercel.app/api/cron/resumen
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayISO();
  // Primero se crean las tareas repetitivas del día, para que salgan en el resumen
  const repeticiones = await ensureRecurrences(supabase, today);
  await ensureEventRecurrences(supabase, today);
  const todaysEvents = await listEvents(supabase, today, today);
  const [{ data: profiles }, { data: tasks, error }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name"),
    supabase
      .from("tasks")
      .select("*, task_assignees(user_id)")
      .not("status", "in", `(${CLOSED.join(",")})`),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type T = Task & { task_assignees: { user_id: string }[] };
  const open = (tasks ?? []) as T[];
  const byName = Object.fromEntries((profiles ?? []).map((p) => [p.id, p as Profile]));
  const nm = (id: string) => byName[id]?.full_name || byName[id]?.email || "Alguien";
  const sent: string[] = [];

  for (const p of (profiles ?? []) as Profile[]) {
    const mine = open.filter((t) => t.task_assignees.some((a) => a.user_id === p.id));
    const late = mine.filter((t) => t.due_date && daysUntil(t.due_date, today) < 0);
    const todayT = mine.filter((t) => t.due_date && daysUntil(t.due_date, today) === 0);
    const tomorrow = mine.filter((t) => t.due_date && daysUntil(t.due_date, today) === 1);
    const toApprove = open.filter((t) => t.status === "en_revision" && t.assigned_by === p.id);
    const blocked = mine.filter((t) => t.status === "bloqueada");
    const myEvents = todaysEvents.filter((e) => e.participants.includes(p.id));
    const total = late.length + todayT.length + tomorrow.length + toApprove.length + myEvents.length;
    if (total === 0) continue; // sin novedades: no se envía correo

    const section = (title: string, color: string, list: T[], sub: (t: T) => string) =>
      list.length === 0
        ? ""
        : `<h3 style="margin:18px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${color}">${title} (${list.length})</h3>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
             .map(
               (t) => `<tr><td style="padding:7px 0;border-top:1px solid #f2e6d3">
                 <a href="${appUrl()}/tareas/${t.id}" style="color:#2b1a0e;font-weight:bold;text-decoration:none">${esc(t.title)}</a>
                 <div style="font-size:13px;color:#7a5c43">${esc(sub(t))}</div></td></tr>`,
             )
             .join("")}</table>`;
    const dueSub = (t: T) => `${dueInfo(t.due_date, today).text} · Prioridad ${PRIORITY[t.priority].toLowerCase()}`;

    const html = layout({
      heading: `Tu día: ${fmtLongToday()}`,
      intro: `Tienes ${total} ${total === 1 ? "asunto" : "asuntos"} que mirar hoy.`,
      bodyHtml:
        (myEvents.length
          ? `<h3 style="margin:18px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#824812">Tus eventos de hoy (${myEvents.length})</h3>
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${myEvents
               .map(
                 (e) => `<tr><td style="padding:7px 0;border-top:1px solid #f2e6d3">
                   <a href="${appUrl()}/eventos/${e.id}" style="color:#2b1a0e;font-weight:bold;text-decoration:none">${esc(e.title)}</a>
                   <div style="font-size:13px;color:#7a5c43">${esc(fmtTimeRange(e.start_time, e.end_time))}${e.location ? ` · ${esc(e.location)}` : ""}</div></td></tr>`,
               )
               .join("")}</table>`
          : "") +
        section("Vencidas", "#9f1124", late, dueSub) +
        section("Vencen hoy", "#a56a00", todayT, dueSub) +
        section("Vencen mañana", "#a56a00", tomorrow, dueSub) +
        section("Esperan tu aprobación", "#0b7c8c", toApprove, (t) =>
          `Enviada por ${t.task_assignees.map((a) => nm(a.user_id)).join(", ")}`,
        ) +
        (blocked.length
          ? `<p style="margin:16px 0 0;font-size:13px;color:#7a5c43">Además tienes ${blocked.length} tarea(s) bloqueada(s).</p>`
          : ""),
      cta: { label: "Abrir el Gestor de Tareas", href: appUrl() || "#" },
    });
    await sendMail(p.email, `Resumen del día: ${total} ${total === 1 ? "pendiente" : "pendientes"} por mirar`, html);
    sent.push(p.email);
  }

  return NextResponse.json({ ok: true, fecha: today, enviados: sent.length, repeticiones });
}
