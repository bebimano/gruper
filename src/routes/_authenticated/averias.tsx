import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  AlertTriangle,
  Camera,
  Trash2,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Search,
  Wrench,
  Monitor,
  Eye,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useRole";
import { compressImage } from "@/lib/image-compress";
import {
  getAveriasList,
  submitAveria,
  updateAveriaStatusServer,
  deleteAveriaServer,
} from "@/lib/averias.functions";
import type { Averia, AveriaPhoto } from "@/lib/averias";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import logo from "@/assets/gruper-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/averias")({
  head: () => ({
    meta: [
      { title: "Averías y Fallos — Gruper Remote" },
      { name: "description", content: "Avisos de averías y fallos de maquinaria Gruper." },
      { property: "og:title", content: "Averías y Fallos — Gruper Remote" },
      { property: "og:description", content: "Avisos de averías y fallos de maquinaria Gruper." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AveriasPage,
});

function AveriasPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pendiente" | "en_curso" | "solucionado">("all");
  const [previewPhoto, setPreviewPhoto] = useState<AveriaPhoto | null>(null);

  // Form states
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [selectedMachineName, setSelectedMachineName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgente">("normal");
  const [photos, setPhotos] = useState<AveriaPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = !!me.data?.isAdmin;
  const canAccess = isAdmin || !!me.data?.canAverias;

  const getAveriasFn = useServerFn(getAveriasList);
  const submitFn = useServerFn(submitAveria);
  const updateStatusFn = useServerFn(updateAveriaStatusServer);
  const deleteFn = useServerFn(deleteAveriaServer);

  // Consulta de averías usando función de servidor con supabaseAdmin
  const averiasQuery = useQuery({
    queryKey: ["averias", me.data?.id],
    enabled: !!me.data && canAccess,
    queryFn: () => getAveriasFn(),
  });

  // Consulta de máquinas asignadas al usuario para el selector
  const machinesQuery = useQuery({
    queryKey: ["machines-for-averias", me.data?.id],
    enabled: !!me.data && canAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, name, description")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (me.isLoading) return null;

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-hero px-4 sm:px-6 safe-top safe-bottom flex flex-col items-center justify-center max-w-md mx-auto text-center p-6">
        <div className="p-4 rounded-full bg-amber-500/10 text-amber-600 mb-4">
          <AlertTriangle className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-bold mb-2">Acceso no habilitado</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tu cuenta no tiene activado el acceso al apartado de Averías / Fallos. Contacta con Gruper para habilitar este servicio para tus máquinas.
        </p>
        <Button asChild variant="outline">
          <Link to="/maquinas">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a mis máquinas
          </Link>
        </Button>
      </main>
    );
  }

  // Manejo de fotos con compresión automática
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    try {
      const newPhotos: AveriaPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const compressedDataUrl = await compressImage(file, 900, 900, 0.65);
        newPhotos.push({
          id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: compressedDataUrl,
          descripcion: "",
        });
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
      toast.success(`${newPhotos.length} foto(s) añadida(s) correctamente`);
    } catch (err) {
      console.error("Error comprimiendo foto:", err);
      toast.error("Error al procesar la imagen");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Envío del formulario de avería con función de servidor y notificación inmediata
  const handleSubmitAveria = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMachineName.trim()) {
      toast.error("Por favor, selecciona la máquina que presenta la avería");
      return;
    }
    if (!title.trim()) {
      toast.error("Por favor, introduce un título o resumen del fallo");
      return;
    }
    if (!description.trim()) {
      toast.error("Por favor, describe qué le ocurre a la máquina");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitFn({
        data: {
          machineId: selectedMachineId,
          machineName: selectedMachineName,
          title: title.trim(),
          description: description.trim(),
          urgency,
          photos,
        },
      });

      // Emitir aviso por canal Realtime para activar sonido y ventana emergente de técnicos
      try {
        const channel = supabase.channel("gruper-averias-realtime");
        await channel.send({
          type: "broadcast",
          event: "new_averia",
          payload: {
            id: result.id,
            clientName: result.clientName,
            machineName: result.machineName,
            title: result.title,
            urgency: result.urgency,
          },
        });
      } catch (bcErr) {
        console.warn("Realtime broadcast error:", bcErr);
      }

      toast.success("¡Aviso de avería enviado a Gruper!", {
        description: "El aviso se ha registrado y los técnicos han sido alertados con ventana emergente.",
        duration: 7000,
      });

      // Limpiar formulario y cerrar modal
      setTitle("");
      setDescription("");
      setSelectedMachineId("");
      setSelectedMachineName("");
      setUrgency("normal");
      setPhotos([]);
      setOpenModal(false);

      qc.invalidateQueries({ queryKey: ["averias"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (err: any) {
      console.error("Error al crear avería:", err);
      toast.error(err?.message || "No se pudo enviar el aviso de avería. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // Cambio de estado de la avería
  const handleUpdateStatus = async (
    averia: Averia,
    newStatus: "pendiente" | "en_curso" | "solucionado"
  ) => {
    try {
      const note =
        newStatus === "solucionado"
          ? prompt("Nota de resolución o cierre (opcional):", averia.statusNote || "") ?? undefined
          : newStatus === "en_curso"
          ? prompt("Nota técnica (ej. Técnico Juan en camino / Repuesto pedido):", averia.statusNote || "") ?? undefined
          : "";

      await updateStatusFn({
        data: {
          id: averia.id,
          status: newStatus,
          statusNote: note,
        },
      });
      toast.success(
        `Estado actualizado a: ${
          newStatus === "solucionado" ? "Solucionado" : newStatus === "en_curso" ? "En curso" : "Pendiente"
        }`
      );
      qc.invalidateQueries({ queryKey: ["averias"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar el estado");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este aviso de avería?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Aviso eliminado");
      qc.invalidateQueries({ queryKey: ["averias"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar");
    }
  };

  // Filtrado de la lista
  const rawList = averiasQuery.data ?? [];
  const filteredList = rawList.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;

    if (search.trim()) {
      const term = search.toLowerCase();
      const matchMachine = item.machineName.toLowerCase().includes(term);
      const matchClient = item.clientName.toLowerCase().includes(term);
      const matchTitle = item.title.toLowerCase().includes(term);
      const matchDesc = item.description.toLowerCase().includes(term);
      if (!matchMachine && !matchClient && !matchTitle && !matchDesc) return false;
    }

    return true;
  });

  const countPendientes = rawList.filter((a) => a.status === "pendiente").length;
  const countEnCurso = rawList.filter((a) => a.status === "en_curso").length;
  const countSolucionadas = rawList.filter((a) => a.status === "solucionado").length;

  return (
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-14">
      {/* Header */}
      <header className="py-3">
        <div className="flex items-center justify-between">
          <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-8 sm:h-9 w-auto" />
          <Link
            to="/maquinas"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a máquinas
          </Link>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Averías y Fallos</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {isAdmin
                ? "Gestión de incidencias y avisos reportados por clientes con fotos y seguimiento"
                : "Notifica cualquier problema en tus máquinas con fotos para resolverlo de inmediato"}
            </p>
          </div>

          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white shadow-md gap-2 h-11 px-5">
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Dar aviso de avería</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" /> Notificar avería en máquina
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmitAveria} className="space-y-4 pt-2">
                {/* Selector de máquina */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Máquina afectada *
                  </label>
                  <select
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    value={selectedMachineId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedMachineId(id);
                      const m = machinesQuery.data?.find((x) => x.id === id);
                      setSelectedMachineName(m ? m.name : id);
                    }}
                    required
                  >
                    <option value="">-- Elige la máquina que tiene la avería --</option>
                    {machinesQuery.data?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nivel de urgencia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nivel de urgencia
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUrgency("normal")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        urgency === "normal"
                          ? "border-primary bg-primary/10 ring-1 ring-primary font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="font-semibold text-sm">Normal</div>
                      <div className="text-xs text-muted-foreground mt-0.5">La producción no está detenida</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUrgency("urgente")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        urgency === "urgente"
                          ? "border-destructive bg-destructive/10 ring-1 ring-destructive font-medium text-destructive"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span>URGENTE</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Máquina parada / Producción afectada</div>
                    </button>
                  </div>
                </div>

                {/* Título breve */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Título o síntoma del fallo *
                  </label>
                  <Input
                    placeholder="Ej. Bomba no arranca, Error E-04 en pantalla, Ruido extraño..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={100}
                    className="h-11 font-medium"
                  />
                </div>

                {/* Descripción detallada */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Descripción detallada del problema *
                  </label>
                  <Textarea
                    placeholder="Describe con el mayor detalle posible qué ocurre, si huele a quemado, códigos de error en display, qué estabais haciendo cuando ocurrió..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    className="text-sm"
                  />
                </div>

                {/* Fotos adjuntas */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Camera className="h-4 w-4" /> Fotos de la avería
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {photos.length} {photos.length === 1 ? "foto" : "fotos"}
                    </span>
                  </div>

                  {/* Botón para añadir foto */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="w-full border-dashed h-12 gap-2 text-muted-foreground hover:text-foreground"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 text-amber-500" />
                    )}
                    <span>{uploadingPhoto ? "Comprimiendo fotos..." : "+ Hacer foto o adjuntar de la galería"}</span>
                  </Button>

                  {/* Galería de fotos añadidas */}
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {photos.map((p) => (
                        <div
                          key={p.id}
                          className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-square"
                        >
                          <img
                            src={p.url}
                            alt="Foto avería"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md opacity-90 hover:opacity-100"
                            aria-label="Eliminar foto"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón de envío */}
                <div className="pt-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-base shadow-md"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enviando aviso...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5 mr-2" /> Enviar aviso a los técnicos
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Se enviará una alerta inmediata a la central técnica de Gruper.
                  </p>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Barra de filtros y búsqueda */}
      <div className="mt-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por máquina, cliente o fallo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => averiasQuery.refetch()}
            disabled={averiasQuery.isFetching}
            className="shrink-0 h-10 gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${averiasQuery.isFetching ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>

        {/* Píldoras de estado */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-foreground text-background shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted"
            }`}
          >
            Todas ({rawList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("pendiente")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === "pendiente"
                ? "bg-amber-500 text-white shadow-xs font-semibold"
                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Pendientes ({countPendientes})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("en_curso")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === "en_curso"
                ? "bg-blue-600 text-white shadow-xs font-semibold"
                : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>En curso ({countEnCurso})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("solucionado")}
            className={`px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === "solucionado"
                ? "bg-green-600 text-white shadow-xs font-semibold"
                : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Solucionadas ({countSolucionadas})</span>
          </button>
        </div>
      </div>

      {/* Lista de Averías */}
      <div className="mt-5 space-y-4">
        {averiasQuery.isLoading && (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm">Cargando avisos de averías...</p>
          </div>
        )}

        {!averiasQuery.isLoading && filteredList.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="font-semibold text-base">No hay averías registradas</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || filterStatus !== "all"
                ? "No se han encontrado averías con los filtros seleccionados."
                : "No hay avisos de avería activos en este momento."}
            </p>
            {!search && filterStatus === "all" && (
              <Button
                onClick={() => setOpenModal(true)}
                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" /> Dar primer aviso de avería
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const isPending = item.status === "pendiente";
            const isInProgress = item.status === "en_curso";
            const isSolved = item.status === "solucionado";
            const isUrgent = item.urgency === "urgente";

            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 sm:p-5 bg-card shadow-xs transition-all flex flex-col justify-between ${
                  isUrgent && isPending
                    ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/20"
                    : isPending
                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                    : isSolved
                    ? "border-border opacity-90"
                    : "border-blue-500/30"
                }`}
              >
                <div>
                  {/* Top Header: Máquina, Urgencia, Estado */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                        <Monitor className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-base block truncate text-foreground">
                          {item.machineName}
                        </span>
                        <span className="text-xs text-muted-foreground block truncate">
                          {isAdmin ? `Cliente: ${item.clientName} · ` : ""}
                          {new Date(item.createdAt).toLocaleString("es-ES", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isUrgent && (
                        <Badge variant="destructive" className="animate-pulse font-bold text-[10px] uppercase">
                          ⚠️ URGENTE
                        </Badge>
                      )}
                      <Badge
                        variant={isSolved ? "default" : isPending ? "outline" : "secondary"}
                        className={
                          isPending
                            ? "border-amber-500 text-amber-600 bg-amber-500/10 font-semibold"
                            : isInProgress
                            ? "bg-blue-600 text-white font-semibold"
                            : "bg-green-600 text-white font-semibold"
                        }
                      >
                        {isPending ? "Pendiente" : isInProgress ? "En curso" : "Solucionada"}
                      </Badge>
                    </div>
                  </div>

                  {/* Título y Descripción del fallo */}
                  <div className="mt-3.5 space-y-1.5">
                    <h3 className="font-semibold text-base text-foreground leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Galería de fotos adjuntas */}
                  {item.photos && item.photos.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/60">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                        <Camera className="h-3.5 w-3.5 text-amber-500" />
                        <span>Fotos adjuntas ({item.photos.length}):</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.photos.map((photo, pIdx) => (
                          <button
                            key={photo.id || pIdx}
                            type="button"
                            onClick={() => setPreviewPhoto(photo)}
                            className="relative group rounded-lg overflow-hidden border border-border h-16 w-16 bg-muted shrink-0 transition-transform hover:scale-105 active:scale-95"
                          >
                            <img
                              src={photo.url}
                              alt="Foto avería"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white">
                              <Eye className="h-4 w-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nota técnica o de resolución */}
                  {item.statusNote && (
                    <div className="mt-3.5 p-3 rounded-xl bg-muted/60 border border-border text-xs flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-semibold text-foreground block">Nota del servicio técnico:</span>
                        <span className="text-muted-foreground">{item.statusNote}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones de gestión (para técnicos y administradores) */}
                {(isAdmin || me.data?.canReports) && (
                  <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isPending && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(item, "en_curso")}
                          className="h-8 text-xs border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                        >
                          <Wrench className="h-3.5 w-3.5 mr-1" /> Marcar en curso
                        </Button>
                      )}

                      {!isSolved && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(item, "solucionado")}
                          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar solucionada
                        </Button>
                      )}

                      {isSolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(item, "pendiente")}
                          className="h-8 text-xs text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                        >
                          <Clock className="h-3.5 w-3.5 mr-1" /> Reabrir avería
                        </Button>
                      )}
                    </div>

                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 px-2 text-destructive hover:bg-destructive/10"
                        aria-label="Eliminar avería"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal visor de foto a pantalla completa */}
      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-3xl p-2 bg-black/95 border-none text-white overflow-hidden">
          {previewPhoto && (
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/90 z-10"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={previewPhoto.url}
                alt="Foto ampliada"
                className="max-h-[80vh] w-auto object-contain rounded-md"
              />
              {previewPhoto.descripcion && (
                <p className="mt-2 text-xs text-center text-zinc-300 px-4 pb-2">
                  {previewPhoto.descripcion}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
