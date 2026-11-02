import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { downloadUrl, parseMaterials } from "./materials";

/** Admin only: downloads the cloud spreadsheet and replaces the materials list. */
export const syncMaterialsFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("No autorizado");
    if (!/^https:\/\//i.test(data.url)) throw new Error("El enlace debe empezar por https://");
    const res = await fetch(downloadUrl(data.url), { redirect: "follow" });
    if (!res.ok) throw new Error(`No se pudo leer el archivo (${res.status}). Comprueba que el enlace es público.`);
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) throw new Error("El enlace no es público o no apunta a un archivo Excel.");
    const rows = parseMaterials(await res.arrayBuffer());
    if (!rows.length) throw new Error("No se encontraron materiales en el archivo");
    const del = await supabase.from("materials").delete().not("id", "is", null);
    if (del.error) throw new Error(del.error.message);
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await supabase.from("materials").insert(rows.slice(i, i + 1000));
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from("material_source").upsert({ id: 1, kind: "url", name: new URL(data.url).hostname, url: data.url, synced_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });
