"use client";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
            <Settings className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
            <p className="text-sm text-gray-500">Manage your account and preferences.</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800/40 bg-gray-950/40 p-8 text-center backdrop-blur-xl">
          <p className="text-sm text-gray-500">Settings panel loads here.</p>
        </div>
      </div>
    </>
  );
}
