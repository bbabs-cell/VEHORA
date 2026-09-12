// GÉNÉRÉ depuis le projet Supabase VEHORA — ne pas modifier à la main.
// À régénérer après chaque migration :
//   MCP Supabase `generate_typescript_types`, ou la CLI Supabase.
//
// ATTENTION — les blocs `Relationships` ne sont PAS décoratifs : ce sont eux
// qui permettent à PostgREST de typer les jointures (`select('a, b(c)')`).
// Les omettre fait échouer la compilation avec un message trompeur
// (« could not find the relation between … »). Trois incidents sur ce projet.
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
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_profile_id_fkey';
            columns: ['actor_profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          full_name: string;
          id: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          phone_digits: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          phone_digits?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          phone_digits?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      inspection_zones: {
        Row: { code: string; id: string; is_active: boolean; label: string; sort_order: number };
        Insert: { code: string; id?: string; is_active?: boolean; label: string; sort_order: number };
        Update: { code?: string; id?: string; is_active?: boolean; label?: string; sort_order?: number };
        Relationships: [];
      };
      vehicle_inspections: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          organization_id: string;
          performed_at: string;
          performed_by: string | null;
          service_order_id: string | null;
          station_id: string | null;
          vehicle_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          performed_at?: string;
          performed_by?: string | null;
          service_order_id?: string | null;
          station_id?: string | null;
          vehicle_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          performed_at?: string;
          performed_by?: string | null;
          service_order_id?: string | null;
          station_id?: string | null;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicle_inspections_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_inspections_performed_by_fkey';
            columns: ['performed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_inspections_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_inspections_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      inspection_items: {
        Row: {
          comment: string | null;
          condition: Database['public']['Enums']['inspection_condition'];
          created_at: string;
          id: string;
          inspection_id: string;
          organization_id: string;
          zone_id: string;
        };
        Insert: {
          comment?: string | null;
          condition: Database['public']['Enums']['inspection_condition'];
          created_at?: string;
          id?: string;
          inspection_id: string;
          organization_id?: string;
          zone_id: string;
        };
        Update: {
          comment?: string | null;
          condition?: Database['public']['Enums']['inspection_condition'];
          created_at?: string;
          id?: string;
          inspection_id?: string;
          organization_id?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inspection_items_inspection_id_fkey';
            columns: ['inspection_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_inspections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inspection_items_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'inspection_zones';
            referencedColumns: ['id'];
          },
        ];
      };
      inspection_photos: {
        Row: {
          created_by: string | null;
          id: string;
          inspection_id: string;
          item_id: string | null;
          organization_id: string;
          storage_path: string;
          taken_at: string;
        };
        Insert: {
          created_by?: string | null;
          id?: string;
          inspection_id: string;
          item_id?: string | null;
          organization_id?: string;
          storage_path: string;
          taken_at?: string;
        };
        Update: {
          created_by?: string | null;
          id?: string;
          inspection_id?: string;
          item_id?: string | null;
          organization_id?: string;
          storage_path?: string;
          taken_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inspection_photos_inspection_id_fkey';
            columns: ['inspection_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_inspections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inspection_photos_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inspection_items';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_types: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          id: string;
          make: string | null;
          model: string | null;
          notes: string | null;
          organization_id: string;
          plate: string | null;
          plate_normalized: string | null;
          updated_at: string;
          vehicle_type_id: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          notes?: string | null;
          organization_id?: string;
          plate?: string | null;
          plate_normalized?: never;
          updated_at?: string;
          vehicle_type_id: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          notes?: string | null;
          organization_id?: string;
          plate?: string | null;
          plate_normalized?: never;
          updated_at?: string;
          vehicle_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vehicles_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'organization_settings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_permissions_permission_key_fkey';
            columns: ['permission_key'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['key'];
          },
        ];
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
      service_categories: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_categories_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          duration_minutes: number | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          duration_minutes?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          duration_minutes?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'service_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      service_prices: {
        Row: {
          id: string;
          organization_id: string;
          service_id: string;
          vehicle_type_id: string | null;
          station_id: string | null;
          amount_minor: number;
          currency: string;
          valid_from: string;
          valid_to: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          service_id: string;
          vehicle_type_id?: string | null;
          station_id?: string | null;
          amount_minor: number;
          currency?: string;
          valid_from?: string;
          valid_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          service_id?: string;
          vehicle_type_id?: string | null;
          station_id?: string | null;
          amount_minor?: number;
          currency?: string;
          valid_from?: string;
          valid_to?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_prices_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_prices_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_prices_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_prices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      service_orders: {
        Row: {
          id: string;
          organization_id: string;
          station_id: string;
          number: number;
          customer_id: string | null;
          vehicle_id: string;
          status: Database['public']['Enums']['service_order_status'];
          notes: string | null;
          arrived_at: string;
          started_at: string | null;
          completed_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string;
          station_id: string;
          number?: number;
          customer_id?: string | null;
          vehicle_id: string;
          status?: Database['public']['Enums']['service_order_status'];
          notes?: string | null;
          arrived_at?: string;
          created_by?: string | null;
        };
        Update: {
          customer_id?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_items: {
        Row: {
          id: string;
          organization_id: string;
          service_order_id: string;
          service_id: string;
          service_name: string;
          price_id: string | null;
          unit_amount_minor: number;
          currency: string;
          quantity: number;
          discount_amount_minor: number;
          line_total_minor: number;
          created_by: string | null;
          created_at: string;
        };
        /** `service_name`, `unit_amount_minor` et `currency` sont posés par la
         *  base : les envoyer est inutile, les croire serait une faille. */
        Insert: {
          id?: string;
          organization_id?: string;
          service_order_id: string;
          service_id: string;
          service_name?: string;
          unit_amount_minor?: number;
          currency?: string;
          quantity?: number;
          discount_amount_minor?: number;
          created_by?: string | null;
        };
        Update: {
          quantity?: number;
          discount_amount_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_items_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_items_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_status_history: {
        Row: {
          id: number;
          organization_id: string;
          service_order_id: string;
          from_status: Database['public']['Enums']['service_order_status'] | null;
          to_status: Database['public']['Enums']['service_order_status'];
          changed_by: string | null;
          changed_at: string;
          reason: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'service_order_status_history_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_transitions: {
        Row: {
          from_status: Database['public']['Enums']['service_order_status'];
          to_status: Database['public']['Enums']['service_order_status'];
          required_permission: string;
          condition_code: string | null;
          requires_reason: boolean;
          must_audit: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      session_revocations: {
        Row: { profile_id: string; reason: string | null; revoked_at: string };
        Insert: { profile_id: string; reason?: string | null; revoked_at?: string };
        Update: { profile_id?: string; reason?: string | null; revoked_at?: string };
        Relationships: [
          {
            foreignKeyName: 'session_revocations_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      station_users: {
        Row: { created_at: string; id: string; membership_id: string; station_id: string };
        Insert: { created_at?: string; id?: string; membership_id: string; station_id: string };
        Update: { created_at?: string; id?: string; membership_id?: string; station_id?: string };
        Relationships: [
          {
            foreignKeyName: 'station_users_membership_id_fkey';
            columns: ['membership_id'];
            isOneToOne: false;
            referencedRelation: 'organization_memberships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'station_users_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'stations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      service_order_totals: {
        Row: {
          service_order_id: string;
          organization_id: string;
          lignes: number;
          total_amount_minor: number;
          discount_amount_minor: number;
          currency: string | null;
        };
        /** Une vue agrégée n'a pas de clé étrangère : PostgREST ne peut pas
         *  l'embarquer dans une jointure. Elle se lit séparément. */
        Relationships: [];
      };
    };
    Functions: {
      remplacer_tarif: {
        Args: { p_price_id: string; p_amount_minor: number; p_valid_from?: string | null };
        Returns: string;
      };
      transitionner_dossier: {
        Args: { p_service_order_id: string; p_to_status: string; p_reason?: string | null };
        Returns: Database['public']['Tables']['service_orders']['Row'];
      };
      resoudre_prix: {
        Args: {
          p_service_id: string;
          p_vehicle_type_id?: string | null;
          p_station_id?: string | null;
          p_date?: string | null;
        };
        Returns: {
          price_id: string;
          amount_minor: number;
          currency: string;
          specificite: 'SERVICE_TYPE_STATION' | 'SERVICE_TYPE' | 'SERVICE_STATION' | 'SERVICE';
        }[];
      };
      rechercher_vehicules: {
        Args: { p_recherche?: string | null; p_limite?: number; p_decalage?: number };
        Returns: {
          id: string;
          organization_id: string;
          customer_id: string | null;
          vehicle_type_id: string;
          plate: string | null;
          plate_normalized: string | null;
          make: string | null;
          model: string | null;
          color: string | null;
          notes: string | null;
          created_at: string;
          type_label: string;
          customer_name: string | null;
        }[];
      };
      rechercher_clients: {
        Args: { p_recherche?: string | null; p_limite?: number; p_decalage?: number };
        Returns: Database['public']['Tables']['customers']['Row'][];
      };
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
      inspection_condition: 'OK' | 'ANOMALY';
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
