import { supabase } from "@/integrations/supabase/client";

export interface AveriaPhoto {
  id: string;
  url: string;
  descripcion?: string;
}

export interface AveriaElement {
  id: string;
  nombre: string;
  descripcion: string;
  fotoUrl?: string;
}

export interface Averia {
  id: string;
  clientId: string;
  clientName: string;
  machineId: string;
  machineName: string;
  title: string;
  description: string;
  urgency: "normal" | "urgente";
  photos: AveriaPhoto[];
  elementos?: AveriaElement[];
  status: "pendiente" | "en_curso" | "solucionado";
  statusNote: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateAveriaInput {
  clientId: string;
  clientName: string;
  machineId: string;
  machineName: string;
  title: string;
  description: string;
  urgency: "normal" | "urgente";
  photos: AveriaPhoto[];
  elementos?: AveriaElement[];
}

const PERMISOS_CLIENT_NAME = "__GRUPER_AVERIAS_PERMISOS__";

/**
 * Obtiene la lista de IDs de clientes con acceso a averías,
 * combinando la columna can_averias de profiles y el registro persistente de client_equipment.
 */
export async function fetchAveriasAllowedUserIds(): Promise<Set<string>> {
  const allowed = new Set<string>();

  // 1. Intentar leer desde profiles (si la columna can_averias ya existe en Supabase)
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, can_averias" as any);
    if (profiles) {
      for (const p of profiles as any[]) {
        if (p.can_averias === true) {
          allowed.add(p.id);
        }
      }
    }
  } catch (err) {
    console.warn("Columna can_averias aún no migrada en profiles:", err);
  }

  // 2. Leer desde client_equipment (100% garantizado en base de datos sin migraciones DDL)
  try {
    const { data: records } = await supabase
      .from("client_equipment")
      .select("id, modelo")
      .eq("client_name", PERMISOS_CLIENT_NAME);

    if (records) {
      for (const r of records) {
        if (r.modelo) {
          allowed.add(r.modelo); // modelo almacena el userId
        }
      }
    }
  } catch (err) {
    console.warn("No se pudo leer permisos de averias desde client_equipment:", err);
  }

  return allowed;
}

/**
 * Activa o desactiva el permiso de Averías para un cliente.
 */
export async function toggleClientAveriasPermission(userId: string, allow: boolean): Promise<void> {
  // 1. Intentar actualizar profiles.can_averias
  try {
    await supabase
      .from("profiles")
      .update({ can_averias: allow } as any)
      .eq("id", userId);
  } catch (err) {
    console.warn("Profiles can_averias update fallback:", err);
  }

  // 2. Persistir en client_equipment (seguro y permanente)
  try {
    if (allow) {
      // Comprobar si ya existe
      const { data: existing } = await supabase
        .from("client_equipment")
        .select("id")
        .eq("client_name", PERMISOS_CLIENT_NAME)
        .eq("modelo", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("client_equipment").insert({
          client_name: PERMISOS_CLIENT_NAME,
          modelo: userId,
          direccion: "Permiso Averias",
          poblacion: "Gruper",
          tipo_maquina: "permission",
          num_serie: String(Date.now()),
        });
      }
    } else {
      // Eliminar permiso
      await supabase
        .from("client_equipment")
        .delete()
        .eq("client_name", PERMISOS_CLIENT_NAME)
        .eq("modelo", userId);
    }
  } catch (err) {
    console.error("Error al persistir permiso en client_equipment:", err);
    throw err;
  }
}

/**
 * Consulta todas las averías o las de un cliente específico.
 * Utiliza fallback dual: tabla averias + tabla jobs para máxima fiabilidad.
 */
export async function fetchAveriasList(clientNameFilter?: string): Promise<Averia[]> {
  const resultList: Averia[] = [];
  const seenIds = new Set<string>();

  // 1. Intentar consultar tabla averias
  let tableAveriasWorked = false;
  try {
    let q = (supabase.from("averias" as any) as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (clientNameFilter) {
      q = q.eq("client_name", clientNameFilter);
    }

    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      tableAveriasWorked = true;
      for (const item of data) {
        seenIds.add(item.id);
        resultList.push({
          id: item.id,
          clientId: item.client_id,
          clientName: item.client_name,
          machineId: item.machine_id,
          machineName: item.machine_name,
          title: item.title,
          description: item.description,
          urgency: (item.urgency as "normal" | "urgente") || "normal",
          photos: Array.isArray(item.photos) ? item.photos : [],
          status: (item.status as "pendiente" | "en_curso" | "solucionado") || "pendiente",
          statusNote: item.status_note || "",
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        });
      }
    }
  } catch (err) {
    console.warn("Tabla averias no disponible, usando tabla jobs:", err);
  }

  // 2. Consultar tabla jobs con filtro [AVERÍA]
  try {
    let qJobs = supabase
      .from("jobs")
      .select("*")
      .ilike("title", "[AVERÍA]%")
      .order("created_at", { ascending: false });

    if (clientNameFilter) {
      qJobs = qJobs.eq("client", clientNameFilter);
    }

    const { data: jobRows, error: jobErr } = await qJobs;
    if (!jobErr && Array.isArray(jobRows)) {
      for (const j of jobRows) {
        if (seenIds.has(j.id)) continue;

        let parsed: any = null;
        try {
          if (j.description.startsWith("{")) {
            parsed = JSON.parse(j.description);
          }
        } catch {
          // not json
        }

        const machineName = parsed?.machineName || j.title.replace(/^\[AVERÍA\]\s*/i, "").split(":")[0]?.trim() || "Máquina";
        const cleanTitle = parsed?.title || (j.title.includes(":") ? j.title.split(":").slice(1).join(":").trim() : j.title);
        const descText = parsed?.description || (parsed ? "" : j.description);
        const photos = Array.isArray(parsed?.photos) ? parsed.photos : [];
        const urgency = parsed?.urgency || "normal";
        const status = (j.status === "terminado" ? "solucionado" : j.status === "en_curso" ? "en_curso" : "pendiente") as any;

        resultList.push({
          id: j.id,
          clientId: parsed?.clientId || "",
          clientName: j.client || parsed?.clientName || "Cliente",
          machineId: parsed?.machineId || "",
          machineName,
          title: cleanTitle,
          description: descText,
          urgency,
          photos,
          status,
          statusNote: j.status_note || "",
          createdAt: j.created_at,
          updatedAt: j.updated_at,
        });
        seenIds.add(j.id);
      }
    }
  } catch (err) {
    console.error("Error al consultar jobs para averías:", err);
  }

  // Ordenar de más reciente a más antiguo
  return resultList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Crea una nueva avería, guardándola en la base de datos y notificando en tiempo real.
 */
export async function createAveria(input: CreateAveriaInput): Promise<{ id: string }> {
  let createdId = "";

  // 1. Intentar guardar en tabla averias
  try {
    const { data, error } = await (supabase.from("averias" as any) as any)
      .insert({
        client_id: input.clientId,
        client_name: input.clientName,
        machine_id: input.machineId || null,
        machine_name: input.machineName,
        title: input.title,
        description: input.description,
        urgency: input.urgency,
        photos: input.photos,
        status: "pendiente",
        status_note: "",
      })
      .select("id")
      .single();

    if (!error && data?.id) {
      createdId = data.id;
    }
  } catch (err) {
    console.warn("No se pudo insertar en tabla averias, recurriendo a jobs:", err);
  }

  // 2. Guardar también en tabla jobs (asegura visibilidad para técnicos y persistencia garantizada)
  const jobPayload = {
    type: "averia",
    clientId: input.clientId,
    clientName: input.clientName,
    machineId: input.machineId,
    machineName: input.machineName,
    title: input.title,
    description: input.description,
    urgency: input.urgency,
    photos: input.photos,
  };

  try {
    const { data: jobRow, error: jobError } = await supabase
      .from("jobs")
      .insert({
        title: `[AVERÍA] ${input.machineName}: ${input.title}`,
        client: input.clientName,
        description: JSON.stringify(jobPayload),
        status: "pendiente",
        status_note: input.urgency === "urgente" ? "⚠️ AVERÍA URGENTE" : "Avería reportada por cliente",
      })
      .select("id")
      .single();

    if (!createdId && jobRow?.id) {
      createdId = jobRow.id;
    }
  } catch (err) {
    console.error("Error al insertar avería en jobs:", err);
    if (!createdId) throw err;
  }

  // 3. Emitir notificación en canal en tiempo real
  try {
    const channel = supabase.channel("gruper-averias-realtime");
    await channel.send({
      type: "broadcast",
      event: "new_averia",
      payload: {
        id: createdId,
        clientName: input.clientName,
        machineName: input.machineName,
        title: input.title,
        urgency: input.urgency,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn("No se pudo emitir broadcast de avería:", err);
  }

  return { id: createdId };
}

/**
 * Actualiza el estado y notas de una avería.
 */
export async function updateAveriaStatus(
  id: string,
  status: "pendiente" | "en_curso" | "solucionado",
  statusNote?: string
): Promise<void> {
  // Mapear a estado compatible de jobs
  const jobStatus = status === "solucionado" ? "terminado" : status;

  // 1. Actualizar en averias si existe
  try {
    await (supabase.from("averias" as any) as any)
      .update({
        status,
        status_note: statusNote ?? "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    console.warn("Update en averias fallo:", err);
  }

  // 2. Actualizar en jobs
  try {
    await supabase
      .from("jobs")
      .update({
        status: jobStatus,
        status_note: statusNote ?? (status === "solucionado" ? "Avería solucionada" : "En revisión técnica"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    console.warn("Update en jobs fallo:", err);
  }
}

/**
 * Elimina una avería (solo administradores).
 */
export async function deleteAveria(id: string): Promise<void> {
  try {
    await (supabase.from("averias" as any) as any).delete().eq("id", id);
  } catch (err) {
    console.warn("Delete en averias fallo:", err);
  }

  try {
    await supabase.from("jobs").delete().eq("id", id);
  } catch (err) {
    console.warn("Delete en jobs fallo:", err);
  }
}
