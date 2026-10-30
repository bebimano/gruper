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
      <header className="flex items-center gap-2 px-3 pb-1 safe-top">
        <button
          onClick={() => router.history.back()}
          aria-label="Volver"
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 truncate text-center text-sm font-semibold">Sobre nosotros</span>
        <button
          onClick={() => setKey((k) => k + 1)}
          aria-label="Recargar"
          className="rounded-full p-1.5 text-muted-foreground hover:text-primary"
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
