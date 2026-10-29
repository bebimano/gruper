import { Info } from "lucide-react";

export function AboutLink() {
  return (
    <a
      href="https://www.gruper.es/"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <Info className="h-4 w-4" /> Sobre nosotros
    </a>
  );
}
