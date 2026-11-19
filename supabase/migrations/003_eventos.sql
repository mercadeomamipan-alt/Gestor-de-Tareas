-- =====================================================================
-- Actualización: Eventos y reuniones
-- Ejecútalo una sola vez en Supabase > SQL Editor > New query > Run.
-- Se puede volver a ejecutar sin problema.
-- =====================================================================

create table if not exists public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  kind            text not null default 'reunion'
                  check (kind in ('reunion', 'evento', 'cita', 'capacitacion', 'otro')),
  event_date      date not null,
  start_time      time,                    -- vacío = todo el día
  end_time        time,
  location        text not null default '', -- sala, dirección o enlace de Meet/Zoom/Teams
  description     text not null default '', -- agenda
  notes           text not null default '', -- notas o acta
  recurrence      text not null default 'ninguna'
                  check (recurrence in ('ninguna', 'diaria', 'semanal', 'mensual')),
  recurrence_from uuid references public.events (id) on delete set null,
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time)
);
create index if not exists events_date_idx on public.events (event_date);
create unique index if not exists events_recurrence_from_unique
  on public.events (recurrence_from) where recurrence_from is not null;

create table if not exists public.event_participants (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

-- Tareas que salen de un evento o se vinculan a él
alter table public.tasks add column if not exists event_id uuid references public.events (id) on delete set null;
create index if not exists tasks_event_idx on public.tasks (event_id);

-- Seguridad: igual que el resto, solo usuarios con sesión
do $$
declare t text;
begin
  foreach t in array array['events', 'event_participants']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipo_lee" on public.%I', t);
    execute format('drop policy if exists "equipo_escribe" on public.%I', t);
    execute format('create policy "equipo_lee" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "equipo_escribe" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
