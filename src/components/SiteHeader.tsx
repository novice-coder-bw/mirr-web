import { Link } from "@tanstack/react-router";
import { AudioWaveform } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-neon text-primary-foreground">
            <AudioWaveform className="size-4" />
          </span>
          Stemlab
        </Link>
        <Button asChild size="sm">
          <Link to="/studio">Open studio</Link>
        </Button>
      </div>
    </header>
  );
}
