import { AppShell } from "@/components/layout/app-shell";
import { fetchProfile } from "@/lib/api/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, usageThisMonth } = await fetchProfile();

  return (
    <AppShell profile={profile} usageThisMonth={usageThisMonth}>
      {children}
    </AppShell>
  );
}
