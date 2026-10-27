import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Upload, Gauge, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { Waveform } from "@/components/Waveform";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stemlab — Track analysis & stem separation for producers" },
      { name: "description", content: "Upload a WAV or MP3, get key, BPM and energy, then split it into vocals, drums, bass and other stems." },
      { property: "og:title", content: "Stemlab — Track analysis & stem separation" },
      { property: "og:description", content: "Upload → Analyze → Separate stems. Built for musicians and producers." },
    ],
  }),
  component: Index,
});

const hero = Array.from({ length: 96 }, (_, i) => 0.2 + Math.abs(Math.sin(i * 0.31) * Math.cos(i * 0.09)) * 0.8);

const steps = [
  { icon: Upload, title: "Upload", body: "Drop a WAV or MP3 up to 200 MB. Your mix stays private to your session." },
  { icon: Gauge, title: "Analyze", body: "Detect musical key, tempo, integrated loudness, energy and style tags in seconds." },
  { icon: Layers, title: "Separate stems", body: "Pull clean vocals, drums, bass and other into individual files ready for your DAW." },
];

function Index() {
  return (
    <div className="min-h-screen font-sans">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4">
        <section className="py-20 text-center md:py-28">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-accent">For remixers, producers & engineers</p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight md:text-6xl">
            Hear what's <span className="text-neon">inside</span> your track.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Upload a song, read its key and BPM, then split it into vocals, drums, bass and everything else.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/studio">
                Start a session <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-border bg-card/60 p-6">
            <Waveform peaks={hero} progress={0.42} className="h-24" />
            <div className="mt-4 flex justify-between font-mono text-xs text-muted-foreground">
              <span>F♯ min</span><span>124 BPM</span><span>−8.4 LUFS</span>
            </div>
          </div>
        </section>
        <section className="grid gap-4 pb-24 md:grid-cols-3" aria-label="How it works">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/60">
              <div className="flex items-center gap-3">
                <s.icon className="size-5 text-accent" />
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
