export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      chapters: {
        Row: {
          demo_id: string;
          id: string;
          position: number;
          title: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          id?: string;
          position?: number;
          title?: string;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          id?: string;
          position?: number;
          title?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chapters_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chapters_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      demo_access: {
        Row: {
          ask_email: boolean;
          demo_id: string;
          domains: string[];
          expires_at: string | null;
          locked_by_rules: boolean;
          mode: string;
          password_changed_at: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          ask_email?: boolean;
          demo_id: string;
          domains?: string[];
          expires_at?: string | null;
          locked_by_rules?: boolean;
          mode?: string;
          password_changed_at?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          ask_email?: boolean;
          demo_id?: string;
          domains?: string[];
          expires_at?: string | null;
          locked_by_rules?: boolean;
          mode?: string;
          password_changed_at?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      demo_access_invites: {
        Row: {
          demo_id: string;
          email: string;
          invited_at: string;
          invited_by: string | null;
          last_sent_at: string | null;
          opened_at: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          email: string;
          invited_at?: string;
          invited_by?: string | null;
          last_sent_at?: string | null;
          opened_at?: string | null;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          email?: string;
          invited_at?: string;
          invited_by?: string | null;
          last_sent_at?: string | null;
          opened_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          workspace_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      demo_tags: {
        Row: {
          created_at: string;
          demo_id: string;
          tag_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          demo_id: string;
          tag_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          demo_id?: string;
          tag_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      demo_versions: {
        Row: {
          demo_id: string;
          id: string;
          manifest: NonNullable<Json>;
          number: number;
          public_ack: Json | null;
          published_at: string;
          published_by: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          id?: string;
          manifest: NonNullable<Json>;
          number: number;
          public_ack?: Json | null;
          published_at?: string;
          published_by?: string | null;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          id?: string;
          manifest?: NonNullable<Json>;
          number?: number;
          public_ack?: Json | null;
          published_at?: string;
          published_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'demo_versions_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'demo_versions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      demos: {
        Row: {
          device: string;
          viewport: Json | null;
          kind: string;
          sandbox: Json | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          current_version_id: string | null;
          deleted_at: string | null;
          folder_id: string | null;
          id: string;
          settings: NonNullable<Json>;
          status: Database['public']['Enums']['demo_status'];
          theme_id: string | null;
          presenter_notes: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          device?: string;
          viewport?: Json | null;
          kind?: string;
          sandbox?: Json | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          deleted_at?: string | null;
          folder_id?: string | null;
          id?: string;
          settings?: NonNullable<Json>;
          status?: Database['public']['Enums']['demo_status'];
          theme_id?: string | null;
          presenter_notes?: string;
          title?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          device?: string;
          viewport?: Json | null;
          kind?: string;
          sandbox?: Json | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          deleted_at?: string | null;
          folder_id?: string | null;
          id?: string;
          settings?: NonNullable<Json>;
          status?: Database['public']['Enums']['demo_status'];
          theme_id?: string | null;
          presenter_notes?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'demos_current_version_fk';
            columns: ['current_version_id'];
            isOneToOne: false;
            referencedRelation: 'demo_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'demos_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'folders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'demos_theme_id_fkey';
            columns: ['theme_id'];
            isOneToOne: false;
            referencedRelation: 'themes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'demos_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          demo_id: string;
          browser: string | null;
          channel: string | null;
          country: string | null;
          device: string | null;
          embed_origin: string | null;
          hotspot_id: string | null;
          id: number;
          lang: string | null;
          link_id: string | null;
          occurred_at: string;
          os: string | null;
          props: NonNullable<Json>;
          referrer_host: string | null;
          session_id: string;
          step_id: string | null;
          step_index: number | null;
          type: string;
          version_id: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          browser?: string | null;
          channel?: string | null;
          country?: string | null;
          device?: string | null;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id?: never;
          lang?: string | null;
          link_id?: string | null;
          os?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id: string;
          step_id?: string | null;
          step_index?: number | null;
          type: string;
          version_id?: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          browser?: string | null;
          channel?: string | null;
          country?: string | null;
          device?: string | null;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id?: never;
          lang?: string | null;
          link_id?: string | null;
          os?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id?: string;
          step_id?: string | null;
          step_index?: number | null;
          type?: string;
          version_id?: string | null;
          visitor_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      events_2026_11: {
        Row: {
          demo_id: string;
          embed_origin: string | null;
          hotspot_id: string | null;
          id: number;
          link_id: string | null;
          occurred_at: string;
          props: NonNullable<Json>;
          referrer_host: string | null;
          session_id: string;
          step_id: string | null;
          step_index: number | null;
          type: string;
          version_id: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id: string;
          step_id?: string | null;
          step_index?: number | null;
          type: string;
          version_id?: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id?: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id?: string;
          step_id?: string | null;
          step_index?: number | null;
          type?: string;
          version_id?: string | null;
          visitor_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      events_2026_12: {
        Row: {
          demo_id: string;
          embed_origin: string | null;
          hotspot_id: string | null;
          id: number;
          link_id: string | null;
          occurred_at: string;
          props: NonNullable<Json>;
          referrer_host: string | null;
          session_id: string;
          step_id: string | null;
          step_index: number | null;
          type: string;
          version_id: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id: string;
          step_id?: string | null;
          step_index?: number | null;
          type: string;
          version_id?: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id?: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id?: string;
          step_id?: string | null;
          step_index?: number | null;
          type?: string;
          version_id?: string | null;
          visitor_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      events_2027_01: {
        Row: {
          demo_id: string;
          embed_origin: string | null;
          hotspot_id: string | null;
          id: number;
          link_id: string | null;
          occurred_at: string;
          props: NonNullable<Json>;
          referrer_host: string | null;
          session_id: string;
          step_id: string | null;
          step_index: number | null;
          type: string;
          version_id: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id: string;
          step_id?: string | null;
          step_index?: number | null;
          type: string;
          version_id?: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id?: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id?: string;
          step_id?: string | null;
          step_index?: number | null;
          type?: string;
          version_id?: string | null;
          visitor_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      events_default: {
        Row: {
          demo_id: string;
          embed_origin: string | null;
          hotspot_id: string | null;
          id: number;
          link_id: string | null;
          occurred_at: string;
          props: NonNullable<Json>;
          referrer_host: string | null;
          session_id: string;
          step_id: string | null;
          step_index: number | null;
          type: string;
          version_id: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id: string;
          step_id?: string | null;
          step_index?: number | null;
          type: string;
          version_id?: string | null;
          visitor_id: string;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          embed_origin?: string | null;
          hotspot_id?: string | null;
          id?: number;
          link_id?: string | null;
          occurred_at?: string;
          props?: NonNullable<Json>;
          referrer_host?: string | null;
          session_id?: string;
          step_id?: string | null;
          step_index?: number | null;
          type?: string;
          version_id?: string | null;
          visitor_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          restricted: boolean;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          restricted?: boolean;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          restricted?: boolean;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'folders_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'folders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'folders_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      forms: {
        Row: {
          consent_text: string;
          created_at: string;
          demo_id: string | null;
          description: string;
          fields: NonNullable<Json>;
          id: string;
          skippable: boolean;
          submit_label: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          consent_text?: string;
          created_at?: string;
          demo_id?: string | null;
          description?: string;
          fields?: NonNullable<Json>;
          id?: string;
          skippable?: boolean;
          submit_label?: string;
          title?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          consent_text?: string;
          created_at?: string;
          demo_id?: string | null;
          description?: string;
          fields?: NonNullable<Json>;
          id?: string;
          skippable?: boolean;
          submit_label?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'forms_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'forms_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      hotspots: {
        Row: {
          action: NonNullable<Json>;
          body: string;
          created_at: string;
          cta: Json | null;
          demo_id: string;
          h: number;
          id: string;
          placement: string;
          position: number;
          pulse: boolean;
          sel: string | null;
          step_id: string;
          title: string;
          updated_at: string;
          w: number;
          workspace_id: string;
          x: number;
          y: number;
          style: string;
        };
        ComputedFields: never;
        Insert: {
          action?: NonNullable<Json>;
          body?: string;
          created_at?: string;
          cta?: Json | null;
          demo_id: string;
          h?: number;
          id?: string;
          placement?: string;
          position?: number;
          pulse?: boolean;
          sel?: string | null;
          step_id: string;
          title?: string;
          updated_at?: string;
          w?: number;
          workspace_id: string;
          x: number;
          y: number;
          style?: string;
        };
        Update: {
          action?: NonNullable<Json>;
          body?: string;
          created_at?: string;
          cta?: Json | null;
          demo_id?: string;
          h?: number;
          id?: string;
          placement?: string;
          position?: number;
          pulse?: boolean;
          sel?: string | null;
          step_id?: string;
          title?: string;
          updated_at?: string;
          w?: number;
          workspace_id?: string;
          x?: number;
          y?: number;
          style?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hotspots_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hotspots_step_id_fkey';
            columns: ['step_id'];
            isOneToOne: false;
            referencedRelation: 'steps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'hotspots_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: Database['public']['Enums']['workspace_role'];
          sent_at: string | null;
          token: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          sent_at?: string | null;
          token?: string;
          workspace_id: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database['public']['Enums']['workspace_role'];
          sent_at?: string | null;
          token?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      leads: {
        Row: {
          consent: boolean;
          created_at: string;
          demo_id: string | null;
          email: string;
          fields: NonNullable<Json>;
          id: string;
          link_id: string | null;
          version_id: string | null;
          visitor_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          consent?: boolean;
          created_at?: string;
          demo_id?: string | null;
          email: string;
          fields?: NonNullable<Json>;
          id?: string;
          link_id?: string | null;
          version_id?: string | null;
          visitor_id?: string | null;
          workspace_id: string;
        };
        Update: {
          consent?: boolean;
          created_at?: string;
          demo_id?: string | null;
          email?: string;
          fields?: NonNullable<Json>;
          id?: string;
          link_id?: string | null;
          version_id?: string | null;
          visitor_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_link_id_fkey';
            columns: ['link_id'];
            isOneToOne: false;
            referencedRelation: 'share_links';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_version_id_fkey';
            columns: ['version_id'];
            isOneToOne: false;
            referencedRelation: 'demo_versions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      members: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['workspace_role'];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          code: string;
          limits: NonNullable<Json>;
          name: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          limits?: NonNullable<Json>;
          name: string;
          sort?: number;
        };
        Update: {
          code?: string;
          limits?: NonNullable<Json>;
          name?: string;
          sort?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          avatar_url: string | null;
          created_at: string;
          extension_last_capture_at: string | null;
          extension_last_demo: string | null;
          extension_seen_at: string | null;
          extension_version: string | null;
          full_name: string;
          id: string;
          locale: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          locale?: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          locale?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          last4: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          scopes: string[];
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          id: string;
          meta: Json;
          target_ref: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          meta?: Json;
          target_ref?: string | null;
          workspace_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          meta?: Json;
          target_ref?: string | null;
          workspace_id?: string;
        };
        Relationships: [];
      };
      webhooks: {
        Row: {
          created_at: string;
          created_by: string | null;
          events: string[];
          failures: number;
          id: string;
          name: string;
          secret_hint: string;
          state: string;
          updated_at: string;
          url: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: never;
        Update: {
          events?: string[];
          name?: string;
          url?: string;
        };
        Relationships: [];
      };
      diffusions: {
        Row: {
          created_by: string | null;
          demo_id: string;
          first_at: string;
          id: string;
          kind: string;
          label: string;
          last_at: string;
          settings: Json;
          uses: number;
          version_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ai_usage: {
        Row: {
          workspace_id: string;
          user_id: string;
          day: string;
          requests: number;
          input_tokens: number;
          output_tokens: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      webhook_deliveries: {
        Row: {
          attempt: number;
          created_at: string;
          duration_ms: number | null;
          error: string | null;
          event_id: string;
          event_type: string;
          finished_at: string | null;
          id: string;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          replay_of: string | null;
          response_body: string | null;
          response_status: number | null;
          status: string;
          webhook_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      demo_templates: {
        Row: {
          builtin_key: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          description: string;
          icon: string;
          id: string;
          name: string;
          structure: Json;
          updated_at: string;
          with_captures: boolean;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          builtin_key?: string | null;
          category: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          icon?: string;
          id?: string;
          name: string;
          structure: Json;
          updated_at?: string;
          with_captures?: boolean;
          workspace_id?: string | null;
        };
        Update: {
          category?: string;
          description?: string;
          name?: string;
        };
        Relationships: [];
      };
      folder_members: {
        Row: { created_at: string; folder_id: string; user_id: string; workspace_id: string };
        ComputedFields: never;
        Insert: { created_at?: string; folder_id: string; user_id: string; workspace_id: string };
        Update: { created_at?: string; folder_id?: string; user_id?: string; workspace_id?: string };
        Relationships: [];
      };
      share_rules: {
        Row: {
          exports_allowed: boolean;
          max_link_days: number | null;
          modes: string[];
          publish_role: string;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          exports_allowed?: boolean;
          max_link_days?: number | null;
          modes?: string[];
          publish_role?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id: string;
        };
        Update: {
          exports_allowed?: boolean;
          max_link_days?: number | null;
          modes?: string[];
          publish_role?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [];
      };
      builtin_styles: {
        Row: { key: string; sort: number; tokens: NonNullable<Json> };
        ComputedFields: never;
        Insert: { key: string; sort: number; tokens: NonNullable<Json> };
        Update: { key?: string; sort?: number; tokens?: NonNullable<Json> };
        Relationships: [];
      };
      learn_progress: {
        Row: { done_at: string; module: string; user_id: string };
        ComputedFields: never;
        Insert: { done_at?: string; module: string; user_id?: string };
        Update: { done_at?: string; module?: string; user_id?: string };
        Relationships: [];
      };
      onboarding_prefs: {
        Row: { hidden_at: string | null; user_id: string; workspace_id: string };
        ComputedFields: never;
        Insert: { hidden_at?: string | null; user_id?: string; workspace_id: string };
        Update: { hidden_at?: string | null; user_id?: string; workspace_id?: string };
        Relationships: [];
      };
      present_reports: {
        Row: {
          created_at: string;
          demo_id: string;
          duration_s: number;
          id: string;
          notes_changed: number;
          owner: string;
          started_at: string;
          steps: Json;
          target_min: number | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          demo_id: string;
          duration_s: number;
          id?: string;
          notes_changed?: number;
          owner?: string;
          started_at: string;
          steps?: Json;
          target_min?: number | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          demo_id?: string;
          duration_s?: number;
          id?: string;
          notes_changed?: number;
          owner?: string;
          started_at?: string;
          steps?: Json;
          target_min?: number | null;
          workspace_id?: string;
        };
        Relationships: [];
      };
      notification_mutes: {
        Row: { created_at: string; demo_id: string; user_id: string; workspace_id: string };
        Insert: { demo_id: string; workspace_id: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'notification_mutes_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_settings: {
        Row: {
          alert_email_cleared_at: string | null;
          email: boolean;
          email_frequency: string;
          email_prefs: NonNullable<Json>;
          prefs: NonNullable<Json>;
          timezone: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          alert_email_cleared_at?: string | null;
          email?: boolean;
          email_frequency?: string;
          email_prefs?: NonNullable<Json>;
          prefs?: NonNullable<Json>;
          timezone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          alert_email_cleared_at?: string | null;
          email?: boolean;
          email_frequency?: string;
          email_prefs?: NonNullable<Json>;
          prefs?: NonNullable<Json>;
          timezone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          alert_id: string | null;
          comment_id: string | null;
          created_at: string;
          data: Json;
          demo_id: string | null;
          email_forced: boolean;
          emailed_at: string | null;
          id: string;
          kind: string;
          read_at: string | null;
          step_id: string | null;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          alert_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          data?: Json;
          demo_id?: string | null;
          email_forced?: boolean;
          emailed_at?: string | null;
          id?: string;
          kind: string;
          read_at?: string | null;
          step_id?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          alert_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          data?: Json;
          demo_id?: string | null;
          email_forced?: boolean;
          emailed_at?: string | null;
          id?: string;
          kind?: string;
          read_at?: string | null;
          step_id?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      learner_certificates: {
        Row: {
          id: number;
          issued_at: string;
          learner_id: string;
          path_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          issued_at?: string;
          learner_id: string;
          path_id: string;
          workspace_id: string;
        };
        Update: {
          id?: never;
          issued_at?: string;
          learner_id?: string;
          path_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      training_centers: {
        Row: {
          access_mode: string;
          draft: Json;
          password_changed_at: string | null;
          public_page: Json;
          public_page_enabled: boolean;
          published: Json | null;
          published_at: string | null;
          slug: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          access_mode?: string;
          draft?: Json;
          password_changed_at?: string | null;
          published?: Json | null;
          published_at?: string | null;
          slug?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          access_mode?: string;
          draft?: Json;
          password_changed_at?: string | null;
          published?: Json | null;
          published_at?: string | null;
          slug?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      learners: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          last_seen_at: string;
          share_link_id: string | null;
          source: string;
          structure_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          last_seen_at?: string;
          share_link_id?: string | null;
          source: string;
          structure_id?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          last_seen_at?: string;
          share_link_id?: string | null;
          source?: string;
          structure_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [];
      };
      path_modules: {
        Row: {
          demo_id: string;
          path_id: string;
          position: number;
          required: boolean;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          demo_id: string;
          path_id: string;
          position?: number;
          required?: boolean;
          workspace_id: string;
        };
        Update: {
          demo_id?: string;
          path_id?: string;
          position?: number;
          required?: boolean;
          workspace_id?: string;
        };
        Relationships: [];
      };
      paths: {
        Row: {
          created_at: string;
          description: string;
          goal: number;
          id: string;
          ordered: boolean;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          goal?: number;
          id?: string;
          ordered?: boolean;
          title?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          goal?: number;
          id?: string;
          ordered?: boolean;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      structures: {
        Row: {
          created_at: string;
          domains: string[];
          id: string;
          name: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          domains?: string[];
          id?: string;
          name: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          domains?: string[];
          id?: string;
          name?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          answers: NonNullable<Json>;
          correct: number;
          created_at: string;
          demo_id: string;
          id: string;
          link_id: string | null;
          passed: boolean;
          score: number;
          session_id: string | null;
          total: number;
          version_id: string;
          visitor_id: string;
          workspace_id: string;
        };
        Insert: {
          answers: NonNullable<Json>;
          correct: number;
          created_at?: string;
          demo_id: string;
          id?: string;
          link_id?: string | null;
          passed: boolean;
          score: number;
          session_id?: string | null;
          total: number;
          version_id: string;
          visitor_id: string;
          workspace_id: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          correct?: number;
          created_at?: string;
          demo_id?: string;
          id?: string;
          link_id?: string | null;
          passed?: boolean;
          score?: number;
          session_id?: string | null;
          total?: number;
          version_id?: string;
          visitor_id?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          active: boolean;
          channels: string[];
          checked_at: string;
          created_at: string;
          created_by: string | null;
          demo_id: string | null;
          digest_at: string | null;
          frequency: string;
          id: string;
          last_fired_at: string | null;
          last_state: boolean;
          path_id: string | null;
          pending: number;
          segment_id: string | null;
          threshold: number | null;
          trigger: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          active?: boolean;
          channels?: string[];
          demo_id?: string | null;
          frequency?: string;
          id?: string;
          path_id?: string | null;
          segment_id?: string | null;
          threshold?: number | null;
          trigger: string;
          workspace_id: string;
        };
        /** État interne (pending, last_state…) réservé à alerts_tick. */
        Update: {
          active?: boolean;
          channels?: string[];
          demo_id?: string | null;
          frequency?: string;
          path_id?: string | null;
          segment_id?: string | null;
          threshold?: number | null;
          trigger?: string;
        };
        Relationships: [];
      };
      demo_datasets: {
        Row: {
          bindings: Json;
          columns: Json;
          created_at: string;
          created_by: string | null;
          demo_id: string;
          id: string;
          link_column: string | null;
          name: string;
          row_mode: string;
          rows: Json;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          bindings?: Json;
          columns: Json;
          demo_id: string;
          id?: string;
          link_column?: string | null;
          name: string;
          row_mode?: string;
          rows?: Json;
          workspace_id: string;
        };
        Update: {
          bindings?: Json;
          columns?: Json;
          link_column?: string | null;
          name?: string;
          row_mode?: string;
          rows?: Json;
        };
        Relationships: [];
      };
      demo_addresses: {
        Row: {
          address: string;
          created_at: string;
          demo_id: string;
          retired_at: string | null;
          workspace_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      demo_pages: {
        Row: {
          cta_label: string | null;
          cta_url: string | null;
          demo_id: string;
          description: string;
          enabled: boolean;
          indexable: boolean;
          related: boolean;
          style: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          cta_label?: string | null;
          cta_url?: string | null;
          demo_id: string;
          description?: string;
          enabled?: boolean;
          indexable?: boolean;
          related?: boolean;
          style?: string;
          title?: string;
          workspace_id?: string;
        };
        Update: {
          cta_label?: string | null;
          cta_url?: string | null;
          description?: string;
          enabled?: boolean;
          indexable?: boolean;
          related?: boolean;
          style?: string;
          title?: string;
        };
        Relationships: [];
      };
      segments: {
        Row: {
          conditions: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          match: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          conditions: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          match?: string;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          conditions?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          match?: string;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      survey_text_answers: {
        Row: {
          attempt_id: string;
          body: string;
          created_at: string;
          demo_id: string;
          id: string;
          question_id: string;
          visitor_id: string;
          workspace_id: string;
        };
        /** Écrites seulement par submit_quiz_attempt (aucune écriture directe). */
        Insert: never;
        Update: never;
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          answers: NonNullable<Json>;
          created_at: string;
          demo_id: string;
          explanation: string;
          id: string;
          points: number;
          position: number;
          prompt: string;
          step_id: string | null;
          type: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          answers?: NonNullable<Json>;
          created_at?: string;
          demo_id: string;
          explanation?: string;
          id?: string;
          points?: number;
          position?: number;
          prompt?: string;
          step_id?: string | null;
          type?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          created_at?: string;
          demo_id?: string;
          explanation?: string;
          id?: string;
          points?: number;
          position?: number;
          prompt?: string;
          step_id?: string | null;
          type?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      share_links: {
        Row: {
          created_at: string;
          created_by: string | null;
          demo_id: string;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          name: string;
          token: string;
          variables: NonNullable<Json>;
          workspace_id: string;
          page_enabled: boolean;
          page_title: string;
          page_message: string;
          signed_by: string | null;
          dataset_row: number | null;
          cta_label: string | null;
          cta_url: string | null;
          page_code: string | null;
          cohort: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          demo_id: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          token?: string;
          variables?: NonNullable<Json>;
          workspace_id: string;
          page_enabled?: boolean;
          page_title?: string;
          page_message?: string;
          signed_by?: string | null;
          dataset_row?: number | null;
          cta_label?: string | null;
          cta_url?: string | null;
          cohort?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          demo_id?: string;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          token?: string;
          variables?: NonNullable<Json>;
          workspace_id?: string;
          page_enabled?: boolean;
          page_title?: string;
          page_message?: string;
          signed_by?: string | null;
          dataset_row?: number | null;
          cta_label?: string | null;
          cta_url?: string | null;
          cohort?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'share_links_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'share_links_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      step_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          demo_id: string;
          id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          step_id: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          demo_id?: string;
          id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          step_id: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          demo_id?: string;
          id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          step_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      steps: {
        Row: {
          original: Json | null;
          voice_autoplay: boolean;
          voice_duration_ms: number | null;
          voice_path: string | null;
          voice_transcript: string | null;
          alt_text: string | null;
          video: Json;
          video_duration_ms: number | null;
          video_path: string | null;
          html_path: string | null;
          html_ops: Json;
          html_meta: Json;
          before_blurs: NonNullable<Json>;
          before_image_height: number | null;
          before_image_path: string | null;
          before_image_width: number | null;
          blurs: NonNullable<Json>;
          body: string;
          chapter_id: string | null;
          created_at: string;
          cta: Json | null;
          demo_id: string;
          element_meta: NonNullable<Json>;
          gate_form_id: string | null;
          id: string;
          image_height: number | null;
          image_path: string | null;
          image_width: number | null;
          kind: Database['public']['Enums']['step_kind'];
          page_title: string | null;
          page_url: string | null;
          position: number;
          snapshot_path: string | null;
          title: string;
          to_capture: boolean;
          updated_at: string;
          workspace_id: string;
          zoom: Json | null;
          options: NonNullable<Json>;
          presenter_notes: string;
        };
        ComputedFields: never;
        Insert: {
          original?: Json | null;
          voice_autoplay?: boolean;
          voice_duration_ms?: number | null;
          voice_path?: string | null;
          voice_transcript?: string | null;
          alt_text?: string | null;
          video?: Json;
          video_duration_ms?: number | null;
          video_path?: string | null;
          html_path?: string | null;
          html_ops?: Json;
          html_meta?: Json;
          before_blurs?: NonNullable<Json>;
          before_image_height?: number | null;
          before_image_path?: string | null;
          before_image_width?: number | null;
          blurs?: NonNullable<Json>;
          body?: string;
          chapter_id?: string | null;
          created_at?: string;
          cta?: Json | null;
          demo_id: string;
          element_meta?: NonNullable<Json>;
          gate_form_id?: string | null;
          id?: string;
          image_height?: number | null;
          image_path?: string | null;
          image_width?: number | null;
          kind?: Database['public']['Enums']['step_kind'];
          page_title?: string | null;
          page_url?: string | null;
          position?: number;
          snapshot_path?: string | null;
          title?: string;
          to_capture?: boolean;
          updated_at?: string;
          workspace_id: string;
          zoom?: Json | null;
          options?: NonNullable<Json>;
          presenter_notes?: string;
        };
        Update: {
          original?: Json | null;
          voice_autoplay?: boolean;
          voice_duration_ms?: number | null;
          voice_path?: string | null;
          voice_transcript?: string | null;
          alt_text?: string | null;
          video?: Json;
          video_duration_ms?: number | null;
          video_path?: string | null;
          html_path?: string | null;
          html_ops?: Json;
          html_meta?: Json;
          before_blurs?: NonNullable<Json>;
          before_image_height?: number | null;
          before_image_path?: string | null;
          before_image_width?: number | null;
          blurs?: NonNullable<Json>;
          body?: string;
          chapter_id?: string | null;
          created_at?: string;
          cta?: Json | null;
          demo_id?: string;
          element_meta?: NonNullable<Json>;
          gate_form_id?: string | null;
          id?: string;
          image_height?: number | null;
          image_path?: string | null;
          image_width?: number | null;
          kind?: Database['public']['Enums']['step_kind'];
          page_title?: string | null;
          page_url?: string | null;
          position?: number;
          snapshot_path?: string | null;
          title?: string;
          to_capture?: boolean;
          updated_at?: string;
          workspace_id?: string;
          zoom?: Json | null;
          options?: NonNullable<Json>;
          presenter_notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'steps_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'steps_demo_id_fkey';
            columns: ['demo_id'];
            isOneToOne: false;
            referencedRelation: 'demos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'steps_gate_form_id_fkey';
            columns: ['gate_form_id'];
            isOneToOne: false;
            referencedRelation: 'forms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'steps_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          current_period_end: string | null;
          plan_code: string;
          provider: string | null;
          provider_ref: string | null;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          current_period_end?: string | null;
          plan_code: string;
          provider?: string | null;
          provider_ref?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          current_period_end?: string | null;
          plan_code?: string;
          provider?: string | null;
          provider_ref?: string | null;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_plan_code_fkey';
            columns: ['plan_code'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'subscriptions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      themes: {
        Row: {
          builtin_key: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_default: boolean;
          name: string;
          tokens: NonNullable<Json>;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          builtin_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          tokens?: NonNullable<Json>;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          builtin_key?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          tokens?: NonNullable<Json>;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'themes_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      ab_tests: {
        Row: {
          created_by: string | null;
          demo_id: string;
          ended_at: string | null;
          goal: string;
          history: NonNullable<Json>;
          hotspot_id: string | null;
          id: string;
          kept: string | null;
          label_b: string;
          split_b: number;
          started_at: string;
          status: string;
          step_id: string;
          variant_b: NonNullable<Json>;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      media_files: {
        Row: {
          created_at: string;
          created_by: string | null;
          height: number | null;
          id: string;
          kind: string;
          mime: string;
          name: string;
          path: string;
          size_bytes: number;
          width: number | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      glossary_terms: {
        Row: {
          created_at: string;
          created_by: string | null;
          definition: string;
          forms: string[];
          id: string;
          old_term: string | null;
          term: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          definition: string;
          forms?: string[];
          id?: string;
          old_term?: string | null;
          term: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          definition?: string;
          forms?: string[];
          id?: string;
          old_term?: string | null;
          term?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'glossary_terms_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      variables: {
        Row: {
          default_value: string;
          description: string;
          example: string;
          id: string;
          key: string;
          label: string;
          value: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          default_value?: string;
          description?: string;
          example?: string;
          id?: string;
          key: string;
          label?: string;
          value?: string | null;
          workspace_id: string;
        };
        Update: {
          default_value?: string;
          description?: string;
          example?: string;
          id?: string;
          key?: string;
          label?: string;
          value?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'variables_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          logo_path: string | null;
          brand_primary: string | null;
          brand_accent: string | null;
          name: string;
          plan_code: string;
          public_links_enabled: boolean;
          visit_measure: boolean;
          visit_gap_minutes: number;
          settings: NonNullable<Json>;
          slug: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          logo_path?: string | null;
          brand_primary?: string | null;
          brand_accent?: string | null;
          name: string;
          plan_code?: string;
          public_links_enabled?: boolean;
          visit_measure?: boolean;
          visit_gap_minutes?: number;
          settings?: NonNullable<Json>;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          logo_path?: string | null;
          brand_primary?: string | null;
          brand_accent?: string | null;
          name?: string;
          plan_code?: string;
          public_links_enabled?: boolean;
          visit_measure?: boolean;
          visit_gap_minutes?: number;
          settings?: NonNullable<Json>;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspaces_plan_code_fkey';
            columns: ['plan_code'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['code'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      public_page_info: { Args: { p_ws: string }; Returns: Json };
      public_page_demo: { Args: { p_demo: string }; Returns: Json };
      set_public_page_demo: { Args: { p_demo: string; p_shown: boolean }; Returns: Json };
      media_file_demos: { Args: { p_id: string }; Returns: Json };
      rename_media_file: { Args: { p_id: string; p_name: string }; Returns: undefined };
      set_media_kind: { Args: { p_id: string; p_kind: string }; Returns: undefined };
      save_public_page: {
        Args: { p_ws: string; p_slug: string; p_page: Json; p_enabled: boolean; p_replace?: boolean };
        Returns: undefined;
      };
      create_api_key: {
        Args: { p_workspace: string; p_name: string; p_scopes: string[]; p_expires_days?: number | null };
        Returns: Json;
      };
      rename_api_key: { Args: { p_id: string; p_name: string }; Returns: undefined };
      revoke_api_key: { Args: { p_id: string }; Returns: undefined };
      answer_invitation: { Args: { p_accept: boolean; p_invitation: string }; Returns: string | null };
      email_budget_today: { Args: { p_workspace: string }; Returns: Json };
      invite_quota: { Args: { p_workspace: string }; Returns: Json };
      shares_workspace: { Args: { p_other: string }; Returns: boolean };
      my_invitations: {
        Args: never;
        Returns: Array<{ id: string; workspace_name: string; inviter_name: string | null; expires_at: string }>;
      };
      console_add_owner: { Args: { p_email: string; p_role: string }; Returns: string };
      console_articles: { Args: { p_days?: number; p_workspace?: string | null }; Returns: Json };
      console_audit_list: { Args: { p_limit?: number }; Returns: Json };
      console_comments: { Args: { p_article?: string | null; p_days?: number; p_workspace?: string | null }; Returns: Json };
      console_create_item: {
        Args: { p_article?: string | null; p_comments?: string[]; p_github_url?: string | null; p_priority?: string; p_title: string };
        Returns: string;
      };
      console_delete_comment: { Args: { p_comment: string }; Returns: undefined };
      console_item: { Args: { p_id: string }; Returns: Json };
      console_items: { Args: never; Returns: Json };
      console_link_comments: { Args: { p_comments: string[]; p_item: string }; Returns: number };
      console_log_event: { Args: { p_action: string; p_label?: string }; Returns: undefined };
      console_me: { Args: never; Returns: string | null };
      console_news: { Args: never; Returns: Json };
      console_overview: { Args: { p_days?: number }; Returns: Json };
      console_remove_owner: { Args: { p_user: string }; Returns: undefined };
      console_save_news: {
        Args: { p_article: string | null; p_body: string; p_id: string | null; p_item: string | null; p_publish: boolean; p_title: string };
        Returns: string;
      };
      console_set_comments: { Args: { p_comments: string[]; p_status: string }; Returns: undefined };
      console_set_owner_role: { Args: { p_role: string; p_user: string }; Returns: undefined };
      console_team: { Args: never; Returns: Json };
      console_update_item: { Args: { p_id: string; p_patch: Json }; Returns: undefined };
      console_withdraw_news: { Args: { p_id: string }; Returns: undefined };
      console_workspaces: { Args: never; Returns: Json };
      help_comment: { Args: { p_entry: string; p_text: string }; Returns: undefined };
      help_vote: { Args: { p_article: string; p_helpful: boolean; p_page: string; p_workspace: string }; Returns: string };
      is_platform_admin: { Args: never; Returns: boolean };
      is_platform_owner: { Args: never; Returns: boolean };
      list_product_news: { Args: never; Returns: Json };
      my_help_vote: { Args: { p_article: string; p_workspace: string }; Returns: Json };
      news_mark_seen: { Args: never; Returns: undefined };
      news_unseen_count: { Args: never; Returns: number };
      analytics_series: {
        Args: {
          p_demo?: string | null;
          p_from: string;
          p_source?: string | null;
          p_segment?: Json | null;
          p_to?: string;
          p_workspace: string;
        };
        Returns: Json;
      };
      create_workspace: {
        Args: { p_name: string; p_slug?: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          plan_code: string;
          public_links_enabled: boolean;
          visit_measure: boolean;
          visit_gap_minutes: number;
          settings: NonNullable<Json>;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'workspaces';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      demo_analytics: { Args: { p_demo: string; p_from?: string; p_to?: string }; Returns: Json };
      demo_workspace: { Args: { p_demo: string }; Returns: string };
      duplicate_demo: { Args: { p_demo: string }; Returns: string };
      // L32 : lectures de démarrage regroupées (tableau de bord, éditeur)
      dashboard_home: { Args: { p_ws: string }; Returns: Json };
      demo_step_counts: { Args: { p_ws: string }; Returns: Json };
      merge_tags: { Args: { p_from: string; p_to: string }; Returns: number };
      editor_load: { Args: { p_demo: string }; Returns: Json };
      ensure_events_partitions: { Args: { months_ahead?: number }; Returns: undefined };
      finalize_publication: { Args: { p_version: string }; Returns: undefined };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          accepted: boolean;
          email: string;
          expired: boolean;
          role: Database['public']['Enums']['workspace_role'];
          workspace_name: string;
        }[];
      };
      has_role: {
        Args: { min_role: Database['public']['Enums']['workspace_role']; ws: string };
        Returns: boolean;
      };
      limit_reached: { Args: { current_count: number; key: string; ws: string }; Returns: boolean };
      list_members: {
        Args: { p_workspace: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          role: Database['public']['Enums']['workspace_role'];
          user_id: string;
        }[];
      };
      my_role: { Args: { ws: string }; Returns: Database['public']['Enums']['workspace_role'] };
      path_uuid: { Args: { idx: number; path: string }; Returns: string };
      plan_limit: { Args: { key: string; ws: string }; Returns: Json };
      publish_demo: { Args: { p_ack?: Json; p_demo: string }; Returns: Json };
      quiz_stats: { Args: { p_demo: string }; Returns: Json };
      learners_progress: { Args: { p_workspace: string }; Returns: Json };
      learner_detail: { Args: { p_learner: string }; Returns: Json };
      mark_notifications_read: { Args: { p_ids?: string[] | null }; Returns: number };
      record_diffusion: {
        Args: { p_demo: string; p_kind: string; p_label: string; p_settings?: Json };
        Returns: string;
      };
      demo_embed_views: { Args: { p_demo: string }; Returns: Json };
      glossary_import: { Args: { p_ws: string; p_rows: Json; p_replace?: boolean }; Returns: Json };
      glossary_set_underline: { Args: { p_ws: string; p_on: boolean }; Returns: undefined };
      glossary_usage: { Args: { p_ws: string }; Returns: Json };
      ab_start: { Args: { p_hotspot: string; p_label?: string }; Returns: string };
      ab_update: {
        Args: { p_test: string; p_label?: string; p_b?: Json; p_split?: number; p_goal?: string };
        Returns: undefined;
      };
      ab_end: { Args: { p_test: string; p_keep?: string }; Returns: undefined };
      ab_results: { Args: { p_test: string; p_goal?: string }; Returns: Json };
      media_used: { Args: { p_ws: string }; Returns: number };
      media_usage: { Args: { p_ws: string }; Returns: Json };
      webhook_create: { Args: { p_ws: string; p_url: string; p_events: string[]; p_name?: string }; Returns: Json };
      webhook_rotate_secret: { Args: { p_id: string }; Returns: string };
      webhook_send_test: { Args: { p_id: string }; Returns: string };
      webhook_replay: { Args: { p_delivery: string }; Returns: string };
      webhook_set_state: { Args: { p_id: string; p_state: string }; Returns: undefined };
      webhook_url_ok: { Args: { p_url: string }; Returns: boolean };
      webhook_event_types: { Args: Record<string, never>; Returns: string[] };
      issue_certificate: { Args: { p_link_token: string; p_path: string }; Returns: Json };
      structure_overview: { Args: { p_path: string }; Returns: Json };
      grant_quiz_attempt: { Args: { p_demo: string; p_learner: string }; Returns: number };
      record_reminders: { Args: { p_learners: string[] }; Returns: string[] };
      log_learners_export: {
        Args: { p_columns: string[]; p_rows: number; p_workspace: string };
        Returns: undefined;
      };
      erase_learner: { Args: { p_confirm: string; p_learner: string }; Returns: undefined };
      learner_resume: { Args: { p_demo: string; p_link_token: string }; Returns: Json };
      center_slug_available: { Args: { p_slug: string; p_ws: string }; Returns: boolean };
      save_center_draft: { Args: { p_draft: Json; p_slug: string; p_ws: string }; Returns: undefined };
      publish_center: { Args: { p_ws: string }; Returns: string };
      unpublish_center: { Args: { p_ws: string }; Returns: undefined };
      set_center_access: { Args: { p_mode: string; p_ws: string }; Returns: undefined };
      slack_webhook_connected: { Args: { p_ws: string }; Returns: boolean };
      slack_webhook_remove: { Args: { p_ws: string }; Returns: undefined };
      slack_webhook_set: { Args: { p_url: string; p_ws: string }; Returns: undefined };
      slack_webhook_test: { Args: { p_ws: string }; Returns: number | null };
      set_center_password: { Args: { p_password: string; p_ws: string }; Returns: undefined };
      submit_quiz_attempt: { Args: { p_batch: Json }; Returns: Json };
      segment_count: {
        Args: { p_workspace: string; p_segment: Json; p_from: string; p_to?: string };
        Returns: Json;
      };
      public_page: { Args: { p_demo: string }; Returns: Json };
      personal_page: { Args: { p_demo: string; p_code: string }; Returns: Json };
      live_demo: { Args: { p_demo: string }; Returns: Json };
      live_space: { Args: { p_workspace: string; p_demo?: string }; Returns: Json };
      live_visits: { Args: { p_demo: string }; Returns: Json };
      present_remote_start: { Args: { p_demo: string }; Returns: Json };
      present_remote_new_code: { Args: { p_id: string }; Returns: Json };
      present_remote_status: { Args: { p_id: string }; Returns: Json };
      present_remote_end: { Args: { p_id: string }; Returns: undefined };
      extension_seen: { Args: Record<PropertyKey, never>; Returns: undefined };
      extension_report: { Args: { p_version: string; p_demo?: string }; Returns: undefined };
      workspace_onboarding: { Args: { p_ws: string }; Returns: Json };
      set_default_style: {
        Args: { p_ws: string; p_builtin?: string | null; p_theme?: string | null };
        Returns: undefined;
      };
      default_style_impact: { Args: { p_ws: string }; Returns: number };
      set_folder_access: {
        Args: { p_folder: string; p_restricted: boolean; p_users?: string[] };
        Returns: undefined;
      };
      folder_hidden_count: { Args: { p_folder: string }; Returns: number };
      share_rules_preview: {
        Args: { p_ws: string; p_modes: string[]; p_max_days: number | null };
        Returns: Json;
      };
      // L30 : Assistance IA
      ai_status: { Args: { p_ws: string }; Returns: Json };
      ai_enabled: { Args: { p_ws: string }; Returns: boolean };
      set_ai_settings: {
        Args: {
          p_ws: string;
          p_enabled: boolean;
          p_features?: Json | null;
          p_monthly_requests?: number | null;
          p_user_daily_requests?: number | null;
        };
        Returns: Json;
      };
      set_html_capture: {
        Args: { p_ws: string; p_mode: string; p_domains?: string[] };
        Returns: Json;
      };
      set_share_rules: {
        Args: {
          p_ws: string;
          p_modes: string[];
          p_max_days: number | null;
          p_publish_role: string;
          p_exports: boolean;
          p_fix?: boolean;
        };
        Returns: Json;
      };
      template_set_images: { Args: { p_template: string; p_map: Json }; Returns: undefined };
      save_demo_as_template: {
        Args: {
          p_demo: string;
          p_name: string;
          p_description: string;
          p_category: string;
          p_with_captures: boolean;
          p_ack?: boolean | null;
        };
        Returns: string;
      };
      create_demo_from_template: {
        Args: { p_template: string; p_ws: string; p_folder?: string | null };
        Returns: string;
      };
      present_remote_pair: { Args: { p_id: string | null; p_code: string }; Returns: Json };
      present_remote_state: { Args: { p_token: string }; Returns: Json };
      session_visits: { Args: { p_workspace: string; p_sessions: string[] }; Returns: Json };
      workspace_returning: {
        Args: {
          p_workspace: string;
          p_from: string;
          p_to?: string;
          p_demo?: string | null;
          p_source?: string | null;
          p_segment?: Json | null;
        };
        Returns: Json;
      };
      survey_results: { Args: { p_demo: string; p_from?: string; p_to?: string }; Returns: Json };
      survey_texts: { Args: { p_demo: string; p_question?: string | null; p_limit?: number }; Returns: Json };
      choice_results: { Args: { p_demo: string; p_from?: string; p_to?: string }; Returns: Json };
      purge_old_events: { Args: Record<PropertyKey, never>; Returns: number };
      restore_original_sizes: { Args: { p_demo: string }; Returns: number };
      account_deletion_check: { Args: Record<PropertyKey, never>; Returns: Json };
      delete_my_account: {
        Args: { p_email: string; p_password?: string | null; p_orphans?: Json };
        Returns: undefined;
      };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      resolve_demo_address: { Args: { p_address: string }; Returns: string | null };
      resolve_share_link: { Args: { p_token: string }; Returns: Json };
      set_demo_address: { Args: { p_demo: string; p_label: string }; Returns: string };
      set_demo_access: {
        Args: { p_ask_email: boolean; p_demo: string; p_expires_at: string | null; p_mode: string };
        Returns: undefined;
      };
      set_demo_password: { Args: { p_demo: string; p_password: string }; Returns: undefined };
      set_demo_domains: { Args: { p_demo: string; p_domains: string[] }; Returns: string[] };
      add_demo_invites: { Args: { p_demo: string; p_emails: string[] }; Returns: string[] };
      remove_demo_invite: { Args: { p_demo: string; p_email: string }; Returns: undefined };
      submit_lead: {
        Args: {
          p_consent?: boolean;
          p_demo: string;
          p_email: string;
          p_fields?: Json;
          p_link_token?: string;
          p_version: string;
          p_visitor?: string;
        };
        Returns: string;
      };
      track_events: { Args: { p_batch: Json }; Returns: number };
      unpublish_demo: { Args: { p_demo: string }; Returns: undefined };
      workspace_overview: {
        Args: { p_days?: number; p_workspace: string };
        Returns: {
          completions: number;
          demo_id: string;
          leads: number;
          views: number;
          visitors: number;
        }[];
      };
      set_comment_resolved: { Args: { p_comment: string; p_resolved: boolean }; Returns: undefined };
      workspace_analytics: {
        Args: {
          p_demo?: string | null;
          p_from: string;
          p_source?: string | null;
          p_segment?: Json | null;
          p_to?: string;
          p_workspace: string;
        };
        Returns: Json;
      };
      workspace_kpis: { Args: { p_from: string; p_to?: string; p_workspace: string }; Returns: Json };
      workspace_leads: {
        Args: {
          p_demo?: string | null;
          p_from: string;
          p_limit?: number;
          p_offset?: number;
          p_segment?: Json | null;
          p_to?: string;
          p_workspace: string;
        };
        Returns: Json;
      };
      workspace_sessions: {
        Args: {
          p_demo?: string | null;
          p_from: string;
          p_limit?: number;
          p_offset?: number;
          p_source?: string | null;
          p_segment?: Json | null;
          p_to?: string;
          p_workspace: string;
        };
        Returns: Json;
      };
      workspace_usage: { Args: { p_workspace: string }; Returns: Json };
    };
    Enums: {
      demo_status: 'draft' | 'published' | 'archived';
      step_kind: 'image' | 'text' | 'html' | 'before_after' | 'video';
      workspace_role: 'viewer' | 'editor' | 'admin' | 'owner';
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
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      demo_status: ['draft', 'published', 'archived'],
      step_kind: ['image', 'text', 'html', 'before_after', 'video'],
      workspace_role: ['viewer', 'editor', 'admin', 'owner'],
    },
  },
} as const;
