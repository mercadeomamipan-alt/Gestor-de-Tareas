export const STATUS = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  en_revision: "En revisión",
  bloqueada: "Bloqueada",
  hecha: "Hecha",
  cancelada: "Cancelada",
  no_realizada: "No realizada",
} as const;
export type Status = keyof typeof STATUS;

export const PRIORITY = { alta: "Alta", media: "Media", baja: "Baja" } as const;
export type Priority = keyof typeof PRIORITY;

export const RECURRENCE = {
  ninguna: "No se repite",
  diaria: "Cada día (lunes a sábado)",
  semanal: "Cada semana",
  mensual: "Cada mes",
} as const;
export type Recurrence = keyof typeof RECURRENCE;

export const CLOSED: Status[] = ["hecha", "cancelada", "no_realizada"];
export const isOpen = (s: Status) => !CLOSED.includes(s);

/** hue: tono de color asignado a la persona (distinto para cada miembro del equipo). */
export type Profile = { id: string; email: string; full_name: string; hue?: number };

export type Task = {
  id: string;
  title: string;
  description: string;
  project: string;
  priority: Priority;
  status: Status;
  blocked_reason: string;
  start_date: string | null;
  due_date: string | null;
  closed_at: string | null;
  estimated_hours: number | null;
  recurrence: Recurrence;
  recurrence_from: string | null;
  assigned_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  event_id?: string | null;
};

export type Requirement = {
  id: string;
  task_id: string;
  body: string;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  position: number;
};

export type Note = { id: string; task_id: string; author_id: string; body: string; created_at: string };

export type DueChange = {
  id: string;
  task_id: string;
  old_date: string | null;
  new_date: string | null;
  reason: string;
  changed_by: string;
  changed_at: string;
};

export type TaskEvent = { id: string; task_id: string; actor_id: string; kind: string; detail: string; created_at: string };

export type Attachment = {
  id: string;
  task_id: string;
  kind: "enlace" | "archivo";
  name: string;
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  created_by: string;
  created_at: string;
};

/** Tarea con sus responsables y conteos, como se usa en las listas. */
export type TaskListItem = Task & {
  assignees: string[];
  req_total: number;
  req_done: number;
  note_count: number;
};

// ---------- Eventos y reuniones ----------
export const EVENT_KIND = {
  reunion: "Reunión",
  evento: "Evento",
  cita: "Cita",
  capacitacion: "Capacitación",
  otro: "Otro",
} as const;
export type EventKind = keyof typeof EVENT_KIND;

export type CalEvent = {
  id: string;
  title: string;
  kind: EventKind;
  event_date: string;
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  location: string;
  description: string;
  notes: string;
  recurrence: Recurrence;
  recurrence_from: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type EventListItem = CalEvent & { participants: string[]; task_count: number };
