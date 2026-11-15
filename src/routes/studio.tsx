import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  FileAudio,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SiteHeader } from "@/components/SiteHeader";
import { Waveform } from "@/components/Waveform";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import {
  describeError,
  getSession,
  MAX_UPLOAD_MB,
  POLL_INTERVAL_MS,
  refreshStemUrl,
  STEMS,
  startAnalysis,
  startSeparation,
  uploadFile,
  USE_MOCK,
  validateUpload,
  type ErrorDescription,
  type Session,
  type StageStatus,
  type Stem,
} from "@/lib/api";

export const Route = createFileRoute("/studio")({
  ssr: false,
  beforeLoad: async () => {
    if (!USE_MOCK) await requireAuth();
  },
  head: () => ({
    meta: [
      { title: "Studio — Stemlab" },
      {
        name: "description",
        content:
          "Upload a track, run analysis and separate it into vocals, drums, bass and other stems.",
      },
      { property: "og:title", content: "Studio — Stemlab" },
      { property: "og:description", content: "Analyze key, BPM and energy, then export stems." },
    ],
  }),
  component: Studio,
});

const ACCEPT = ".wav,.mp3,audio/wav,audio/mpeg";

function Studio() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "failed">("idle");
  const [error, setError] = useState<ErrorDescription | null>(null);
  const fail = (e: unknown) => setError(describeError(e));
  const [session, setSession] = useState<Session | null>(null);
  const uploaded = useRef<{ file: File; id: string } | null>(null);

  const doUpload = useCallback(async (f: File) => {
    try {
      validateUpload(f);
    } catch (e) {
      setError(describeError(e));
      return;
    }
    setFile(f);
    setError(null);
    setSession(null);
    setUploadState("uploading");
    setUploadPct(0);
    try {
      // Retrying after a failed session fetch must not upload (and start analysis) twice.
      const file_id =
        uploaded.current?.file === f
          ? uploaded.current.id
          : (await uploadFile(f, setUploadPct)).file_id;
      uploaded.current = { file: f, id: file_id };
      setUploadPct(100);
      setSession(await getSession(file_id));
      setUploadState("done");
    } catch (e) {
      setUploadState("failed");
      setError(describeError(e));
    }
  }, []);

  // Poll while something is running
  const running =
    session && (isActive(session.analysis.status) || isActive(session.separation.status));
  useEffect(() => {
    if (!running || !session) return;
    const id = setInterval(async () => {
      try {
        setSession(await getSession(session.file_id));
      } catch (e) {
        fail(e);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running, session?.file_id]);

  const run = async (fn: (id: string) => Promise<void>) => {
    if (!session) return;
    setError(null);
    try {
      await fn(session.file_id);
      setSession(await getSession(session.file_id));
    } catch (e) {
      fail(e);
    }
  };

  const a = session?.analysis.status ?? "idle";
  const s = session?.separation.status ?? "idle";

  return (
    <div className="min-h-screen font-sans">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <DropZone onFile={doUpload} disabled={uploadState === "uploading"} />
          <SessionCard
            file={file}
            session={session}
            uploadState={uploadState}
            uploadPct={uploadPct}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              disabled={!session || isActive(a) || a === "completed"}
              onClick={() => run(startAnalysis)}
            >
              {isActive(a) && <Loader2 className="animate-spin" />} Analyze
            </Button>
            <Button
              variant="secondary"
              disabled={a !== "completed" || isActive(s) || s === "completed"}
              onClick={() => run(startSeparation)}
            >
              {isActive(s) && <Loader2 className="animate-spin" />} Separate stems
            </Button>
          </div>
          {USE_MOCK && (
            <p className="font-mono text-xs text-muted-foreground">
              Demo mode — results are simulated.
            </p>
          )}
        </div>

        <div className="space-y-6" aria-live="polite">
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error.message}</span>
                {file && uploadState === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => doUpload(file)}>
                    <RotateCcw /> Retry upload
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {!session ? (
            <EmptyResults uploading={uploadState === "uploading"} />
          ) : (
            <>
              <AnalysisPanel session={session} onRetry={() => run(startAnalysis)} />
              <StemsPanel session={session} onRetry={() => run(startSeparation)} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const isActive = (s: StageStatus) => s === "queued" || s === "processing";

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/50 p-8 text-center transition",
          "hover:border-primary/70 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          over && "border-accent bg-accent/10 shadow-glow",
        )}
        aria-label="Upload audio file. Drop a WAV or MP3 up to 100 MB here or press to browse."
      >
        <UploadCloud className="size-8 text-accent" />
        <span className="font-display font-semibold">Drop your track here</span>
        <span className="text-sm text-muted-foreground">
          WAV or MP3 up to {MAX_UPLOAD_MB} MB · or click to browse
        </span>
      </button>
    </>
  );
}

function SessionCard({
  file,
  session,
  uploadState,
  uploadPct,
}: {
  file: File | null;
  session: Session | null;
  uploadState: string;
  uploadPct: number;
}) {
  const stages = [
    {
      label: "Uploaded",
      status:
        uploadState === "done"
          ? "completed"
          : uploadState === "uploading"
            ? "processing"
            : uploadState === "failed"
              ? "failed"
              : "idle",
    },
    { label: "Analyzing", status: session?.analysis.status ?? "idle" },
    { label: "Separating", status: session?.separation.status ?? "idle" },
    { label: "Ready", status: session?.separation.status === "completed" ? "completed" : "idle" },
  ] as { label: string; status: StageStatus }[];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileAudio className="size-4 text-primary" />
          <span className="truncate">{file?.name ?? "No track loaded"}</span>
        </CardTitle>
        {session && (
          <p className="font-mono text-xs text-muted-foreground">session {session.file_id}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {uploadState === "uploading" && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Uploading</span>
              <span>{uploadPct}%</span>
            </div>
            <Progress value={uploadPct} aria-label="Upload progress" />
          </div>
        )}
        <ol className="space-y-2">
          {stages.map((st) => (
            <li key={st.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <StageDot status={st.status} />
                <span className={cn(st.status === "idle" && "text-muted-foreground")}>
                  {st.label}
                </span>
              </span>
              <StatusBadge status={st.status} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function StageDot({ status }: { status: StageStatus }) {
  if (status === "completed") return <Check className="size-4 text-success" aria-hidden />;
  if (isActive(status)) return <Loader2 className="size-4 animate-spin text-accent" aria-hidden />;
  if (status === "failed") return <AlertCircle className="size-4 text-destructive" aria-hidden />;
  return <span className="mx-1 size-2 rounded-full bg-muted-foreground/40" aria-hidden />;
}

function StatusBadge({ status }: { status: StageStatus }) {
  const map: Record<StageStatus, string> = {
    idle: "border-border text-muted-foreground",
    queued: "border-accent/40 text-accent",
    processing: "border-primary/50 text-primary",
    completed: "border-success/40 text-success",
    failed: "border-destructive/50 text-destructive",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[10px] uppercase", map[status])}>
      {status === "idle" ? "waiting" : status}
    </Badge>
  );
}

function EmptyResults({ uploading }: { uploading: boolean }) {
  if (uploading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  return (
    <Card className="grid min-h-80 place-items-center border-dashed text-center">
      <CardContent className="max-w-sm py-12">
        <Waveform
          peaks={Array.from({ length: 40 }, (_, i) => 0.2 + Math.abs(Math.sin(i / 3)) * 0.6)}
          progress={0}
          className="mb-6 h-12"
        />
        <h2 className="font-display text-xl font-semibold">No track yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a mix or a bounce to see its key, tempo, energy and individual stems here.
        </p>
      </CardContent>
    </Card>
  );
}

function AnalysisPanel({ session, onRetry }: { session: Session; onRetry: () => void }) {
  const { status, progress, result, error } = session.analysis;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-display">Analysis</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent>
        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
            Press <strong>Analyze</strong> to detect key, BPM, loudness and style.
          </p>
        )}
        {status === "failed" && (
          <FailedRow message={error ?? "Analysis failed."} onRetry={onRetry} />
        )}
        {isActive(status) && (
          <div className="space-y-4">
            <Progress value={progress} aria-label="Analysis progress" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-16" />
          </div>
        )}
        {status === "completed" && result && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Key" value={result.key ?? "—"} />
              <Metric label="Tempo" value={fmt(result.bpm, (v) => `${Math.round(v)} BPM`)} />
              <Metric label="Energy" value={fmt(result.energy, (v) => `${Math.round(v * 100)}%`)} />
              <Metric label="Loudness" value={fmt(result.loudness_lufs, (v) => `${v} LUFS`)} />
            </div>
            {result.waveform.length > 0 && <Waveform peaks={result.waveform} />}
            <div className="flex flex-wrap gap-2">
              {result.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const fmt = (v: number | null, f: (v: number) => string) => (v === null ? "—" : f(v));

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function FailedRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-destructive">
      <span>{message}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RotateCcw /> Retry
      </Button>
    </div>
  );
}

function StemsPanel({ session, onRetry }: { session: Session; onRetry: () => void }) {
  const { status, progress, stems, error } = session.separation;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="font-display">Stems</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
            Finish analysis, then press <strong>Separate stems</strong> to split into vocals, drums,
            bass and other.
          </p>
        )}
        {status === "failed" && (
          <FailedRow message={error ?? "Separation failed."} onRetry={onRetry} />
        )}
        {isActive(status) && <Progress value={progress} aria-label="Separation progress" />}
        {status !== "idle" && status !== "failed" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {STEMS.map((n) => {
              const stem = stems.find((x) => x.name === n);
              return stem ? (
                <StemCard key={`${session.file_id}:${n}`} stem={stem} fileId={session.file_id} />
              ) : (
                <Skeleton key={n} className="h-36" />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StemCard({ stem, fileId }: { stem: Stem; fileId: string }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [url, setUrl] = useState(stem.url);
  const audio = useRef<HTMLAudioElement | null>(null);
  const refetched = useRef(false);
  const ready = stem.status === "completed";
  const realUrl = url && !url.startsWith("mock://") ? url : undefined;

  useEffect(() => setUrl(stem.url), [stem.url]);
  useEffect(() => () => audio.current?.pause(), []);

  useEffect(() => {
    if (!playing || realUrl) return;
    const id = setInterval(() => setPos((p) => (p >= 1 ? (setPlaying(false), 0) : p + 0.01)), 80);
    return () => clearInterval(id);
  }, [playing, realUrl]);

  // Presigned URLs expire: on a load failure, refetch the session once for a fresh URL and retry.
  const onLoadError = async (el: HTMLAudioElement) => {
    if (refetched.current) return setPlaying(false);
    refetched.current = true;
    const fresh = await refreshStemUrl(fileId, stem.name).catch(() => undefined);
    if (!fresh) {
      refetched.current = false;
      return setPlaying(false);
    }
    setUrl(fresh);
    el.src = fresh;
    el.play().catch(() => setPlaying(false));
  };

  // Presigned URLs may have expired by the time the user downloads; fetch a fresh one first.
  const download = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const fresh = (await refreshStemUrl(fileId, stem.name).catch(() => undefined)) ?? realUrl;
    if (!fresh) return;
    if (fresh !== url) setUrl(fresh);
    const a = document.createElement("a");
    a.href = fresh;
    a.download = "";
    a.click();
  };

  const toggle = () => {
    if (realUrl) {
      audio.current ??= new Audio(realUrl);
      const el = audio.current;
      el.ontimeupdate = () => setPos(el.currentTime / (el.duration || 1));
      el.onended = () => setPlaying(false);
      el.onplaying = () => (refetched.current = false);
      el.onerror = () => void onLoadError(el);
      if (playing) el.pause();
      else el.play().catch(() => {});
    }
    setPlaying(!playing);
  };
  const label = stem.name.charAt(0).toUpperCase() + stem.name.slice(1);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 transition hover:border-primary/50">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display font-semibold">{label}</span>
        <StatusBadge status={stem.status} />
      </div>
      {ready && stem.waveform.length > 0 ? (
        <Waveform peaks={stem.waveform} progress={pos} className="h-12" />
      ) : ready ? (
        <Progress
          value={pos * 100}
          className="my-5 h-2"
          aria-label={`${label} playback position`}
        />
      ) : (
        <Skeleton className="h-12" />
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!ready}
          onClick={toggle}
          aria-label={`${playing ? "Pause" : "Play"} ${label} stem`}
        >
          {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Play"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!ready || !realUrl}
          asChild={!!realUrl && ready}
          aria-label={`Download ${label} stem`}
        >
          {realUrl && ready ? (
            <a href={realUrl} download onClick={download}>
              <Download /> WAV
            </a>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Download /> WAV
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
