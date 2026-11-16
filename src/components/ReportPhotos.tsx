import { useRef, useState } from "react";
import { Camera, Trash2, Eye, Plus, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReportPhoto } from "@/lib/work-report";
import { compressImage } from "@/lib/image-compress";

interface ReportPhotosProps {
  fotos: ReportPhoto[];
  onChange: (fotos: ReportPhoto[]) => void;
  disabled?: boolean;
}

export function ReportPhotos({ fotos = [], onChange, disabled = false }: ReportPhotosProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);

  const inputAntesRef = useRef<HTMLInputElement>(null);
  const inputDespuesRef = useRef<HTMLInputElement>(null);
  const inputGeneralRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File, tipo: "antes" | "despues" | "otro") => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecciona una imagen válida");
      return;
    }

    setProcessing(true);
    try {
      const dataUrl = await compressImage(file, 1200, 1200, 0.75);
      const newPhoto: ReportPhoto = {
        id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo,
        titulo: tipo === "antes" ? "Antes (Avería)" : tipo === "despues" ? "Después (Reparado)" : "Foto de trabajo",
        descripcion: "",
        url: dataUrl,
      };

      onChange([...fotos, newPhoto]);
      toast.success(
        tipo === "antes"
          ? "Foto de antes (avería) añadida"
          : tipo === "despues"
          ? "Foto de después (reparación) añadida"
          : "Foto añadida"
      );
    } catch (err) {
      console.error(err);
      toast.error("No se pudo procesar la foto");
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = (id: string) => {
    onChange(fotos.filter((f) => f.id !== id));
    toast.info("Foto eliminada");
  };

  const updatePhotoDesc = (id: string, desc: string) => {
    onChange(fotos.map((f) => (f.id === id ? { ...f, descripcion: desc } : f)));
  };

  const toggleTipo = (id: string) => {
    onChange(
      fotos.map((f) => {
        if (f.id !== id) return f;
        const nextTipo = f.tipo === "antes" ? "despues" : "antes";
        return {
          ...f,
          tipo: nextTipo,
          titulo: nextTipo === "antes" ? "Antes (Avería)" : "Después (Reparado)",
        };
      })
    );
  };

  return (
    <div className="space-y-4">
      {/* BOTONES DE ACCIÓN PARA AÑADIR FOTOS */}
      {!disabled && (
        <div className="flex flex-wrap gap-2.5 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            className="flex-1 sm:flex-none border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
            onClick={() => inputAntesRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1.5" />
            + Foto Antes (Avería)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={processing}
            className="flex-1 sm:flex-none border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
            onClick={() => inputDespuesRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1.5" />
            + Foto Después (Reparado)
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={processing}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => inputGeneralRef.current?.click()}
          >
            <Plus className="h-4 w-4 mr-1" />
            + Otra foto
          </Button>

          {/* Inputs ocultos para cámara directa */}
          <input
            ref={inputAntesRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file, "antes");
              e.target.value = "";
            }}
          />
          <input
            ref={inputDespuesRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file, "despues");
              e.target.value = "";
            }}
          />
          <input
            ref={inputGeneralRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file, "otro");
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* INDICADOR DE PROCESAMIENTO */}
      {processing && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Optimizando fotografía para el parte...</span>
        </div>
      )}

      {/* LISTA DE FOTOS */}
      {fotos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground bg-muted/20">
          <Camera className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium text-foreground">No hay fotos en este parte</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pulsa en <strong>+ Foto Antes</strong> o <strong>+ Foto Después</strong> para hacer fotos con la cámara o subirlas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {fotos.map((f, index) => {
            const isAntes = f.tipo === "antes";
            const isDespues = f.tipo === "despues";

            return (
              <div
                key={f.id}
                className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-sm space-y-2.5 transition-colors hover:border-primary/40"
              >
                {/* CABECERA DE LA FOTO: TIPO + BOTÓN ELIMINAR */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleTipo(f.id)}
                      title="Pulsa para cambiar entre Antes y Después"
                      className="cursor-pointer"
                    >
                      <Badge
                        variant={isAntes ? "secondary" : isDespues ? "outline" : "secondary"}
                        className={`text-[11px] font-semibold uppercase tracking-wide cursor-pointer transition-colors ${
                          isAntes
                            ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                            : isDespues
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isAntes ? "Antes (Avería)" : isDespues ? "Después (Reparado)" : "Foto de trabajo"}
                        {!disabled && <span className="ml-1 opacity-60 text-[9px]">⇄</span>}
                      </Badge>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setPreviewTitle(
                          isAntes
                            ? "Foto Antes — Avería / Estado inicial"
                            : isDespues
                            ? "Foto Después — Reparación finalizada"
                            : "Fotografía de trabajo"
                        );
                        setPreviewUrl(f.url);
                      }}
                      title="Ver en grande"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {!disabled && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removePhoto(f.id)}
                        title="Eliminar foto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* IMAGEN DE LA FOTO */}
                <div
                  className="relative group overflow-hidden rounded-lg border border-border bg-black/5 aspect-[4/3] flex items-center justify-center cursor-pointer"
                  onClick={() => {
                    setPreviewTitle(
                      isAntes
                        ? "Foto Antes — Avería / Estado inicial"
                        : isDespues
                        ? "Foto Después — Reparación finalizada"
                        : "Fotografía de trabajo"
                    );
                    setPreviewUrl(f.url);
                  }}
                >
                  <img
                    src={f.url}
                    alt={f.descripcion || f.titulo || "Foto de trabajo"}
                    className="w-full h-full object-cover transition-transform group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> Ampliar
                    </span>
                  </div>
                </div>

                {/* DESCRIPCIÓN DE LA FOTO */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Descripción de la foto:
                  </label>
                  <Input
                    placeholder="Ej. Rotura en latiguillo, pieza sustituida..."
                    value={f.descripcion || ""}
                    disabled={disabled}
                    onChange={(e) => updatePhotoDesc(f.id, e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG DE VISTA PREVIA EN GRANDE */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{previewTitle || "Fotografía"}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="mt-2 overflow-hidden rounded-xl bg-black/5 flex items-center justify-center max-h-[75vh]">
              <img
                src={previewUrl}
                alt={previewTitle}
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
