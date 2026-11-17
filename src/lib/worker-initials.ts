import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  } catch (e) {
    console.error("Error saving worker initials to localStorage:", e);
  }
}

/**
 * Formats a report number in the custom company format:
 * [INICIALES][AÑO][00001]
 * - Initials of the technician (e.g. "JR", "MB")
 * - 4-digit Year (e.g. "2026")
 * - 5-digit zero-padded sequential number (e.g. "00001", "00002", "00015")
 *
 * Example: initials "JR", year 2026, num 1 => "JR202600001"
 */
export function formatReportNumber(
  initials?: string | null,
  yearOrDate?: string | number | null,
  num?: number | string | null
): string {
  if (num === null || num === undefined || num === "") return "";
  const n = typeof num === "number" ? num : parseInt(String(num), 10);
  if (isNaN(n)) return String(num);

  let year = new Date().getFullYear();
  if (yearOrDate) {
    if (typeof yearOrDate === "number" && yearOrDate > 1900 && yearOrDate < 2100) {
      year = yearOrDate;
    } else {
      const parsed = new Date(yearOrDate);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
        year = parsed.getFullYear();
      }
    }
  }

  const cleanInit = (initials || "").trim().toUpperCase();
  const seq = String(n).padStart(5, "0");

  return cleanInit ? `${cleanInit}${year}${seq}` : `${year}${seq}`;
}

export type WorkerProfileInfo = {
  id: string;
  username: string;
  initials: string;
};

/**
 * Hook to query all worker profiles and their initials.
 */
export function useWorkerInitials() {
  const query = useQuery({
    queryKey: ["worker-initials"],
    queryFn: async () => {
      const cache = getLocalCache();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("username");

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
        const dbInit = item.initials?.trim() || "";
        const finalInit = dbInit || map[item.id] || item.username.slice(0, 2).toUpperCase();
        map[item.id] = finalInit;

        list.push({
          id: item.id,
          username: item.username,
          initials: finalInit,
        });
      }

      // Update local cache
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
 * Saves worker initials both to Supabase profiles table and to local cache.
 */
export async function saveWorkerInitials(userId: string, initials: string) {
  const clean = initials.trim().toUpperCase();

  // Save to local cache first for instant feedback
  const cache = getLocalCache();
  cache[userId] = clean;
  setLocalCache(cache);

  // Update in Supabase
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ initials: clean } as any)
      .eq("id", userId);

    if (error) {
      console.warn("Could not persist initials to profiles table (needs migration):", error.message);
    }
  } catch (err) {
    console.warn("Error updating initials in Supabase:", err);
  }

  return clean;
}
