import Link from "next/link";
import { Sparkles } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-zinc-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold">Captionovo</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Upload once.
            <br />
            Get transcript, subtitles,
            <br />
            and reusable content.
          </h1>
          <p className="mt-4 max-w-md text-lg text-zinc-400">
            Transcription, speaker labels, subtitles, burned-in video, and
            creator repurposing — built for English, Hindi, and Hinglish.
          </p>
        </div>
        <p className="text-sm text-zinc-500">Creator-first transcription workspace</p>
      </div>
      <div className="flex w-full items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

export function AuthBrand() {
  return (
    <div className="mb-8 lg:hidden">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Captionovo
        </span>
      </Link>
    </div>
  );
}
