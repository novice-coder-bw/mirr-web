import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import {
  ApiError,
  BASE_URL,
  describeError,
  getSession,
  mapStageStatus,
  toSession,
  validateUpload,
} from "@/lib/api";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("mapStageStatus", () => {
  it.each([
    ["pending", "queued"],
    ["active", "processing"],
    ["completed", "completed"],
    ["failed", "failed"],
    [null, "idle"],
    [undefined, "idle"],
  ] as const)("maps %s to %s", (backend, frontend) => {
    expect(mapStageStatus(backend)).toBe(frontend);
  });
});

describe("toSession", () => {
  it("treats a session without analysis or stems as idle", () => {
    const s = toSession({ file_id: "f1", filename: "mix.wav" });
    expect(s).toMatchObject({
      file_id: "f1",
      file_name: "mix.wav",
      analysis: { status: "idle" },
      separation: { status: "idle", stems: [] },
    });
  });

  it("maps a completed analysis and stems with presigned URLs", () => {
    const s = toSession({
      file_id: "f1",
      analysis: { status: "completed", bpm: 123.6, key: "A minor", structure: ["intro"] },
      stems: {
        status: "completed",
        stems: [
          { name: "drums", url: "https://r2/drums.wav" },
          { name: "bass", url: "https://r2/bass.wav" },
          { name: "other", url: "https://r2/other.wav" },
          { name: "vocals", url: "https://r2/vocals.wav" },
          { name: "piano", url: "https://r2/piano.wav" },
        ],
      },
    });
    expect(s.analysis.status).toBe("completed");
    expect(s.analysis.result).toMatchObject({ key: "A minor", bpm: 123.6, tags: ["intro"] });
    expect(s.separation.stems.map((x) => [x.name, x.status, x.url])).toEqual([
      ["drums", "completed", "https://r2/drums.wav"],
      ["bass", "completed", "https://r2/bass.wav"],
      ["other", "completed", "https://r2/other.wav"],
      ["vocals", "completed", "https://r2/vocals.wav"],
    ]);
  });

  it("maps in-flight and failed stages", () => {
    const s = toSession({
      file_id: "f1",
      analysis: { status: "failed", message: "Decoder error.", next_action: "Re-upload." },
      stems: { status: "active", stems: [] },
    });
    expect(s.analysis).toMatchObject({ status: "failed", error: "Decoder error. Re-upload." });
    expect(s.separation.status).toBe("processing");
    expect(s.separation.stems.every((x) => x.status === "processing")).toBe(true);
  });
});

describe("apiFetch auth handling", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, pathname: "/studio", assign });
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok123" } } });
    auth.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    auth.getSession.mockReset();
    auth.signOut.mockReset();
  });

  it("sends the Supabase access token as a bearer token to /api/v1", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { file_id: "f1" }));

    await getSession("f1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/api/v1/session/f1`);
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok123");
  });

  it("clears the session and redirects to /login on 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Invalid token" }));

    const err = await getSession("f1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("reports network/CORS failures as status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const err = await getSession("f1").catch((e: unknown) => e);

    expect((err as ApiError).status).toBe(0);
    expect(describeError(err).title).toBe("Can't reach the server");
  });

  it("surfaces backend error detail for other statuses", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "Session not found" }));

    const err = await getSession("f1").catch((e: unknown) => e);

    expect(err).toMatchObject({ status: 404, message: "Session not found" });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("describeError", () => {
  it.each([
    [413, "File too large"],
    [415, "Unsupported file"],
    [429, "Too many requests"],
    [401, "Signed out"],
  ])("gives a friendly title for %i", (status, title) => {
    expect(describeError(new ApiError(status, "x")).title).toBe(title);
  });
});

describe("validateUpload", () => {
  const file = (name: string, size: number) => {
    const f = new File(["x"], name);
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  it("returns the backend content type for WAV and MP3", () => {
    expect(validateUpload(file("a.WAV", 10))).toBe("audio/wav");
    expect(validateUpload(file("a.mp3", 10))).toBe("audio/mpeg");
  });

  it("rejects other types and files over 100 MB", () => {
    expect(() => validateUpload(file("a.flac", 10))).toThrow(
      expect.objectContaining({ status: 415 }),
    );
    expect(() => validateUpload(file("a.wav", 100 * 1024 * 1024 + 1))).toThrow(
      expect.objectContaining({ status: 413 }),
    );
  });
});
