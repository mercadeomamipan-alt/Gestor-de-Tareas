"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, getProfiles, displayName, type Supa } from "@/lib/data";
import { sendMail, layout, appUrl, esc } from "@/lib/email";
import { addDays, addMonths, fmtDate } from "@/lib/dates";
import { STATUS, PRIORITY, RECURRENCE, type Status, type Task, type Priority, type Recurrence, type Profile } from "@/lib/types";

export type FormState = { error?: string } | undefined;

// ---------------------------------------------------------------- helpers

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dateOrNull = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function parseTaskFields(fd: FormData) {
  const priority = str(fd, "priority") as Priority;
  const recurrence = str(fd, "recurrence") as Recurrence;
  const hoursRaw = str(fd, "estimated_hours").replace(",", ".");
  const hours = hoursRaw === "" ? null : Number(hoursRaw);
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    project: str(fd, "project"),
    priority: priority in PRIORITY ? priority : "media",
    recurrence: recurrence in RECURRENCE ? recurrence : "ninguna",
    start_date: dateOrNull(str(fd, "start_date")),
    due_date: dateOrNull(str(fd, "due_date")),
    estimated_hours: hours !== null && Number.isFinite(hours) && hours >= 0 ? hours : null,
    assigned_by: str(fd, "assigned_by"),
    assignees: [...new Set(fd.getAll("assignees").map(String).filter(Boolean))],
  };
}

async function logEvent(supabase: Supa, taskId: string, actorId: string, kind: string, detail = "") {
  await supabase.from("task_events").insert({ task_id: taskId, actor_id: actorId, kind, detail });
}

async function getTask(supabase: Supa, id: string) {
  const { data } = await supabase.from("tasks").select("*, task_assignees(user_id)").eq("id", id).single();
  if (!data) return null;
  const { task_assignees, ...t } = data as Task & { task_assignees: { user_id: string }[] };
  return { ...(t as Task), assignees: task_assignees.map((a) => a.user_id) };
}

/** Envía correos después de responder, para que la app no espere a Gmail. */
function notifyLater(fn: () => Promise<void>) {
  after(async () => {
    try {
      await fn();
    } catch (e) {
      console.error("[avisos]", e);
    }
  });
}

function taskSummaryHtml(t: Pick<Task, "title" | "due_date" | "priority" | "description">, people?: string) {
  const rows = [
    ["Tarea", esc(t.title)],
    ["Entrega", t.due_date ? fmtDate(t.due_date) : "Sin fecha"],
    ["Prioridad", PRIORITY[t.priority]],
    ...(people ? [["Responsables", esc(people)]] : []),
  ];
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:4px 0 8px">` +
    rows.map(([k, v]) => `<tr><td style="color:#5d6879;padding:3px 14px 3px 0">${k}</td><td style="padding:3px 0"><b>${v}</b></td></tr>`).join("") +
    `</table>` +
    (t.description ? `<p style="margin:8px 0 0;color:#18202e;white-space:pre-wrap">${esc(t.description.slice(0, 600))}</p>` : "")
  );
}

const link = (id: string) => `${appUrl()}/tareas/${id}`;
const emailsOf = (ids: string[], profiles: Record<string, Profile>) =>
  ids.map((id) => profiles[id]?.email).filter((e): e is string => !!e);

/** Si la tarea es recurrente, crea la siguiente al cerrarla (una sola vez). */
async function spawnNextOccurrence(supabase: Supa, task: Task & { assignees: string[] }, actorId: string) {
  if (task.recurrence === "ninguna") return;
  const { data: existing } = await supabase.from("tasks").select("id").eq("recurrence_from", task.id).limit(1);
  if (existing && existing.length) return;
  const shift = (d: string | null) => (d ? (task.recurrence === "semanal" ? addDays(d, 7) : addMonths(d, 1)) : null);
  const { data: next, error } = await supabase
    .from("tasks")
    .insert({
      title: task.title,
      description: task.description,
      project: task.project,
      priority: task.priority,
      recurrence: task.recurrence,
      recurrence_from: task.id,
      start_date: shift(task.start_date),
      due_date: shift(task.due_date),
      estimated_hours: task.estimated_hours,
      assigned_by: task.assigned_by,
      created_by: actorId,
      updated_by: actorId,
    })
    .select("id")
    .single();
  if (error || !next) return;
  if (task.assignees.length) {
    await supabase.from("task_assignees").insert(task.assignees.map((u) => ({ task_id: next.id, user_id: u })));
  }
  const { data: reqs } = await supabase.from("requirements").select("body, position").eq("task_id", task.id);
  if (reqs?.length) {
    await supabase.from("requirements").insert(reqs.map((r) => ({ task_id: next.id, body: r.body, position: r.position })));
  }
  await logEvent(supabase, next.id, actorId, "creada", "Siguiente repetición creada automáticamente");
}

// ---------------------------------------------------------------- crear / editar

export async function createTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const f = parseTaskFields(fd);
  if (!f.title) return { error: "Escribe el título de la tarea." };
  if (!f.assignees.length) return { error: "Elige al menos un responsable." };
  if (f.start_date && f.due_date && f.start_date > f.due_date)
    return { error: "La fecha de inicio no puede ser posterior a la fecha de entrega." };

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: f.title,
      description: f.description,
      project: f.project,
      priority: f.priority,
      recurrence: f.recurrence,
      start_date: f.start_date,
      due_date: f.due_date,
      estimated_hours: f.estimated_hours,
      assigned_by: f.assigned_by || me.id,
      created_by: me.id,
      updated_by: me.id,
    })
    .select("*")
    .single();
  if (error || !task) return { error: "No se pudo crear la tarea. " + (error?.message ?? "") };

  await supabase.from("task_assignees").insert(f.assignees.map((u) => ({ task_id: task.id, user_id: u })));

  const reqLines = str(fd, "requirements")
    .split("\n")
    .map((l) => l.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);
  if (reqLines.length) {
    await supabase.from("requirements").insert(reqLines.map((body, i) => ({ task_id: task.id, body, position: i })));
  }
  await logEvent(supabase, task.id, me.id, "creada");
  await supabase.from("task_reads").upsert({ task_id: task.id, user_id: me.id, last_read_at: new Date().toISOString() });

  const others = f.assignees.filter((u) => u !== me.id);
  if (others.length) {
    const profiles = await getProfiles(supabase);
    notifyLater(async () => {
      const people = f.assignees.map((u) => profiles[u]?.full_name || profiles[u]?.email).join(", ");
      await sendMail(
        emailsOf(others, profiles),
        `Nueva tarea asignada: ${task.title}`,
        layout({
          heading: `${displayName(profiles[me.id])} te asignó una tarea`,
          bodyHtml: taskSummaryHtml(task as Task, people),
          cta: { label: "Ver la tarea", href: link(task.id) },
        }),
      );
    });
  }

  revalidatePath("/");
  redirect(`/tareas/${task.id}`);
}

export async function updateTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const id = str(fd, "id");
  const before = await getTask(supabase, id);
  if (!before) return { error: "Esta tarea ya no existe." };
  const f = parseTaskFields(fd);
  if (!f.title) return { error: "Escribe el título de la tarea." };
  if (!f.assignees.length) return { error: "Elige al menos un responsable." };
  if (f.start_date && f.due_date && f.start_date > f.due_date)
    return { error: "La fecha de inicio no puede ser posterior a la fecha de entrega." };

  const dueChanged = (before.due_date ?? null) !== (f.due_date ?? null);
  const reason = str(fd, "due_reason");
  if (dueChanged && before.due_date && !reason) {
    return { error: "Cuéntanos el motivo del cambio de fecha de entrega." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title: f.title,
      description: f.description,
      project: f.project,
      priority: f.priority,
      recurrence: f.recurrence,
      start_date: f.start_date,
      due_date: f.due_date,
      estimated_hours: f.estimated_hours,
      assigned_by: f.assigned_by || before.assigned_by,
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. " + error.message };

  const added = f.assignees.filter((u) => !before.assignees.includes(u));
  const removed = before.assignees.filter((u) => !f.assignees.includes(u));
  if (removed.length) await supabase.from("task_assignees").delete().eq("task_id", id).in("user_id", removed);
  if (added.length) await supabase.from("task_assignees").insert(added.map((u) => ({ task_id: id, user_id: u })));

  if (dueChanged) {
    await supabase.from("due_date_changes").insert({
      task_id: id,
      old_date: before.due_date,
      new_date: f.due_date,
      reason,
      changed_by: me.id,
    });
  }
  await logEvent(supabase, id, me.id, "editada");

  const profiles = await getProfiles(supabase);
  const actor = displayName(profiles[me.id]);
  const newTask = { ...before, ...f } as Task;
  const addedOthers = added.filter((u) => u !== me.id);
  const dueRecipients = [...new Set([...f.assignees, f.assigned_by || before.assigned_by])].filter(
    (u) => u !== me.id && !addedOthers.includes(u),
  );
  notifyLater(async () => {
    if (addedOthers.length) {
      await sendMail(
        emailsOf(addedOthers, profiles),
        `Nueva tarea asignada: ${f.title}`,
        layout({
          heading: `${actor} te agregó como responsable`,
          bodyHtml: taskSummaryHtml(newTask),
          cta: { label: "Ver la tarea", href: link(id) },
        }),
      );
    }
    if (dueChanged && dueRecipients.length) {
      const from = before.due_date ? fmtDate(before.due_date) : "sin fecha";
      const to = f.due_date ? fmtDate(f.due_date) : "sin fecha";
      await sendMail(
        emailsOf(dueRecipients, profiles),
        `Cambió la fecha de entrega: ${f.title}`,
        layout({
          heading: `Nueva fecha de entrega: ${to}`,
          intro: `${actor} movió la entrega de “${f.title}” del ${from} al ${to}.`,
          bodyHtml: reason ? `<p style="margin:0"><span style="color:#5d6879">Motivo:</span> ${esc(reason)}</p>` : "",
          cta: { label: "Ver la tarea", href: link(id) },
        }),
      );
    }
  });

  revalidatePath("/");
  revalidatePath(`/tareas/${id}`);
  redirect(`/tareas/${id}`);
}

// ---------------------------------------------------------------- estado y aprobación

/**
 * Reglas:
 * - Solo quien asignó la tarea puede marcarla como "hecha" directamente.
 * - Un responsable que no la asignó la envía a "en revisión"; quien la asignó la aprueba o la devuelve.
 * - "Bloqueada" exige motivo.
 */
export async function changeStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const id = str(fd, "id");
  let status = str(fd, "status") as Status;
  if (!(status in STATUS)) return { error: "Estado no válido." };
  const task = await getTask(supabase, id);
  if (!task) return { error: "Esta tarea ya no existe." };

  const isAssigner = task.assigned_by === me.id;
  if (status === "hecha" && !isAssigner) status = "en_revision";

  const blockedReason = str(fd, "blocked_reason");
  if (status === "bloqueada" && !blockedReason) return { error: "Escribe qué está bloqueando la tarea." };
  if (status === task.status && status !== "bloqueada") return undefined;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_by: me.id,
    updated_at: now,
    blocked_reason: status === "bloqueada" ? blockedReason : "",
    closed_at: status === "hecha" || status === "cancelada" ? now : null,
  };
  if (status === "hecha") {
    patch.approved_by = me.id;
    patch.approved_at = now;
  } else {
    patch.approved_by = null;
    patch.approved_at = null;
  }
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) return { error: "No se pudo cambiar el estado. " + error.message };

  await logEvent(
    supabase,
    id,
    me.id,
    "estado",
    `${STATUS[task.status]} → ${STATUS[status]}${status === "bloqueada" ? ` (${blockedReason})` : ""}`,
  );
  if (status === "hecha") await spawnNextOccurrence(supabase, task, me.id);

  if (status === "en_revision" && task.assigned_by !== me.id) {
    const profiles = await getProfiles(supabase);
    notifyLater(async () => {
      await sendMail(
        emailsOf([task.assigned_by], profiles),
        `Para aprobar: ${task.title}`,
        layout({
          heading: "Una tarea espera tu aprobación",
          intro: `${displayName(profiles[me.id])} terminó “${task.title}” y la envió a revisión.`,
          cta: { label: "Revisar y aprobar", href: link(id) },
        }),
      );
    });
  }

  revalidatePath("/");
  revalidatePath(`/tareas/${id}`);
  return undefined;
}

export async function reviewTask(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const id = str(fd, "id");
  const decision = str(fd, "decision");
  const reason = str(fd, "reason");
  const task = await getTask(supabase, id);
  if (!task) return { error: "Esta tarea ya no existe." };
  if (task.assigned_by !== me.id) return { error: "Solo quien asignó la tarea puede aprobarla o devolverla." };
  if (decision === "devolver" && !reason) return { error: "Escribe qué falta para que la persona pueda corregirlo." };

  const now = new Date().toISOString();
  if (decision === "aprobar") {
    await supabase
      .from("tasks")
      .update({ status: "hecha", approved_by: me.id, approved_at: now, closed_at: now, updated_by: me.id, updated_at: now })
      .eq("id", id);
    await logEvent(supabase, id, me.id, "aprobada", reason);
    if (reason) await supabase.from("task_notes").insert({ task_id: id, author_id: me.id, body: `Aprobada: ${reason}` });
    await spawnNextOccurrence(supabase, task, me.id);
  } else {
    await supabase
      .from("tasks")
      .update({ status: "en_curso", approved_by: null, approved_at: null, closed_at: null, updated_by: me.id, updated_at: now })
      .eq("id", id);
    await logEvent(supabase, id, me.id, "devuelta", reason);
    await supabase.from("task_notes").insert({ task_id: id, author_id: me.id, body: `Devuelta: ${reason}` });
  }

  const recipients = task.assignees.filter((u) => u !== me.id);
  if (recipients.length) {
    const profiles = await getProfiles(supabase);
    const actor = displayName(profiles[me.id]);
    notifyLater(async () => {
      await sendMail(
        emailsOf(recipients, profiles),
        decision === "aprobar" ? `Aprobada: ${task.title}` : `Devuelta: ${task.title}`,
        layout({
          heading: decision === "aprobar" ? "Tu tarea fue aprobada" : "Tu tarea fue devuelta",
          intro:
            decision === "aprobar"
              ? `${actor} aprobó “${task.title}”.`
              : `${actor} devolvió “${task.title}” y quedó otra vez en curso.`,
          bodyHtml: reason ? `<p style="margin:0"><span style="color:#5d6879">Comentario:</span> ${esc(reason)}</p>` : "",
          cta: { label: "Ver la tarea", href: link(id) },
        }),
      );
    });
  }

  revalidatePath("/");
  revalidatePath(`/tareas/${id}`);
  return undefined;
}

export async function deleteTask(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const { data: files } = await supabase.from("attachments").select("storage_path").eq("task_id", id).eq("kind", "archivo");
  const paths = (files ?? []).map((f) => f.storage_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("adjuntos").remove(paths);
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/");
  redirect("/?borrada=1");
}

// ---------------------------------------------------------------- requisitos

export async function addRequirement(fd: FormData) {
  const { supabase } = await requireUser();
  const taskId = str(fd, "task_id");
  const body = str(fd, "body");
  if (!body) return;
  const { count } = await supabase.from("requirements").select("id", { count: "exact", head: true }).eq("task_id", taskId);
  await supabase.from("requirements").insert({ task_id: taskId, body, position: count ?? 0 });
  revalidatePath(`/tareas/${taskId}`);
}

export async function toggleRequirement(id: string, taskId: string, done: boolean) {
  const { supabase, me } = await requireUser();
  await supabase
    .from("requirements")
    .update({ done, done_by: done ? me.id : null, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath(`/tareas/${taskId}`);
  revalidatePath("/");
}

export async function deleteRequirement(fd: FormData) {
  const { supabase } = await requireUser();
  const taskId = str(fd, "task_id");
  await supabase.from("requirements").delete().eq("id", str(fd, "id"));
  revalidatePath(`/tareas/${taskId}`);
}

// ---------------------------------------------------------------- notas

export async function addNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const taskId = str(fd, "task_id");
  const body = str(fd, "body");
  if (!body) return { error: "Escribe la nota antes de guardarla." };
  const { error } = await supabase.from("task_notes").insert({ task_id: taskId, author_id: me.id, body });
  if (error) return { error: "No se pudo guardar la nota." };
  await supabase.from("task_reads").upsert({ task_id: taskId, user_id: me.id, last_read_at: new Date().toISOString() });
  revalidatePath(`/tareas/${taskId}`);
  revalidatePath("/");
  return undefined;
}

// ---------------------------------------------------------------- adjuntos

export async function addLink(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const taskId = str(fd, "task_id");
  let url = str(fd, "url");
  if (!url) return { error: "Pega el enlace." };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
  } catch {
    return { error: "Ese enlace no es válido." };
  }
  const name = str(fd, "name") || new URL(url).hostname;
  await supabase.from("attachments").insert({ task_id: taskId, kind: "enlace", name, url, created_by: me.id });
  revalidatePath(`/tareas/${taskId}`);
  return undefined;
}

export async function uploadFile(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, me } = await requireUser();
  const taskId = str(fd, "task_id");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige un archivo." };
  if (file.size > 10 * 1024 * 1024) return { error: "El archivo pesa más de 10 MB." };
  const safe = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${taskId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("adjuntos")
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) return { error: "No se pudo subir el archivo. " + error.message };
  await supabase.from("attachments").insert({
    task_id: taskId,
    kind: "archivo",
    name: file.name,
    storage_path: path,
    size_bytes: file.size,
    created_by: me.id,
  });
  revalidatePath(`/tareas/${taskId}`);
  return undefined;
}

export async function deleteAttachment(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const taskId = str(fd, "task_id");
  const { data } = await supabase.from("attachments").select("storage_path").eq("id", id).single();
  if (data?.storage_path) await supabase.storage.from("adjuntos").remove([data.storage_path]);
  await supabase.from("attachments").delete().eq("id", id);
  revalidatePath(`/tareas/${taskId}`);
}

// ---------------------------------------------------------------- sesión y perfil

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState & { ok?: string }> {
  const { supabase, me } = await requireUser();
  const name = str(fd, "full_name");
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Escribe tu nombre." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", me.id);
  if (error) return { error: "No se pudo guardar el nombre." };
  if (password) {
    if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
    const { error: pErr } = await supabase.auth.updateUser({ password });
    if (pErr) return { error: "No se pudo cambiar la contraseña. " + pErr.message };
  }
  revalidatePath("/", "layout");
  return { ok: password ? "Guardado. Tu contraseña cambió." : "Guardado." };
}
