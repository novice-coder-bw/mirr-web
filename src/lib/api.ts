// API client for the music analysis backend.
// Base URL: VITE_BACKEND_URL (e.g. http://localhost:8000). Empty = same origin (proxy-friendly).
// Set VITE_USE_MOCK="false" to hit the real backend; mock mode is the default.

export type StageStatus = "idle" | "queued" | "processing" | "completed" | "failed";
export type StemName = "vocals" | "drums" | "bass" | "other";

export interface AnalysisResult {
  key: string;
  bpm: number;
  energy: number; // 0-1
  loudness_lufs: number;
  tags: string[];
  waveform: number[]; // normalized 0-1 peaks
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

const BASE_URL = (import.meta.env["VITE_BACKEND_URL"] as string | undefined)?.replace(/\/$/, "") ?? "";
export const USE_MOCK = import.meta.env["VITE_USE_MOCK"] !== "false";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

// ---------- mock backend ----------
const STEMS: StemName[] = ["vocals", "drums", "bass", "other"];
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
export async function uploadFile(file: File, onProgress: (pct: number) => void): Promise<{ file_id: string }> {
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
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    xhr.open("POST", `${BASE_URL}/api/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error — is the backend running?"));
    xhr.send(form);
  });
}

export async function getSession(file_id: string): Promise<Session> {
  if (USE_MOCK) {
    await sleep(150);
    const s = mockStore.get(file_id);
    if (!s) throw new Error("Session not found");
    tick(s);
    return strip(s);
  }
  return json(await fetch(`${BASE_URL}/api/session/${encodeURIComponent(file_id)}`));
}

export async function startAnalysis(file_id: string): Promise<void> {
  if (USE_MOCK) {
    const s = mockStore.get(file_id);
    if (!s) throw new Error("Session not found");
    s._aStart = Date.now();
    s.analysis = { status: "queued", progress: 0 };
    return;
  }
  await json(await fetch(`${BASE_URL}/api/analyze`, post({ file_id })));
}

export async function startSeparation(file_id: string): Promise<void> {
  if (USE_MOCK) {
    const s = mockStore.get(file_id);
    if (!s) throw new Error("Session not found");
    s._sStart = Date.now();
    s.separation = { status: "queued", progress: 0, stems: [] };
    return;
  }
  await json(await fetch(`${BASE_URL}/api/separate`, post({ file_id, stems: STEMS })));
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
