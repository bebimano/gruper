import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/sobre-nosotros")({
  head: () => ({
    meta: [
      { title: "Sobre nosotros — Gruper Remote" },
      { name: "description", content: "Conoce Gruper: Shaping the Future of Water." },
      { property: "og:title", content: "Sobre nosotros — Gruper Remote" },
      { property: "og:description", content: "Conoce Gruper: Shaping the Future of Water." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  const router = useRouter();
  const [key, setKey] = useState(0);

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur-md safe-top">
        <button
          onClick={() => router.history.back()}
          aria-label="Volver"
          className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground/90 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-primary" />
          <span>Volver</span>
        </button>
        <span className="flex-1 truncate text-center text-sm sm:text-base font-bold text-foreground">Sobre nosotros</span>
        <button
          onClick={() => setKey((k) => k + 1)}
          aria-label="Recargar"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground/80 shadow-2xs transition-all hover:bg-muted hover:border-primary/50 hover:text-primary active:scale-95"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </header>
      <iframe
        key={key}
        src="https://www.gruper.es/"
        title="Sobre nosotros — Gruper"
        className="flex-1 w-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
