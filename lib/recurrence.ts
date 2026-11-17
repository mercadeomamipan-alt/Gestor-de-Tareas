import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, todayISO, weekdayIndex } from "@/lib/dates";
import { CLOSED, type Task } from "@/lib/types";

/**
 * Genera las repeticiones de las tareas repetitivas, se hayan hecho o no las anteriores.
 *
 * - Diaria (lunes a sábado): cada mañana aparece la tarea del día. La del día anterior que
 *   siga abierta se marca como "no realizada".
 * - Semanal y mensual: el día en que vence una, aparece la siguiente (una semana o un mes después).
 *   Las que no se hicieron se quedan como vencidas.
 *
 * Se llama desde el resumen diario y al abrir la app. Es seguro llamarla muchas veces:
 * un índice único en recurrence_from impide crear dos veces la misma repetición.
 */
export async function ensureRecurrences(supabase: SupabaseClient, today = todayISO()) {
  const { data: recurring, error } = await supabase
    .from("tasks")
    .select("*, task_assignees(user_id)")
    .neq("recurrence", "ninguna")
    .not("due_date", "is", null);
  if (error || !recurring?.length) return { created: 0, missed: 0 };

  const { data: children } = await supabase.from("tasks").select("recurrence_from").not("recurrence_from", "is", null);
  const hasChild = new Set((children ?? []).map((c) => c.recurrence_from as string));

  type Row = Task & { task_assignees: { user_id: string }[] };
  const rows = recurring as Row[];
  let created = 0;
  let missed = 0;

  // 1) Diarias de días anteriores que siguen abiertas → "no realizada"
  const stale = rows.filter((t) => t.recurrence === "diaria" && t.due_date! < today && !CLOSED.includes(t.status));
  for (const t of stale) {
    const { error: e } = await supabase
      .from("tasks")
      .update({ status: "no_realizada", closed_at: new Date().toISOString(), blocked_reason: "", updated_at: new Date().toISOString() })
      .eq("id", t.id)
      .not("status", "in", `(${CLOSED.join(",")})`);
    if (!e) {
      missed++;
      await supabase.from("task_events").insert({
        task_id: t.id,
        actor_id: t.created_by,
        kind: "auto",
        detail: "se marcó como no realizada porque no se cerró ese día",
      });
    }
  }

  // 2) Crear la siguiente repetición de cada serie (la última tarea de cada cadena)
  const isSundayToday = weekdayIndex(today) === 6;
  for (const leaf of rows.filter((t) => !hasChild.has(t.id))) {
    let current: Row = leaf;
    for (let guard = 0; guard < 6; guard++) {
      let nextDue: string | null = null;
      if (current.recurrence === "diaria") {
        // Solo la de hoy (lunes a sábado), y solo si la última es de un día anterior
        if (!isSundayToday && current.due_date! < today) nextDue = today;
      } else if (current.due_date! <= today) {
        nextDue = current.recurrence === "semanal" ? addDays(current.due_date!, 7) : addMonths(current.due_date!, 1);
      }
      if (!nextDue) break;

      const shiftStart =
        current.start_date && current.due_date
          ? addDays(nextDue, Math.round((Date.parse(current.start_date) - Date.parse(current.due_date)) / 86400000))
          : null;
      const { data: next, error: insErr } = await supabase
        .from("tasks")
        .insert({
          title: current.title,
          description: current.description,
          project: current.project,
          priority: current.priority,
          recurrence: current.recurrence,
          recurrence_from: current.id,
          start_date: current.recurrence === "diaria" ? null : shiftStart,
          due_date: nextDue,
          assigned_by: current.assigned_by,
          created_by: current.created_by,
        })
        .select("*")
        .single();
      if (insErr || !next) break; // ya existía (otra persona la creó al mismo tiempo) u otro error

      const assignees = current.task_assignees.map((a) => a.user_id);
      if (assignees.length) {
        await supabase.from("task_assignees").insert(assignees.map((u) => ({ task_id: next.id, user_id: u })));
      }
      const { data: reqs } = await supabase.from("requirements").select("body, position").eq("task_id", current.id);
      if (reqs?.length) {
        await supabase.from("requirements").insert(reqs.map((r) => ({ task_id: next.id, body: r.body, position: r.position })));
      }
      await supabase.from("task_events").insert({
        task_id: next.id,
        actor_id: current.created_by,
        kind: "auto",
        detail: "se creó esta repetición",
      });
      created++;
      current = { ...(next as Task), task_assignees: current.task_assignees };
      if (current.recurrence === "diaria") break;
    }
  }
  return { created, missed };
}
