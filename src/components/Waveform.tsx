import { cn } from "@/lib/utils";

export function Waveform({
  peaks,
  progress = 1,
  className,
}: {
  peaks: number[];
  progress?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex h-16 items-center gap-[2px]", className)} aria-hidden="true">
      {peaks.map((p, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-full transition-colors",
            i / peaks.length <= progress ? "bg-neon" : "bg-muted",
          )}
          style={{ height: `${Math.max(8, p * 100)}%` }}
        />
      ))}
    </div>
  );
}
