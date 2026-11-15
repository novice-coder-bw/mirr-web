import { Link, useNavigate } from "@tanstack/react-router";
import { AudioWaveform, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await signOut();
    await navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-neon text-primary-foreground">
            <AudioWaveform className="size-4" />
          </span>
          Stemlab
        </Link>
        <div className="flex items-center gap-2">
          {user?.email && (
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
          )}
          <Button asChild size="sm">
            <Link to="/studio">Open studio</Link>
          </Button>
          {user && (
            <Button size="sm" variant="ghost" onClick={onSignOut} aria-label="Sign out">
              <LogOut /> Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
