import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Avatar } from "@/components/Avatar";
import { EventForm } from "@/components/EventForm";
import { TaskRow } from "@/components/TaskRow";
import { SubmitButton } from "@/components/SubmitButton";
import { NotesForm, DeleteEvent } from "@/components/EventControls";
import { requireUser, getProfiles, listTasks, displayName } from "@/lib/data";
import { getEvent } from "@/lib/events";
import { fmtDate, fmtLongDay, fmtStamp, fmtTimeRange, todayISO } from "@/lib/dates";
import { EVENT_KIND, RECURRENCE, isOpen } from "@/lib/types";
import { updateEvent, linkTask, unlinkTask } from "../actions";

export const dynamic = "force-dynamic";

const isUrl = (s: string) => /^https?:\/\//i.test(s);

export default async function EventPage({
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
  const ev = await getEvent(supabase, id);
  if (!ev) notFound();
  const [profiles, allTasks, nextRes] = await Promise.all([
    getProfiles(supabase),
    listTasks(supabase),
    supabase.from("events").select("id, event_date").eq("recurrence_from", id).maybeSingle(),
  ]);
  const name = (u: string | null) => displayName(u ? profiles[u] : undefined);

  if (sp.editar) {
    return (
      <>
        <Header me={me} />
        <main className="page narrow">
          <div className="crumbs">
            <Link href="/eventos">Eventos</Link> / <Link href={`/eventos/${id}`}>{ev.title}</Link>
          </div>
          <h1 style={{ fontSize: 28 }}>Editar evento</h1>
          <EventForm mode="editar" action={updateEvent} people={Object.values(profiles)} meId={me.id} event={ev} />
        </main>
      </>
    );
  }

  const linked = allTasks.filter((t) => t.event_id === id);
  const linkable = allTasks
    .filter((t) => t.event_id !== id && isOpen(t.status))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
  const today = todayISO();
  const when = ev.event_date === today ? "Hoy" : fmtLongDay(ev.event_date);

  return (
    <>
      <Header me={me} />
      <main className="page">
        <div className="crumbs"><Link href="/eventos">← Eventos</Link></div>

        <div className="task-head">
          <h1>{ev.title}</h1>
          <div className="meta">
            <span className={`kind kind-${ev.kind}`}>{EVENT_KIND[ev.kind]}</span>
            <span className="ev-big-when">
              {when} · {fmtTimeRange(ev.start_time, ev.end_time)}
            </span>
            {ev.recurrence !== "ninguna" && <span>↻ {RECURRENCE[ev.recurrence]}</span>}
          </div>
          <div className="actions">
            <Link href={`/eventos/${id}?editar=1`} className="btn">Editar</Link>
            <Link href={`/tareas/nueva?evento=${id}`} className="btn primary">+ Crear tarea desde este evento</Link>
          </div>
        </div>

        {nextRes.data && (
          <div className="callout">
            <p>
              ↻ Próxima repetición: <Link href={`/eventos/${nextRes.data.id}`}>{fmtDate(nextRes.data.event_date)}</Link>
            </p>
          </div>
        )}

        <div className="layout-2">
          <div className="stack">
            {ev.description && (
              <section className="card">
                <h2>Agenda</h2>
                <p className="desc">{ev.description}</p>
              </section>
            )}

            <section className="card">
              <h2>Tareas de este evento · {linked.length}</h2>
              {linked.length === 0 ? (
                <p className="hint">Todavía no hay tareas. Crea una nueva o vincula una que ya exista.</p>
              ) : (
                <div className="list linked">
                  {linked.map((t) => (
                    <div key={t.id} className="linked-row">
                      <TaskRow t={t} profiles={profiles} />
                      <form action={unlinkTask}>
                        <input type="hidden" name="event_id" value={id} />
                        <input type="hidden" name="task_id" value={t.id} />
                        <button type="submit" className="x" aria-label={`Desvincular ${t.title}`} title="Desvincular (la tarea no se borra)">×</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              <div className="link-tools">
                <Link href={`/tareas/nueva?evento=${id}`} className="btn small">+ Crear tarea</Link>
                {linkable.length > 0 && (
                  <form action={linkTask} className="addrow" style={{ flex: 1, minWidth: 240 }}>
                    <input type="hidden" name="event_id" value={id} />
                    <select name="task_id" className="input" required aria-label="Tarea existente" defaultValue="">
                      <option value="" disabled>Vincular una tarea existente…</option>
                      {linkable.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                          {t.due_date ? ` · ${fmtDate(t.due_date)}` : ""}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn small" pendingText="…">Vincular</SubmitButton>
                  </form>
                )}
              </div>
            </section>

            <section className="card">
              <h2>Notas o acta</h2>
              <NotesForm eventId={id} notes={ev.notes} />
            </section>
          </div>

          <aside className="stack">
            <section className="card">
              <h2>Detalles</h2>
              <dl className="facts">
                <div>
                  <dt>Fecha</dt>
                  <dd>{fmtDate(ev.event_date)}</dd>
                </div>
                <div>
                  <dt>Hora</dt>
                  <dd>{fmtTimeRange(ev.start_time, ev.end_time)}</dd>
                </div>
                {ev.location && (
                  <div>
                    <dt>Lugar o enlace</dt>
                    <dd style={{ overflowWrap: "anywhere" }}>
                      {isUrl(ev.location) ? (
                        <a href={ev.location} target="_blank" rel="noopener noreferrer">{ev.location}</a>
                      ) : (
                        ev.location
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Participantes</dt>
                  <dd>
                    {ev.participants.map((u) => (
                      <span key={u} className="person"><Avatar p={profiles[u]} size={22} />{name(u)}</span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>Creado</dt>
                  <dd>{name(ev.created_by)}, {fmtStamp(ev.created_at)}</dd>
                </div>
              </dl>
            </section>
            <DeleteEvent eventId={id} recurring={ev.recurrence !== "ninguna"} />
          </aside>
        </div>
      </main>
    </>
  );
}
