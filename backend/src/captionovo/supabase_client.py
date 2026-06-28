from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from captionovo.config import Settings


def create_admin_client(settings: Settings) -> Client:
    options = SyncClientOptions(persist_session=False, auto_refresh_token=False)
    return create_client(settings.supabase_url, settings.supabase_service_role_key, options=options)


def create_user_client(settings: Settings, access_token: str) -> Client:
    options = SyncClientOptions(
        persist_session=False,
        auto_refresh_token=False,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    return create_client(settings.supabase_url, settings.supabase_anon_key, options=options)
