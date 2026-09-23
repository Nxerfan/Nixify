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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Ltr } from "@/lib/i18n/Ltr";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();

  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (code.length !== 6) {
      toast({
        title: t("auth.verifyEmail.enterFullCode"),
        description: t("auth.verifyEmail.codeLengthHint"),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: t("auth.verifyEmail.successTitle"),
          description: data?.message ?? t("auth.verifyEmail.successDescription"),
        });
        router.push("/profile");
        return;
      }
      toast({
        title: t("auth.verifyEmail.verificationFailed"),
        description: data?.message ?? t("auth.verifyEmail.invalidCode"),
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
        body: JSON.stringify({ email, purpose: "signup" }),
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
        <CardTitle className="text-2xl">{t("auth.verifyEmail.enterCodeTitle")}</CardTitle>
        <CardDescription>
          {t("auth.verifyEmail.subtitle")}{" "}
          <Ltr className="font-medium text-foreground">{email}</Ltr>.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onVerify}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <span className="sr-only" id="code-label">
              {t("auth.verifyEmail.code")}
            </span>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => setCode(v)}
              aria-label={t("auth.verifyEmail.code")}
              aria-describedby="code-label"
              disabled={submitting}
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
                {t("auth.verifyEmail.verifying")}
              </>
            ) : (
              <>
                {t("auth.verifyEmail.verify")}
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
              href="/signup"
              className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
            >
              {t("auth.verifyEmail.backToSignUp")}
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
        <CardTitle className="text-2xl">{t("auth.verifyEmail.noEmailTitle")}</CardTitle>
        <CardDescription>
          {t("auth.verifyEmail.noEmailDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription>
            {t("auth.verifyEmail.noEmailAlert")}
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Link href="/signup">{t("auth.verifyEmail.noEmailAction")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <div className="mb-4 flex justify-end">
        <LocaleSwitcher />
      </div>
      {email ? <VerifyEmailForm email={email} /> : <NoEmailPrompt />}
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-12 sm:h-14 sm:w-14" />
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-9 w-full" />
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </React.Suspense>
  );
}
