"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthBrand, AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { getOAuthErrorMessage, signInWithGoogle } from "@/lib/auth/oauth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const oauthCallbackError = getOAuthErrorMessage(searchParams.get("error"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await signInWithGoogle(supabase, redirect);

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
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Log in to upload and manage projects</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            {oauthCallbackError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {oauthCallbackError}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              Continue with Google
            </Button>
            <div className="relative text-center text-xs text-zinc-400">
              <span className="bg-white px-2 dark:bg-zinc-900">or</span>
              <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-zinc-200 dark:border-zinc-800" />
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
                required
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </Button>
            <p className="text-center text-sm text-zinc-500">
              No account?{" "}
              <Link href="/signup" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
