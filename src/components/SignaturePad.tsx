import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!; const b = c.getBoundingClientRect();
    return { x: ((e.clientX - b.left) * c.width) / b.width, y: ((e.clientY - b.top) * c.height) / b.height };
  };
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    drawing.current = true; (e.target as Element).setPointerCapture(e.pointerId);
    const ctx = ref.current!.getContext("2d")!; const p = pos(e);
    ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!; const p = pos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; onChange(ref.current!.toDataURL("image/png"));
  };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); onChange(""); };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref} width={600} height={200}
        className="w-full h-40 rounded-lg border border-border bg-background touch-none"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      />
      {!disabled && <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={clear}>Borrar firma</Button>}
    </div>
  );
}
