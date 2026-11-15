import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const LOGIN_PATH = "/login";
export const POST_LOGIN_PATH = "/studio";

export const postLoginUrl = () => `${window.location.origin}${POST_LOGIN_PATH}`;

/** Route `beforeLoad` guard: redirects to /login when there is no Supabase session. */
export async function requireAuth(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: LOGIN_PATH });
}
