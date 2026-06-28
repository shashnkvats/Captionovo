class InsufficientCreditsError(Exception):
    def __init__(self, credits_remaining: int, credits_needed: int) -> None:
        super().__init__("Insufficient credits")
        self.credits_remaining = credits_remaining
        self.credits_needed = credits_needed


class CreditsService:
    def __init__(self, admin) -> None:
        self._admin = admin

    def get_available_credits(self, user_id: str) -> int:
        result = (
            self._admin.table("profiles")
            .select("credits_remaining, credits_reserved")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not result.data:
            raise RuntimeError("Profile not found")
        data = result.data
        return data["credits_remaining"] - data["credits_reserved"]

    def reserve(self, reservation) -> None:
        existing = (
            self._admin.table("credit_transactions")
            .select("id")
            .eq("idempotency_key", reservation.idempotency_key)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return

        profile_result = (
            self._admin.table("profiles")
            .select("credits_remaining, credits_reserved")
            .eq("id", reservation.user_id)
            .single()
            .execute()
        )
        if not profile_result.data:
            raise RuntimeError("Profile not found")

        profile = profile_result.data
        available = profile["credits_remaining"] - profile["credits_reserved"]
        if available < reservation.amount:
            raise InsufficientCreditsError(available, reservation.amount)

        self._admin.table("profiles").update(
            {"credits_reserved": profile["credits_reserved"] + reservation.amount}
        ).eq("id", reservation.user_id).execute()

        self._admin.table("projects").update(
            {
                "credits_reserved": reservation.amount,
                "duration_minutes": reservation.duration_minutes,
                "reservation_idempotency_key": reservation.idempotency_key,
            }
        ).eq("id", reservation.project_id).execute()

        self._admin.table("credit_transactions").insert(
            {
                "user_id": reservation.user_id,
                "project_id": reservation.project_id,
                "project_title": reservation.project_title,
                "duration_minutes": reservation.duration_minutes,
                "credits_used": reservation.amount,
                "output_types": reservation.output_types,
                "transaction_type": "reserve",
                "idempotency_key": reservation.idempotency_key,
            }
        ).execute()

    def release(self, project_id: str, user_id: str) -> None:
        idempotency_key = f"release:{project_id}"
        existing = (
            self._admin.table("credit_transactions")
            .select("id")
            .eq("idempotency_key", idempotency_key)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return

        project_result = (
            self._admin.table("projects")
            .select("credits_reserved, title, duration_minutes, outputs")
            .eq("id", project_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not project_result.data or project_result.data["credits_reserved"] <= 0:
            return

        project = project_result.data
        profile_result = (
            self._admin.table("profiles")
            .select("credits_reserved")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not profile_result.data:
            raise RuntimeError("Profile not found")

        profile = profile_result.data
        self._admin.table("profiles").update(
            {"credits_reserved": max(0, profile["credits_reserved"] - project["credits_reserved"])}
        ).eq("id", user_id).execute()

        self._admin.table("projects").update(
            {"credits_reserved": 0, "reservation_idempotency_key": None}
        ).eq("id", project_id).execute()

        self._admin.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "project_id": project_id,
                "project_title": project["title"],
                "duration_minutes": project["duration_minutes"],
                "credits_used": project["credits_reserved"],
                "output_types": project["outputs"],
                "transaction_type": "release",
                "idempotency_key": idempotency_key,
            }
        ).execute()

    def commit_from_reservation(self, project_id: str, user_id: str) -> None:
        idempotency_key = f"usage:{project_id}"
        existing = (
            self._admin.table("credit_transactions")
            .select("id")
            .eq("idempotency_key", idempotency_key)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return

        project_result = (
            self._admin.table("projects")
            .select("title, duration_minutes, outputs, credits_reserved, credits_used")
            .eq("id", project_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not project_result.data:
            raise RuntimeError("Project not found")

        project = project_result.data
        amount = project["credits_reserved"] or project["duration_minutes"] or 1

        profile_result = (
            self._admin.table("profiles")
            .select("credits_remaining, credits_reserved")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not profile_result.data:
            raise RuntimeError("Profile not found")

        profile = profile_result.data
        self._admin.table("profiles").update(
            {
                "credits_remaining": max(0, profile["credits_remaining"] - amount),
                "credits_reserved": max(
                    0, profile["credits_reserved"] - (project["credits_reserved"] or amount)
                ),
            }
        ).eq("id", user_id).execute()

        self._admin.table("projects").update(
            {"credits_used": amount, "credits_reserved": 0, "reservation_idempotency_key": None}
        ).eq("id", project_id).execute()

        self._admin.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "project_id": project_id,
                "project_title": project["title"],
                "duration_minutes": project["duration_minutes"],
                "credits_used": amount,
                "output_types": project["outputs"],
                "transaction_type": "usage",
                "idempotency_key": idempotency_key,
            }
        ).execute()

    def grant_credits(
        self,
        user_id: str,
        amount: int,
        tx_type: str,
        metadata: dict | None = None,
    ) -> None:
        profile_result = (
            self._admin.table("profiles")
            .select("credits_remaining")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not profile_result.data:
            raise RuntimeError("Profile not found")

        profile = profile_result.data
        self._admin.table("profiles").update(
            {"credits_remaining": profile["credits_remaining"] + amount}
        ).eq("id", user_id).execute()

        self._admin.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "project_id": None,
                "project_title": "Credit purchase" if tx_type == "purchase" else "Credit adjustment",
                "duration_minutes": 0,
                "credits_used": -amount,
                "output_types": [],
                "transaction_type": tx_type,
                "metadata": metadata or {},
            }
        ).execute()
