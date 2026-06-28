"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { updateProfileClient } from "@/lib/api/client";
import type { Language, TranscriptMode } from "@/lib/types";

interface SettingsFormProps {
  initial: {
    name: string;
    email: string;
    defaultLanguage: Language;
    defaultTranscriptMode: TranscriptMode;
    dataRetentionDays: number;
    notificationEmail: boolean;
  };
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [defaultLanguage, setDefaultLanguage] = useState(initial.defaultLanguage);
  const [defaultTranscriptMode, setDefaultTranscriptMode] = useState(
    initial.defaultTranscriptMode,
  );
  const [dataRetentionDays, setDataRetentionDays] = useState(initial.dataRetentionDays);
  const [notificationEmail, setNotificationEmail] = useState(initial.notificationEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await updateProfileClient({
        name,
        defaultLanguage,
        defaultTranscriptMode,
        dataRetentionDays,
        notificationEmail,
      });
      setMessage("Settings saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Account Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Manage profile and default preferences</p>
      </div>

      <form onSubmit={handleSaveProfile}>
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Profile</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={initial.email} disabled />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Defaults</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Default language mode</Label>
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value as Language)}
              >
                <option value="auto">Auto-detect</option>
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
            <div>
              <Label>Default transcript style</Label>
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={defaultTranscriptMode}
                onChange={(e) =>
                  setDefaultTranscriptMode(e.target.value as TranscriptMode)
                }
              >
                <option value="clean">Clean transcript</option>
                <option value="verbatim">Verbatim transcript</option>
              </select>
            </div>
            <div>
              <Label>Data retention preference</Label>
              <select
                className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={dataRetentionDays}
                onChange={(e) => setDataRetentionDays(Number(e.target.value))}
              >
                <option value={30}>30-day media retention</option>
                <option value={7}>7-day media retention</option>
                <option value={1}>Delete after processing</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.checked)}
                className="rounded text-indigo-600"
              />
              Email me when processing completes
            </label>
            {message && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
            )}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Saving..." : "Save settings"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
