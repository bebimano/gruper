import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
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
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  UploadCloud,
  Cpu,
  AlertCircle,
  Building,
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
import {
  getClientEquipmentForAveriasServer,
  getAllClientsAndEquipmentAdminServer,
} from "@/lib/equipment.functions";
import type { Averia, AveriaPhoto, AveriaElement } from "@/lib/averias";
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
  const [manualMachineName, setManualMachineName] = useState("");
  const [adminClientTarget, setAdminClientTarget] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgente">("normal");
  const [photos, setPhotos] = useState<AveriaPhoto[]>([]);
  const [elementos, setElementos] = useState<AveriaElement[]>([]);
  const [newElNombre, setNewElNombre] = useState("");
  const [newElDesc, setNewElDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Camera & Gallery refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = !!me.data?.isAdmin;
  const canAccess = isAdmin || !!me.data?.canAverias;

  const getAveriasFn = useServerFn(getAveriasList);
  const submitFn = useServerFn(submitAveria);
  const updateStatusFn = useServerFn(updateAveriaStatusServer);
  const deleteFn = useServerFn(deleteAveriaServer);
  const getEquipmentForAveriasFn = useServerFn(getClientEquipmentForAveriasServer);
  const getAllClientsAdminFn = useServerFn(getAllClientsAndEquipmentAdminServer);

  // Consulta de averías usando función de servidor con supabaseAdmin
  const averiasQuery = useQuery({
    queryKey: ["averias", me.data?.id],
    enabled: !!me.data && canAccess,
    queryFn: () => getAveriasFn(),
  });

  // Lista de clientes para administradores
  const adminClientsQuery = useQuery({
    queryKey: ["admin-all-clients-averias"],
    enabled: !!me.data && isAdmin,
    queryFn: () => getAllClientsAdminFn(),
  });

  // Consulta de máquinas asignadas al cliente desde EQUIPOS (client_equipment)
  const clientTarget = isAdmin && adminClientTarget ? adminClientTarget : me.data?.username;
  const equipmentQuery = useQuery({
    queryKey: ["equipment-for-averias", clientTarget],
    enabled: !!me.data && canAccess,
    queryFn: () => getEquipmentForAveriasFn({ data: { clientName: clientTarget || undefined } }),
  });

  const assignedMachines = equipmentQuery.data ?? [];

  if (me.isLoading) return null;

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-hero px-4 sm:px-6 safe-top safe-bottom flex flex-col items-center justify-center max-w-md mx-auto text-center p-6">
        <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-bold mb-2">Acceso no habilitado</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Tu cuenta no tiene activado el acceso al apartado de Averías / Fallos. Contacta con Gruper para habilitar este servicio para tus máquinas.
        </p>
        <Button asChild variant="outline" className="rounded-xl border-border/80 shadow-2xs">
          <Link to="/maquinas">
            <ArrowLeft className="h-4 w-4 mr-2 text-primary" /> Volver a mis máquinas
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
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Añadir un elemento que falla con su descripción
  const handleAddElemento = () => {
    if (!newElNombre.trim()) {
      toast.error("Indica el nombre del elemento o pieza que falla (ej. Bomba, Sonda, Válvula)");
      return;
    }
    if (!newElDesc.trim()) {
      toast.error("Describe qué le ocurre a este elemento");
      return;
    }
    setElementos((prev) => [
      ...prev,
      {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nombre: newElNombre.trim(),
        descripcion: newElDesc.trim(),
      },
    ]);
    setNewElNombre("");
    setNewElDesc("");
  };

  const handleRemoveElemento = (id: string) => {
    setElementos((prev) => prev.filter((el) => el.id !== id));
  };

  // Envío del formulario de avería
  const handleSubmitAveria = async (e: React.FormEvent) => {
    e.preventDefault();

    const machineNameFinal = selectedMachineName.trim() || manualMachineName.trim();
    if (!machineNameFinal) {
      toast.error("Por favor, selecciona o indica la máquina afectada");
      return;
    }
    if (!title.trim()) {
      toast.error("Por favor, introduce un título o síntoma del fallo");
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
          machineName: machineNameFinal,
          title: title.trim(),
          description: description.trim(),
          urgency,
          photos,
          elementos,
        },
      });

      // Broadcast en tiempo real si está disponible
      try {
        const channel = supabase.channel("gruper-averias-realtime");
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel.send({
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
          }
        });
      } catch (bcErr) {
        console.warn("Realtime broadcast error:", bcErr);
      }

      toast.success("¡Aviso de avería enviado a Gruper!", {
        description: "El aviso se ha registrado y los técnicos han sido alertados.",
        duration: 7000,
      });

      // Limpiar formulario y cerrar modal
      setTitle("");
      setDescription("");
      setSelectedMachineId("");
      setSelectedMachineName("");
      setManualMachineName("");
      setAdminClientTarget("");
      setUrgency("normal");
      setPhotos([]);
      setElementos([]);
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
      const matchElements = (item.elementos || []).some(
        (el) => el.nombre.toLowerCase().includes(term) || el.descripcion.toLowerCase().includes(term)
      );
      if (!matchMachine && !matchClient && !matchTitle && !matchDesc && !matchElements) return false;
    }

    return true;
  });

  const countPendientes = rawList.filter((a) => a.status === "pendiente").length;
  const countEnCurso = rawList.filter((a) => a.status === "en_curso").length;
  const countSolucionadas = rawList.filter((a) => a.status === "solucionado").length;

  // Agrupado por carpetas de cliente
  const clientGroups = useMemo(() => {
    const map = new Map<string, Averia[]>();
    for (const a of filteredList) {
      const c = (a.clientName || "Sin cliente").trim();
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(a);
    }
    return Array.from(map.entries())
      .map(([clientName, items]) => {
        const pendingCount = items.filter((x) => x.status === "pendiente").length;
        const urgentCount = items.filter((x) => x.urgency === "urgente" && x.status !== "solucionado").length;
        return {
          clientName,
          items,
          pendingCount,
          urgentCount,
        };
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName, "es-ES"));
  }, [filteredList]);

  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (key: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of clientGroups) {
      next[g.clientName] = true;
    }
    setCollapsedFolders(next);
  };

  const expandAll = () => {
    setCollapsedFolders({});
  };

  const renderAveriaCard = (item: Averia) => {
    const isPending = item.status === "pendiente";
    const isInProgress = item.status === "en_curso";
    const isSolved = item.status === "solucionado";
    const isUrgent = item.urgency === "urgente";

    return (
      <div
        key={item.id}
        className={`rounded-2xl border p-4 sm:p-5 bg-card shadow-xs transition-all flex flex-col justify-between ${
          isUrgent && isPending
            ? "border-primary/60 bg-primary/[0.03] ring-1 ring-primary/20"
            : isPending
            ? "border-border/80 bg-background"
            : isSolved
            ? "border-border opacity-90"
            : "border-primary/40 bg-primary/[0.02]"
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
                <Badge variant="outline" className="border-primary text-primary font-bold text-[10px] uppercase">
                  ⚠️ URGENTE
                </Badge>
              )}
              <Badge
                variant={isSolved ? "default" : isPending ? "outline" : "secondary"}
                className={
                  isPending
                    ? "border-border text-foreground font-semibold"
                    : isInProgress
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground font-semibold"
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

          {/* Elementos específicos que fallan */}
          {item.elementos && item.elementos.length > 0 && (
            <div className="mt-3.5 p-3 rounded-xl bg-muted/30 border border-border/80 space-y-1.5 text-xs">
              <span className="font-bold text-primary flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                <Wrench className="h-3.5 w-3.5" /> Elementos afectados ({item.elementos.length}):
              </span>
              <div className="space-y-1 pt-0.5">
                {item.elementos.map((el, idx) => (
                  <div key={el.id || idx} className="border-l-2 border-primary/60 pl-2">
                    <strong className="text-foreground">{el.nombre}:</strong>{" "}
                    <span className="text-muted-foreground">{el.descripcion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Galería de fotos adjuntas */}
          {item.photos && item.photos.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Camera className="h-3.5 w-3.5 text-primary" />
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

        {/* Acciones de gestión con botones todos en azul Gruper uniforme */}
        {(isAdmin || me.data?.canReports) && (
          <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {isPending && (
                <Button
                  size="sm"
                  onClick={() => handleUpdateStatus(item, "en_curso")}
                  className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1"
                >
                  <Wrench className="h-3.5 w-3.5" /> Marcar en curso
                </Button>
              )}

              {!isSolved && (
                <Button
                  size="sm"
                  onClick={() => handleUpdateStatus(item, "solucionado")}
                  className="h-8 text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar solucionada
                </Button>
              )}

              {isSolved && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(item, "pendiente")}
                  className="h-8 text-xs rounded-xl border-border/80 text-foreground hover:border-primary/50 hover:text-primary gap-1"
                >
                  <Clock className="h-3.5 w-3.5 text-primary" /> Reabrir avería
                </Button>
              )}
            </div>

            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(item.id)}
                className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Eliminar avería"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-hero px-4 sm:px-6 md:px-8 safe-top safe-bottom max-w-5xl w-full mx-auto pb-14">
      {/* Header */}
      <header className="py-3">
        <div className="flex items-center justify-between">
          <img src={logo.url} alt="Gruper" width={1076} height={343} className="h-8 sm:h-9 w-auto" />
          <Link
            to="/maquinas"
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-foreground/90 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-primary" />
            <span>Volver a máquinas</span>
          </Link>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-6 w-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Averías y Fallos</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {isAdmin
                ? "Gestión de incidencias y avisos reportados por clientes con fotos y seguimiento"
                : "Notifica cualquier problema en tus máquinas con fotos de la cámara para resolverlo de inmediato"}
            </p>
          </div>

          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-2 h-10 px-4 rounded-xl font-semibold active:scale-95 transition-all">
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Dar aviso de avería</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg max-h-[86vh] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                  <Wrench className="h-5 w-5 text-primary" /> Notificar avería en máquina
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmitAveria} className="space-y-4 pt-2 pb-4">
                {/* Si es Admin: selector de Cliente */}
                {isAdmin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-primary" />
                        <span>Cliente que reporta *</span>
                      </span>
                      {adminClientTarget && (
                        <button
                          type="button"
                          onClick={() => {
                            setAdminClientTarget("");
                            setSelectedMachineName("");
                            setSelectedMachineId("");
                            setManualMachineName("");
                          }}
                          className="text-[11px] text-primary hover:underline font-normal cursor-pointer"
                        >
                          Cambiar cliente
                        </button>
                      )}
                    </label>

                    <select
                      value={adminClientTarget}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAdminClientTarget(val);
                        setSelectedMachineName("");
                        setSelectedMachineId("");
                        setManualMachineName("");
                      }}
                      className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium text-foreground cursor-pointer"
                      required
                    >
                      <option value="">-- Elige un cliente para ver sus máquinas --</option>
                      {adminClientsQuery.data?.clients.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} {c.machinesCount > 0 ? `(${c.machinesCount} ${c.machinesCount === 1 ? "máquina" : "máquinas"})` : "(0 máquinas)"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selector de máquina desde EQUIPOS (client_equipment) */}
                {isAdmin && !adminClientTarget ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Máquina afectada *
                    </label>
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5 text-center text-xs text-muted-foreground">
                      👆 Selecciona primero un cliente arriba para ver sus máquinas de Equipos.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Máquina afectada *</span>
                      <span className="text-[11px] text-primary lowercase font-normal">
                        {assignedMachines.length} {assignedMachines.length === 1 ? "máquina en equipos" : "máquinas en equipos"}
                      </span>
                    </label>

                    {assignedMachines.length > 0 ? (
                      <select
                        className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium text-foreground cursor-pointer"
                        value={selectedMachineName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedMachineName(val);
                          const m = assignedMachines.find((x) => x.displayName === val);
                          if (m) setSelectedMachineId(m.id);
                        }}
                        required
                      >
                        <option value="">-- Elige la máquina que tiene la avería --</option>
                        {assignedMachines.map((m) => (
                          <option key={m.id} value={m.displayName}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          placeholder="Nombre de la máquina (ej. Depuradora mtar-300a)"
                          value={manualMachineName}
                          onChange={(e) => setManualMachineName(e.target.value)}
                          required
                          className="h-10 text-sm font-medium rounded-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {isAdmin
                            ? `"${adminClientTarget}" no tiene máquinas asignadas en Equipos. Escribe el nombre o puedes asignarle una en Administración > Equipos.`
                            : "No tienes máquinas registradas aún en el sistema. Escribe el nombre o modelo de tu máquina."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Nivel de urgencia */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nivel de urgencia
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUrgency("normal")}
                      className={`p-3 rounded-xl border text-left transition-all ${
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
                      className={`p-3 rounded-xl border text-left transition-all ${
                        urgency === "urgente"
                          ? "border-primary bg-primary/10 ring-1 ring-primary font-medium text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                        <span>⚠️ URGENTE</span>
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
                    className="h-10 font-medium rounded-xl"
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
                    rows={3}
                    className="text-sm rounded-xl"
                  />
                </div>

                {/* Descripción de cada elemento que falla */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-primary" />
                      <span>Elementos o componentes que fallan</span>
                    </label>
                    <span className="text-xs text-muted-foreground">{elementos.length} añadidos</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Añade los elementos específicos afectados y describe qué le ocurre a cada uno (ej. Bomba, Sonda, Válvula...).
                  </p>

                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Elemento que falla (ej. Bomba dosificadora)"
                        value={newElNombre}
                        onChange={(e) => setNewElNombre(e.target.value)}
                        className="h-9 text-xs font-medium bg-background"
                      />
                      <Input
                        placeholder="Descripción del fallo (ej. Gotea y no arranca)"
                        value={newElDesc}
                        onChange={(e) => setNewElDesc(e.target.value)}
                        className="h-9 text-xs bg-background"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddElemento}
                      size="sm"
                      className="w-full h-8 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Añadir este elemento al aviso</span>
                    </Button>
                  </div>

                  {elementos.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {elementos.map((el) => (
                        <div
                          key={el.id}
                          className="rounded-lg border border-border bg-card p-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <strong className="text-foreground">{el.nombre}:</strong>{" "}
                            <span className="text-muted-foreground">{el.descripcion}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveElemento(el.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fotos con la Cámara del móvil o subida de galería */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Camera className="h-4 w-4 text-primary" />
                      <span>Fotos de la avería</span>
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {photos.length} {photos.length === 1 ? "foto" : "fotos"}
                    </span>
                  </div>

                  {/* Input específico para abrir la CÁMARA directamente */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />

                  {/* Input para seleccionar fotos de la GALERÍA */}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />

                  {/* Botones todos en el mismo azul Gruper */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 active:scale-95 transition-all"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      <span>Hacer foto con la cámara</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="flex-1 h-10 rounded-xl border-border/80 text-foreground hover:border-primary/50 hover:text-primary font-semibold text-xs gap-1.5 active:scale-95 transition-all"
                    >
                      <UploadCloud className="h-4 w-4 text-primary" />
                      <span>Subir de galería</span>
                    </Button>
                  </div>

                  {/* Galería de fotos añadidas */}
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {photos.map((p) => (
                        <div
                          key={p.id}
                          className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-square"
                        >
                          <img
                            src={p.url}
                            alt="Foto avería"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(p.id)}
                            className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full shadow-md opacity-90 hover:opacity-100"
                            aria-label="Eliminar foto"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botón de envío limpio en azul corporativo */}
                <div className="pt-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-xs active:scale-95 transition-all"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando aviso...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" /> Enviar aviso a los técnicos
                      </>
                    )}
                  </Button>
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
              placeholder="Buscar por máquina, cliente, fallo o elemento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background border-border text-sm"
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
            className="shrink-0 h-10 rounded-xl border-border/80 text-xs gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${averiasQuery.isFetching ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>

        {/* Píldoras de estado uniformes en azul Gruper */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/70 text-muted-foreground hover:bg-muted"
            }`}
          >
            Todas ({rawList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("pendiente")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === "pendiente"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/70 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Pendientes ({countPendientes})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("en_curso")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === "en_curso"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/70 text-muted-foreground hover:bg-muted"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>En curso ({countEnCurso})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("solucionado")}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 ${
              filterStatus === "solucionado"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/70 text-muted-foreground hover:bg-muted"
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
            <Wrench className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-base">No hay averías registradas</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {search || filterStatus !== "all"
                ? "No se han encontrado averías con los filtros seleccionados."
                : "No hay avisos de avería activos en este momento."}
            </p>
            {!search && filterStatus === "all" && (
              <Button
                onClick={() => setOpenModal(true)}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-xl"
              >
                <Plus className="h-4 w-4" /> Dar primer aviso de avería
              </Button>
            )}
          </div>
        )}

        {!averiasQuery.isLoading && clientGroups.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="font-medium">
                {clientGroups.length} {clientGroups.length === 1 ? "carpeta de cliente" : "carpetas de clientes"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-primary transition-colors font-medium cursor-pointer"
                >
                  Abrir todas
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-primary transition-colors font-medium cursor-pointer"
                >
                  Plegar todas
                </button>
              </div>
            </div>

            {clientGroups.map((g) => {
              const isCollapsed = search.trim().length > 0 ? false : !!collapsedFolders[g.clientName];

              return (
                <div
                  key={g.clientName}
                  className="rounded-2xl border border-border bg-card/70 backdrop-blur shadow-xs overflow-hidden transition-all"
                >
                  {/* Encabezado Carpeta Cliente */}
                  <button
                    type="button"
                    onClick={() => toggleFolder(g.clientName)}
                    className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {isCollapsed ? <Folder className="h-5 w-5" /> : <FolderOpen className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <span className="block font-semibold text-base truncate text-foreground">
                          {g.clientName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {g.items.length} {g.items.length === 1 ? "avería guardada" : "averías guardadas"}
                          {g.pendingCount > 0 ? ` · ${g.pendingCount} pendiente(s)` : " · al día"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-muted-foreground ml-3">
                      {g.urgentCount > 0 && (
                        <Badge variant="outline" className="border-primary text-primary text-[10px] uppercase font-bold">
                          ⚠️ {g.urgentCount} urgente
                        </Badge>
                      )}
                      {g.pendingCount > 0 && (
                        <Badge variant="outline" className="border-border text-foreground text-xs font-semibold">
                          {g.pendingCount} pendiente{g.pendingCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <span className="text-xs font-medium bg-background border border-border px-2.5 py-1 rounded-full">
                        {g.items.length}
                      </span>
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {/* Averías dentro de la carpeta */}
                  {!isCollapsed && (
                    <div className="p-4 border-t border-border/60 bg-background/50">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {g.items.map((item) => renderAveriaCard(item))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
