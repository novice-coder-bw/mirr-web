// API client for the music analysis backend. All backend traffic goes through this module.
// Base URL: VITE_BACKEND_URL (default https://mirr-web.duckdns.org).
// Set VITE_USE_MOCK="true" to use the in-browser mock backend; live mode is the default.

import type { components } from "@/api/schema";
import { supabase } from "@/integrations/supabase/client";
import { LOGIN_PATH } from "@/lib/auth";

export type StageStatus = "idle" | "queued" | "processing" | "completed" | "failed";
export type StemName = "vocals" | "drums" | "bass" | "other";

export interface AnalysisResult {
  key: string | null;
  bpm: number | null;
  energy: number | null; // 0-1
  loudness_lufs: number | null;
  duration: number | null; // seconds
  tags: string[];
  waveform: number[]; // normalized 0-1 peaks; empty when the backend provides none
}

export interface Stem {
  name: StemName;
  status: StageStatus;
  url?: string | undefined;
  waveform: number[];
}

export interface Session {
  file_id: string;
  file_name: string;
  analysis: { status: StageStatus; progress: number; error?: string; result?: AnalysisResult };
  separation: { status: StageStatus; progress: number; error?: string; stems: Stem[] };
}

// ---------- backend contract (generated from src/api/openapi.json via `bun run api:types`) ----------
type Schemas = components["schemas"];
type BackendStageStatus = Schemas["StageStatus"];
export type BackendSessionResponse = Schemas["SessionResponse"];
type PresignUploadRequest = Schemas["PresignUploadRequest"];
type PresignUploadResponse = Schemas["PresignUploadResponse"];
type CompleteUploadRequest = Schemas["CompleteUploadRequest"];
type CompleteUploadResponse = Schemas["CompleteUploadResponse"];
type AnalyzeRequest = Schemas["AnalyzeRequest"];
type SeparateRequest = Schemas["SeparateRequest"];

// ---------- config ----------
const DEFAULT_BACKEND_URL = "https://mirr-web.duckdns.org";
export const BASE_URL = (
  (import.meta.env["VITE_BACKEND_URL"] as string | undefined) || DEFAULT_BACKEND_URL
).replace(/\/$/, "");
export const USE_MOCK = import.meta.env["VITE_USE_MOCK"] === "true";

export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const POLL_INTERVAL_MS = 2000;
export const STEMS: StemName[] = ["drums", "bass", "other", "vocals"];

// ---------- errors ----------
/** `status` is the HTTP status, or 0 for network/CORS failures. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ErrorDescription {
  title: string;
  message: string;
}

export function describeError(err: unknown): ErrorDescription {
  const status = err instanceof ApiError ? err.status : undefined;
  switch (status) {
    case 0:
      return {
        title: "Can't reach the server",
        message:
          "The request was blocked or the network is down. Check your connection and try again; if it keeps happening the backend may be offline or not allowing this site (CORS).",
      };
    case 401:
      return { title: "Signed out", message: "Your session has expired. Please sign in again." };
    case 413:
      return {
        title: "File too large",
        message: `The maximum upload size is ${MAX_UPLOAD_MB} MB.`,
      };
    case 415:
      return { title: "Unsupported file", message: "Only WAV or MP3 files are supported." };
    case 429:
      return {
        title: "Too many requests",
        message: "You're going a little fast. Wait a moment and try again.",
      };
    default:
      return {
        title: "Something went wrong",
        message: err instanceof Error && err.message ? err.message : "Unexpected error.",
      };
  }
}

async function errorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail))
      return body.detail.map((d: { msg?: string }) => d.msg ?? String(d)).join("; ");
  } catch {
    // not JSON
  }
  return text || `Request failed (${res.status})`;
}

let redirectingToLogin = false;

export async function handleUnauthorized(): Promise<void> {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  try {
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    if (typeof window !== "undefined" && window.location.pathname !== LOGIN_PATH)
      window.location.assign(LOGIN_PATH);
    redirectingToLogin = false;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    ...(await authHeaders()),
  };
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Network error");
  }
  if (res.status === 401) {
    await handleUnauthorized();
    throw new ApiError(401, await errorDetail(res));
  }
  if (!res.ok) throw new ApiError(res.status, await errorDetail(res));
  return (await res.json()) as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// ---------- adapter: backend → frontend ----------
export function mapStageStatus(status: BackendStageStatus | null | undefined): StageStatus {
  switch (status) {
    case "pending":
      return "queued";
    case "active":
      return "processing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "idle";
  }
}

const DEFAULT_PROGRESS: Record<StageStatus, number> = {
  idle: 0,
  queued: 5,
  processing: 50,
  completed: 100,
  failed: 0,
};

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const peaks = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
const progressOf = (raw: Record<string, unknown>, status: StageStatus) =>
  num(raw["progress"]) ?? DEFAULT_PROGRESS[status];
const errorOf = (raw: { message?: string | null; next_action?: string | null }) =>
  [raw.message, raw.next_action].filter(Boolean).join(" ") || undefined;

const isStemName = (n: string): n is StemName => (STEMS as string[]).includes(n);

export function toSession(res: BackendSessionResponse): Session {
  const a = res.analysis ?? undefined;
  const aStatus = mapStageStatus(a?.status);
  const analysis: Session["analysis"] = { status: aStatus, progress: 0 };
  if (a) {
    analysis.progress = progressOf(a, aStatus);
    if (aStatus === "failed") {
      const e = errorOf(a);
      if (e) analysis.error = e;
    }
    if (aStatus === "completed") {
      const tags = Array.isArray(a["tags"]) ? (a["tags"] as unknown[]) : (a.structure ?? []);
      analysis.result = {
        key: a.key ?? null,
        bpm: num(a.bpm),
        energy: num(a["energy"]),
        loudness_lufs: num(a["loudness_lufs"]) ?? num(a["loudness"]),
        duration: num(a.duration),
        tags: tags.filter((t): t is string => typeof t === "string"),
        waveform: peaks(a["waveform"]),
      };
    }
  }

  const s = res.stems ?? undefined;
  const sStatus = mapStageStatus(s?.status);
  const separation: Session["separation"] = { status: sStatus, progress: 0, stems: [] };
  if (s) {
    separation.progress = progressOf(s, sStatus);
    if (sStatus === "failed") {
      const e = errorOf(s);
      if (e) separation.error = e;
    }
    if (sStatus !== "idle" && sStatus !== "failed") {
      const byName = new Map(
        (s.stems ?? []).filter((x) => isStemName(x.name)).map((x) => [x.name, x] as const),
      );
      separation.stems = STEMS.map((name) => {
        const artifact = byName.get(name);
        return {
          name,
          status: artifact?.url ? "completed" : sStatus === "completed" ? "failed" : sStatus,
          url: artifact?.url,
          waveform: peaks(artifact?.["waveform"]),
        };
      });
    }
  }

  return { file_id: res.file_id, file_name: res.filename ?? "", analysis, separation };
}

// ---------- uploads ----------
const CONTENT_TYPES: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg" };

export function validateUpload(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) throw new ApiError(415, "Only WAV or MP3 files are supported.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new ApiError(413, `The maximum upload size is ${MAX_UPLOAD_MB} MB.`);
  return contentType;
}

function putToStorage(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, xhr.responseText || `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new ApiError(0, "Upload to storage failed"));
    xhr.send(file);
  });
}

// ---------- mock backend ----------
const mockStore = new Map<string, Session & { _aStart?: number; _sStart?: number }>();
const wave = (n: number, seed: number) =>
  Array.from({ length: n }, (_, i) => {
    const v = Math.abs(Math.sin(i * 0.37 + seed) * Math.cos(i * 0.11 + seed * 2));
    return 0.15 + v * 0.85;
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DURATION = 4500;

function tick(s: Session & { _aStart?: number; _sStart?: number }) {
  const now = Date.now();
  if (s._aStart && s.analysis.status !== "completed") {
    const p = Math.min(1, (now - s._aStart) / DURATION);
    s.analysis.status = p < 0.1 ? "queued" : p < 1 ? "processing" : "completed";
    s.analysis.progress = Math.round(p * 100);
    if (p >= 1)
      s.analysis.result = {
        key: "F♯ minor",
        bpm: 124,
        energy: 0.78,
        loudness_lufs: -8.4,
        duration: 212,
        tags: ["Deep House", "Melodic", "Four-on-the-floor", "Analog synths"],
        waveform: wave(120, 1),
      };
  }
  if (s._sStart && s.separation.status !== "completed") {
    const p = Math.min(1, (now - s._sStart) / (DURATION * 1.4));
    s.separation.status = p < 0.08 ? "queued" : p < 1 ? "processing" : "completed";
    s.separation.progress = Math.round(p * 100);
    s.separation.stems = STEMS.map((name, i) => {
      const done = p >= (i + 1) / STEMS.length;
      return {
        name,
        status: done ? "completed" : s.separation.status === "queued" ? "queued" : "processing",
        url: done ? `mock://${s.file_id}/${name}.wav` : undefined,
        waveform: wave(80, i + 3),
      };
    });
  }
}

const strip = (s: Session & { _aStart?: number; _sStart?: number }): Session => {
  const { _aStart, _sStart, ...rest } = s;
  void _aStart;
  void _sStart;
  return structuredClone(rest);
};

// ---------- public API ----------
export async function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ file_id: string }> {
  const contentType = validateUpload(file);
  if (USE_MOCK) {
    for (let p = 0; p <= 100; p += 5) {
      onProgress(p);
      await sleep(60);
    }
    const file_id = `trk_${Math.random().toString(36).slice(2, 10)}`;
    mockStore.set(file_id, {
      file_id,
      file_name: file.name,
      analysis: { status: "idle", progress: 0 },
      separation: { status: "idle", progress: 0, stems: [] },
    });
    return { file_id };
  }

  onProgress(0);
  const meta: PresignUploadRequest = {
    filename: file.name,
    content_type: contentType,
    size_bytes: file.size,
  };
  const presign = await apiFetch<PresignUploadResponse>("/api/v1/uploads/presign", post(meta));
  await putToStorage(presign.upload_url, file, contentType, onProgress);
  const done = await apiFetch<CompleteUploadResponse>(
    "/api/v1/uploads/complete",
    post({
      ...meta,
      file_id: presign.file_id,
      object_key: presign.object_key,
    } satisfies CompleteUploadRequest),
  );
  onProgress(100);
  return { file_id: done.file_id };
}

export async function getSession(file_id: string): Promise<Session> {
  if (USE_MOCK) {
    await sleep(150);
    const s = mockStore.get(file_id);
    if (!s) throw new Error("Session not found");
    tick(s);
    return strip(s);
  }
  return toSession(
    await apiFetch<BackendSessionResponse>(`/api/v1/session/${encodeURIComponent(file_id)}`),
  );
}

/** Re-fetches the session to get a fresh presigned URL for a stem (e.g. after expiry). */
export async function refreshStemUrl(file_id: string, name: StemName): Promise<string | undefined> {
  const session = await getSession(file_id);
  return session.separation.stems.find((s) => s.name === name)?.url;
}

export async function startAnalysis(file_id: string): Promise<void> {
  if (USE_MOCK) {
    const s = mockStore.get(file_id);
    if (!s) throw new Error("Session not found");
    s._aStart = Date.now();
    s.analysis = { status: "queued", progress: 0 };
    return;
  }
  await apiFetch("/api/v1/analyze", post({ file_id } satisfies AnalyzeRequest));
}

export async function startSeparation(file_id: string): Promise<void> {
  if (USE_MOCK) {
    const s = mockStore.get(file_id);
    if (!s) throw new Error("Session not found");
    s._sStart = Date.now();
    s.separation = { status: "queued", progress: 0, stems: [] };
    return;
  }
  await apiFetch("/api/v1/separate", post({ file_id } satisfies SeparateRequest));
}
