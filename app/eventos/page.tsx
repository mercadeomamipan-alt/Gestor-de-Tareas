import Link from "next/link";
import { Header } from "@/components/Header";
import { EventRow } from "@/components/EventRow";
import { requireUser, getProfiles } from "@/lib/data";
import { listEvents, ensureEventRecurrences } from "@/lib/events";
import { addDays, fmtLongDay, todayISO } from "@/lib/dates";
import type { EventListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | undefined>>;

export default async function EventsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const who = sp.quien === "mios" ? "mios" : "todos";
  const { supabase, me } = await requireUser();
  await ensureEventRecurrences(supabase);
  const today = todayISO();
  const [profiles, upcomingAll, pastAll] = await Promise.all([
    getProfiles(supabase),
    listEvents(supabase, today),
    listEvents(supabase, addDays(today, -60), addDays(today, -1)),
  ]);
  const mine = (e: EventListItem) => who === "todos" || e.participants.includes(me.id);
  const upcoming = upcomingAll.filter(mine);
  const past = pastAll.filter(mine).reverse();

  const byDay: [string, EventListItem[]][] = [];
  for (const e of upcoming) {
    const last = byDay[byDay.length - 1];
    if (last && last[0] === e.event_date) last[1].push(e);
    else byDay.push([e.event_date, [e]]);
  }
  const dayLabel = (d: string) => (d === today ? "Hoy" : d === addDays(today, 1) ? "Mañana" : fmtLongDay(d));

  return (
    <>
      <Header me={me} />
      <main className="page">
        <div className="dash-head">
          <h1>Eventos y reuniones</h1>
          <Link href="/eventos/nuevo" className="btn primary">+ Nuevo evento</Link>
        </div>
        {sp.borrado && <div className="flash">El evento se eliminó.</div>}
        <div className="filters">
          <div className="seg" role="group" aria-label="De quién">
            <Link href="/eventos" aria-current={who === "todos" ? "true" : undefined}>Todos</Link>
            <Link href="/eventos?quien=mios" aria-current={who === "mios" ? "true" : undefined}>Donde participo</Link>
          </div>
        </div>

        {byDay.length === 0 ? (
          <div className="empty">
            <h3>No hay eventos próximos</h3>
            <p style={{ margin: 0, maxWidth: "48ch" }}>
              Agrega reuniones, citas o capacitaciones. Aparecen aquí y en el calendario, y puedes crear tareas desde cada una.
            </p>
            <Link href="/eventos/nuevo" className="btn primary">+ Nuevo evento</Link>
          </div>
        ) : (
          <div className="groups">
            {byDay.map(([d, list]) => (
              <section key={d} className="group">
                <header>
                  <h2>{dayLabel(d)}</h2>
                  <span className="count">{list.length}</span>
                </header>
                <div className="list">
                  {list.map((e) => (
                    <EventRow key={e.id} e={e} profiles={profiles} showDate={false} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <details className="past">
            <summary>Eventos pasados (últimos 60 días) · {past.length}</summary>
            <div className="list">
              {past.map((e) => (
                <EventRow key={e.id} e={e} profiles={profiles} />
              ))}
            </div>
          </details>
        )}
      </main>
    </>
  );
}
