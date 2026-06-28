import { SettingsForm } from "@/components/settings/settings-form";
import { fetchProfile } from "@/lib/api/server";

export default async function AccountSettingsPage() {
  const { raw } = await fetchProfile();

  return (
    <SettingsForm
      initial={{
        name: raw.name ?? "",
        email: raw.email ?? "",
        defaultLanguage: raw.defaultLanguage,
        defaultTranscriptMode: raw.defaultTranscriptMode,
        dataRetentionDays: raw.dataRetentionDays,
        notificationEmail: raw.notificationEmail,
      }}
    />
  );
}
