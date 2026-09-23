"use client";

import * as React from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const PHONE_RE = /^\+?[0-9]{7,15}$/;

type MeResponse = {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    fullName: string | null;
    phoneNumber: string | null;
    profileCompleted: boolean;
    plan: string;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();

  const [loading, setLoading] = React.useState(true);
  const [fullName, setFullName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [errors, setErrors] = React.useState<{
    fullName?: string;
    phoneNumber?: string;
  }>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/me", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login?next=/profile");
          return;
        }
        if (!res.ok) {
          toast({
            title: t("profile.complete.toast.loadFailed"),
            description: t("profile.complete.toast.loadFailedDesc"),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const data = (await res.json()) as MeResponse;
        setFullName(data.user.fullName ?? "");
        setPhoneNumber(data.user.phoneNumber ?? "");
        setLoading(false);
      } catch {
        if (!cancelled) {
          toast({
            title: t("profile.complete.toast.networkError"),
            description: t("profile.complete.toast.networkErrorDesc"),
            variant: "destructive",
          });
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, toast, t]);

  function validate() {
    const next: { fullName?: string; phoneNumber?: string } = {};
    if (!fullName.trim()) {
      next.fullName = t("profile.complete.fullNameRequired");
    } else if (fullName.trim().length > 100) {
      next.fullName = t("profile.complete.fullNameTooLong");
    }
    const phone = phoneNumber.trim();
    if (!phone) {
      next.phoneNumber = t("profile.complete.phoneRequired");
    } else if (!PHONE_RE.test(phone)) {
      next.phoneNumber = t("profile.complete.phoneInvalid");
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
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: t("profile.complete.toast.saved"),
          description: data?.message ?? t("profile.complete.toast.savedDesc"),
        });
        router.push("/dashboard");
        return;
      }
      toast({
        title: t("profile.complete.toast.saveFailed"),
        description: data?.message ?? t("profile.complete.toast.saveFailedDesc"),
        variant: "destructive",
      });
    } catch {
      toast({
        title: t("profile.complete.toast.networkError"),
        description: t("profile.complete.toast.networkErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-2 h-4 w-3/4" />
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("profile.complete.title")}</CardTitle>
          <CardDescription>
            {t("profile.complete.subtitle")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                {t("profile.complete.alert")}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("profile.complete.fullName")}</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder={t("profile.complete.fullNamePlaceholder")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={!!errors.fullName}
                aria-describedby={
                  errors.fullName ? "fullName-error" : undefined
                }
                disabled={submitting}
                required
                maxLength={100}
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-xs text-destructive">
                  {errors.fullName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">{t("profile.complete.phoneNumber")}</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                autoComplete="tel"
                inputMode="tel"
                placeholder={t("profile.complete.phonePlaceholder")}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                aria-invalid={!!errors.phoneNumber}
                aria-describedby={
                  errors.phoneNumber ? "phoneNumber-error" : "phoneNumber-help"
                }
                disabled={submitting}
                required
              />
              {!errors.phoneNumber && (
                <p id="phoneNumber-help" className="text-xs text-muted-foreground">
                  {t("profile.complete.phoneHelp")}
                </p>
              )}
              {errors.phoneNumber && (
                <p id="phoneNumber-error" className="text-xs text-destructive">
                  {errors.phoneNumber}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t("profile.complete.submitting")}
                </>
              ) : (
                <>
                  {t("profile.complete.submit")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
