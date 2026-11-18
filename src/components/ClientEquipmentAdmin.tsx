import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, ChevronDown, ChevronUp, MapPin, Cpu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ClientEquipmentRow = {
  id: string;
  client_name: string;
  direccion: string;
  poblacion: string;
  tipo_maquina: string;
  modelo: string;
  num_serie: string;
};

export function useClientEquipment(clientName?: string) {
  return useQuery({
    queryKey: ["client-equipment", clientName ?? "__all__"],
    queryFn: async () => {
      let q = supabase
        .from("client_equipment")
        .select("id, client_name, direccion, poblacion, tipo_maquina, modelo, num_serie")
        .order("client_name")
        .order("tipo_maquina");
      if (clientName) q = (q as any).eq("client_name", clientName);
      else q = (q as any).neq("client_name", "__GRUPER_VEHICULOS__");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ClientEquipmentRow[];
    },
  });
}

const TIPOS_PREDEFINIDOS = ["Depuradora", "Cámara de ozono", "Otro"];

export function ClientEquipmentAdmin() {
  const qc = useQueryClient();
  const all = useClientEquipment();

  // Form state
  const [clientName, setClientName] = useState("");
  const [direccion, setDireccion] = useState("");
  const [poblacion, setPoblacion] = useState("");
  const [tipoMaquina, setTipoMaquina] = useState("");
  const [modelo, setModelo] = useState("");
  const [numSerie, setNumSerie] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Clients from report_contacts for autocomplete
  const contacts = useQuery({
    queryKey: ["report-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("report_contacts").select("name").order("name");
      return data ?? [];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("client_equipment").insert({
      client_name: clientName.trim(),
      direccion: direccion.trim(),
      poblacion: poblacion.trim(),
      tipo_maquina: tipoMaquina.trim(),
      modelo: modelo.trim(),
      num_serie: numSerie.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Máquina añadida");
    setTipoMaquina(""); setModelo(""); setNumSerie("");
    qc.invalidateQueries({ queryKey: ["client-equipment"] });
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta máquina?")) return;
    const { error } = await supabase.from("client_equipment").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["client-equipment"] });
  }

  async function updateAddress(id: string, field: "direccion" | "poblacion", value: string) {
    const { error } = await supabase.from("client_equipment").update({ [field]: value }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["client-equipment"] });
  }

  // Group by client_name
  const grouped: Record<string, ClientEquipmentRow[]> = {};
  for (const row of all.data ?? []) {
    if (row.client_name === "__GRUPER_VEHICULOS__") continue;
    if (!grouped[row.client_name]) grouped[row.client_name] = [];
    grouped[row.client_name].push(row);
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-4">
      <div>
        <h2 className="font-medium">Equipos y datos de clientes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Asocia dirección y máquinas (con modelo y nº serie) a cada cliente. En el parte de trabajo, al
          seleccionar el cliente aparecerán sus máquinas para rellenar el código y nº de serie automáticamente.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={add} className="rounded-lg border border-dashed border-border bg-muted/40 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Añadir máquina a cliente</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
            <Input
              list="eq-clients"
              placeholder="Nombre del cliente"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              autoCapitalize="none"
            />
            <datalist id="eq-clients">
              {contacts.data?.map((c) => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Dirección</label>
            <Input placeholder="Calle, número…" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Población</label>
            <Input placeholder="Ciudad / pueblo" value={poblacion} onChange={(e) => setPoblacion(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de máquina</label>
            <Input
              list="eq-tipos"
              placeholder="Depuradora, Cámara de ozono…"
              value={tipoMaquina}
              onChange={(e) => setTipoMaquina(e.target.value)}
              required
            />
            <datalist id="eq-tipos">
              {TIPOS_PREDEFINIDOS.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Modelo</label>
            <Input placeholder="Modelo de la máquina" value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nº de serie</label>
            <Input placeholder="Número de serie" value={numSerie} onChange={(e) => setNumSerie(e.target.value)} required />
          </div>
        </div>

        <Button type="submit" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Añadir máquina</Button>
      </form>

      {/* Grouped list */}
      {Object.keys(grouped).length === 0 && !all.isLoading && (
        <p className="text-sm text-muted-foreground text-center py-4">Aún no hay máquinas registradas.</p>
      )}
      {Object.entries(grouped).map(([client, rows]) => {
        const open = expanded[client] ?? true;
        const first = rows[0];
        return (
          <div key={client} className="rounded-xl border border-border overflow-hidden">
            {/* Client header */}
            <button
              type="button"
              className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
              onClick={() => setExpanded((p) => ({ ...p, [client]: !open }))}
            >
              <span className="flex-1 font-semibold">{client}</span>
              {first.poblacion && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{first.poblacion}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{rows.length} máquina{rows.length !== 1 ? "s" : ""}</span>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {open && (
              <div className="divide-y divide-border">
                {/* Address row (shared per client, editable on first row) */}
                <div className="px-4 py-3 bg-background grid gap-2 sm:grid-cols-2">
                  <AddressCell
                    label="Dirección"
                    value={first.direccion}
                    onSave={(v) => {
                      // Update all rows for this client
                      rows.forEach((r) => updateAddress(r.id, "direccion", v));
                    }}
                  />
                  <AddressCell
                    label="Población"
                    value={first.poblacion}
                    onSave={(v) => {
                      rows.forEach((r) => updateAddress(r.id, "poblacion", v));
                    }}
                  />
                </div>

                {/* Machine rows */}
                {rows.map((row) => (
                  <div key={row.id} className="px-4 py-3 flex items-center gap-3 bg-background">
                    <Cpu className="h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{row.tipo_maquina}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.modelo && <span className="mr-2">Modelo: {row.modelo}</span>}
                        <span>Serie: <span className="font-mono">{row.num_serie}</span></span>
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(row.id)} aria-label="Eliminar máquina">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Inline editable cell for address fields */
function AddressCell({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-7 text-xs"
          autoFocus
          onBlur={() => { onSave(draft); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      className="flex items-start gap-1 text-xs text-left hover:text-primary transition-colors group"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className={value ? "font-medium" : "italic text-muted-foreground/60"}>{value || "— pulsa para editar"}</span>
      </div>
    </button>
  );
}
