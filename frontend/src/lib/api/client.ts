"use client";

import {
  apiFetch,
  type ApiProjectSummary,
  type ProfileResponse,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

async function getToken() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return session.access_token;
}

export async function createProject(body: {
  title: string;
  fileName: string;
  mediaType?: "audio" | "video";
  durationMinutes: number;
  language: string;
  outputs: string[];
  transcriptMode: "clean" | "verbatim";
}) {
  const token = await getToken();
  return apiFetch<{ project: ApiProjectSummary }>("/projects", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getUploadUrl(projectId: string) {
  const token = await getToken();
  return apiFetch<{ uploadUrl: string; token: string; path: string }>(
    `/projects/${projectId}/upload-url`,
    token,
    { method: "POST" },
  );
}

export async function confirmUpload(projectId: string, durationMinutes?: number) {
  const token = await getToken();
  return apiFetch<{
    message: string;
    project: ApiProjectSummary;
    durationMinutes: number;
    creditsReserved: number;
  }>(`/projects/${projectId}/confirm-upload`, token, {
    method: "POST",
    body: JSON.stringify(durationMinutes ? { durationMinutes } : {}),
  });
}

export async function startProcessing(projectId: string) {
  const token = await getToken();
  return apiFetch<{ message: string; projectId: string }>(
    `/projects/${projectId}/process`,
    token,
    { method: "POST" },
  );
}

export async function fetchProfileClient() {
  const token = await getToken();
  return apiFetch<ProfileResponse>("/profile", token);
}

export async function updateProfileClient(body: {
  name?: string;
  defaultLanguage?: string;
  defaultTranscriptMode?: string;
  dataRetentionDays?: number;
  notificationEmail?: boolean;
}) {
  const token = await getToken();
  return apiFetch<{ profile: ProfileResponse["profile"] }>("/profile", token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
