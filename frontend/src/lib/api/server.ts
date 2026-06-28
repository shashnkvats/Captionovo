import { redirect, notFound } from "next/navigation";
import {
  apiFetch,
  ApiError,
  toCreditTransaction,
  toProject,
  toProjectDetail,
  toUserProfile,
  type ApiProjectDetail,
  type ApiProjectSummary,
  type ProfileResponse,
} from "@/lib/api";
import { getAccessToken } from "@/lib/supabase/server";
import type { CreditTransaction, Project } from "@/lib/types";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  return token;
}

export async function fetchProfile() {
  const token = await requireToken();
  const data = await apiFetch<ProfileResponse>("/profile", token);
  return {
    profile: toUserProfile(data),
    usageThisMonth: data.usageThisMonth,
    raw: data.profile,
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const token = await requireToken();
  const data = await apiFetch<{ projects: ApiProjectSummary[] }>("/projects", token);
  return data.projects.map(toProject);
}

export async function fetchProject(id: string): Promise<Project> {
  const token = await requireToken();
  try {
    const data = await apiFetch<{ project: ApiProjectDetail }>(`/projects/${id}`, token);
    return toProjectDetail(data.project);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function fetchTransactions(): Promise<CreditTransaction[]> {
  const token = await requireToken();
  const data = await apiFetch<{
    transactions: Array<{
      id: string;
      projectTitle: string;
      durationMinutes: number;
      creditsUsed: number;
      outputTypes: string[];
      date: string;
    }>;
  }>("/billing/transactions", token);
  return data.transactions.map(toCreditTransaction);
}

export async function updateProfile(body: {
  name?: string;
  defaultLanguage?: string;
  defaultTranscriptMode?: string;
  dataRetentionDays?: number;
  notificationEmail?: boolean;
}) {
  const token = await requireToken();
  return apiFetch<{ profile: ProfileResponse["profile"] }>("/profile", token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
