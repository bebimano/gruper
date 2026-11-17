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

/**
 * React hook to fetch all company vehicles with fallback to local cache.
 */
export function useVehicles() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["company-vehicles"],
    queryFn: async () => {
      const localList = getLocalVehicles();
      try {
        const { data, error } = await supabase
          .from("vehicles")
          .select("id, name, matricula, created_at")
          .order("name");

        if (error) {
          console.warn("Could not fetch vehicles from Supabase, using local cache:", error.message);
          return localList;
        }

        const list: Vehicle[] = (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          matricula: row.matricula,
          created_at: row.created_at,
        }));

        setLocalVehicles(list);
        return list;
      } catch (err) {
        console.warn("Vehicles fetch error, using local fallback:", err);
        return localList;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 min
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

  const tempId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newVehicle: Vehicle = {
    id: tempId,
    name: cleanName,
    matricula: cleanMat,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("vehicles")
      .insert({ name: cleanName, matricula: cleanMat })
      .select("id, name, matricula, created_at")
      .single();

    if (!error && data) {
      newVehicle.id = data.id;
      newVehicle.created_at = data.created_at;
    }
  } catch (err) {
    console.warn("Supabase insert vehicle fallback to local:", err);
  }

  // Update local cache
  const current = getLocalVehicles();
  const updated = [...current.filter((v) => v.id !== newVehicle.id), newVehicle].sort((a, b) =>
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

  try {
    await supabase
      .from("vehicles")
      .update({ name: cleanName, matricula: cleanMat })
      .eq("id", id);
  } catch (err) {
    console.warn("Supabase update vehicle fallback to local:", err);
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
  try {
    await supabase.from("vehicles").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase delete vehicle fallback to local:", err);
  }

  // Update local cache
  const current = getLocalVehicles();
  const updated = current.filter((v) => v.id !== id);
  setLocalVehicles(updated);
}
