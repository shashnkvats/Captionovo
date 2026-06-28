import { UploadForm } from "@/components/upload/upload-form";
import { fetchProfile } from "@/lib/api/server";

export default async function UploadPage() {
  const { profile } = await fetchProfile();
  return <UploadForm profile={profile} />;
}
