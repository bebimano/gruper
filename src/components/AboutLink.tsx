import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

export function AboutLink() {
  return (
    <Link
      to="/sobre-nosotros"
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      <Info className="h-4 w-4" /> Sobre nosotros
    </Link>
  );
}
