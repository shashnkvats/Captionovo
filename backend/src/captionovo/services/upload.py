from dataclasses import dataclass

from captionovo.storage_paths import ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, infer_mime_type


class UploadVerificationError(Exception):
    pass


@dataclass
class VerifiedUpload:
    storage_path: str
    size_bytes: int
    mime_type: str | None
    content: bytes


class UploadService:
    def __init__(self, admin) -> None:
        self._admin = admin

    def verify_object(self, storage_path: str, expected_file_name: str) -> VerifiedUpload:
        result = self._admin.storage.from_("uploads").download(storage_path)
        if not result:
            raise UploadVerificationError("Uploaded file not found. Complete the upload first.")

        data = result if isinstance(result, bytes) else result
        size_bytes = len(data)

        if size_bytes == 0:
            raise UploadVerificationError("Uploaded file is empty.")

        if size_bytes > MAX_UPLOAD_BYTES:
            raise UploadVerificationError("File exceeds the maximum allowed size.")

        mime_type = infer_mime_type(expected_file_name)
        if mime_type and mime_type not in ALLOWED_MIME_TYPES:
            raise UploadVerificationError(f"Unsupported file type: {mime_type}")

        return VerifiedUpload(
            storage_path=storage_path,
            size_bytes=size_bytes,
            mime_type=mime_type,
            content=data,
        )
