import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/elora-logo-light.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) {
    navigate({ to: "/" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await signIn(username, password);
    setBusy(false);
    if (error) return setErr(error);
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#15120e] bg-[radial-gradient(900px_500px_at_50%_-10%,rgba(201,169,110,0.22),transparent_60%)]">
      <Card className="w-full max-w-sm rounded-3xl border-[#3a3229] bg-[#1d1a16]/90 text-[#f4ede2] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] backdrop-blur">
        <CardHeader className="text-center pt-10 pb-4">
          <img src={logo} alt="Elora Labs" className="mx-auto h-28 w-auto object-contain" />
          <p className="mt-4 text-[10px] tracking-[0.34em] text-[#c9a96e]">OPERATING SYSTEM</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 pb-4">
            <div>
              <Label htmlFor="username" className="text-[11px] tracking-[0.2em] uppercase text-[#a99d89]">Username</Label>
              <Input
                id="username"
                className="mt-1.5 h-11 rounded-xl border-[#3a3229] bg-[#15120e] text-[#f4ede2]"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[11px] tracking-[0.2em] uppercase text-[#a99d89]">Password</Label>
              <Input id="password" className="mt-1.5 h-11 rounded-xl border-[#3a3229] bg-[#15120e] text-[#f4ede2]" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full h-11 rounded-full bg-[#c9a96e] text-[#15120e] hover:bg-[#dcbf86] tracking-[0.18em] text-xs font-semibold" disabled={busy}>
              {busy ? "SIGNING IN…" : "SIGN IN"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
