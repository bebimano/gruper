import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Vehicle = {
  id: string;
  name: string;
  matricula: string;
  created_at?: string;
};

const LOCAL_STORAGE_KEY = "gruper_vehicles_cache";

function getLocalVehicles(): Vehicle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalVehicles(list: Vehicle[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Error saving vehicles cache to localStorage:", e);
  }
}

/**
 * Formats a vehicle into a clean string label for report fields:
 * e.g. "Renault Kangoo · 1234 ABC" or "1234 ABC"
 */
export function formatVehicleLabel(v?: Partial<Vehicle> | null): string {
  if (!v) return "";
  const name = (v.name || "").trim();
  const mat = (v.matricula || "").trim().toUpperCase();
  if (name && mat) return `${name} · ${mat}`;
  return name || mat || "";
}

const VEHICLES_SPECIAL_CLIENT = "__GRUPER_VEHICULOS__";

/**
 * React hook to fetch all company vehicles with fallback to local cache.
 */
export function useVehicles() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["company-vehicles"],
    queryFn: async () => {
      const localList = getLocalVehicles();

      // 1. Try querying native 'vehicles' table first (if created via migration)
      try {
        const vRes = await supabase
          .from("vehicles")
          .select("id, name, matricula, created_at")
          .order("name");

        if (!vRes.error && vRes.data && vRes.data.length > 0) {
          const list: Vehicle[] = vRes.data.map((row) => ({
            id: row.id,
            name: row.name,
            matricula: row.matricula,
            created_at: row.created_at,
          }));
          setLocalVehicles(list);
          return list;
        }
      } catch {
        // vehicles table might not exist
      }

      // 2. Query persistent vehicles stored in existing client_equipment table
      try {
        const eqRes = await supabase
          .from("client_equipment")
          .select("id, modelo, num_serie, created_at")
          .eq("client_name", VEHICLES_SPECIAL_CLIENT)
          .order("modelo");

        if (!eqRes.error && eqRes.data && eqRes.data.length > 0) {
          const list: Vehicle[] = eqRes.data.map((row) => ({
            id: row.id,
            name: row.modelo,
            matricula: row.num_serie,
            created_at: row.created_at,
          }));
          setLocalVehicles(list);
          return list;
        }
      } catch (err) {
        console.warn("Could not query vehicles from client_equipment:", err);
      }

      // 3. Fallback to local cache if available
      return localList;
    },
    staleTime: 1000 * 30, // 30 sec
  });

  return {
    vehicles: query.data ?? getLocalVehicles(),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * Add a new vehicle.
 */
export async function addVehicle(name: string, matricula: string): Promise<Vehicle> {
  const cleanName = name.trim();
  const cleanMat = matricula.trim().toUpperCase();
  if (!cleanName || !cleanMat) {
    throw new Error("El nombre y la matrícula son obligatorios.");
  }

  let savedId: string | null = null;
  let savedCreatedAt: string | null = null;

  // 1. Try insert into 'vehicles' table
  try {
    const vInsert = await supabase
      .from("vehicles")
      .insert({ name: cleanName, matricula: cleanMat })
      .select("id, name, matricula, created_at")
      .maybeSingle();

    if (!vInsert.error && vInsert.data) {
      savedId = vInsert.data.id;
      savedCreatedAt = vInsert.data.created_at;
    }
  } catch {
    // ignore
  }

  // 2. Persist in client_equipment (always present in Supabase!)
  if (!savedId) {
    const eqInsert = await supabase
      .from("client_equipment")
      .insert({
        client_name: VEHICLES_SPECIAL_CLIENT,
        tipo_maquina: "Vehículo",
        modelo: cleanName,
        num_serie: cleanMat,
        direccion: "",
        poblacion: "",
      })
      .select("id, created_at")
      .single();

    if (eqInsert.error) {
      console.error("Error inserting vehicle into Supabase:", eqInsert.error);
      throw new Error(`Error al guardar en base de datos: ${eqInsert.error.message}`);
    }

    if (eqInsert.data) {
      savedId = eqInsert.data.id;
      savedCreatedAt = eqInsert.data.created_at;
    }
  }

  const newVehicle: Vehicle = {
    id: savedId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    name: cleanName,
    matricula: cleanMat,
    created_at: savedCreatedAt || new Date().toISOString(),
  };

  // Update local cache
  const current = getLocalVehicles();
  const updated = [...current.filter((v) => v.id !== newVehicle.id && v.matricula !== cleanMat), newVehicle].sort((a, b) =>
    a.name.localeCompare(b.name, "es-ES")
  );
  setLocalVehicles(updated);

  return newVehicle;
}

/**
 * Update an existing vehicle.
 */
export async function updateVehicle(id: string, name: string, matricula: string): Promise<void> {
  const cleanName = name.trim();
  const cleanMat = matricula.trim().toUpperCase();
  if (!cleanName || !cleanMat) {
    throw new Error("El nombre y la matrícula son obligatorios.");
  }

  // Try vehicles table
  try {
    await supabase
      .from("vehicles")
      .update({ name: cleanName, matricula: cleanMat })
      .eq("id", id);
  } catch {
    // ignore
  }

  // Update client_equipment table
  try {
    await supabase
      .from("client_equipment")
      .update({ modelo: cleanName, num_serie: cleanMat })
      .eq("id", id);
  } catch (err) {
    console.warn("Could not update vehicle in client_equipment:", err);
  }

  // Update local cache
  const current = getLocalVehicles();
  const updated = current.map((v) => (v.id === id ? { ...v, name: cleanName, matricula: cleanMat } : v));
  setLocalVehicles(updated);
}

/**
 * Delete a vehicle.
 */
export async function deleteVehicle(id: string): Promise<void> {
  // Try vehicles table
  try {
    await supabase.from("vehicles").delete().eq("id", id);
  } catch {
    // ignore
  }

  // Delete from client_equipment table
  try {
    await supabase.from("client_equipment").delete().eq("id", id);
  } catch (err) {
    console.warn("Could not delete vehicle from client_equipment:", err);
  }

  // Update local cache
  const current = getLocalVehicles();
  const updated = current.filter((v) => v.id !== id);
  setLocalVehicles(updated);
}
