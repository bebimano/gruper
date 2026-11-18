import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building,
  Cpu,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  Wrench,
  CheckCircle2,
  MapPin,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getAllClientsAndEquipmentAdminServer,
  assignEquipmentToClientServer,
  deleteEquipmentServer,
} from "@/lib/equipment.functions";

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
      const { data, error } = await q;
      if (error) throw error;
      const list = ((data ?? []) as ClientEquipmentRow[]).filter(
        (r) => !r.client_name.startsWith("__") && !r.client_name.startsWith("AVERIA_")
      );
      return list;
    },
  });
}

const TIPOS_PREDEFINIDOS = [
  "Depuradora",
  "Cámara de ozono",
  "Generador de ozono",
  "Compresor",
  "Bomba de recirculación",
  "Caldera",
  "Dosificador de cloro",
  "Filtro de arena",
  "Otro",
];

export function ClientEquipmentAdmin() {
  const qc = useQueryClient();
  const getAllFn = useServerFn(getAllClientsAndEquipmentAdminServer);
  const assignFn = useServerFn(assignEquipmentToClientServer);
  const deleteFn = useServerFn(deleteEquipmentServer);

  // Form states
  const [selectedClientName, setSelectedClientName] = useState("");
  const [tipoMaquina, setTipoMaquina] = useState("");
  const [modelo, setModelo] = useState("");
  const [numSerie, setNumSerie] = useState("");
  const [direccion, setDireccion] = useState("");
  const [poblacion, setPoblacion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Accordion
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  const clientsQuery = useQuery({
    queryKey: ["admin-client-equipment-all"],
    queryFn: () => getAllFn(),
  });

  const clients = clientsQuery.data?.clients ?? [];

  // Filtrar clientes por buscador
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchMachines = c.machines.some(
        (m) =>
          m.tipo_maquina.toLowerCase().includes(q) ||
          m.modelo.toLowerCase().includes(q) ||
          m.num_serie.toLowerCase().includes(q)
      );
      return matchName || matchMachines;
    });
  }, [clients, search]);

  const toggleClient = (clientName: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [clientName]: prev[clientName] === undefined ? false : !prev[clientName],
    }));
  };

  const isClientExpanded = (clientName: string) => {
    if (search.trim()) return true;
    return expandedClients[clientName] ?? true;
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientName.trim()) {
      toast.error("Selecciona o escribe el nombre del cliente");
      return;
    }
    if (!tipoMaquina.trim()) {
      toast.error("Indica el tipo de máquina (ej. Depuradora)");
      return;
    }
    if (!numSerie.trim()) {
      toast.error("Indica el número de serie de la máquina");
      return;
    }

    setIsSubmitting(true);
    try {
      await assignFn({
        data: {
          client_name: selectedClientName.trim(),
          tipo_maquina: tipoMaquina.trim(),
          modelo: modelo.trim(),
          num_serie: numSerie.trim(),
          direccion: direccion.trim(),
          poblacion: poblacion.trim(),
        },
      });

      toast.success(
        `Máquina ${tipoMaquina} ${modelo} asignada a ${selectedClientName.trim()}`,
        {
          description: "Ahora le aparecerá en 'Máquina afectada' cuando cree un aviso de avería.",
        }
      );

      // Limpiar datos de máquina (mantener cliente si se quiere añadir otra máquina al mismo)
      setTipoMaquina("");
      setModelo("");
      setNumSerie("");
      qc.invalidateQueries({ queryKey: ["admin-client-equipment-all"] });
      qc.invalidateQueries({ queryKey: ["client-equipment"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al asignar máquina");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, machineName: string, clientName: string) => {
    if (!confirm(`¿Eliminar la máquina "${machineName}" asignada a ${clientName}?`)) {
      return;
    }
    try {
      await deleteFn({ data: { id } });
      toast.success("Máquina eliminada");
      qc.invalidateQueries({ queryKey: ["admin-client-equipment-all"] });
      qc.invalidateQueries({ queryKey: ["client-equipment"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar máquina");
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabecera explicativa con diseño limpio y botón azul */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              Asignación de Máquinas a Clientes (Equipos para Avisos de Avería)
            </h2>
            <p className="text-xs text-muted-foreground">
              Asigna a cada cliente las máquinas que tiene (ejemplo: a <strong>Cañamas Alcudia</strong> le corresponde la máquina <strong>Depuradora mtar-300a</strong>).
              Estas máquinas son las que le aparecerán en el desplegable de <strong>"Máquina afectada"</strong> cuando el cliente reporte una avería.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario para asignar máquina a un cliente */}
      <form
        onSubmit={handleAssign}
        className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <span>Asignar nueva máquina a un cliente</span>
          </h3>
          <span className="text-xs text-muted-foreground">Todos los campos con * son obligatorios</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Selector de Cliente */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Cliente / Usuario *
            </label>
            <Input
              list="admin-all-clients-list"
              placeholder="Elige o escribe el cliente (ej. Cañamas Alcudia)"
              value={selectedClientName}
              onChange={(e) => setSelectedClientName(e.target.value)}
              required
              className="h-10 text-sm font-medium"
            />
            <datalist id="admin-all-clients-list">
              {clients.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} {c.isRegisteredUser ? "(Usuario registrado)" : ""}
                </option>
              ))}
            </datalist>
          </div>

          {/* Tipo de máquina */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Tipo de máquina *
            </label>
            <Input
              list="admin-tipos-list"
              placeholder="Ej. Depuradora, Cámara de ozono…"
              value={tipoMaquina}
              onChange={(e) => setTipoMaquina(e.target.value)}
              required
              className="h-10 text-sm font-medium"
            />
            <datalist id="admin-tipos-list">
              {TIPOS_PREDEFINIDOS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Modelo */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Modelo
            </label>
            <Input
              placeholder="Ej. mtar-300a, Mod-X, D-200…"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="h-10 text-sm font-medium"
            />
          </div>

          {/* Nº de serie */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Nº de Serie *
            </label>
            <Input
              placeholder="Ej. SN-98231, 17950040…"
              value={numSerie}
              onChange={(e) => setNumSerie(e.target.value)}
              required
              className="h-10 text-sm font-medium"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Dirección de instalación
            </label>
            <Input
              placeholder="Calle, polígono, nave…"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="h-10 text-sm"
            />
          </div>

          {/* Población */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Población
            </label>
            <Input
              placeholder="Ciudad o municipio"
              value={poblacion}
              onChange={(e) => setPoblacion(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          {/* Botón azul corporativo sin colores raros */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl font-semibold gap-2 shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm px-5 h-10 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>{isSubmitting ? "Asignando…" : "Asignar máquina a este cliente"}</span>
          </Button>
        </div>
      </form>

      {/* Buscador de clientes y máquinas asignadas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por cliente, modelo o nº de serie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs rounded-xl bg-background border-border"
          />
        </div>

        <span className="text-xs text-muted-foreground">
          {filteredClients.length} {filteredClients.length === 1 ? "cliente listado" : "clientes listados"}
        </span>
      </div>

      {/* Listado de Clientes con sus máquinas asignadas */}
      {clientsQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card/40">
          Cargando asignación de equipos…
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card/40">
          No se encontraron clientes o máquinas con el criterio de búsqueda.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client) => {
            const isExpanded = isClientExpanded(client.name);
            const hasMachines = client.machines.length > 0;

            return (
              <div
                key={client.name}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all"
              >
                {/* Cabecera del Cliente */}
                <div
                  onClick={() => toggleClient(client.name)}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 bg-muted/20 cursor-pointer hover:bg-muted/30 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Building className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2 flex-wrap">
                        <span>{client.name}</span>
                        {client.isRegisteredUser && (
                          <Badge variant="outline" className="text-[10px] bg-background">
                            Usuario de la app
                          </Badge>
                        )}
                        <Badge
                          variant={hasMachines ? "secondary" : "outline"}
                          className="text-[11px] font-semibold"
                        >
                          {client.machines.length} {client.machines.length === 1 ? "máquina" : "máquinas"}
                        </Badge>
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClientName(client.name);
                        window.scrollTo({ top: 120, behavior: "smooth" });
                      }}
                      className="rounded-xl text-xs gap-1 h-8 border-border/80 hover:border-primary/50 text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5 text-primary" />
                      <span>Asignar máquina</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleClient(client.name)}
                      className="rounded-xl h-8 w-8 text-muted-foreground"
                      aria-label="Desplegar"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Lista de máquinas asignadas a este cliente */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 border-t border-border/60 space-y-2 bg-background/50">
                    {!hasMachines ? (
                      <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl">
                        Este cliente aún no tiene ninguna máquina asignada. Cuando cree un aviso de avería, no le aparecerán máquinas en el selector.
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {client.machines.map((m) => (
                          <div
                            key={m.id}
                            className="rounded-xl border border-border/80 bg-card p-3 flex items-start justify-between gap-3 shadow-2xs hover:border-primary/30 transition"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <span className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5 truncate">
                                <Cpu className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">{m.tipo_maquina} {m.modelo}</span>
                              </span>
                              <p className="text-[11px] text-muted-foreground font-medium">
                                Nº Serie: <strong className="text-foreground">{m.num_serie}</strong>
                              </p>
                              {(m.direccion || m.poblacion) && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{[m.direccion, m.poblacion].filter(Boolean).join(", ")}</span>
                                </p>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(m.id, `${m.tipo_maquina} ${m.modelo}`, client.name)}
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                              title="Eliminar esta máquina"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
