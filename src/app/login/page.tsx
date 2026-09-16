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
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

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
  const t = useTranslations();

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
      next.email = t("errors.required");
    } else if (!EMAIL_RE.test(e)) {
      next.email = t("errors.invalidEmail");
    }
    if (!password) {
      next.password = t("errors.required");
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
          title: t("auth.signIn.title"),
          description: data?.message ?? t("auth.signIn.subtitle"),
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
          title: t("auth.verifyEmail.title"),
          description:
            data?.message ?? t("auth.verifyEmail.subtitle"),
          variant: "destructive",
          action: (
            <ToastAction
              altText={t("auth.verifyEmail.title")}
              onClick={() =>
                router.push(
                  `/verify-email?email=${encodeURIComponent(payload.email)}`,
                )
              }
            >
              {t("auth.verifyEmail.title")}
            </ToastAction>
          ),
        });
        return;
      }

      if (res.status === 401) {
        toast({
          title: t("errors.generic"),
          description: data?.message ?? t("errors.generic"),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("errors.generic"),
        description: data?.message ?? t("errors.generic"),
        variant: "destructive",
      });
    } catch {
      toast({
        title: t("errors.networkError"),
        description: t("errors.networkError"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <div className="mb-4 flex justify-end">
        <LocaleSwitcher />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.signIn.title")}</CardTitle>
          <CardDescription>
            {t("auth.signIn.subtitle")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.signIn.email")}</Label>
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
                <Label htmlFor="password">{t("auth.signIn.password")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                >
                  {t("auth.signIn.forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
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
                  {t("auth.signIn.submitting")}
                </>
              ) : (
                <>
                  {t("auth.signIn.submit")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.signIn.noAccount")}{" "}
              <Link
                href="/signup"
                className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
              >
                {t("auth.signIn.signUpLink")}
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
