"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: { error?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: "Falta configurar NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel." };
  }
  let error;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch (e) {
    console.error("[login]", e);
    return { error: "No se pudo conectar con Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL en Vercel." };
  }
  if (error) {
    console.error("[login]", error.code, error.status, error.message);
    if (error.code === "invalid_credentials") return { error: "Correo o contraseña incorrectos." };
    if (error.code === "email_not_confirmed")
      return { error: "Este correo no está confirmado. En Supabase, abre el usuario y confírmalo, o desactiva “Confirm email”." };
    if (error.status === 401 || /api key/i.test(error.message))
      return { error: "La clave de Supabase no es válida. Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel." };
    return { error: `No se pudo iniciar sesión (${error.code ?? error.status ?? "error"}): ${error.message}` };
  }
  redirect("/");
}
