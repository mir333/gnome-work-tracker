import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn, authClient } from "@/lib/auth-client";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Fingerprint } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await signIn.username({ username, password });
    if (error) {
      setError(error.message || "Invalid credentials");
    } else {
      navigate("/");
    }
  }

  async function handlePasskeySignIn() {
    setError("");
    setPasskeyLoading(true);
    try {
      const { error } = await authClient.signIn.passkey();
      if (error) {
        setError(String(error.message || "Passkey sign-in failed"));
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err?.message || "Passkey sign-in failed. Make sure your browser supports WebAuthn.");
    }
    setPasskeyLoading(false);
  }

  return (
    <AuthLayout title="Login">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username webauthn"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Login
        </Button>
      </form>

      <div className="relative my-6">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
          or
        </span>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={handlePasskeySignIn}
        disabled={passkeyLoading}
      >
        <Fingerprint className="mr-2 h-4 w-4" />
        {passkeyLoading ? "Waiting for passkey..." : "Sign in with Passkey"}
      </Button>

      <p className="text-sm text-center mt-4">
        No account?{" "}
        <Link to="/register" className="underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
