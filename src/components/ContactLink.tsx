import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContactLink() {
  return (
    <Button variant="ghost" asChild className="h-auto min-h-11 max-w-full whitespace-normal text-center text-primary">
      <Link to="/contacto"><MessageCircle className="size-4 shrink-0" />Ponte en contacto con nosotros</Link>
    </Button>
  );
}