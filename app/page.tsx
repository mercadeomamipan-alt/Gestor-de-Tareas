import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { TaskRow } from "@/components/TaskRow";
import { requireUser, getProfiles, listTasks, getReads, getRecentNotesByOthers, displayName } from "@/lib/data";
import { daysUntil, dueInfo, fmtLongToday, isoWeek, todayISO } from "@/lib/dates";
import { STATUS, isOpen, type Status, type TaskListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

const PRIO_RANK = { alta: 0, media: 1, baja: 2 } as const;
const byDue = (a: TaskListItem, b: TaskListItem) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || PRIO_RANK[a.priority] - PRIO_RANK[b.priority];

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const who = get("quien") || "todas";
  const estado = get("estado") || "abiertas";
  const proyecto = get("proyecto");
  const q = get("q").toLowerCase();

  const { supabase, me } = await requireUser();
  const [profiles, tasks, reads, notes] = await Promise.all([
    getProfiles(supabase),
    listTasks(supabase),
    getReads(supabase, me.id),
    getRecentNotesByOthers(supabase, me.id),
  ]);
  const today = todayISO();

  const mine = (t: TaskListItem) => t.assignees.includes(me.id);
  const involved = (t: TaskListItem) => mine(t) || t.assigned_by === me.id;

  // ---- Requiere tu atención (siempre sobre MIS tareas) ----
  const openMine = tasks.filter((t) => isOpen(t.status) && mine(t));
  const attLate = openMine.filter((t) => t.due_date && daysUntil(t.due_date, today) < 0).sort(byDue);
  const attSoon = openMine.filter((t) => t.due_date && [0, 1].includes(daysUntil(t.due_date, today))).sort(byDue);
  const attReview = tasks.filter((t) => t.status === "en_revision" && t.assigned_by === me.id).sort(byDue);
  const isNewForMe = (t: TaskListItem) => mine(t) && t.assigned_by !== me.id && !reads[t.id] && isOpen(t.status);
  const attNew = tasks.filter(isNewForMe);
  const unreadByTask: Record<string, number> = {};
  for (const n of notes) {
    const r = reads[n.task_id];
    if (!r || n.created_at > r) unreadByTask[n.task_id] = (unreadByTask[n.task_id] ?? 0) + 1;
  }
  const attNotes = tasks.filter((t) => involved(t) && unreadByTask[t.id] && !isNewForMe(t));
  const attentionCount = attLate.length + attSoon.length + attReview.length + attNew.length + attNotes.length;

  // ---- Filtros ----
  const scope = tasks.filter((t) => {
    if (who === "mias" && !mine(t)) return false;
    if (who === "compartidas" && t.assignees.length < 2) return false;
    if (who === "otros" && mine(t)) return false;
    if (proyecto && t.project !== proyecto) return false;
    if (q) {
      const hay = `${t.title} ${t.description} ${t.project}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const openScope = scope.filter((t) => isOpen(t.status));
  const sLate = openScope.filter((t) => t.due_date && daysUntil(t.due_date, today) < 0).length;
  const sWeek = openScope.filter((t) => t.due_date && daysUntil(t.due_date, today) >= 0 && daysUntil(t.due_date, today) <= 7).length;
  const sProg = openScope.filter((t) => t.status === "en_curso").length;
  const sReview = openScope.filter((t) => t.status === "en_revision").length;

  const visible = scope.filter((t) => {
    if (estado === "abiertas") return isOpen(t.status);
    if (estado === "todas") return true;
    return t.status === (estado as Status);
  });

  const groups = [
    { key: "late", title: "Vencidas", items: visible.filter((t) => isOpen(t.status) && t.due_date && daysUntil(t.due_date, today) < 0) },
    { key: "week", title: "Próximos 7 días", items: visible.filter((t) => isOpen(t.status) && t.due_date && daysUntil(t.due_date, today) >= 0 && daysUntil(t.due_date, today) <= 7) },
    { key: "later", title: "Más adelante", items: visible.filter((t) => isOpen(t.status) && t.due_date && daysUntil(t.due_date, today) > 7) },
    { key: "nodate", title: "Sin fecha de entrega", items: visible.filter((t) => isOpen(t.status) && !t.due_date) },
    { key: "closed", title: "Cerradas", items: visible.filter((t) => !isOpen(t.status)) },
  ]
    .map((g) => ({
      ...g,
      items: g.key === "closed" ? g.items.sort((a, b) => (b.closed_at ?? "").localeCompare(a.closed_at ?? "")) : g.items.sort(byDue),
    }))
    .filter((g) => g.items.length);

  const projects = [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (who !== "todas") p.set("quien", who);
    if (proyecto) p.set("proyecto", proyecto);
    if (q) p.set("q", q);
    for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k);
    return p.size ? `/?${p}` : "/";
  };

  const AttItem = ({ t, sub }: { t: TaskListItem; sub: string }) => (
    <li>
      <Link href={`/tareas/${t.id}`}>
        <span className="t">{t.title}</span>
        <span className="s">{sub}</span>
      </Link>
    </li>
  );

  return (
    <>
      <Header me={me} />
      <main className="page">
        <div className="dash-head">
          <h1>Hola, {me.full_name.split(" ")[0] || "de nuevo"}</h1>
          <span className="today">
            {fmtLongToday()} · semana {isoWeek(today)}
          </span>
        </div>

        {get("borrada") && <div className="flash">La tarea se eliminó.</div>}

        <section className="attention" aria-labelledby="att-title">
          <header>
            <h2 id="att-title">Requiere tu atención</h2>
            <span className="muted mono">{attentionCount}</span>
          </header>
          {attentionCount === 0 ? (
            <p className="all-clear">Estás al día: nada vencido, nada por aprobar y ninguna novedad en tus tareas.</p>
          ) : (
            <div className="attention-grid">
              {attLate.length > 0 && (
                <div className="att-col late">
                  <h3><span className="dot" />Vencidas · {attLate.length}</h3>
                  <ul>{attLate.map((t) => <AttItem key={t.id} t={t} sub={dueInfo(t.due_date, today).text} />)}</ul>
                </div>
              )}
              {attSoon.length > 0 && (
                <div className="att-col soon">
                  <h3><span className="dot" />Vencen hoy o mañana · {attSoon.length}</h3>
                  <ul>{attSoon.map((t) => <AttItem key={t.id} t={t} sub={dueInfo(t.due_date, today).text} />)}</ul>
                </div>
              )}
              {attReview.length > 0 && (
                <div className="att-col review">
                  <h3><span className="dot" />Por aprobar · {attReview.length}</h3>
                  <ul>
                    {attReview.map((t) => (
                      <AttItem key={t.id} t={t} sub={`Enviada por ${t.assignees.map((a) => displayName(profiles[a], me.id)).join(", ")}`} />
                    ))}
                  </ul>
                </div>
              )}
              {attNew.length > 0 && (
                <div className="att-col new">
                  <h3><span className="dot" />Te asignaron · {attNew.length}</h3>
                  <ul>
                    {attNew.map((t) => (
                      <AttItem key={t.id} t={t} sub={`De ${displayName(profiles[t.assigned_by], me.id)} · ${dueInfo(t.due_date, today).text}`} />
                    ))}
                  </ul>
                </div>
              )}
              {attNotes.length > 0 && (
                <div className="att-col new">
                  <h3><span className="dot" />Notas nuevas · {attNotes.length}</h3>
                  <ul>
                    {attNotes.map((t) => (
                      <AttItem key={t.id} t={t} sub={`${unreadByTask[t.id]} nota${unreadByTask[t.id] > 1 ? "s" : ""} sin leer`} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <nav className="summary" aria-label="Resumen">
          <a className="late" href={qs({ estado: "" }) + "#g-late"}>
            <span className="n">{sLate}</span>
            <span className="l">Vencidas</span>
          </a>
          <a className="soon" href={qs({ estado: "" }) + "#g-week"}>
            <span className="n">{sWeek}</span>
            <span className="l">Próximos 7 días</span>
          </a>
          <a href={qs({ estado: "en_curso" })}>
            <span className="n">{sProg}</span>
            <span className="l">En curso</span>
          </a>
          <a className="review" href={qs({ estado: "en_revision" })}>
            <span className="n">{sReview}</span>
            <span className="l">En revisión</span>
          </a>
        </nav>

        <Suspense>
          <FilterBar projects={projects} />
        </Suspense>

        {tasks.length === 0 ? (
          <div className="empty">
            <h3>Todavía no hay tareas</h3>
            <p style={{ margin: 0, maxWidth: "46ch" }}>
              Crea la primera y asígnala a ti, a la otra persona o a ambos. Si tiene dos responsables queda como compartida.
            </p>
            <Link href="/tareas/nueva" className="btn primary">+ Nueva tarea</Link>
          </div>
        ) : groups.length === 0 ? (
          <div className="empty">
            <h3>Nada con estos filtros</h3>
            <p style={{ margin: 0 }}>
              Prueba con <Link href="/">todas las tareas abiertas</Link>
              {estado !== "todas" && <> o elige “Todos los estados”</>}.
            </p>
          </div>
        ) : (
          <div className="groups">
            {groups.map((g) => (
              <section key={g.key} id={`g-${g.key}`} className={`group ${g.key}`}>
                <header>
                  <h2>{g.title}</h2>
                  <span className="count">{g.items.length}</span>
                </header>
                <div className="list">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} t={t} profiles={profiles} isNew={isNewForMe(t)} unreadNotes={unreadByTask[t.id]} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {estado !== "abiertas" && estado !== "todas" && (
          <p className="hint">Mostrando solo: {STATUS[estado as Status] ?? estado}.</p>
        )}
      </main>
    </>
  );
}
