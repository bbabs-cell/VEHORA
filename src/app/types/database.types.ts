// GÉNÉRÉ depuis le projet Supabase VEHORA — ne pas modifier à la main.
// À régénérer après chaque migration :
//   MCP Supabase `generate_typescript_types`, ou la CLI Supabase.
//
// Ce fichier est, depuis la phase 22, la **sortie brute du générateur**,
// reformatée par Prettier et rien d'autre. Il l'a longtemps été « presque » :
// les blocs ajoutés à la main finissaient par diverger de la base, et quatre
// incidents sont venus des `Relationships` incomplets — ce sont eux qui typent
// les jointures PostgREST, et leur absence produit un message trompeur
// (« could not find the relation between … »).
//
// Toute divergence avec la base se voit maintenant immédiatement : la
// compilation stricte et les tests de parcours échouent.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
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
      cash_registers: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          closing_note: string | null;
          created_at: string;
          currency: string;
          declared_closing_minor: number | null;
          id: string;
          opened_at: string;
          opened_by: string;
          opening_float_minor: number;
          organization_id: string;
          station_id: string;
          status: Database['public']['Enums']['cash_register_status'];
          theoretical_minor: number | null;
          updated_at: string;
          variance_minor: number | null;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          closing_note?: string | null;
          created_at?: string;
          currency: string;
          declared_closing_minor?: number | null;
          id?: string;
          opened_at?: string;
          opened_by: string;
          opening_float_minor: number;
          organization_id?: string;
          station_id: string;
          status?: Database['public']['Enums']['cash_register_status'];
          theoretical_minor?: number | null;
          updated_at?: string;
          variance_minor?: number | null;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          closing_note?: string | null;
          created_at?: string;
          currency?: string;
          declared_closing_minor?: number | null;
          id?: string;
          opened_at?: string;
          opened_by?: string;
          opening_float_minor?: number;
          organization_id?: string;
          station_id?: string;
          status?: Database['public']['Enums']['cash_register_status'];
          theoretical_minor?: number | null;
          updated_at?: string;
          variance_minor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_registers_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_opened_by_fkey';
            columns: ['opened_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'cash_registers_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_transactions: {
        Row: {
          amount_minor: number;
          cash_register_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          kind: Database['public']['Enums']['cash_transaction_kind'];
          organization_id: string;
          payment_id: string | null;
          reason: string | null;
        };
        Insert: {
          amount_minor: number;
          cash_register_id: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          id?: string;
          kind: Database['public']['Enums']['cash_transaction_kind'];
          organization_id?: string;
          payment_id?: string | null;
          reason?: string | null;
        };
        Update: {
          amount_minor?: number;
          cash_register_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          kind?: Database['public']['Enums']['cash_transaction_kind'];
          organization_id?: string;
          payment_id?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_transactions_cash_register_id_fkey';
            columns: ['cash_register_id'];
            isOneToOne: false;
            referencedRelation: 'cash_register_history';
            referencedColumns: ['cash_register_id'];
          },
          {
            foreignKeyName: 'cash_transactions_cash_register_id_fkey';
            columns: ['cash_register_id'];
            isOneToOne: false;
            referencedRelation: 'cash_register_state';
            referencedColumns: ['cash_register_id'];
          },
          {
            foreignKeyName: 'cash_transactions_cash_register_id_fkey';
            columns: ['cash_register_id'];
            isOneToOne: false;
            referencedRelation: 'cash_registers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_transactions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_transactions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_transactions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_transactions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'cash_transactions_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          accepte_notifications: boolean;
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
          accepte_notifications?: boolean;
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
          accepte_notifications?: boolean;
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
          {
            foreignKeyName: 'customers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      employee_services: {
        Row: {
          employee_id: string;
          organization_id: string;
          service_id: string;
        };
        Insert: {
          employee_id: string;
          organization_id?: string;
          service_id: string;
        };
        Update: {
          employee_id?: string;
          organization_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_services_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employee_services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employee_services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employee_services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'employee_services_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      employees: {
        Row: {
          created_at: string;
          created_by: string | null;
          full_name: string;
          id: string;
          organization_id: string;
          phone: string | null;
          phone_digits: string | null;
          profile_id: string | null;
          station_id: string | null;
          status: Database['public']['Enums']['employee_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          full_name: string;
          id?: string;
          organization_id?: string;
          phone?: string | null;
          phone_digits?: string | null;
          profile_id?: string | null;
          station_id?: string | null;
          status?: Database['public']['Enums']['employee_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          full_name?: string;
          id?: string;
          organization_id?: string;
          phone?: string | null;
          phone_digits?: string | null;
          profile_id?: string | null;
          station_id?: string | null;
          status?: Database['public']['Enums']['employee_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employees_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'employees_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employees_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string | null;
          enabled_by_default: boolean;
          key: string;
          label: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          enabled_by_default?: boolean;
          key: string;
          label: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          enabled_by_default?: boolean;
          key?: string;
          label?: string;
        };
        Relationships: [];
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
            foreignKeyName: 'inspection_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inspection_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inspection_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
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
            foreignKeyName: 'inspection_photos_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
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
          {
            foreignKeyName: 'inspection_photos_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inspection_photos_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inspection_photos_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      inspection_zones: {
        Row: {
          code: string;
          id: string;
          is_active: boolean;
          label: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          id?: string;
          is_active?: boolean;
          label: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_minor: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          issued_at: string;
          number: number;
          organization_id: string | null;
          organization_label: string;
          paid_at: string | null;
          payment_reference: string | null;
          period_end: string;
          period_start: string;
          plan_code: string;
          reference: string;
          status: string;
          subscription_id: string | null;
          void_reason: string | null;
          year: number;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          currency: string;
          due_date: string;
          id?: string;
          issued_at?: string;
          number: number;
          organization_id?: string | null;
          organization_label: string;
          paid_at?: string | null;
          payment_reference?: string | null;
          period_end: string;
          period_start: string;
          plan_code: string;
          reference: string;
          status?: string;
          subscription_id?: string | null;
          void_reason?: string | null;
          year: number;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          currency?: string;
          due_date?: string;
          id?: string;
          issued_at?: string;
          number?: number;
          organization_id?: string | null;
          organization_label?: string;
          paid_at?: string | null;
          payment_reference?: string | null;
          period_end?: string;
          period_start?: string;
          plan_code?: string;
          reference?: string;
          status?: string;
          subscription_id?: string | null;
          void_reason?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'invoices_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          attempts: number;
          body: string;
          cancel_reason: string | null;
          created_at: string;
          customer_id: string | null;
          destination: string;
          id: string;
          kind: string;
          last_error: string | null;
          organization_id: string;
          sent_at: string | null;
          service_order_id: string;
          station_id: string;
          status: Database['public']['Enums']['notification_status'];
        };
        Insert: {
          attempts?: number;
          body: string;
          cancel_reason?: string | null;
          created_at?: string;
          customer_id?: string | null;
          destination: string;
          id?: string;
          kind: string;
          last_error?: string | null;
          organization_id?: string;
          sent_at?: string | null;
          service_order_id: string;
          station_id: string;
          status?: Database['public']['Enums']['notification_status'];
        };
        Update: {
          attempts?: number;
          body?: string;
          cancel_reason?: string | null;
          created_at?: string;
          customer_id?: string | null;
          destination?: string;
          id?: string;
          kind?: string;
          last_error?: string | null;
          organization_id?: string;
          sent_at?: string | null;
          service_order_id?: string;
          station_id?: string;
          status?: Database['public']['Enums']['notification_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'notifications_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_payment_state';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'notifications_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_totals';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'notifications_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_feature_overrides: {
        Row: {
          created_at: string;
          enabled: boolean;
          flag_key: string;
          organization_id: string;
          reason: string | null;
        };
        Insert: {
          created_at?: string;
          enabled: boolean;
          flag_key: string;
          organization_id: string;
          reason?: string | null;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          flag_key?: string;
          organization_id?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_feature_overrides_flag_key_fkey';
            columns: ['flag_key'];
            isOneToOne: false;
            referencedRelation: 'feature_flags';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'organization_feature_overrides_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_feature_overrides_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_feature_overrides_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
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
            foreignKeyName: 'organization_invitations_accepted_by_fkey';
            columns: ['accepted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invitations_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_invitations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
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
            foreignKeyName: 'organization_memberships_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_memberships_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
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
          {
            foreignKeyName: 'organization_settings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organization_settings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: true;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
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
          is_platform: boolean;
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
          is_platform?: boolean;
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
          is_platform?: boolean;
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
      payments: {
        Row: {
          amount_minor: number;
          cash_register_id: string | null;
          created_at: string;
          currency: string;
          external_ref: string | null;
          id: string;
          kind: Database['public']['Enums']['payment_kind'];
          method: Database['public']['Enums']['payment_method'];
          organization_id: string;
          provider_name: string | null;
          reason: string | null;
          received_by: string | null;
          reverses_payment_id: string | null;
          service_order_id: string;
          station_id: string;
          status: Database['public']['Enums']['payment_status'];
        };
        Insert: {
          amount_minor: number;
          cash_register_id?: string | null;
          created_at?: string;
          currency: string;
          external_ref?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['payment_kind'];
          method: Database['public']['Enums']['payment_method'];
          organization_id?: string;
          provider_name?: string | null;
          reason?: string | null;
          received_by?: string | null;
          reverses_payment_id?: string | null;
          service_order_id: string;
          station_id: string;
          status?: Database['public']['Enums']['payment_status'];
        };
        Update: {
          amount_minor?: number;
          cash_register_id?: string | null;
          created_at?: string;
          currency?: string;
          external_ref?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['payment_kind'];
          method?: Database['public']['Enums']['payment_method'];
          organization_id?: string;
          provider_name?: string | null;
          reason?: string | null;
          received_by?: string | null;
          reverses_payment_id?: string | null;
          service_order_id?: string;
          station_id?: string;
          status?: Database['public']['Enums']['payment_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'payments_cash_register_id_fkey';
            columns: ['cash_register_id'];
            isOneToOne: false;
            referencedRelation: 'cash_register_history';
            referencedColumns: ['cash_register_id'];
          },
          {
            foreignKeyName: 'payments_cash_register_id_fkey';
            columns: ['cash_register_id'];
            isOneToOne: false;
            referencedRelation: 'cash_register_state';
            referencedColumns: ['cash_register_id'];
          },
          {
            foreignKeyName: 'payments_cash_register_id_fkey';
            columns: ['cash_register_id'];
            isOneToOne: false;
            referencedRelation: 'cash_registers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'payments_received_by_fkey';
            columns: ['received_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_reverses_payment_id_fkey';
            columns: ['reverses_payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_payment_state';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'payments_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_totals';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'payments_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      permissions: {
        Row: {
          created_at: string;
          description: string;
          key: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          key: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          key?: string;
        };
        Relationships: [];
      };
      plan_features: {
        Row: {
          enabled: boolean;
          flag_key: string;
          plan_id: string;
        };
        Insert: {
          enabled: boolean;
          flag_key: string;
          plan_id: string;
        };
        Update: {
          enabled?: boolean;
          flag_key?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_features_flag_key_fkey';
            columns: ['flag_key'];
            isOneToOne: false;
            referencedRelation: 'feature_flags';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'plan_features_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          is_public: boolean;
          label: string;
          max_stations: number | null;
          max_users: number | null;
          price_minor: number;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          label: string;
          max_stations?: number | null;
          max_users?: number | null;
          price_minor?: number;
          sort_order?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          label?: string;
          max_stations?: number | null;
          max_users?: number | null;
          price_minor?: number;
          sort_order?: number;
        };
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
      receipts: {
        Row: {
          contenu: Json;
          currency: string;
          id: string;
          issued_at: string;
          issued_by: string | null;
          number: number;
          organization_id: string;
          paid_minor: number;
          replaces_receipt_id: string | null;
          service_order_id: string;
          station_id: string;
          total_minor: number;
        };
        Insert: {
          contenu: Json;
          currency: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          number: number;
          organization_id: string;
          paid_minor: number;
          replaces_receipt_id?: string | null;
          service_order_id: string;
          station_id: string;
          total_minor: number;
        };
        Update: {
          contenu?: Json;
          currency?: string;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          number?: number;
          organization_id?: string;
          paid_minor?: number;
          replaces_receipt_id?: string | null;
          service_order_id?: string;
          station_id?: string;
          total_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'receipts_issued_by_fkey';
            columns: ['issued_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'receipts_replaces_receipt_id_fkey';
            columns: ['replaces_receipt_id'];
            isOneToOne: false;
            referencedRelation: 'receipts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_payment_state';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'receipts_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_totals';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'receipts_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permissions: {
        Row: {
          permission_key: string;
          role_id: string;
        };
        Insert: {
          permission_key: string;
          role_id: string;
        };
        Update: {
          permission_key?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_permission_key_fkey';
            columns: ['permission_key'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
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
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          sort_order?: number;
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
          {
            foreignKeyName: 'service_categories_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_categories_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      service_order_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          discount_amount_minor: number;
          id: string;
          line_total_minor: number | null;
          organization_id: string;
          price_id: string | null;
          quantity: number;
          service_id: string;
          service_name: string;
          service_order_id: string;
          unit_amount_minor: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency: string;
          discount_amount_minor?: number;
          id?: string;
          line_total_minor?: number | null;
          organization_id?: string;
          price_id?: string | null;
          quantity?: number;
          service_id: string;
          service_name: string;
          service_order_id: string;
          unit_amount_minor: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          discount_amount_minor?: number;
          id?: string;
          line_total_minor?: number | null;
          organization_id?: string;
          price_id?: string | null;
          quantity?: number;
          service_id?: string;
          service_name?: string;
          service_order_id?: string;
          unit_amount_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_items_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_items_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'service_order_items_price_id_fkey';
            columns: ['price_id'];
            isOneToOne: false;
            referencedRelation: 'service_prices';
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
            foreignKeyName: 'service_order_items_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_payment_state';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'service_order_items_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_totals';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'service_order_items_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_operations: {
        Row: {
          completed_at: string | null;
          created_at: string;
          employee_id: string | null;
          id: string;
          item_id: string;
          notes: string | null;
          organization_id: string;
          service_name: string;
          service_order_id: string;
          started_at: string | null;
          status: Database['public']['Enums']['operation_status'];
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          item_id: string;
          notes?: string | null;
          organization_id: string;
          service_name: string;
          service_order_id: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['operation_status'];
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          item_id?: string;
          notes?: string | null;
          organization_id?: string;
          service_name?: string;
          service_order_id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['operation_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_operations_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_operations_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: true;
            referencedRelation: 'service_order_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_operations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_operations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_operations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'service_order_operations_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_payment_state';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'service_order_operations_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_totals';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'service_order_operations_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_orders';
            referencedColumns: ['id'];
          },
        ];
      };
      service_order_status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_status: Database['public']['Enums']['service_order_status'] | null;
          id: number;
          organization_id: string;
          reason: string | null;
          service_order_id: string;
          to_status: Database['public']['Enums']['service_order_status'];
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: Database['public']['Enums']['service_order_status'] | null;
          id?: never;
          organization_id: string;
          reason?: string | null;
          service_order_id: string;
          to_status: Database['public']['Enums']['service_order_status'];
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: Database['public']['Enums']['service_order_status'] | null;
          id?: never;
          organization_id?: string;
          reason?: string | null;
          service_order_id?: string;
          to_status?: Database['public']['Enums']['service_order_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_status_history_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_status_history_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_status_history_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_order_status_history_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'service_order_status_history_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_payment_state';
            referencedColumns: ['service_order_id'];
          },
          {
            foreignKeyName: 'service_order_status_history_service_order_id_fkey';
            columns: ['service_order_id'];
            isOneToOne: false;
            referencedRelation: 'service_order_totals';
            referencedColumns: ['service_order_id'];
          },
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
          condition_code: string | null;
          from_status: Database['public']['Enums']['service_order_status'];
          must_audit: boolean;
          required_permission: string;
          requires_reason: boolean;
          to_status: Database['public']['Enums']['service_order_status'];
        };
        Insert: {
          condition_code?: string | null;
          from_status: Database['public']['Enums']['service_order_status'];
          must_audit?: boolean;
          required_permission: string;
          requires_reason?: boolean;
          to_status: Database['public']['Enums']['service_order_status'];
        };
        Update: {
          condition_code?: string | null;
          from_status?: Database['public']['Enums']['service_order_status'];
          must_audit?: boolean;
          required_permission?: string;
          requires_reason?: boolean;
          to_status?: Database['public']['Enums']['service_order_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'service_order_transitions_required_permission_fkey';
            columns: ['required_permission'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['key'];
          },
        ];
      };
      service_orders: {
        Row: {
          arrived_at: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          delivered_at: string | null;
          id: string;
          notes: string | null;
          number: number;
          organization_id: string;
          started_at: string | null;
          station_id: string;
          status: Database['public']['Enums']['service_order_status'];
          updated_at: string;
          vehicle_id: string;
        };
        Insert: {
          arrived_at?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          delivered_at?: string | null;
          id?: string;
          notes?: string | null;
          number: number;
          organization_id?: string;
          started_at?: string | null;
          station_id: string;
          status?: Database['public']['Enums']['service_order_status'];
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          arrived_at?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          delivered_at?: string | null;
          id?: string;
          notes?: string | null;
          number?: number;
          organization_id?: string;
          started_at?: string | null;
          station_id?: string;
          status?: Database['public']['Enums']['service_order_status'];
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'service_orders_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_prices: {
        Row: {
          amount_minor: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          organization_id: string;
          service_id: string;
          station_id: string | null;
          updated_at: string;
          valid_from: string;
          valid_to: string | null;
          vehicle_type_id: string | null;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          id?: string;
          organization_id?: string;
          service_id: string;
          station_id?: string | null;
          updated_at?: string;
          valid_from?: string;
          valid_to?: string | null;
          vehicle_type_id?: string | null;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          organization_id?: string;
          service_id?: string;
          station_id?: string | null;
          updated_at?: string;
          valid_from?: string;
          valid_to?: string | null;
          vehicle_type_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_prices_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_prices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_prices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_prices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'service_prices_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'services';
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
            foreignKeyName: 'service_prices_vehicle_type_id_fkey';
            columns: ['vehicle_type_id'];
            isOneToOne: false;
            referencedRelation: 'vehicle_types';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          category_id: string | null;
          created_at: string;
          description: string | null;
          duration_minutes: number | null;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          sort_order?: number;
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
          {
            foreignKeyName: 'services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      session_revocations: {
        Row: {
          profile_id: string;
          reason: string | null;
          revoked_at: string;
        };
        Insert: {
          profile_id: string;
          reason?: string | null;
          revoked_at?: string;
        };
        Update: {
          profile_id?: string;
          reason?: string | null;
          revoked_at?: string;
        };
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
        Row: {
          created_at: string;
          id: string;
          membership_id: string;
          station_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          membership_id: string;
          station_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          membership_id?: string;
          station_id?: string;
        };
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
          organization_id?: string;
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
          {
            foreignKeyName: 'stations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stations_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          ends_at: string | null;
          id: string;
          organization_id: string;
          plan_id: string;
          started_at: string;
          status: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          organization_id: string;
          plan_id: string;
          started_at?: string;
          status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          organization_id?: string;
          plan_id?: string;
          started_at?: string;
          status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
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
            foreignKeyName: 'vehicle_inspections_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_inspections_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
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
          plate_normalized?: string | null;
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
          plate_normalized?: string | null;
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
            foreignKeyName: 'vehicles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicles_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
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
    };
    Views: {
      cash_register_history: {
        Row: {
          cash_register_id: string | null;
          closed_at: string | null;
          closed_by: string | null;
          closed_by_name: string | null;
          closing_note: string | null;
          currency: string | null;
          declared_closing_minor: number | null;
          entrees_minor: number | null;
          mouvements: number | null;
          opened_at: string | null;
          opened_by: string | null;
          opened_by_name: string | null;
          opening_float_minor: number | null;
          organization_id: string | null;
          sorties_minor: number | null;
          station_id: string | null;
          station_name: string | null;
          status: Database['public']['Enums']['cash_register_status'] | null;
          theoretical_minor: number | null;
          variance_minor: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_registers_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_opened_by_fkey';
            columns: ['opened_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
          {
            foreignKeyName: 'cash_registers_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'stations';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_register_state: {
        Row: {
          cash_register_id: string | null;
          mouvements: number | null;
          organization_id: string | null;
          theoretical_minor: number | null;
        };
        Insert: {
          cash_register_id?: string | null;
          mouvements?: never;
          organization_id?: string | null;
          theoretical_minor?: never;
        };
        Update: {
          cash_register_id?: string | null;
          mouvements?: never;
          organization_id?: string | null;
          theoretical_minor?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_registers_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      platform_audit_logs: {
        Row: {
          action: string | null;
          actor_label: string | null;
          id: number | null;
          new_value: Json | null;
          occurred_at: string | null;
          old_value: Json | null;
          organization_id: string | null;
          reason: string | null;
          resource_id: string | null;
          resource_type: string | null;
        };
        Insert: {
          action?: string | null;
          actor_label?: string | null;
          id?: number | null;
          new_value?: Json | null;
          occurred_at?: string | null;
          old_value?: Json | null;
          organization_id?: string | null;
          reason?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
        };
        Update: {
          action?: string | null;
          actor_label?: string | null;
          id?: number | null;
          new_value?: Json | null;
          occurred_at?: string | null;
          old_value?: Json | null;
          organization_id?: string | null;
          reason?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      platform_invoices: {
        Row: {
          amount_minor: number | null;
          currency: string | null;
          due_date: string | null;
          en_retard: boolean | null;
          id: string | null;
          issued_at: string | null;
          jours_de_retard: number | null;
          organization_id: string | null;
          organization_label: string | null;
          paid_at: string | null;
          payment_reference: string | null;
          period_end: string | null;
          period_start: string | null;
          plan_code: string | null;
          reference: string | null;
          status: string | null;
          void_reason: string | null;
        };
        Insert: {
          amount_minor?: number | null;
          currency?: string | null;
          due_date?: string | null;
          en_retard?: never;
          id?: string | null;
          issued_at?: string | null;
          jours_de_retard?: never;
          organization_id?: string | null;
          organization_label?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          plan_code?: string | null;
          reference?: string | null;
          status?: string | null;
          void_reason?: string | null;
        };
        Update: {
          amount_minor?: number | null;
          currency?: string | null;
          due_date?: string | null;
          en_retard?: never;
          id?: string | null;
          issued_at?: string | null;
          jours_de_retard?: never;
          organization_id?: string | null;
          organization_label?: string | null;
          paid_at?: string | null;
          payment_reference?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          plan_code?: string | null;
          reference?: string | null;
          status?: string | null;
          void_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      platform_organizations: {
        Row: {
          city: string | null;
          country_code: string | null;
          created_at: string | null;
          currency: string | null;
          derniere_activite: string | null;
          dossiers: number | null;
          dossiers_30j: number | null;
          id: string | null;
          membres_actifs: number | null;
          name: string | null;
          slug: string | null;
          stations: number | null;
          status: Database['public']['Enums']['organization_status'] | null;
          vehicules: number | null;
        };
        Insert: {
          city?: string | null;
          country_code?: string | null;
          created_at?: string | null;
          currency?: string | null;
          derniere_activite?: never;
          dossiers?: never;
          dossiers_30j?: never;
          id?: string | null;
          membres_actifs?: never;
          name?: string | null;
          slug?: string | null;
          stations?: never;
          status?: Database['public']['Enums']['organization_status'] | null;
          vehicules?: never;
        };
        Update: {
          city?: string | null;
          country_code?: string | null;
          created_at?: string | null;
          currency?: string | null;
          derniere_activite?: never;
          dossiers?: never;
          dossiers_30j?: never;
          id?: string | null;
          membres_actifs?: never;
          name?: string | null;
          slug?: string | null;
          stations?: never;
          status?: Database['public']['Enums']['organization_status'] | null;
          vehicules?: never;
        };
        Relationships: [];
      };
      platform_subscriptions: {
        Row: {
          currency: string | null;
          max_stations: number | null;
          max_users: number | null;
          membres_actifs: number | null;
          organisation: string | null;
          organization_id: string | null;
          plan_code: string | null;
          plan_label: string | null;
          price_minor: number | null;
          started_at: string | null;
          stations_utilisees: number | null;
          status: string | null;
          trial_ends_at: string | null;
        };
        Relationships: [];
      };
      service_order_payment_state: {
        Row: {
          balance_minor: number | null;
          organization_id: string | null;
          paid_amount_minor: number | null;
          payment_status: string | null;
          service_order_id: string | null;
          total_amount_minor: number | null;
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
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
      service_order_totals: {
        Row: {
          currency: string | null;
          discount_amount_minor: number | null;
          lignes: number | null;
          organization_id: string | null;
          service_order_id: string | null;
          total_amount_minor: number | null;
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
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_orders_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'platform_subscriptions';
            referencedColumns: ['organization_id'];
          },
        ];
      };
    };
    Functions: {
      accepter_invitation: { Args: { p_token: string }; Returns: string };
      annuler_facture: {
        Args: { p_invoice_id: string; p_motif: string };
        Returns: {
          amount_minor: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          issued_at: string;
          number: number;
          organization_id: string | null;
          organization_label: string;
          paid_at: string | null;
          payment_reference: string | null;
          period_end: string;
          period_start: string;
          plan_code: string;
          reference: string;
          status: string;
          subscription_id: string | null;
          void_reason: string | null;
          year: number;
        };
        SetofOptions: {
          from: '*';
          to: 'invoices';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      annuler_notification: {
        Args: { p_motif: string; p_notification_id: string };
        Returns: {
          attempts: number;
          body: string;
          cancel_reason: string | null;
          created_at: string;
          customer_id: string | null;
          destination: string;
          id: string;
          kind: string;
          last_error: string | null;
          organization_id: string;
          sent_at: string | null;
          service_order_id: string;
          station_id: string;
          status: Database['public']['Enums']['notification_status'];
        };
        SetofOptions: {
          from: '*';
          to: 'notifications';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      basculer_fonctionnalite: {
        Args: {
          p_actif: boolean;
          p_cle: string;
          p_motif: string;
          p_organization_id: string;
        };
        Returns: boolean;
      };
      changer_plan: {
        Args: {
          p_motif: string;
          p_organization_id: string;
          p_plan_code: string;
        };
        Returns: {
          created_at: string;
          ends_at: string | null;
          id: string;
          organization_id: string;
          plan_id: string;
          started_at: string;
          status: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'subscriptions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cloturer_caisse: {
        Args: {
          p_cash_register_id: string;
          p_declared_minor: number;
          p_note?: string;
        };
        Returns: {
          closed_at: string | null;
          closed_by: string | null;
          closing_note: string | null;
          created_at: string;
          currency: string;
          declared_closing_minor: number | null;
          id: string;
          opened_at: string;
          opened_by: string;
          opening_float_minor: number;
          organization_id: string;
          station_id: string;
          status: Database['public']['Enums']['cash_register_status'];
          theoretical_minor: number | null;
          updated_at: string;
          variance_minor: number | null;
        };
        SetofOptions: {
          from: '*';
          to: 'cash_registers';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      emettre_factures: {
        Args: { p_delai_jours?: number; p_periode?: string };
        Returns: {
          devise: string;
          montant_minor: number;
          organisation: string;
          reference: string;
        }[];
      };
      emettre_recu: {
        Args: { p_replaces_receipt_id?: string; p_service_order_id: string };
        Returns: {
          contenu: Json;
          currency: string;
          id: string;
          issued_at: string;
          issued_by: string | null;
          number: number;
          organization_id: string;
          paid_minor: number;
          replaces_receipt_id: string | null;
          service_order_id: string;
          station_id: string;
          total_minor: number;
        };
        SetofOptions: {
          from: '*';
          to: 'receipts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fonctionnalite_active: { Args: { p_cle: string }; Returns: boolean };
      marquer_facture_payee: {
        Args: { p_invoice_id: string; p_reference?: string };
        Returns: {
          amount_minor: number;
          created_at: string;
          currency: string;
          due_date: string;
          id: string;
          issued_at: string;
          number: number;
          organization_id: string | null;
          organization_label: string;
          paid_at: string | null;
          payment_reference: string | null;
          period_end: string;
          period_start: string;
          plan_code: string;
          reference: string;
          status: string;
          subscription_id: string | null;
          void_reason: string | null;
          year: number;
        };
        SetofOptions: {
          from: '*';
          to: 'invoices';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mes_factures: {
        Args: never;
        Returns: {
          devise: string;
          echeance: string;
          en_retard: boolean;
          montant_minor: number;
          payee_le: string;
          periode_debut: string;
          periode_fin: string;
          reference: string;
          statut: string;
        }[];
      };
      mes_fonctionnalites: {
        Args: never;
        Returns: {
          actif: boolean;
          cle: string;
          libelle: string;
        }[];
      };
      mon_abonnement: {
        Args: never;
        Returns: {
          essai_jusqu_au: string;
          max_stations: number;
          max_users: number;
          membres_actifs: number;
          plan_code: string;
          plan_label: string;
          stations_utilisees: number;
          statut: string;
        }[];
      };
      provisionner_organisation: {
        Args: {
          p_nom: string;
          p_nom_station?: string;
          p_pays: string;
          p_ville?: string;
        };
        Returns: string;
      };
      rapport_journalier: {
        Args: { p_debut: string; p_fin: string; p_station?: string };
        Returns: {
          autres_minor: number;
          dossiers_livres: number;
          encaisse_minor: number;
          especes_minor: number;
          jour: string;
          mobile_minor: number;
          panier_moyen_minor: number;
          station_id: string;
          station_nom: string;
        }[];
      };
      rapport_prestations: {
        Args: { p_debut: string; p_fin: string; p_station?: string };
        Returns: {
          montant_minor: number;
          prestation: string;
          quantite: number;
        }[];
      };
      reactiver_organisation: {
        Args: { p_motif: string; p_organization_id: string };
        Returns: {
          address: string | null;
          city: string | null;
          country_code: string;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          is_platform: boolean;
          locale: string;
          logo_path: string | null;
          name: string;
          phone: string | null;
          slug: string;
          status: Database['public']['Enums']['organization_status'];
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'organizations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      rechercher_clients: {
        Args: { p_decalage?: number; p_limite?: number; p_recherche?: string };
        Returns: {
          accepte_notifications: boolean;
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
        }[];
        SetofOptions: {
          from: '*';
          to: 'customers';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      rechercher_vehicules: {
        Args: { p_decalage?: number; p_limite?: number; p_recherche?: string };
        Returns: {
          color: string;
          created_at: string;
          customer_id: string;
          customer_name: string;
          id: string;
          make: string;
          model: string;
          notes: string;
          organization_id: string;
          plate: string;
          plate_normalized: string;
          type_label: string;
          vehicle_type_id: string;
        }[];
      };
      relancer_impayes: {
        Args: never;
        Returns: {
          devise: string;
          jours_de_retard: number;
          montant_minor: number;
          organisation: string;
          reference: string;
        }[];
      };
      remplacer_tarif: {
        Args: {
          p_amount_minor: number;
          p_price_id: string;
          p_valid_from?: string;
        };
        Returns: string;
      };
      resoudre_prix: {
        Args: {
          p_date?: string;
          p_service_id: string;
          p_station_id?: string;
          p_vehicle_type_id?: string;
        };
        Returns: {
          amount_minor: number;
          currency: string;
          price_id: string;
          specificite: string;
        }[];
      };
      suspendre_organisation: {
        Args: { p_motif: string; p_organization_id: string };
        Returns: {
          address: string | null;
          city: string | null;
          country_code: string;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          is_platform: boolean;
          locale: string;
          logo_path: string | null;
          name: string;
          phone: string | null;
          slug: string;
          status: Database['public']['Enums']['organization_status'];
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'organizations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transitionner_dossier: {
        Args: {
          p_reason?: string;
          p_service_order_id: string;
          p_to_status: string;
        };
        Returns: {
          arrived_at: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          delivered_at: string | null;
          id: string;
          notes: string | null;
          number: number;
          organization_id: string;
          started_at: string | null;
          station_id: string;
          status: Database['public']['Enums']['service_order_status'];
          updated_at: string;
          vehicle_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'service_orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      cash_register_status: 'OPEN' | 'CLOSED';
      cash_transaction_kind: 'PAYMENT_IN' | 'REFUND_OUT' | 'CASH_IN' | 'CASH_OUT';
      employee_status: 'ACTIVE' | 'INACTIVE';
      inspection_condition: 'OK' | 'ANOMALY';
      invitation_status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
      membership_status: 'ACTIVE' | 'SUSPENDED';
      notification_status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
      operation_status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
      organization_status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'DEACTIVATED';
      payment_before_delivery_rule: 'STRICT' | 'ALLOW_DEBT';
      payment_kind: 'PAYMENT' | 'REFUND';
      payment_method: 'CASH' | 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';
      payment_status: 'PENDING' | 'COMPLETED' | 'FAILED';
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
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cash_register_status: ['OPEN', 'CLOSED'],
      cash_transaction_kind: ['PAYMENT_IN', 'REFUND_OUT', 'CASH_IN', 'CASH_OUT'],
      employee_status: ['ACTIVE', 'INACTIVE'],
      inspection_condition: ['OK', 'ANOMALY'],
      invitation_status: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'],
      membership_status: ['ACTIVE', 'SUSPENDED'],
      notification_status: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'],
      operation_status: ['PENDING', 'IN_PROGRESS', 'DONE'],
      organization_status: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'DEACTIVATED'],
      payment_before_delivery_rule: ['STRICT', 'ALLOW_DEBT'],
      payment_kind: ['PAYMENT', 'REFUND'],
      payment_method: ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'OTHER'],
      payment_status: ['PENDING', 'COMPLETED', 'FAILED'],
      role_scope: ['PLATFORM', 'ORGANIZATION', 'STATION'],
      service_order_status: [
        'ARRIVED',
        'INSPECTION',
        'WAITING',
        'IN_PROGRESS',
        'CONTROL',
        'READY',
        'DELIVERED',
        'CANCELLED',
      ],
      station_kind: ['FIXED', 'MOBILE'],
      station_status: ['ACTIVE', 'INACTIVE'],
    },
  },
} as const;
