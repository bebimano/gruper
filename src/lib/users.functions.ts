import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "./username";

const credsSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/, "Usuario: 3-32 letras, números, . _ -"),
  password: z.string().min(6, "Contraseña mínima de 6 caracteres").max(72),
});

async function createAccount(username: string, password: string, role: "admin" | "client") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message?.includes("already") ? "Ese usuario ya existe" : error?.message ?? "Error");
  const id = data.user.id;
  await supabaseAdmin.from("profiles").insert({ id, username });
  await supabaseAdmin.from("user_roles").insert({ user_id: id, role });
  return id;
}

/** Public: only works while no admin exists yet (first-time setup). */
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => credsSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exists } = await supabaseAdmin.rpc("admin_exists");
    if (exists) throw new Error("Ya existe un administrador");
    await createAccount(data.username, data.password, "admin");
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("No autorizado");
}

export const createClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => credsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const id = await createAccount(data.username, data.password, "client");
    return { id };
  });

export const deleteClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("No puedes borrarte a ti mismo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("machine_access").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetClientPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), password: credsSchema.shape.password }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
