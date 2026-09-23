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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Ltr } from "@/lib/i18n/Ltr";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();

  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{
    code?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function validate() {
    const next: typeof errors = {};
    if (code.length !== 6) {
      next.code = t("auth.resetPassword.resetCode");
    }
    if (!newPassword) {
      next.newPassword = t("errors.required");
    } else if (newPassword.length < 8) {
      next.newPassword = t("errors.tooShort");
    }
    if (confirmPassword !== newPassword) {
      next.confirmPassword = t("auth.resetPassword.mismatch");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: t("auth.resetPassword.success"),
          description: data?.message ?? t("auth.resetPassword.successDescription"),
        });
        router.push("/login");
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

  async function onResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "reset" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: t("auth.verifyEmail.codeResent"),
          description: data?.message ?? t("auth.verifyEmail.codeResentDescription"),
        });
        setCooldown(60);
      } else {
        toast({
          title: t("auth.verifyEmail.couldNotResend"),
          description: data?.message ?? t("auth.verifyEmail.couldNotResendDescription"),
          variant: "destructive",
        });
        if (res.status === 429) setCooldown(30);
      }
    } catch {
      toast({
        title: t("errors.networkError"),
        description: t("errors.networkError"),
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("auth.resetPassword.requestResetCodeTitle")}</CardTitle>
        <CardDescription>
          {t("auth.resetPassword.requestResetCodeDescription")}{" "}
          <Ltr className="font-medium text-foreground">{email}</Ltr>.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reset-code">{t("auth.resetPassword.resetCode")}</Label>
            <InputOTP
              id="reset-code"
              maxLength={6}
              value={code}
              onChange={(v) => setCode(v)}
              disabled={submitting}
              aria-label={t("auth.resetPassword.resetCode")}
              aria-invalid={!!errors.code}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                <InputOTPSlot
                  index={0}
                  className="h-12 w-12 text-lg sm:h-14 sm:w-14"
                />
                <InputOTPSlot
                  index={1}
                  className="h-12 w-12 text-lg sm:h-14 sm:w-14"
                />
                <InputOTPSlot
                  index={2}
                  className="h-12 w-12 text-lg sm:h-14 sm:w-14"
                />
                <InputOTPSlot
                  index={3}
                  className="h-12 w-12 text-lg sm:h-14 sm:w-14"
                />
                <InputOTPSlot
                  index={4}
                  className="h-12 w-12 text-lg sm:h-14 sm:w-14"
                />
                <InputOTPSlot
                  index={5}
                  className="h-12 w-12 text-lg sm:h-14 sm:w-14"
                />
              </InputOTPGroup>
            </InputOTP>
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("auth.resetPassword.password")}</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.resetPassword.password")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={!!errors.newPassword}
              aria-describedby={
                errors.newPassword ? "newPassword-error" : "newPassword-help"
              }
              disabled={submitting}
              required
              minLength={8}
            />
            {!errors.newPassword && (
              <p id="newPassword-help" className="text-xs text-muted-foreground">
                {t("auth.signUp.passwordHelp")}
              </p>
            )}
            {errors.newPassword && (
              <p id="newPassword-error" className="text-xs text-destructive">
                {errors.newPassword}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirm")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.resetPassword.confirm")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? "confirmPassword-error" : undefined
              }
              disabled={submitting}
              required
              minLength={8}
            />
            {errors.confirmPassword && (
              <p id="confirmPassword-error" className="text-xs text-destructive">
                {errors.confirmPassword}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t("auth.resetPassword.submitting")}
              </>
            ) : (
              <>
                {t("auth.resetPassword.submit")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
          <div className="flex w-full items-center justify-between text-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              disabled={resending || cooldown > 0}
              className="text-muted-foreground hover:text-foreground"
            >
              {resending
                ? t("auth.verifyEmail.sending")
                : cooldown > 0
                  ? `${t("auth.verifyEmail.resendIn")} ${cooldown}s`
                  : t("auth.verifyEmail.resend")}
            </Button>
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
            >
              {t("auth.resetPassword.backToResetRequest")}
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function NoEmailPrompt() {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("auth.resetPassword.noEmailTitle")}</CardTitle>
        <CardDescription>
          {t("auth.resetPassword.noEmailDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription>
            {t("auth.resetPassword.noEmailDescription")}
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Link href="/forgot-password">{t("auth.resetPassword.noEmailAction")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <div className="mb-4 flex justify-end">
        <LocaleSwitcher />
      </div>
      {email ? <ResetPasswordForm email={email} /> : <NoEmailPrompt />}
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-12 sm:h-14 sm:w-14" />
            ))}
          </div>
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

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
