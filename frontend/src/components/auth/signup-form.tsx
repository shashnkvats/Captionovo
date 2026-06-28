"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthBrand, AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogle } from "@/lib/auth/oauth";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Check your email to confirm your account, then log in.");
    setLoading(false);
  }

  async function handleGoogleSignup() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await signInWithGoogle(supabase, "/dashboard");

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthBrand />
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Start transcribing in minutes</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleGoogleSignup}
              disabled={loading}
            >
              Continue with Google
            </Button>
            <div className="relative text-center text-xs text-zinc-400">
              <span className="bg-white px-2 dark:bg-zinc-900">or</span>
              <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
