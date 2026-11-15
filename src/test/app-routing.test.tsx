import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, rootRouteId } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, onAuthStateChange: vi.fn(), signOut: vi.fn() } },
}));

import { routeTree } from "@/routeTree.gen";

const makeRouter = (path = "/") =>
  createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const matches = makeRouter().matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches the /login page", () => {
    expect(makeRouter().matchRoutes("/login").at(-1)?.routeId).toBe("/login");
  });
});

describe("Auth redirects", () => {
  beforeEach(() => getSession.mockReset());

  it("redirects unauthenticated users from /studio to /login", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const router = makeRouter("/studio");

    await router.load();

    expect(router.state.location.pathname).toBe("/login");
  });

  it("lets authenticated users into /studio", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    const router = makeRouter("/studio");

    await router.load();

    expect(router.state.location.pathname).toBe("/studio");
  });

  it("sends signed-in users from /login to /studio", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    const router = makeRouter("/login");

    await router.load();

    expect(router.state.location.pathname).toBe("/studio");
  });
});
