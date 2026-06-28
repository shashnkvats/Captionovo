export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      billing_events: {
        Row: {
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string;
          stripe_event_id: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          created_at: string;
          credits_used: number;
          duration_minutes: number;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          output_types: string[];
          project_id: string | null;
          project_title: string;
          stripe_payment_intent_id: string | null;
          transaction_type: Database["public"]["Enums"]["credit_transaction_type"];
          user_id: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      credit_packs: {
        Row: {
          active: boolean;
          created_at: string;
          credits: number;
          id: string;
          name: string;
          price_cents: number;
          sort_order: number;
          stripe_price_id: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      exports: {
        Row: {
          created_at: string;
          file_size_bytes: number | null;
          format: string;
          id: string;
          project_id: string;
          status: Database["public"]["Enums"]["export_state"];
          storage_path: string | null;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          credits_remaining: number;
          credits_reserved: number;
          data_retention_days: number;
          default_language: Database["public"]["Enums"]["language_code"];
          default_subtitle_style: Json;
          default_transcript_mode: Database["public"]["Enums"]["transcript_mode"];
          email: string | null;
          id: string;
          name: string | null;
          notification_email: boolean;
          plan_name: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      processing_events: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          job_id: string | null;
          message: string | null;
          metadata: Json;
          project_id: string;
          stage: string;
          started_at: string;
          status: Database["public"]["Enums"]["processing_event_status"];
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      processing_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          current_step: Database["public"]["Enums"]["processing_state"] | null;
          error_message: string | null;
          id: string;
          idempotency_key: string | null;
          job_type: Database["public"]["Enums"]["job_type"];
          last_error: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: Json;
          project_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      project_files: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          expires_at: string | null;
          file_type: Database["public"]["Enums"]["project_file_type"];
          id: string;
          mime_type: string | null;
          project_id: string;
          size_bytes: number | null;
          storage_bucket: string;
          storage_path: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      projects: {
        Row: {
          created_at: string;
          credits_reserved: number;
          credits_used: number;
          deleted_at: string | null;
          duration_minutes: number;
          file_name: string;
          id: string;
          language: Database["public"]["Enums"]["language_code"];
          media_expires_at: string | null;
          media_type: Database["public"]["Enums"]["media_type"];
          outputs: string[];
          processing_state: Database["public"]["Enums"]["processing_state"];
          reservation_idempotency_key: string | null;
          status: Database["public"]["Enums"]["project_status"];
          storage_path: string | null;
          title: string;
          transcript_mode: Database["public"]["Enums"]["transcript_mode"];
          updated_at: string;
          upload_status: Database["public"]["Enums"]["upload_status"];
          user_id: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      repurpose_outputs: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          output_type: string;
          project_id: string;
          status: Database["public"]["Enums"]["repurpose_status"];
          title: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      speakers: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          project_id: string;
          speaker_key: string;
          speaking_percent: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      subtitle_segments: {
        Row: {
          created_at: string;
          end_ms: number;
          id: string;
          project_id: string;
          sort_order: number;
          start_ms: number;
          text: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      transcript_segments: {
        Row: {
          confidence: number | null;
          created_at: string;
          end_ms: number;
          id: string;
          project_id: string;
          sort_order: number;
          speaker_id: string | null;
          start_ms: number;
          text: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      user_owns_project: { Args: { p_project_id: string }; Returns: boolean };
    };
    Enums: {
      credit_transaction_type:
        | "usage"
        | "purchase"
        | "bonus"
        | "refund"
        | "adjustment"
        | "reserve"
        | "release";
      export_state: "not_generated" | "generating" | "ready" | "failed" | "expired";
      job_status: "queued" | "running" | "completed" | "failed" | "cancelled";
      job_type: "project_pipeline" | "export" | "repurpose" | "burn_subtitles";
      language_code: "auto" | "english" | "hindi" | "hinglish";
      media_type: "audio" | "video";
      processing_event_status:
        | "started"
        | "completed"
        | "failed"
        | "retrying"
        | "skipped";
      processing_state:
        | "queued"
        | "extracting_audio"
        | "detecting_language"
        | "transcribing"
        | "persisting_transcript"
        | "transcript_ready"
        | "diarizing_speakers"
        | "generating_subtitles"
        | "generating_summary"
        | "rendering_video"
        | "preparing_editor"
        | "completed"
        | "partially_completed"
        | "failed";
      project_file_type:
        | "source_video"
        | "source_audio"
        | "extracted_audio"
        | "transcript_txt"
        | "transcript_docx"
        | "subtitle_srt"
        | "subtitle_vtt"
        | "burned_video";
      project_status: "processing" | "completed" | "failed" | "partial" | "draft";
      repurpose_status: "ready" | "generating" | "failed";
      transcript_mode: "clean" | "verbatim";
      upload_status: "draft" | "uploading" | "ready_to_process";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type DefaultSchema = Database["public"];

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"];
