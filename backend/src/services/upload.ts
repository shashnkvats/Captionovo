import type { AppSupabaseClient } from "../lib/supabase.js";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, inferMimeType } from "../lib/storage-paths.js";

export interface VerifiedUpload {
  storagePath: string;
  sizeBytes: number;
  mimeType: string | null;
}

export class UploadVerificationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class UploadService {
  constructor(private readonly admin: AppSupabaseClient) {}

  async verifyObject(storagePath: string, expectedFileName: string): Promise<VerifiedUpload> {
    const { data, error } = await this.admin.storage.from("uploads").download(storagePath);

    if (error || !data) {
      throw new UploadVerificationError("Uploaded file not found. Complete the upload first.");
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const sizeBytes = buffer.length;

    if (sizeBytes === 0) {
      throw new UploadVerificationError("Uploaded file is empty.");
    }

    if (sizeBytes > MAX_UPLOAD_BYTES) {
      throw new UploadVerificationError("File exceeds the maximum allowed size.");
    }

    const mimeType = data.type || inferMimeType(expectedFileName);
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new UploadVerificationError(`Unsupported file type: ${mimeType}`);
    }

    return { storagePath, sizeBytes, mimeType };
  }
}
