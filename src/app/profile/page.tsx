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

const PHONE_RE = /^\+?[0-9]{7,15}$/;

type MeResponse = {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    fullName: string | null;
    phoneNumber: string | null;
    profileCompleted: boolean;
    trialStartedAt: string | null;
    trialExpiresAt: string | null;
  };
  trial: {
    active: boolean;
    daysRemaining: number;
    expiresAt: string | null;
    startedAt: string | null;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();

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
            title: "Could not load profile",
            description: "Please try again.",
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
            title: "Network error",
            description: "Could not reach the server.",
            variant: "destructive",
          });
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, toast]);

  function validate() {
    const next: { fullName?: string; phoneNumber?: string } = {};
    if (!fullName.trim()) {
      next.fullName = "Full name is required";
    } else if (fullName.trim().length > 100) {
      next.fullName = "Full name is too long";
    }
    const phone = phoneNumber.trim();
    if (!phone) {
      next.phoneNumber = "Phone number is required";
    } else if (!PHONE_RE.test(phone)) {
      next.phoneNumber = "Enter a valid phone number (optional +, 7–15 digits)";
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
          title: "Trial activated!",
          description:
            data?.message ?? "Your profile is complete. Your Free plan is active.",
        });
        router.push("/dashboard");
        return;
      }
      toast({
        title: "Could not save profile",
        description: data?.message ?? "Please check your details and try again.",
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
          <CardTitle className="text-2xl">Complete your profile</CardTitle>
          <CardDescription>
            Add your name and phone number to complete your profile and activate your Free plan.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Completing your profile activates your Free plan immediately.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Ada Lovelace"
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
              <Label htmlFor="phoneNumber">Phone number</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+1 555 123 4567"
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
                  Optional country code (+) then 7–15 digits.
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
                  Saving…
                </>
              ) : (
                <>
                  Save &amp; complete profile
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
