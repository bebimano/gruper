import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_STORAGE_KEY = "gruper_worker_initials_cache";

function getLocalCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalCache(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Formats a report number: [INICIALES][AÑO 2 DIGITOS][0001]
 * Example: initials "BM", year 2026, num 1 => "BM260001"
 */
export function formatReportNumber(
  initials?: string | null,
  yearOrDate?: string | number | Date | null,
  num?: number | string | null
): string {
  if (num === null || num === undefined || num === "") return "";
  const n = typeof num === "number" ? num : parseInt(String(num), 10);
  if (isNaN(n)) return String(num);

  let year = new Date().getFullYear();
  if (yearOrDate) {
    if (typeof yearOrDate === "number" && yearOrDate > 1900 && yearOrDate < 2100) {
      year = yearOrDate;
    } else if (yearOrDate instanceof Date) {
      if (!isNaN(yearOrDate.getTime())) year = yearOrDate.getFullYear();
    } else {
      const parsed = new Date(yearOrDate as string);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
        year = parsed.getFullYear();
      }
    }
  }

  const cleanInit = (initials || "").trim().toUpperCase();
  const year2Digits = String(year).slice(-2);
  const seq = String(n).padStart(4, "0");
  return cleanInit ? `${cleanInit}${year2Digits}${seq}` : `${year2Digits}${seq}`;
}

export type WorkerProfileInfo = {
  id: string;
  username: string;
  initials: string;
};

/**
 * Hook to query all worker profiles and their initials.
 * Reads initials from client_equipment (__INITIALS__<userId>) via a single Supabase call.
 * Falls back to localStorage cache, then username slice.
 */
export function useWorkerInitials() {
  const query = useQuery({
    queryKey: ["worker-initials"],
    staleTime: 5 * 60 * 1000, // cache 5 min — no re-fetch on every render
    queryFn: async () => {
      const cache = getLocalCache();

      // Single parallel fetch: profiles + initials + user types + roles
      const [
        { data: profiles, error },
        { data: initialsRows },
        { data: userTypeRows },
        { data: roles },
      ] = await Promise.all([
        supabase.from("profiles").select("id, username, initials, can_work_reports").order("username"),
        supabase
          .from("client_equipment")
          .select("client_name, num_serie")
          .like("client_name", "__INITIALS__%"),
        supabase
          .from("client_equipment")
          .select("client_name, num_serie")
          .like("client_name", "__USER_TYPE__%"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (error) {
        console.warn("Error fetching profiles:", error.message);
        return { list: [] as WorkerProfileInfo[], map: cache };
      }

      // Build initials map from client_equipment store
      const dbInitialsMap: Record<string, string> = {};
      for (const row of initialsRows ?? []) {
        const userId = (row.client_name as string).replace("__INITIALS__", "");
        const val = String((row as any).num_serie || "").trim().toUpperCase();
        if (userId && val) dbInitialsMap[userId] = val;
      }

      // Build user types map and admin set to filter workers
      const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      const userTypeMap: Record<string, string> = {};
      for (const row of userTypeRows ?? []) {
        const userId = (row.client_name as string).replace("__USER_TYPE__", "");
        const val = String((row as any).num_serie || "").trim().toLowerCase();
        if (userId && val) userTypeMap[userId] = val;
      }

      const list: WorkerProfileInfo[] = [];
      const map: Record<string, string> = { ...cache };

      for (const p of profiles ?? []) {
        const item = p as any;
        // Priority: client_equipment store > profiles.initials column > localStorage > username
        const finalInit =
          dbInitialsMap[item.id] ||
          item.initials?.trim() ||
          map[item.id] ||
          item.username.slice(0, 2).toUpperCase();

        map[item.id] = finalInit;

        // Solo incluir en la lista de trabajadores a los que sean trabajadores o administradores
        const explicit = userTypeMap[item.id];
        const isAdmin = adminSet.has(item.id);
        const isWorker =
          explicit === "worker" || (!explicit && (isAdmin || !!item.can_work_reports));

        if (isWorker) {
          list.push({ id: item.id, username: item.username, initials: finalInit });
        }
      }

      setLocalCache(map);
      return { list, map };
    },
  });

  const getInitials = (userId?: string, fallbackUsername?: string): string => {
    if (!userId) return fallbackUsername ? fallbackUsername.slice(0, 2).toUpperCase() : "";
    const fromQuery = query.data?.map[userId];
    if (fromQuery) return fromQuery.toUpperCase();
    const fromCache = getLocalCache()[userId];
    if (fromCache) return fromCache.toUpperCase();
    return fallbackUsername ? fallbackUsername.slice(0, 2).toUpperCase() : "";
  };

  return {
    ...query,
    getInitials,
    workerList: query.data?.list ?? [],
    initialsMap: query.data?.map ?? {},
  };
}

/**
 * Saves worker initials via a server function (persists in client_equipment).
 */
export async function saveWorkerInitials(
  userId: string,
  initials: string,
  serverFn: (args: { data: { userId: string; initials: string } }) => Promise<any>
) {
  const clean = initials.trim().toUpperCase();

  // Update local cache immediately
  const cache = getLocalCache();
  cache[userId] = clean;
  setLocalCache(cache);

  // Persist to server
  await serverFn({ data: { userId, initials: clean } });
  return clean;
}
