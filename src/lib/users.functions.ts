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

const createUserSchema = credsSchema.extend({
  role: z.enum(["admin", "client"]).default("client"),
  userType: z.enum(["worker", "client"]).optional(),
});

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const id = await createAccount(data.username, data.password, data.role ?? "client");
    
    // Save user type if specified (or default: admin -> worker, client -> data.userType || "client")
    const finalType = data.userType || (data.role === "admin" ? "worker" : "client");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("client_equipment").insert({
      client_name: `__USER_TYPE__${id}`,
      tipo_maquina: "user_type",
      num_serie: finalType,
    } as any);

    return { id };
  });

export const createClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => credsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const id = await createAccount(data.username, data.password, "client");
    return { id };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        role: z.enum(["admin", "client"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId && data.role !== "admin") {
      throw new Error("No puedes quitarte el rol de administrador a ti mismo");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("No puedes borrarte a ti mismo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("machine_access").delete().eq("user_id", data.id);
    await supabaseAdmin.from("client_equipment").delete().eq("client_name", `__USER_TYPE__${data.id}`);
    await supabaseAdmin.from("client_equipment").delete().eq("client_name", `__INITIALS__${data.id}`);
    await supabaseAdmin.from("client_equipment").delete().eq("client_name", `__REPORT_CONFIG__${data.id}`);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Admin: Obtiene la clasificación de tipo de cada usuario: "worker" (trabajador) o "client" (cliente).
 */
export const getUserTypesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("client_equipment")
      .select("client_name, num_serie")
      .like("client_name", "__USER_TYPE__%");

    const typesMap: Record<string, "worker" | "client"> = {};
    for (const r of rows ?? []) {
      const uid = (r.client_name as string).replace("__USER_TYPE__", "");
      const val = String((r as any).num_serie || "").trim().toLowerCase();
      if (val === "worker" || val === "client") {
        typesMap[uid] = val;
      }
    }

    return { typesMap };
  });

/**
 * Admin: Establece si un usuario es "worker" (trabajador) o "client" (cliente).
 */
export const setUserTypeServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        userType: z.enum(["worker", "client"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const key = `__USER_TYPE__${data.userId}`;
    const { data: existing } = await supabaseAdmin
      .from("client_equipment")
      .select("id")
      .eq("client_name", key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .update({ num_serie: data.userType } as any)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("client_equipment")
        .insert({
          client_name: key,
          tipo_maquina: "user_type",
          num_serie: data.userType,
        } as any);
      if (error) throw error;
    }

    return { ok: true, userId: data.userId, userType: data.userType };
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
