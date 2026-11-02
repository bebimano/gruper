import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

type M = { id: string; codigo: string; descripcion: string; stock: string };

/** Reference input with stock suggestions from the imported materials list. */
export function MaterialPicker({ value, placeholder, onChange, onPick }: { value: string; placeholder: string; onChange: (v: string) => void; onPick: (m: M) => void }) {
  const [open, setOpen] = useState(false);
  const term = value.trim().replace(/[,()%]/g, "");
  const res = useQuery({
    queryKey: ["materials-search", term],
    enabled: open && term.length >= 2,
    queryFn: async () => (await supabase.from("materials").select("id, codigo, descripcion, stock").or(`codigo.ilike.%${term}%,descripcion.ilike.%${term}%`).limit(8)).data ?? [],
  });
  return (
    <div className="relative col-span-3 sm:col-span-1">
      <Input placeholder={placeholder} value={value} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { onChange(e.target.value); setOpen(true); }} />
      {open && !!res.data?.length && (
        <div className="absolute z-20 mt-1 w-[min(22rem,80vw)] rounded-lg border border-border bg-popover p-1 shadow-md print:hidden">
          {res.data.map((m) => (
            <button type="button" key={m.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(m); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              <span className="font-mono text-xs text-muted-foreground">{m.codigo}</span>
              <span className="flex-1 truncate">{m.descripcion}</span>
              {m.stock && <span className="text-xs font-medium text-primary">{m.stock} uds</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
