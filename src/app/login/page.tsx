"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSafeRelativePath(p: string | null): string | null {
  if (!p) return null;
  // Only allow relative paths starting with "/" but not protocol-relative "//".
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  // Block obvious path traversal.
  if (p.includes("/.") || p.includes("\\") || p.includes("\0")) return null;
  return p;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{
    email?: string;
    password?: string;
  }>({});
  const [submitting, setSubmitting] = React.useState(false);

  function validate() {
    const next: { email?: string; password?: string } = {};
    const e = email.trim().toLowerCase();
    if (!e) {
      next.email = "Email is required";
    } else if (!EMAIL_RE.test(e)) {
      next.email = "Enter a valid email address";
    }
    if (!password) {
      next.password = "Password is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const payload = { email: email.trim().toLowerCase(), password };
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast({
          title: "Logged in",
          description: data?.message ?? "Welcome back.",
        });
        const next = isSafeRelativePath(searchParams.get("next"));
        if (next) {
          router.push(next);
        } else if (data?.profileCompleted) {
          router.push("/dashboard");
        } else {
          router.push("/profile");
        }
        return;
      }

      if (res.status === 403 && data?.error === "email_not_verified") {
        toast({
          title: "Email not verified",
          description:
            data?.message ?? "Please verify your email before logging in.",
          variant: "destructive",
          action: (
            <ToastAction
              altText="Verify your email"
              onClick={() =>
                router.push(
                  `/verify-email?email=${encodeURIComponent(payload.email)}`,
                )
              }
            >
              Verify email
            </ToastAction>
          ),
        });
        return;
      }

      if (res.status === 401) {
        toast({
          title: "Incorrect email or password",
          description: "Check your credentials and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Could not log in",
        description: data?.message ?? "Something went wrong.",
        variant: "destructive",
      });
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the server.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Log in to your Nixify account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                disabled={submitting}
                required
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                disabled={submitting}
                required
              />
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive">
                  {errors.password}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Logging in…
                </>
              ) : (
                <>
                  Log in
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-full" />
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </React.Suspense>
  );
}
