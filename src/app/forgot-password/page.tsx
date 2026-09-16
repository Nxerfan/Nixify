"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();

  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  function validate() {
    const e = email.trim().toLowerCase();
    if (!e) {
      setError(t("errors.required"));
      return false;
    }
    if (!EMAIL_RE.test(e)) {
      setError(t("errors.invalidEmail"));
      return false;
    }
    setError(undefined);
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const payload = { email: email.trim().toLowerCase() };
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Always 200 (per spec, never reveal existence).
      await res.json().catch(() => ({}));
      toast({
        title: t("auth.forgotPassword.successTitle"),
        description: t("auth.forgotPassword.successDescription"),
      });
      router.push(`/reset-password?email=${encodeURIComponent(payload.email)}`);
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
          <CardTitle className="text-2xl">{t("auth.forgotPassword.title")}</CardTitle>
          <CardDescription>
            {t("auth.forgotPassword.subtitle")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.forgotPassword.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : undefined}
                disabled={submitting}
                required
              />
              {error && (
                <p id="email-error" className="text-xs text-destructive">
                  {error}
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
                  {t("auth.forgotPassword.submitting")}
                </>
              ) : (
                <>
                  {t("auth.forgotPassword.submit")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.forgotPassword.rememberedIt")}{" "}
              <Link
                href="/login"
                className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
              >
                {t("auth.forgotPassword.backToLogin")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
