import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Trash2, Eye, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const [processingSlot, setProcessingSlot] = useState<string | null>(null);

  const antesInputRef = useRef<HTMLInputElement>(null);
  const despuesInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const fotoAntes = fotos.find((f) => f.tipo === "antes");
  const fotoDespues = fotos.find((f) => f.tipo === "despues");
  const fotosExtra = fotos.filter((f) => f.tipo !== "antes" && f.tipo !== "despues");

  const handleFile = async (file: File, tipo: "antes" | "despues" | "otro", titulo?: string) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecciona un archivo de imagen válido");
      return;
    }

    const slotKey = `${tipo}-${titulo || ""}`;
    setProcessingSlot(slotKey);
    try {
      const dataUrl = await compressImage(file, 1200, 1200, 0.75);
      const newPhoto: ReportPhoto = {
        id: `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipo,
        titulo: titulo || (tipo === "antes" ? "Antes (Avería)" : tipo === "despues" ? "Después (Reparado)" : "Detalle"),
        url: dataUrl,
      };

      if (tipo === "antes") {
        onChange([...fotos.filter((f) => f.tipo !== "antes"), newPhoto]);
      } else if (tipo === "despues") {
        onChange([...fotos.filter((f) => f.tipo !== "despues"), newPhoto]);
      } else {
        onChange([...fotos, newPhoto]);
      }

      toast.success(
        tipo === "antes"
          ? "Foto de la avería adjuntada"
          : tipo === "despues"
          ? "Foto de la reparación adjuntada"
          : "Foto adicional adjuntada"
      );
    } catch (err) {
      console.error(err);
      toast.error("No se pudo procesar la foto");
    } finally {
      setProcessingSlot(null);
    }
  };

  const removePhoto = (id: string) => {
    onChange(fotos.filter((f) => f.id !== id));
    toast.info("Foto eliminada");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* FOTO ANTES (AVERÍA) */}
        <div className="flex flex-col rounded-xl border border-border/80 bg-muted/40 p-3 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" /> Foto Antes (Avería)
            </span>
            {fotoAntes && <Badge variant="secondary" className="text-[10px] uppercase">Avería</Badge>}
          </div>

          {fotoAntes ? (
            <div className="relative group overflow-hidden rounded-lg border border-border bg-black/5 aspect-[4/3] flex items-center justify-center">
              <img
                src={fotoAntes.url}
                alt="Foto avería antes"
                className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-102"
                onClick={() => {
                  setPreviewTitle("Foto Antes — Avería / Estado inicial");
                  setPreviewUrl(fotoAntes.url);
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-medium"
                  onClick={() => {
                    setPreviewTitle("Foto Antes — Avería / Estado inicial");
                    setPreviewUrl(fotoAntes.url);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver grande
                </Button>
                {!disabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => removePhoto(fotoAntes.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <label
              className={`flex-1 min-h-[140px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors ${
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:border-primary/60 hover:bg-primary/5"
              }`}
            >
              {processingSlot === "antes-" ? (
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Optimizando foto...</span>
                </div>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                    <Camera className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Hacer foto de la avería</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Toca para abrir cámara o galería</span>
                  <input
                    ref={antesInputRef}
                    type="file"
                    accept="image/*"
                    disabled={disabled}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file, "antes");
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </label>
          )}
        </div>

        {/* FOTO DESPUÉS (REPARADO) */}
        <div className="flex flex-col rounded-xl border border-border/80 bg-muted/40 p-3 transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Foto Después (Reparado)
            </span>
            {fotoDespues && (
              <Badge variant="outline" className="text-[10px] uppercase border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                Reparado
              </Badge>
            )}
          </div>

          {fotoDespues ? (
            <div className="relative group overflow-hidden rounded-lg border border-border bg-black/5 aspect-[4/3] flex items-center justify-center">
              <img
                src={fotoDespues.url}
                alt="Foto reparación después"
                className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-102"
                onClick={() => {
                  setPreviewTitle("Foto Después — Reparación finalizada");
                  setPreviewUrl(fotoDespues.url);
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-medium"
                  onClick={() => {
                    setPreviewTitle("Foto Después — Reparación finalizada");
                    setPreviewUrl(fotoDespues.url);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver grande
                </Button>
                {!disabled && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => removePhoto(fotoDespues.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <label
              className={`flex-1 min-h-[140px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors ${
                disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:border-emerald-500/60 hover:bg-emerald-500/5"
              }`}
            >
              {processingSlot === "despues-" ? (
                <div className="flex flex-col items-center gap-2 text-emerald-600">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Optimizando foto...</span>
                </div>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
                    <Camera className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Hacer foto del trabajo terminado</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Toca para abrir cámara o galería</span>
                  <input
                    ref={despuesInputRef}
                    type="file"
                    accept="image/*"
                    disabled={disabled}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file, "despues");
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </label>
          )}
        </div>
      </div>

      {/* FOTOS ADICIONALES (SI LAS HAY) */}
      {fotosExtra.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-muted-foreground">Otras fotos adjuntas:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {fotosExtra.map((f) => (
              <div key={f.id} className="relative group rounded-lg overflow-hidden border border-border aspect-[4/3] bg-muted/40">
                <img
                  src={f.url}
                  alt={f.titulo || "Foto adjunta"}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => {
                    setPreviewTitle(f.titulo || "Foto de trabajo");
                    setPreviewUrl(f.url);
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    onClick={() => {
                      setPreviewTitle(f.titulo || "Foto de trabajo");
                      setPreviewUrl(f.url);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {!disabled && (
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => removePhoto(f.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTÓN PARA AÑADIR MÁS FOTOS */}
      {!disabled && (
        <div className="flex items-center justify-between pt-1 print:hidden">
          <p className="text-[11px] text-muted-foreground">
            Las fotos se comprimen y se adjuntarán automáticamente en el PDF del parte.
          </p>
          <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span>Añadir otra foto</span>
            <input
              ref={extraInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file, "otro", `Detalle ${fotosExtra.length + 1}`);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {/* MODAL / DIALOG DE VISTA PREVIA EN TAMAÑO COMPLETO */}
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
