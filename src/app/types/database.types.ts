// GÉNÉRÉ depuis le projet Supabase VEHORA — ne pas modifier à la main.
// À régénérer après chaque migration :
//   MCP Supabase `generate_typescript_types`, ou la CLI Supabase.
// Toute divergence avec la base se voit immédiatement : la compilation stricte
// et les tests de parcours échouent.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_label: string | null;
          actor_profile_id: string | null;
          context: Json;
          id: number;
          new_value: Json | null;
          occurred_at: string;
          old_value: Json | null;
          organization_id: string | null;
          reason: string | null;
          resource_id: string | null;
          resource_type: string;
          station_id: string | null;
        };
        Insert: {
          action: string;
          actor_label?: string | null;
          actor_profile_id?: string | null;
          context?: Json;
          id?: never;
          new_value?: Json | null;
          occurred_at?: string;
          old_value?: Json | null;
          organization_id?: string | null;
          reason?: string | null;
          resource_id?: string | null;
          resource_type: string;
          station_id?: string | null;
        };
        Update: {
          action?: string;
          actor_label?: string | null;
          actor_profile_id?: string | null;
          context?: Json;
          id?: never;
          new_value?: Json | null;
          occurred_at?: string;
          old_value?: Json | null;
          organization_id?: string | null;
          reason?: string | null;
          resource_id?: string | null;
          resource_type?: string;
          station_id?: string | null;
        };
        Relationships: [];
      };
      organization_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          organization_id: string;
          role_id: string;
          status: Database['public']['Enums']['invitation_status'];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id?: string;
          role_id: string;
          status?: Database['public']['Enums']['invitation_status'];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id?: string;
          role_id?: string;
          status?: Database['public']['Enums']['invitation_status'];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_invitations_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_memberships: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          organization_id: string;
          profile_id: string;
          role_id: string;
          status: Database['public']['Enums']['membership_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id: string;
          profile_id: string;
          role_id: string;
          status?: Database['public']['Enums']['membership_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          organization_id?: string;
          profile_id?: string;
          role_id?: string;
          status?: Database['public']['Enums']['membership_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_memberships_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_memberships_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_settings: {
        Row: {
          max_discount_percent: number;
          organization_id: string;
          payment_before_delivery: Database['public']['Enums']['payment_before_delivery_rule'];
          require_inspection: boolean;
          require_quality_control: boolean;
          updated_at: string;
        };
        Insert: {
          max_discount_percent?: number;
          organization_id: string;
          payment_before_delivery?: Database['public']['Enums']['payment_before_delivery_rule'];
          require_inspection?: boolean;
          require_quality_control?: boolean;
          updated_at?: string;
        };
        Update: {
          max_discount_percent?: number;
          organization_id?: string;
          payment_before_delivery?: Database['public']['Enums']['payment_before_delivery_rule'];
          require_inspection?: boolean;
          require_quality_control?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          address: string | null;
          city: string | null;
          country_code: string;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          locale: string;
          logo_path: string | null;
          name: string;
          phone: string | null;
          slug: string;
          status: Database['public']['Enums']['organization_status'];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          country_code: string;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          locale?: string;
          logo_path?: string | null;
          name: string;
          phone?: string | null;
          slug: string;
          status?: Database['public']['Enums']['organization_status'];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          country_code?: string;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          locale?: string;
          logo_path?: string | null;
          name?: string;
          phone?: string | null;
          slug?: string;
          status?: Database['public']['Enums']['organization_status'];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: { created_at: string; description: string; key: string };
        Insert: { created_at?: string; description: string; key: string };
        Update: { created_at?: string; description?: string; key?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          full_name: string;
          id: string;
          locale: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: { permission_key: string; role_id: string };
        Insert: { permission_key: string; role_id: string };
        Update: { permission_key?: string; role_id?: string };
        Relationships: [];
      };
      roles: {
        Row: {
          code: string;
          created_at: string;
          description: string;
          id: string;
          is_system: boolean;
          label: string;
          scope: Database['public']['Enums']['role_scope'];
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_system?: boolean;
          label: string;
          scope: Database['public']['Enums']['role_scope'];
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_system?: boolean;
          label?: string;
          scope?: Database['public']['Enums']['role_scope'];
        };
        Relationships: [];
      };
      session_revocations: {
        Row: { profile_id: string; reason: string | null; revoked_at: string };
        Insert: { profile_id: string; reason?: string | null; revoked_at?: string };
        Update: { profile_id?: string; reason?: string | null; revoked_at?: string };
        Relationships: [];
      };
      station_users: {
        Row: { created_at: string; id: string; membership_id: string; station_id: string };
        Insert: { created_at?: string; id?: string; membership_id: string; station_id: string };
        Update: { created_at?: string; id?: string; membership_id?: string; station_id?: string };
        Relationships: [];
      };
      stations: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['station_kind'];
          name: string;
          organization_id: string;
          phone: string | null;
          status: Database['public']['Enums']['station_status'];
          timezone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['station_kind'];
          name: string;
          organization_id: string;
          phone?: string | null;
          status?: Database['public']['Enums']['station_status'];
          timezone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['station_kind'];
          name?: string;
          organization_id?: string;
          phone?: string | null;
          status?: Database['public']['Enums']['station_status'];
          timezone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      accepter_invitation: {
        Args: { p_token: string };
        Returns: string;
      };
      provisionner_organisation: {
        Args: {
          p_nom: string;
          p_pays: string;
          p_ville?: string | null;
          p_nom_station?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      invitation_status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
      membership_status: 'ACTIVE' | 'SUSPENDED';
      organization_status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'DEACTIVATED';
      payment_before_delivery_rule: 'STRICT' | 'ALLOW_DEBT';
      role_scope: 'PLATFORM' | 'ORGANIZATION' | 'STATION';
      service_order_status:
        | 'ARRIVED'
        | 'INSPECTION'
        | 'WAITING'
        | 'IN_PROGRESS'
        | 'CONTROL'
        | 'READY'
        | 'DELIVERED'
        | 'CANCELLED';
      station_kind: 'FIXED' | 'MOBILE';
      station_status: 'ACTIVE' | 'INACTIVE';
    };
    CompositeTypes: Record<never, never>;
  };
};

type DefaultSchema = Database['public'];

export type Tables<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T]['Update'];
export type Enums<T extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][T];
