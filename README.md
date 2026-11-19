# Gestor de Tareas

App web para hacerle seguimiento a tareas propias y compartidas entre dos personas, con fechas de entrega, requisitos, aprobaciones, adjuntos y avisos por correo.

**Tecnología:** Next.js (en Vercel) · Supabase (base de datos, inicio de sesión y archivos) · Gmail (correos).

## Qué hace

- **Tareas** con título, descripción, responsables (si son 2 o más queda como *compartida*), quién la asignó, proyecto o área, fecha de inicio, fecha de entrega, prioridad, horas estimadas y repetición (semanal o mensual).
- **Estados:** pendiente, en curso, en revisión, bloqueada (con motivo), hecha y cancelada.
- **Aprobación:** solo quien asignó la tarea puede marcarla como hecha. Si la termina otra persona, la tarea pasa a *en revisión* y quien la asignó la **aprueba** o la **devuelve** con comentarios.
- **Cambios de fecha con motivo:** si se mueve la fecha de entrega, la app pide el motivo y lo guarda en el historial.
- **Requisitos y entregables** que se van marcando, con una barra de avance.
- **Notas de avance** con autor y fecha.
- **Adjuntos:** enlaces y archivos de hasta 10 MB.
- **Historial** de todo lo que cambió en cada tarea.
- **Tareas repetitivas** (diaria de lunes a sábado, semanal o mensual): la siguiente aparece sola en su fecha, se haya hecho o no la anterior. Las diarias que no se cierran ese día quedan como *no realizada*. Las repetitivas se cierran sin aprobación.
- **Calendario** por mes, semana o día, con colores por persona, carga de trabajo y arrastrar para cambiar fechas.
- **Eventos y reuniones**: fecha y hora, lugar o enlace, participantes, agenda, notas o acta, repetición y tareas vinculadas (crear una tarea desde el evento o vincular una existente). Salen en el calendario, en el panel de inicio y en el resumen diario.
- **Panel "Requiere tu atención":** tareas vencidas, las que vencen hoy o mañana, las que esperan tu aprobación, las que te asignaron y notas nuevas.
- **Correos inmediatos** cuando:
  - te asignan una tarea
  - le cambian la fecha de entrega a una tarea tuya
  - una tarea espera tu aprobación
  - tu tarea fue aprobada o devuelta
- **Resumen diario por correo**, de lunes a sábado a las 8 a. m. (hora de Colombia). Solo se envía si hay algo que mirar.
- Acceso **solo para las personas que tú agregues**. No hay registro público.

---

## Puesta en marcha (una sola vez, unos 30 minutos)

### Paso 1 · Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
   - Nombre: `gestor-de-tareas`
   - Región: **East US (North Virginia)** o la más cercana
   - Guarda la contraseña de la base de datos en un lugar seguro.
2. Cuando termine de crearse, ve a **SQL Editor** → **New query**.
3. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repositorio, copia **todo** su contenido, pégalo y presiona **Run**. Debe decir *Success. No rows returned*.

### Paso 2 · Cerrar el registro público y crear los dos usuarios

1. En Supabase ve a **Authentication** → **Sign In / Providers** (o **Providers**).
   - Desactiva **Allow new users to sign up**.
   - En **Email**, desactiva **Confirm email**. Así los usuarios que tú creas pueden entrar de una vez.
2. Ve a **Authentication** → **Users** → **Add user** → **Create new user**.
   - Crea un usuario con **tu correo** y una contraseña.
   - Crea otro con el **correo de tu jefe** y una contraseña temporal. Cada uno puede cambiar la suya después en *Tu perfil*.
   - Marca **Auto Confirm User** si aparece la opción.
3. Pon los nombres que se van a ver en la app. En **SQL Editor** ejecuta (cambia los datos):

   ```sql
   update public.profiles set full_name = 'Tu Nombre'    where email = 'tu@correo.com';
   update public.profiles set full_name = 'Nombre Jefe'  where email = 'jefe@correo.com';
   ```

   También se puede cambiar después desde la app, en *Tu perfil*.

### Paso 3 · Copiar las claves de Supabase

Ve a **Project Settings** → **API** (o **Data API** y **API Keys**) y ten a mano:

| Dato en Supabase | Variable |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

> La clave `service_role` da acceso total. Solo va en Vercel. No la compartas por chat ni correo.

### Paso 4 · Contraseña de aplicación de Gmail

Los correos salen de una cuenta de Gmail. Puede ser la tuya o una creada para esto.

1. En esa cuenta activa la **verificación en dos pasos**: [myaccount.google.com/security](https://myaccount.google.com/security).
2. Entra a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), escribe un nombre (por ejemplo, `Gestor de Tareas`) y presiona **Crear**.
3. Copia la contraseña de 16 letras que aparece. Solo se muestra una vez.

> Si usas una cuenta de Google Workspace de la empresa y no aparece la opción, el administrador debe permitir las contraseñas de aplicación.

### Paso 5 · Publicar en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New…** → **Project** → importa el repositorio `Gestor-de-Tareas` de GitHub.
2. Antes de presionar **Deploy**, abre **Environment Variables** y agrega:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave `anon` |
   | `SUPABASE_SERVICE_ROLE_KEY` | clave `service_role` |
   | `GMAIL_USER` | el Gmail que envía (ej. `avisos.tareas@gmail.com`) |
   | `GMAIL_APP_PASSWORD` | la contraseña de 16 letras del paso 4 |
   | `APP_URL` | por ahora déjala vacía; la llenas en el punto 4 |
   | `CRON_SECRET` | un texto largo inventado, de 30 o más caracteres, sin espacios |

3. Presiona **Deploy** y espera a que termine.
4. Copia la dirección que te da Vercel (ej. `https://gestor-de-tareas.vercel.app`). Ve a **Settings** → **Environment Variables**, pon esa dirección en `APP_URL` (sin `/` al final) y luego ve a **Deployments** → el último → **⋯** → **Redeploy**. Así los enlaces de los correos apuntan a la app.

### Paso 6 · Conectar Supabase con la dirección de la app

En Supabase → **Authentication** → **URL Configuration**:
- **Site URL:** la dirección de Vercel (ej. `https://gestor-de-tareas.vercel.app`)

### Paso 6b · Actualizaciones de la base de datos

Si instalaste la app antes de que existieran, corre también estos archivos (una vez cada uno, en orden) en **SQL Editor**:

| Archivo | Para qué |
|---|---|
| [`supabase/migrations/002_repeticion_diaria.sql`](supabase/migrations/002_repeticion_diaria.sql) | Repetición diaria, estado "No realizada" y evitar repeticiones duplicadas |
| [`supabase/migrations/003_eventos.sql`](supabase/migrations/003_eventos.sql) | Eventos y reuniones, y tareas vinculadas a eventos |

Si instalas desde cero con `schema.sql`, ya vienen incluidas.

### Paso 7 · Probar

1. Abre la dirección de la app e inicia sesión con tu correo y contraseña.
2. Crea una tarea asignada a tu jefe: le debe llegar un correo.
3. Para probar el resumen diario sin esperar a las 8 a. m., ejecuta esto en una terminal, con tus datos:

   ```bash
   curl -H "Authorization: Bearer TU_CRON_SECRET" https://gestor-de-tareas.vercel.app/api/cron/resumen
   ```

   Responde algo como `{"ok":true,"enviados":1}`. Solo envía correo a quien tenga tareas vencidas, que venzan hoy o mañana, o tareas por aprobar.

---

## Cosas que conviene saber

- **Resumen diario:** está programado en [`vercel.json`](vercel.json) como `0 13 * * 1-6`, que es lunes a sábado a las 13:00 UTC, o sea 8:00 a. m. en Colombia. En el plan gratuito de Vercel puede llegar en cualquier momento entre las 8:00 y las 8:59.
- **Supabase gratis** pausa el proyecto si pasa **una semana sin uso**. Con uso diario no pasa; si ocurre, entra a Supabase y presiona **Restore**.
- **Vercel Hobby (gratis)** es oficialmente para uso personal y no comercial. Para uso de empresa, el plan Pro cuesta 20 USD al mes.
- **Gmail** permite unos 500 correos al día. Para dos personas sobra.
- **Olvidé mi contraseña:** en Supabase → **Authentication** → **Users** → el usuario → **⋯** → **Send password recovery**, o crea una contraseña nueva desde ahí.
- **Agregar una tercera persona más adelante:** créala en Supabase (paso 2) y ya aparece en la app como posible responsable.

## Desarrollo local (opcional)

```bash
npm install
```

```bash
cp .env.example .env.local
```

Llena `.env.local` con los mismos valores que pusiste en Vercel y luego:

```bash
npm run dev
```

La app queda en http://localhost:3000.

## Estructura

```
app/
  page.tsx                 Tablero: "Requiere tu atención", resumen, filtros y lista
  tareas/nueva/            Crear tarea
  tareas/[id]/             Detalle: estado, aprobación, requisitos, notas, adjuntos, historial
  tareas/actions.ts        Todas las acciones (guardar, aprobar, correos…)
  perfil/                  Nombre y contraseña
  login/                   Inicio de sesión
  api/cron/resumen/        Resumen diario por correo
components/                Piezas de la interfaz
lib/                       Supabase, fechas (hora Colombia), correos y tipos
supabase/schema.sql        Tablas, seguridad y bucket de archivos
vercel.json                Programación del resumen diario
```
