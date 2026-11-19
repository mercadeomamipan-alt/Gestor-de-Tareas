"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, getProfiles, displayName } from "@/lib/data";
import { getEvent } from "@/lib/events";
import { sendMail, layout, appUrl, esc } from "@/lib/email";
import { fmtDate, fmtTimeRange, weekdayIndex } from "@/lib/dates";
import { EVENT_KIND, RECURRENCE, type EventKind, type Profile, type Recurrence } from "@/lib/types";

export type EventFormState = { error?: string; ok?: boolean } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const timeOrNull = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? v : null);

function parse(fd: FormData) {
  const kind = str(fd, "kind") as EventKind;
  const recurrence = str(fd, "recurrence") as Recurrence;
  const allDay = fd.get("all_day") === "on";
  return {
    title: str(fd, "title"),
    kind: kind in EVENT_KIND ? kind : "reunion",
    event_date: /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "event_date")) ? str(fd, "event_date") : "",
    start_time: allDay ? null : timeOrNull(str(fd, "start_time")),
    end_time: allDay ? null : timeOrNull(str(fd, "end_time")),
    location: str(fd, "location"),
    description: str(fd, "description"),
    recurrence: recurrence in RECURRENCE ? recurrence : "ninguna",
    participants: [...new Set(fd.getAll("participants").map(String).filter(Boolean))],
  };
}

function validate(f: ReturnType<typeof parse>): string | undefined {
  if (!f.title) return "Escribe el nombre del evento.";
  if (!f.event_date) return "Elige la fecha del evento.";
  if (!f.participants.length) return "Elige al menos un participante.";
  if (f.end_time && !f.start_time) return "Pon la hora de inicio, o marca “Todo el día”.";
  if (f.start_time && f.end_time && f.end_time <= f.start_time) return "La hora de fin debe ser después de la de inicio.";
  if (f.recurrence === "diaria" && weekdayIndex(f.event_date) === 6)
    return "Los eventos diarios van de lunes a sábado. Elige otra fecha.";
}

function notifyInvites(
  ids: string[],
  profiles: Record<string, Profile>,
  actorId: string,
  e: { id: string; title: string; kind: EventKind; event_date: string; start_time: string | null; end_time: string | null; location: string; description: string },
) {
  const to = ids.filter((u) => u !== actorId).map((u) => profiles[u]?.email).filter((x): x is string => !!x);
  if (!to.length) return;
  after(async () => {
    const rows = [
      ["Tipo", EVENT_KIND[e.kind]],
      ["Fecha", fmtDate(e.event_date)],
      ["Hora", fmtTimeRange(e.start_time, e.end_time)],
      ...(e.location ? [["Lugar", esc(e.location)]] : []),
    ];
    await sendMail(
      to,
      `Te invitaron: ${e.title} · ${fmtDate(e.event_date)}`,
      layout({
        heading: `${displayName(profiles[actorId])} te agregó a “${e.title}”`,
        bodyHtml:
          `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:4px 0 8px">` +
          rows.map(([k, v]) => `<tr><td style="color:#7a5c43;padding:3px 14px 3px 0">${k}</td><td style="padding:3px 0"><b>${v}</b></td></tr>`).join("") +
          `</table>` +
          (e.description ? `<p style="margin:8px 0 0;white-space:pre-wrap">${esc(e.description.slice(0, 600))}</p>` : ""),
        cta: { label: "Ver el evento", href: `${appUrl()}/eventos/${e.id}` },
      }),
    ).catch(() => {});
  });
}

function revalidateAll(id?: string) {
  revalidatePath("/");
  revalidatePath("/calendario");
  revalidatePath("/eventos");
  if (id) revalidatePath(`/eventos/${id}`);
}

export async function createEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const { supabase, me } = await requireUser();
  const f = parse(fd);
  const err = validate(f);
  if (err) return { error: err };
  const { participants, ...fields } = f;
  const { data: ev, error } = await supabase
    .from("events")
    .insert({ ...fields, created_by: me.id, updated_by: me.id })
    .select("*")
    .single();
  if (error || !ev) {
    const hint = /relation .*events|does not exist|schema cache/i.test(error?.message ?? "")
      ? " Falta correr la actualización SQL de eventos en Supabase."
      : "";
    return { error: "No se pudo crear el evento." + hint + (hint ? "" : ` ${error?.message ?? ""}`) };
  }
  await supabase.from("event_participants").insert(participants.map((u) => ({ event_id: ev.id, user_id: u })));
  // Vincular una tarea de origen, si el evento se creó desde una tarea
  const taskId = str(fd, "task_id");
  if (taskId) await supabase.from("tasks").update({ event_id: ev.id }).eq("id", taskId);
  notifyInvites(participants, await getProfiles(supabase), me.id, ev);
  revalidateAll();
  redirect(`/eventos/${ev.id}`);
}

export async function updateEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const { supabase, me } = await requireUser();
  const id = str(fd, "id");
  const before = await getEvent(supabase, id);
  if (!before) return { error: "Este evento ya no existe." };
  const f = parse(fd);
  const err = validate(f);
  if (err) return { error: err };
  const { participants, ...fields } = f;
  const { error } = await supabase
    .from("events")
    .update({ ...fields, updated_by: me.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. " + error.message };
  const added = participants.filter((u) => !before.participants.includes(u));
  const removed = before.participants.filter((u) => !participants.includes(u));
  if (removed.length) await supabase.from("event_participants").delete().eq("event_id", id).in("user_id", removed);
  if (added.length) await supabase.from("event_participants").insert(added.map((u) => ({ event_id: id, user_id: u })));
  if (added.length) notifyInvites(added, await getProfiles(supabase), me.id, { ...before, ...fields, id });
  revalidateAll(id);
  redirect(`/eventos/${id}`);
}

export async function saveNotes(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const { supabase, me } = await requireUser();
  const id = str(fd, "id");
  const { error } = await supabase
    .from("events")
    .update({ notes: String(fd.get("notes") ?? ""), updated_by: me.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudieron guardar las notas." };
  revalidatePath(`/eventos/${id}`);
  return { ok: true };
}

export async function deleteEvent(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  await supabase.from("events").delete().eq("id", id);
  revalidateAll();
  redirect("/eventos?borrado=1");
}

export async function linkTask(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "event_id");
  const taskId = str(fd, "task_id");
  if (taskId) await supabase.from("tasks").update({ event_id: id }).eq("id", taskId);
  revalidatePath(`/eventos/${id}`);
  revalidatePath(`/tareas/${taskId}`);
}

export async function unlinkTask(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "event_id");
  const taskId = str(fd, "task_id");
  await supabase.from("tasks").update({ event_id: null }).eq("id", taskId).eq("event_id", id);
  revalidatePath(`/eventos/${id}`);
  revalidatePath(`/tareas/${taskId}`);
}

/** Mover un evento a otro día desde el calendario (conserva la hora). */
export async function rescheduleEvent(_prev: EventFormState, fd: FormData): Promise<EventFormState> {
  const { supabase, me } = await requireUser();
  const id = str(fd, "id");
  const date = str(fd, "event_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Fecha no válida." };
  const before = await getEvent(supabase, id);
  if (!before) return { error: "Este evento ya no existe." };
  if (before.event_date === date) return { ok: true };
  const { error } = await supabase
    .from("events")
    .update({ event_date: date, updated_by: me.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo mover el evento." };
  const profiles = await getProfiles(supabase);
  const to = before.participants.filter((u) => u !== me.id).map((u) => profiles[u]?.email).filter((x): x is string => !!x);
  if (to.length) {
    after(() =>
      sendMail(
        to,
        `Cambió la fecha: ${before.title}`,
        layout({
          heading: `“${before.title}” ahora es el ${fmtDate(date)}`,
          intro: `${displayName(profiles[me.id])} lo movió del ${fmtDate(before.event_date)} al ${fmtDate(date)} (${fmtTimeRange(before.start_time, before.end_time)}).`,
          cta: { label: "Ver el evento", href: `${appUrl()}/eventos/${id}` },
        }),
      ),
    );
  }
  revalidateAll(id);
  return { ok: true };
}

