import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { TaskForm } from "@/components/TaskForm";
import { SubmitButton } from "@/components/SubmitButton";
import {
  StatusControl,
  ReviewControl,
  RequirementCheck,
  NoteForm,
  AttachmentForms,
  DeleteTask,
} from "@/components/TaskControls";
import { requireUser, getProfiles, displayName } from "@/lib/data";
import { dueInfo, fmtDate, fmtStamp, todayISO } from "@/lib/dates";
import {
  STATUS,
  PRIORITY,
  RECURRENCE,
  isOpen,
  type Attachment,
  type DueChange,
  type Note,
  type Requirement,
  type Task,
  type TaskEvent,
} from "@/lib/types";
import { updateTask, addRequirement, deleteRequirement, deleteAttachment } from "../actions";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  creada: "creó la tarea",
  editada: "editó la tarea",
  estado: "cambió el estado",
  aprobada: "aprobó la tarea",
  devuelta: "devolvió la tarea",
};

function fileBadge(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  return ext.length <= 4 ? ext : "DOC";
}
function fmtSize(b: number | null) {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, me } = await requireUser();

  const { data: raw } = await supabase.from("tasks").select("*, task_assignees(user_id)").eq("id", id).maybeSingle();
  if (!raw) notFound();
  const { task_assignees, ...rest } = raw as Task & { task_assignees: { user_id: string }[] };
  const task = { ...(rest as Task), assignees: task_assignees.map((a) => a.user_id) };

  const [profiles, reqRes, noteRes, attRes, dueRes, evRes, readRes, projRes, nextRes] = await Promise.all([
    getProfiles(supabase),
    supabase.from("requirements").select("*").eq("task_id", id).order("position").order("created_at"),
    supabase.from("task_notes").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("attachments").select("*").eq("task_id", id).order("created_at"),
    supabase.from("due_date_changes").select("*").eq("task_id", id).order("changed_at", { ascending: false }),
    supabase.from("task_events").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("task_reads").select("last_read_at").eq("task_id", id).eq("user_id", me.id).maybeSingle(),
    supabase.from("tasks").select("project").neq("project", ""),
    supabase.from("tasks").select("id, due_date").eq("recurrence_from", id).maybeSingle(),
  ]);
  const reqs = (reqRes.data ?? []) as Requirement[];
  const notes = (noteRes.data ?? []) as Note[];
  const atts = (attRes.data ?? []) as Attachment[];
  const dueChanges = (dueRes.data ?? []) as DueChange[];
  const events = (evRes.data ?? []) as TaskEvent[];
  const lastRead = readRes.data?.last_read_at ?? null;

  // Marca la tarea como leída por esta persona (después de calcular qué era nuevo)
  await supabase.from("task_reads").upsert({ task_id: id, user_id: me.id, last_read_at: new Date().toISOString() });

  // Enlaces temporales (1 hora) para descargar archivos
  const filePaths = atts.filter((a) => a.kind === "archivo" && a.storage_path).map((a) => a.storage_path!);
  const signed: Record<string, string> = {};
  if (filePaths.length) {
    const { data } = await supabase.storage.from("adjuntos").createSignedUrls(filePaths, 3600, { download: true });
    for (const s of data ?? []) if (s.path && s.signedUrl) signed[s.path] = s.signedUrl;
  }

  const name = (uid: string | null) => displayName(uid ? profiles[uid] : undefined, me.id);
  const isAssigner = task.assigned_by === me.id;
  const open = isOpen(task.status);
  const d = dueInfo(task.due_date, todayISO());
  const reqDone = reqs.filter((r) => r.done).length;

  if (sp.editar) {
    const projects = [...new Set((projRes.data ?? []).map((p) => p.project as string))].sort((a, b) => a.localeCompare(b, "es"));
    return (
      <>
        <Header me={me} />
        <main className="page narrow">
          <div className="crumbs">
            <Link href="/">Tareas</Link> / <Link href={`/tareas/${id}`}>{task.title}</Link>
          </div>
          <h1 style={{ fontSize: 28 }}>Editar tarea</h1>
          <TaskForm mode="editar" action={updateTask} people={Object.values(profiles)} meId={me.id} projects={projects} task={task} />
        </main>
      </>
    );
  }

  const history = [
    ...events.map((e) => ({
      at: e.created_at,
      text: `${name(e.actor_id)} ${EVENT_LABEL[e.kind] ?? e.kind}${e.detail ? `: ${e.detail}` : ""}`,
    })),
    ...dueChanges.map((c) => ({
      at: c.changed_at,
      text: `${name(c.changed_by)} cambió la entrega de ${c.old_date ? fmtDate(c.old_date) : "sin fecha"} a ${c.new_date ? fmtDate(c.new_date) : "sin fecha"}${c.reason ? ` — motivo: ${c.reason}` : ""}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Header me={me} />
      <main className="page">
        <div className="crumbs"><Link href="/">← Tareas</Link></div>

        <div className="task-head">
          <h1>{task.title}</h1>
          <div className="meta">
            <span className={`pill st-${task.status}`}>{STATUS[task.status]}</span>
            <span className={`prio prio-${task.priority}`}>Prioridad {PRIORITY[task.priority].toLowerCase()}</span>
            {task.assignees.length > 1 && <span className="tag shared">Compartida</span>}
            {task.project && <span className="tag project">{task.project}</span>}
            <span className={`due ${open ? d.tone : ""}`}>
              {open ? d.text : task.due_date ? `Entrega ${fmtDate(task.due_date)}` : "Sin fecha"}
            </span>
          </div>
          <div className="actions">
            <Link href={`/tareas/${id}?editar=1`} className="btn">Editar</Link>
          </div>
        </div>

        {task.status === "en_revision" && (
          <div className="callout review">
            <p>
              <b>En revisión.</b>{" "}
              {isAssigner
                ? "Revisa los entregables y aprueba la tarea o devuélvela con comentarios."
                : `Esperando la aprobación de ${name(task.assigned_by)}.`}
            </p>
            {isAssigner && <ReviewControl taskId={id} />}
          </div>
        )}
        {task.status === "bloqueada" && task.blocked_reason && (
          <div className="callout blocked">
            <p><b>Bloqueada:</b> {task.blocked_reason}</p>
          </div>
        )}
        {task.status === "hecha" && (
          <div className="callout done">
            <p>
              <b>Hecha</b>
              {task.closed_at && <> · {fmtStamp(task.closed_at)}</>}
              {task.approved_by && <> · aprobada por {name(task.approved_by)}</>}
              {task.due_date && task.closed_at && (
                <> · {task.closed_at.slice(0, 10) <= task.due_date ? "a tiempo" : "después de la fecha de entrega"}</>
              )}
              {nextRes.data && (
                <>
                  {" · "}
                  <Link href={`/tareas/${nextRes.data.id}`}>ver la siguiente repetición</Link>
                </>
              )}
            </p>
          </div>
        )}

        <div className="layout-2">
          <div className="stack">
            <section className="card">
              <h2>Estado</h2>
              <StatusControl taskId={id} current={task.status} isAssigner={isAssigner} blockedReason={task.blocked_reason} />
            </section>

            {task.description && (
              <section className="card">
                <h2>Descripción</h2>
                <p className="desc">{task.description}</p>
              </section>
            )}

            <section className="card">
              <h2>Requisitos y entregables {reqs.length > 0 && <span className="mono">· {reqDone}/{reqs.length}</span>}</h2>
              {reqs.length > 0 && (
                <div className="progress" aria-hidden="true">
                  <span style={{ width: `${Math.round((reqDone / reqs.length) * 100)}%` }} />
                </div>
              )}
              {reqs.length === 0 ? (
                <p className="hint">Sin requisitos. Agrega lo que debe cumplirse para dar la tarea por terminada.</p>
              ) : (
                <ul className="reqs">
                  {reqs.map((r) => (
                    <li key={r.id} className={`req${r.done ? " done" : ""}`}>
                      <RequirementCheck id={r.id} taskId={id} done={r.done} label={r.body} />
                      <span>
                        <span className="body">{r.body}</span>
                        {r.done && r.done_by && r.done_at && (
                          <span className="by">✓ {name(r.done_by)}, {fmtStamp(r.done_at)}</span>
                        )}
                      </span>
                      <form action={deleteRequirement}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="task_id" value={id} />
                        <button type="submit" className="x" aria-label={`Quitar requisito: ${r.body}`} title="Quitar">×</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addRequirement} className="addrow">
                <input type="hidden" name="task_id" value={id} />
                <input className="input" name="body" placeholder="Agregar requisito o entregable…" required aria-label="Nuevo requisito" />
                <SubmitButton className="btn" pendingText="…">Agregar</SubmitButton>
              </form>
            </section>

            <section className="card">
              <h2>Notas y avances</h2>
              <NoteForm taskId={id} />
              {notes.length === 0 ? (
                <p className="hint">Aún no hay notas.</p>
              ) : (
                <ul className="timeline">
                  {notes.map((n) => {
                    const unread = n.author_id !== me.id && (!lastRead || n.created_at > lastRead);
                    return (
                      <li key={n.id}>
                        <Avatar p={profiles[n.author_id]} size={28} />
                        <div className={unread ? "unread" : undefined}>
                          <div className="h">
                            <b>{name(n.author_id)}</b> · {fmtStamp(n.created_at)}
                            {unread && <span className="new-badge" style={{ marginLeft: 8 }}>Nueva</span>}
                          </div>
                          <p>{n.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="stack">
            <section className="card">
              <h2>Detalles</h2>
              <dl className="facts">
                <div>
                  <dt>Responsables</dt>
                  <dd>
                    {task.assignees.map((u) => (
                      <span key={u} className="person"><Avatar p={profiles[u]} size={22} />{name(u)}</span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Asignada por</dt>
                  <dd><span className="person"><Avatar p={profiles[task.assigned_by]} size={22} />{name(task.assigned_by)}</span></dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{task.start_date ? fmtDate(task.start_date) : "—"}</dd>
                </div>
                <div>
                  <dt>Entrega</dt>
                  <dd>
                    {task.due_date ? fmtDate(task.due_date) : "Sin fecha"}
                    {dueChanges.length > 0 && <span className="muted">· cambió {dueChanges.length} {dueChanges.length === 1 ? "vez" : "veces"}</span>}
                  </dd>
                </div>
                {task.closed_at && (
                  <div>
                    <dt>Cierre real</dt>
                    <dd>{fmtStamp(task.closed_at)}</dd>
                  </div>
                )}
                <div>
                  <dt>Repetición</dt>
                  <dd>{RECURRENCE[task.recurrence]}</dd>
                </div>
                <div>
                  <dt>Creada</dt>
                  <dd>{name(task.created_by)}, {fmtStamp(task.created_at)}</dd>
                </div>
              </dl>
            </section>

            <section className="card">
              <h2>Adjuntos</h2>
              {atts.length === 0 ? (
                <p className="hint">Sin enlaces ni archivos.</p>
              ) : (
                <ul className="files">
                  {atts.map((a) => {
                    const href = a.kind === "enlace" ? a.url! : signed[a.storage_path ?? ""];
                    return (
                      <li key={a.id}>
                        <span className="ico">{a.kind === "enlace" ? "URL" : fileBadge(a.name)}</span>
                        <span style={{ minWidth: 0 }}>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer">{a.name}</a>
                          ) : (
                            <span>{a.name}</span>
                          )}
                          <span className="sub" style={{ display: "block" }}>
                            {name(a.created_by)} · {fmtStamp(a.created_at)}
                            {a.size_bytes ? ` · ${fmtSize(a.size_bytes)}` : ""}
                          </span>
                        </span>
                        <form action={deleteAttachment}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="task_id" value={id} />
                          <button type="submit" className="x" aria-label={`Quitar ${a.name}`} title="Quitar">×</button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
              <AttachmentForms taskId={id} />
            </section>

            <section className="card">
              <h2>Historial</h2>
              {history.length === 0 ? (
                <p className="hint">Sin cambios todavía.</p>
              ) : (
                <ul className="history">
                  {history.map((h, i) => (
                    <li key={i}>
                      <span className="when">{fmtStamp(h.at)}</span>
                      <span>{h.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <DeleteTask taskId={id} />
          </aside>
        </div>
      </main>
    </>
  );
}
