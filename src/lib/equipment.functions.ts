import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientEquipmentItem = {
  id: string;
  client_name: string;
  tipo_maquina: string;
  modelo: string;
  num_serie: string;
  direccion: string;
  poblacion: string;
  displayName: string;
};

export type ClientAssignmentSummary = {
  name: string;
  username?: string;
  isRegisteredUser: boolean;
  machinesCount: number;
  machines: ClientEquipmentItem[];
};

/**
 * Obtiene las máquinas asignadas a un cliente específico para el selector de "Máquina afectada" en Averías.
 * Si el usuario es cliente, obtiene automáticamente las máquinas de su perfil.
 * Si es admin, puede consultar las máquinas de cualquier cliente por clientName.
 */
export const getClientEquipmentForAveriasServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientName: z.string().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data: input, context }): Promise<ClientEquipmentItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Obtener rol y perfil del usuario actual
    const [{ data: roleData }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabaseAdmin.from("profiles").select("username").eq("id", userId).maybeSingle(),
    ]);

    const isAdmin = !!roleData;
    let targetClientName = (input.clientName || "").trim();

    // Si no es admin o no especificó cliente, usar el username de su propio perfil
    if (!isAdmin || !targetClientName) {
      targetClientName = profile?.username || "";
    }

    if (!targetClientName) {
      return [];
    }

    // Consultar client_equipment sin restricciones de RLS con supabaseAdmin
    const { data: rows, error } = await supabaseAdmin
      .from("client_equipment")
      .select("id, client_name, tipo_maquina, modelo, num_serie, direccion, poblacion")
      .order("tipo_maquina");

    if (error) {
      console.error("Error consultando client_equipment para averias:", error);
      throw error;
    }

    const cleanRows = (rows ?? []).filter(
      (r) => !r.client_name.startsWith("__") && !r.client_name.startsWith("AVERIA_")
    );

    // Filtrar por nombre de cliente flexible (coincidencia exacta o contenida)
    const normalizedTarget = targetClientName.toLowerCase().trim();
    const matched = cleanRows.filter((r) => {
      const c = r.client_name.toLowerCase().trim();
      return c === normalizedTarget || c.includes(normalizedTarget) || normalizedTarget.includes(c);
    });

    return matched.map((r) => {
      const parts = [r.tipo_maquina, r.modelo].filter(Boolean).join(" ");
      const serie = r.num_serie ? ` · Serie: ${r.num_serie}` : "";
      const displayName = `${parts || "Máquina"}${serie}`.trim();

      return {
        id: r.id,
        client_name: r.client_name,
        tipo_maquina: r.tipo_maquina,
        modelo: r.modelo,
        num_serie: r.num_serie,
        direccion: r.direccion,
        poblacion: r.poblacion,
        displayName,
      };
    });
  });

/**
 * Consulta para Administradores: Obtiene todos los clientes (usuarios registrados y contactos)
 * con el listado de máquinas asignadas a cada uno desde "Equipos".
 */
export const getAllClientsAndEquipmentAdminServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Acceso restringido a Administradores.");
    }

    const [
      { data: profiles },
      { data: contacts },
      { data: equipmentRows },
      { data: userTypeRows },
      { data: adminRoles },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, can_work_reports").order("username"),
      supabaseAdmin.from("report_contacts").select("name").order("name"),
      supabaseAdmin
        .from("client_equipment")
        .select("id, client_name, tipo_maquina, modelo, num_serie, direccion, poblacion")
        .order("client_name")
        .order("tipo_maquina"),
      supabaseAdmin
        .from("client_equipment")
        .select("client_name, num_serie")
        .like("client_name", "__USER_TYPE__%"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const adminUserIds = new Set((adminRoles ?? []).map((a) => a.user_id));
    const userTypeMap = new Map<string, "worker" | "client">();
    for (const r of userTypeRows ?? []) {
      const uid = (r.client_name as string).replace("__USER_TYPE__", "");
      const val = String((r as any).num_serie || "").trim().toLowerCase();
      if (val === "worker" || val === "client") {
        userTypeMap.set(uid, val);
      }
    }

    // Identificar qué usuarios son trabajadores (nunca deben aparecer en equipos)
    const workerUsernames = new Set<string>();
    for (const p of profiles ?? []) {
      const explicit = userTypeMap.get(p.id);
      const isAdmin = adminUserIds.has(p.id);
      const isWorker =
        explicit === "worker" || (!explicit && (isAdmin || !!(p as any).can_work_reports));
      if (isWorker && p.username) {
        workerUsernames.add(p.username.trim().toLowerCase());
      }
    }

    // Máquinas reales dadas de alta (sin metadatos internos)
    const validEquipment = (equipmentRows ?? []).filter(
      (r) =>
        !r.client_name.startsWith("__") &&
        !r.client_name.startsWith("AVERIA_") &&
        !workerUsernames.has(r.client_name.trim().toLowerCase())
    );

    // Mapear equipos exclusivamente por nombre de cliente que tenga máquinas
    const equipmentByClient = new Map<string, ClientEquipmentItem[]>();
    for (const r of validEquipment) {
      const key = r.client_name.trim();
      if (!equipmentByClient.has(key)) equipmentByClient.set(key, []);

      const parts = [r.tipo_maquina, r.modelo].filter(Boolean).join(" ");
      const serie = r.num_serie ? ` · Serie: ${r.num_serie}` : "";
      const displayName = `${parts || "Máquina"}${serie}`.trim();

      equipmentByClient.get(key)!.push({
        id: r.id,
        client_name: r.client_name,
        tipo_maquina: r.tipo_maquina,
        modelo: r.modelo,
        num_serie: r.num_serie,
        direccion: r.direccion,
        poblacion: r.poblacion,
        displayName,
      });
    }

    // Clientes registrados en la app que NO son trabajadores
    const registeredClientsSet = new Set(
      (profiles ?? [])
        .filter((p) => {
          const explicit = userTypeMap.get(p.id);
          const isAdmin = adminUserIds.has(p.id);
          const isWorker =
            explicit === "worker" || (!explicit && (isAdmin || !!(p as any).can_work_reports));
          return !isWorker;
        })
        .map((p) => (p.username || "").trim().toLowerCase())
        .filter(Boolean)
    );

    // ÚNICAMENTE clientes que tengan máquinas dadas de alta
    // Los trabajadores y usuarios con 0 máquinas NO aparecen
    const clientsMap = new Map<string, ClientAssignmentSummary>();

    for (const [cName, machines] of equipmentByClient.entries()) {
      if (machines.length === 0) continue;
      clientsMap.set(cName, {
        name: cName,
        username: registeredClientsSet.has(cName.toLowerCase()) ? cName : undefined,
        isRegisteredUser: registeredClientsSet.has(cName.toLowerCase()),
        machinesCount: machines.length,
        machines,
      });
    }

    const clientsList = Array.from(clientsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es-ES")
    );

    // Sugerencias de clientes para el desplegable de asignación (excluyendo trabajadores)
    const availableClientSuggestions = Array.from(
      new Set([
        ...Array.from(clientsMap.keys()),
        ...(contacts ?? []).map((c) => (c.name || "").trim()).filter(Boolean),
        ...(profiles ?? [])
          .filter((p) => {
            const explicit = userTypeMap.get(p.id);
            const isAdmin = adminUserIds.has(p.id);
            const isWorker =
              explicit === "worker" || (!explicit && (isAdmin || !!(p as any).can_work_reports));
            return !isWorker;
          })
          .map((p) => (p.username || "").trim())
          .filter(Boolean),
      ])
    )
      .filter((name) => !workerUsernames.has(name.toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "es-ES"));

    return {
      clients: clientsList,
      totalMachines: validEquipment.length,
      availableClientSuggestions,
    };
  });

/**
 * Asigna una nueva máquina a un cliente (o crea registro en client_equipment).
 */
export const assignEquipmentToClientServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_name: z.string().min(1, "El nombre del cliente es obligatorio"),
        tipo_maquina: z.string().min(1, "El tipo de máquina es obligatorio"),
        modelo: z.string().optional().default(""),
        num_serie: z.string().min(1, "El número de serie es obligatorio"),
        direccion: z.string().optional().default(""),
        poblacion: z.string().optional().default(""),
      })
      .parse(d)
  )
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Acceso restringido a Administradores.");
    }

    const { data, error } = await supabaseAdmin
      .from("client_equipment")
      .insert({
        client_name: input.client_name.trim(),
        tipo_maquina: input.tipo_maquina.trim(),
        modelo: input.modelo.trim(),
        num_serie: input.num_serie.trim(),
        direccion: input.direccion.trim(),
        poblacion: input.poblacion.trim(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error insertando en client_equipment:", error);
      throw error;
    }

    return { success: true, id: data.id };
  });

/**
 * Elimina la asignación de una máquina en client_equipment.
 */
export const deleteEquipmentServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid("ID de máquina inválido"),
      })
      .parse(d)
  )
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Acceso restringido a Administradores.");
    }

    const { error } = await supabaseAdmin
      .from("client_equipment")
      .delete()
      .eq("id", input.id);

    if (error) {
      console.error("Error eliminando de client_equipment:", error);
      throw error;
    }

    return { success: true };
  });
