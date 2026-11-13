-- =====================================================================
-- Gestor de Tareas — esquema de base de datos para Supabase
-- Ejecuta este archivo completo una sola vez en:
--   Supabase > SQL Editor > New query > pegar > Run
-- =====================================================================

-- ---------- Perfiles (uno por usuario de Supabase Auth) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  created_at  timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando se agrega un usuario en Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles de usuarios que ya existían antes de correr este script
insert into public.profiles (id, email, full_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------- Tareas ----------
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  description     text not null default '',
  project         text not null default '',
  priority        text not null default 'media'
                  check (priority in ('alta', 'media', 'baja')),
  status          text not null default 'pendiente'
                  check (status in ('pendiente', 'en_curso', 'en_revision', 'bloqueada', 'hecha', 'cancelada')),
  blocked_reason  text not null default '',
  start_date      date,
  due_date        date,
  closed_at       timestamptz,
  estimated_hours numeric(6, 2) check (estimated_hours is null or estimated_hours >= 0),
  recurrence      text not null default 'ninguna'
                  check (recurrence in ('ninguna', 'semanal', 'mensual')),
  recurrence_from uuid references public.tasks (id) on delete set null,
  assigned_by     uuid not null references public.profiles (id),
  approved_by     uuid references public.profiles (id),
  approved_at     timestamptz,
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  updated_at      timestamptz not null default now()
);
create index if not exists tasks_due_idx on public.tasks (due_date);
create index if not exists tasks_status_idx on public.tasks (status);

-- Responsables (una tarea con 2 o más responsables es "compartida")
create table if not exists public.task_assignees (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

-- Requisitos y entregables
create table if not exists public.requirements (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  done       boolean not null default false,
  done_by    uuid references public.profiles (id),
  done_at    timestamptz,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists requirements_task_idx on public.requirements (task_id);

-- Notas de avance
create table if not exists public.task_notes (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid not null references public.profiles (id),
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists task_notes_task_idx on public.task_notes (task_id, created_at);

-- Historial de cambios de fecha de entrega
create table if not exists public.due_date_changes (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  old_date   date,
  new_date   date,
  reason     text not null default '',
  changed_by uuid not null references public.profiles (id),
  changed_at timestamptz not null default now()
);
create index if not exists due_changes_task_idx on public.due_date_changes (task_id, changed_at);

-- Historial de estados y aprobaciones
create table if not exists public.task_events (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id),
  kind       text not null,   -- creada, estado, aprobada, devuelta, editada
  detail     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists task_events_task_idx on public.task_events (task_id, created_at);

-- Enlaces y archivos adjuntos
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  kind         text not null check (kind in ('enlace', 'archivo')),
  name         text not null,
  url          text,          -- para enlaces
  storage_path text,          -- para archivos (bucket "adjuntos")
  size_bytes   bigint,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);
create index if not exists attachments_task_idx on public.attachments (task_id);

-- Última vez que cada persona abrió cada tarea (para "nuevo" y "notas nuevas")
create table if not exists public.task_reads (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- ---------- Seguridad (RLS) ----------
-- Solo usuarios con sesión iniciada pueden leer o escribir. Como los registros
-- públicos están desactivados, eso significa: solo las personas que tú agregues.
do $$
declare t text;
begin
  foreach t in array array['profiles','tasks','task_assignees','requirements','task_notes',
                           'due_date_changes','task_events','attachments','task_reads']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipo_lee" on public.%I', t);
    execute format('drop policy if exists "equipo_escribe" on public.%I', t);
    execute format('create policy "equipo_lee" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "equipo_escribe" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Cada quien solo puede cambiar su propio perfil
drop policy if exists "equipo_escribe" on public.profiles;
drop policy if exists "perfil_propio" on public.profiles;
create policy "perfil_propio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Archivos adjuntos (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 10485760)   -- 10 MB por archivo
on conflict (id) do nothing;

drop policy if exists "adjuntos_equipo_lee" on storage.objects;
drop policy if exists "adjuntos_equipo_sube" on storage.objects;
drop policy if exists "adjuntos_equipo_borra" on storage.objects;
create policy "adjuntos_equipo_lee" on storage.objects
  for select to authenticated using (bucket_id = 'adjuntos');
create policy "adjuntos_equipo_sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'adjuntos');
create policy "adjuntos_equipo_borra" on storage.objects
  for delete to authenticated using (bucket_id = 'adjuntos');
