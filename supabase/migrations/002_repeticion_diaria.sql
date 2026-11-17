-- =====================================================================
-- Actualización: repetición diaria (lunes a sábado), estado "No realizada"
-- y protección contra repeticiones duplicadas.
-- Ejecútalo una sola vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a ejecutar sin problema.
-- =====================================================================

alter table public.tasks drop constraint if exists tasks_recurrence_check;
alter table public.tasks add constraint tasks_recurrence_check
  check (recurrence in ('ninguna', 'diaria', 'semanal', 'mensual'));

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('pendiente', 'en_curso', 'en_revision', 'bloqueada', 'hecha', 'cancelada', 'no_realizada'));

-- Cada tarea tiene como máximo una "siguiente repetición"
create unique index if not exists tasks_recurrence_from_unique
  on public.tasks (recurrence_from) where recurrence_from is not null;
