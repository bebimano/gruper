import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista todos los partes (id, number, user_number, cliente, fecha) para el panel admin de numeración.
 */
export const getAllReportsForNumberingServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    const { data, error } = await supabaseAdmin
      .from("work_reports")
      .select("id, number, user_number, created_at, data")
      .order("number", { ascending: false });

    if (error) throw error;

    return {
      reports: (data ?? []).map((r) => ({
        id: r.id as string,
        number: r.number as number,
        user_number: r.user_number as number | null,
        created_at: r.created_at as string,
        cliente: String((r.data as { cliente?: string })?.cliente ?? ""),
      })),
    };
  });

/**
 * Cambia el user_number de un parte.
 * - Si el nuevo número ya está en uso por OTRO parte → devuelve { conflict: true, conflictNum, conflictCliente }
 * - Si no hay conflicto → actualiza y devuelve { ok: true }
 */
export const changeReportNumberServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        newNumber: z.number().int().positive(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("No autorizado");

    // Comprobar conflicto: ¿otro parte ya usa ese número como user_number?
    const { data: conflictByUserNumber } = await supabaseAdmin
      .from("work_reports")
      .select("id, number, user_number, data")
      .eq("user_number", data.newNumber)
      .neq("id", data.id)
      .maybeSingle();

    if (conflictByUserNumber) {
      return {
        conflict: true as const,
        conflictNum: data.newNumber,
        conflictCliente: String(
          (conflictByUserNumber.data as { cliente?: string })?.cliente ?? ""
        ),
        conflictId: conflictByUserNumber.id as string,
      };
    }

    // Comprobar conflicto: ¿otro parte usa ese número como número original (y no tiene user_number)?
    const { data: conflictByOriginal } = await supabaseAdmin
      .from("work_reports")
      .select("id, number, user_number, data")
      .eq("number", data.newNumber)
      .is("user_number", null)
      .neq("id", data.id)
      .maybeSingle();

    if (conflictByOriginal) {
      return {
        conflict: true as const,
        conflictNum: data.newNumber,
        conflictCliente: String(
          (conflictByOriginal.data as { cliente?: string })?.cliente ?? ""
        ),
        conflictId: conflictByOriginal.id as string,
      };
    }

    // Sin conflicto → actualizar
    const { error } = await supabaseAdmin
      .from("work_reports")
      .update({ user_number: data.newNumber } as any)
      .eq("id", data.id);

    if (error) throw error;

    return { ok: true as const };
  });
