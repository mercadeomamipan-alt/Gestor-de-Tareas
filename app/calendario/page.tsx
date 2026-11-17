import { Suspense } from "react";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { Calendar, type View } from "@/components/Calendar";
import { ensureRecurrences } from "@/lib/recurrence";
import { requireUser, getProfiles, listTasks } from "@/lib/data";
import { addDays, endOfMonth, isValidISO, startOfMonth, startOfWeek, todayISO, daysUntil } from "@/lib/dates";
import { isOpen, type TaskListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view: View = (["mes", "semana", "dia"] as const).includes(get("vista") as View) ? (get("vista") as View) : "mes";
  const today = todayISO();
  const anchor = isValidISO(get("fecha")) ? get("fecha") : today;
  const who = get("quien") || "todas";
  const proyecto = get("proyecto");

  // Rango visible
  let from: string, to: string;
  if (view === "mes") {
    from = startOfWeek(startOfMonth(anchor));
    to = addDays(startOfWeek(endOfMonth(anchor)), 6);
  } else if (view === "semana") {
    from = startOfWeek(anchor);
    to = addDays(from, 6);
  } else {
    from = to = anchor;
  }

  const { supabase, me } = await requireUser();
  await ensureRecurrences(supabase);
  const [profiles, all] = await Promise.all([getProfiles(supabase), listTasks(supabase)]);

  const mine = (t: TaskListItem) => t.assignees.includes(me.id);
  const filtered = all.filter((t) => {
    if (who === "mias" && !mine(t)) return false;
    if (who === "compartidas" && t.assignees.length < 2) return false;
    if (who === "otros" && mine(t)) return false;
    if (proyecto && t.project !== proyecto) return false;
    return true;
  });
  const inRange = filtered.filter((t) => t.due_date && t.due_date >= from && t.due_date <= to);
  const noDate = filtered.filter((t) => !t.due_date && isOpen(t.status)).length;
  // En la vista de hoy también se muestran las vencidas abiertas
  const overdue =
    view === "dia" && anchor === today
      ? filtered.filter((t) => isOpen(t.status) && t.due_date && daysUntil(t.due_date, today) < 0)
      : [];

  const projects = [...new Set(all.map((t) => t.project).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <>
      <Header me={me} />
      <main className="page wide">
        <Suspense>
          <FilterBar projects={projects} showStatus={false} showSearch={false} />
        </Suspense>
        <Calendar
          view={view}
          anchor={anchor}
          today={today}
          from={from}
          to={to}
          tasks={inRange}
          overdue={overdue}
          noDateCount={noDate}
          profiles={profiles}
          meId={me.id}
          query={{ quien: who === "todas" ? "" : who, proyecto }}
        />
      </main>
    </>
  );
}
