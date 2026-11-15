import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { POST_LOGIN_PATH, postLoginUrl } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Stemlab" },
      { name: "description", content: "Sign in to Stemlab to analyze tracks and separate stems." },
    ],
  }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) throw redirect({ to: POST_LOGIN_PATH });
  },
  component: Login,
});

type Mode = "signin" | "signup";

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        await navigate({ to: POST_LOGIN_PATH });
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: postLoginUrl() },
        });
        if (err) throw err;
        if (data.session) await navigate({ to: POST_LOGIN_PATH });
        else setNotice("Check your inbox to confirm your email, then sign in.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: postLoginUrl() },
    });
    if (err) setError(err.message);
  };

  return (
    <div className="min-h-screen font-sans">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {mode === "signin" ? "Sign in" : "Create an account"}
            </CardTitle>
            <CardDescription>Sign in to upload tracks and separate stems.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {notice && (
                <Alert>
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              or
              <Separator className="flex-1" />
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
