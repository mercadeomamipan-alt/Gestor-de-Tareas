import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente con permisos totales. Solo para el resumen diario (sin sesión de usuario). */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
