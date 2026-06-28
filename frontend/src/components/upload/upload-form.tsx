"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Upload, FileUp } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  confirmUpload,
  createProject,
  getUploadUrl,
  startProcessing,
} from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  LANGUAGE_OPTIONS,
  OUTPUT_OPTIONS,
  SUPPORTED_AUDIO,
  SUPPORTED_VIDEO,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/types";

function getMediaDurationMinutes(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const media = document.createElement(isVideo ? "video" : "audio");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const minutes = Math.max(1, Math.ceil(media.duration / 60));
      resolve(minutes);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(1);
    };
    media.src = url;
  });
}

function inferMediaType(fileName: string): "audio" | "video" | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (["mp3", "wav", "m4a"].includes(ext)) return "audio";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  return null;
}

export function UploadForm({
  profile,
}: {
  profile: UserProfile;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("auto");
  const [outputs, setOutputs] = useState<string[]>([
    "transcript",
    "speaker_labels",
    "subtitles",
    "summary",
  ]);
  const [transcriptMode, setTranscriptMode] = useState<"clean" | "verbatim">("clean");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const estimatedMinutes = file ? durationMinutes : 0;
  const hasCredits = profile.creditsRemaining >= estimatedMinutes;

  function toggleOutput(id: string) {
    setOutputs((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
  }

  async function handleFileSelect(selected: File | null) {
    setFile(selected);
    setError(null);
    if (!selected) return;

    const mediaType = inferMediaType(selected.name);
    if (!mediaType) {
      setError("Unsupported file format");
      setFile(null);
      return;
    }

    if (!title) {
      setTitle(selected.name.replace(/\.[^.]+$/, ""));
    }

    const minutes = await getMediaDurationMinutes(selected);
    setDurationMinutes(minutes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mediaType = inferMediaType(file.name);
      if (!mediaType) throw new Error("Unsupported file format");

      const { project } = await createProject({
        title: title || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        mediaType,
        durationMinutes,
        language,
        outputs,
        transcriptMode,
      });

      const { uploadUrl, token, path } = await getUploadUrl(project.id);

      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .uploadToSignedUrl(path, token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        // Fallback to direct PUT for older Supabase clients
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error("File upload failed");
      }

      await confirmUpload(project.id, durationMinutes);
      await startProcessing(project.id);
      router.push(`/projects/${project.id}/processing`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setError("Not enough credits for this upload");
      } else {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          New Upload
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload audio or video and choose what to generate
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-12 dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950">
                <FileUp className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {file ? file.name : "Drop your file here or click to browse"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Audio: {SUPPORTED_AUDIO.join(", ")} · Video: {SUPPORTED_VIDEO.join(", ")}
              </p>
              <label className="mt-4 cursor-pointer">
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,audio/*,video/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-8 items-center justify-center rounded-lg bg-white px-3 text-xs font-medium text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700">
                  Choose file
                </span>
              </label>
            </div>

            <div>
              <Label htmlFor="title">Project title</Label>
              <Input
                id="title"
                placeholder="Defaults to filename"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <Label>Language</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLanguage(opt.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition-colors",
                      language === opt.id
                        ? "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800"
                        : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Output options</Label>
              <div className="mt-2 space-y-2">
                {OUTPUT_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={outputs.includes(opt.id)}
                      onChange={() => toggleOutput(opt.id)}
                      className="mt-1 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {opt.label}
                      </p>
                      <p className="text-xs text-zinc-500">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Advanced settings
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")}
              />
            </button>

            {showAdvanced && (
              <div className="space-y-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={transcriptMode === "clean"}
                    onChange={() => setTranscriptMode("clean")}
                    className="text-indigo-600"
                  />
                  Clean transcript (default)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={transcriptMode === "verbatim"}
                    onChange={() => setTranscriptMode("verbatim")}
                    className="text-indigo-600"
                  />
                  Verbatim transcript
                </label>
              </div>
            )}

            <div
              className={cn(
                "rounded-lg p-4 text-sm",
                hasCredits || !file
                  ? "bg-zinc-50 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
              )}
            >
              {file ? (
                hasCredits ? (
                  <p>
                    Estimated cost: <strong>{estimatedMinutes} minutes</strong> · You have{" "}
                    {profile.creditsRemaining} remaining
                  </p>
                ) : (
                  <p>
                    You need{" "}
                    <strong>{estimatedMinutes - profile.creditsRemaining} more minutes</strong>.
                    <Link href="/billing" className="ml-1 font-medium underline">
                      Buy credits
                    </Link>
                  </p>
                )
              ) : (
                <p>Select a file to see the estimated cost.</p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!file || !hasCredits || loading}
            >
              <Upload className="h-4 w-4" />
              {loading ? "Uploading..." : "Start Processing"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
