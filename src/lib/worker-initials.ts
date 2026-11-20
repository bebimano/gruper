import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getWorkerInitialsServer } from "@/lib/reports.functions";

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
  } catch (e) {
    console.error("Error saving worker initials to localStorage:", e);
  }
}

/**
 * Formats a report number in the custom company format:
 * [INICIALES][AÑO 2 DIGITOS][0001]
 * - Initials of the technician (e.g. "BM", "JR")
 * - 2-digit Year (e.g. "26" for 2026)
 * - 4-digit zero-padded sequential number (e.g. "0001", "0002", "0015")
 *
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
 * Reads initials from: 1) server (client_equipment) 2) localStorage cache 3) username fallback
 */
export function useWorkerInitials() {
  const getInitialsFn = useServerFn(getWorkerInitialsServer);

  const query = useQuery({
    queryKey: ["worker-initials"],
    queryFn: async () => {
      const cache = getLocalCache();

      // Fetch profiles and server-stored initials in parallel
      const [{ data, error }, serverInitials] = await Promise.all([
        supabase.from("profiles").select("*").order("username"),
        getInitialsFn().catch(() => ({ map: {} as Record<string, string> })),
      ]);

      if (error) {
        console.warn("Error fetching profiles:", error.message);
        return {
          list: [] as WorkerProfileInfo[],
          map: cache,
        };
      }

      const list: WorkerProfileInfo[] = [];
      const map: Record<string, string> = { ...cache };

      for (const p of data ?? []) {
        const item = p as any;
        // Priority: server DB > profiles.initials column > localStorage > username slice
        const dbInit =
          serverInitials.map[item.id] ||
          item.initials?.trim() ||
          map[item.id] ||
          item.username.slice(0, 2).toUpperCase();

        map[item.id] = dbInit;

        list.push({
          id: item.id,
          username: item.username,
          initials: dbInit,
        });
      }

      // Update local cache with fresh server data
      setLocalCache(map);

      return { list, map };
    },
  });

  const getInitials = (userId?: string, fallbackUsername?: string): string => {
    if (!userId) {
      return fallbackUsername ? fallbackUsername.slice(0, 2).toUpperCase() : "";
    }
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
 * Saves worker initials — now uses server function (client_equipment) for persistence.
 * Also updates the local cache immediately.
 */
export async function saveWorkerInitials(
  userId: string,
  initials: string,
  serverFn: (args: { data: { userId: string; initials: string } }) => Promise<any>
) {
  const clean = initials.trim().toUpperCase();

  // Update local cache immediately for instant UI feedback
  const cache = getLocalCache();
  cache[userId] = clean;
  setLocalCache(cache);

  // Persist to server (client_equipment table)
  await serverFn({ data: { userId, initials: clean } });

  return clean;
}
