"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const INVALID_MESSAGE = "The unsubscribe link is invalid or has expired.";

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Skeleton className="h-64 w-full max-w-md rounded-lg" /></div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "confirming" | "success" | "invalid" | "error">("loading");
  const [emailMasked, setEmailMasked] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchInfo() {
      if (!token) {
        if (!cancelled) setStatus("invalid");
        return;
      }
      try {
        const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setEmailMasked(data.email_masked ?? null);
          setStatus("confirming");
        } else {
          setStatus("invalid");
        }
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    }
    fetchInfo();
    return () => { cancelled = true; };
  }, [token]);

  async function handleConfirm() {
    if (!token) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
      } else {
        setStatus("invalid");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Unsubscribe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{INVALID_MESSAGE}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Unsubscribed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have been unsubscribed from marketing emails. This action may take a few minutes to take effect.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">An error occurred. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirming
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirm Unsubscribe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailMasked && (
            <p className="text-sm text-muted-foreground">
              You are about to unsubscribe <span className="font-mono">{emailMasked}</span> from marketing emails.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            You will no longer receive marketing emails. Transactional emails (password reset, security notifications) are not affected.
          </p>
          <Button onClick={handleConfirm} className="w-full bg-rose-600 text-white hover:bg-rose-500">
            <Loader2 className="mr-2 h-4 w-4 hidden" />
            Confirm Unsubscribe
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
