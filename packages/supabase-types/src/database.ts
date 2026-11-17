
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "chapters": {
                  Row: {
                    "demo_id": string,"id": string,"position": number,"title": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"id"?: string,"position"?: number,"title"?: string,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"id"?: string,"position"?: number,"title"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chapters_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chapters_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"demo_versions": {
                  Row: {
                    "demo_id": string,"id": string,"manifest": NonNullable<Json>,"number": number,"public_ack": Json | null,"published_at": string,"published_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"id"?: string,"manifest": NonNullable<Json>,"number": number,"public_ack"?: Json | null,"published_at"?: string,"published_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"id"?: string,"manifest"?: NonNullable<Json>,"number"?: number,"public_ack"?: Json | null,"published_at"?: string,"published_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "demo_versions_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "demo_versions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"demos": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"created_by": string | null,"current_version_id": string | null,"deleted_at": string | null,"folder_id": string | null,"id": string,"settings": NonNullable<Json>,"status": Database["public"]['Enums']["demo_status"],"theme_id": string | null,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"deleted_at"?: string | null,"folder_id"?: string | null,"id"?: string,"settings"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["demo_status"],"theme_id"?: string | null,"title"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"deleted_at"?: string | null,"folder_id"?: string | null,"id"?: string,"settings"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["demo_status"],"theme_id"?: string | null,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "demos_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "demo_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "demos_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "demos_theme_id_fkey"
      columns: ["theme_id"]
isOneToOne: false
      referencedRelation: "themes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "demos_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "demo_id": string,"embed_origin": string | null,"hotspot_id": string | null,"id": number,"link_id": string | null,"occurred_at": string,"props": NonNullable<Json>,"referrer_host": string | null,"session_id": string,"step_id": string | null,"step_index": number | null,"type": string,"version_id": string | null,"visitor_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id"?: never,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id": string,"step_id"?: string | null,"step_index"?: number | null,"type": string,"version_id"?: string | null,"visitor_id": string,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id"?: never,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id"?: string,"step_id"?: string | null,"step_index"?: number | null,"type"?: string,"version_id"?: string | null,"visitor_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events_2026_11": {
                  Row: {
                    "demo_id": string,"embed_origin": string | null,"hotspot_id": string | null,"id": number,"link_id": string | null,"occurred_at": string,"props": NonNullable<Json>,"referrer_host": string | null,"session_id": string,"step_id": string | null,"step_index": number | null,"type": string,"version_id": string | null,"visitor_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id": number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id": string,"step_id"?: string | null,"step_index"?: number | null,"type": string,"version_id"?: string | null,"visitor_id": string,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id"?: number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id"?: string,"step_id"?: string | null,"step_index"?: number | null,"type"?: string,"version_id"?: string | null,"visitor_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events_2026_12": {
                  Row: {
                    "demo_id": string,"embed_origin": string | null,"hotspot_id": string | null,"id": number,"link_id": string | null,"occurred_at": string,"props": NonNullable<Json>,"referrer_host": string | null,"session_id": string,"step_id": string | null,"step_index": number | null,"type": string,"version_id": string | null,"visitor_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id": number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id": string,"step_id"?: string | null,"step_index"?: number | null,"type": string,"version_id"?: string | null,"visitor_id": string,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id"?: number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id"?: string,"step_id"?: string | null,"step_index"?: number | null,"type"?: string,"version_id"?: string | null,"visitor_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events_2027_01": {
                  Row: {
                    "demo_id": string,"embed_origin": string | null,"hotspot_id": string | null,"id": number,"link_id": string | null,"occurred_at": string,"props": NonNullable<Json>,"referrer_host": string | null,"session_id": string,"step_id": string | null,"step_index": number | null,"type": string,"version_id": string | null,"visitor_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id": number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id": string,"step_id"?: string | null,"step_index"?: number | null,"type": string,"version_id"?: string | null,"visitor_id": string,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id"?: number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id"?: string,"step_id"?: string | null,"step_index"?: number | null,"type"?: string,"version_id"?: string | null,"visitor_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"events_default": {
                  Row: {
                    "demo_id": string,"embed_origin": string | null,"hotspot_id": string | null,"id": number,"link_id": string | null,"occurred_at": string,"props": NonNullable<Json>,"referrer_host": string | null,"session_id": string,"step_id": string | null,"step_index": number | null,"type": string,"version_id": string | null,"visitor_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_id": string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id": number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id": string,"step_id"?: string | null,"step_index"?: number | null,"type": string,"version_id"?: string | null,"visitor_id": string,"workspace_id": string
                  }
                  Update: {
                    "demo_id"?: string,"embed_origin"?: string | null,"hotspot_id"?: string | null,"id"?: number,"link_id"?: string | null,"occurred_at"?: string,"props"?: NonNullable<Json>,"referrer_host"?: string | null,"session_id"?: string,"step_id"?: string | null,"step_index"?: number | null,"type"?: string,"version_id"?: string | null,"visitor_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"folders": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"parent_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"parent_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"parent_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "folders_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "folders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"forms": {
                  Row: {
                    "consent_text": string,"created_at": string,"demo_id": string | null,"description": string,"fields": NonNullable<Json>,"id": string,"skippable": boolean,"submit_label": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_text"?: string,"created_at"?: string,"demo_id"?: string | null,"description"?: string,"fields"?: NonNullable<Json>,"id"?: string,"skippable"?: boolean,"submit_label"?: string,"title"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "consent_text"?: string,"created_at"?: string,"demo_id"?: string | null,"description"?: string,"fields"?: NonNullable<Json>,"id"?: string,"skippable"?: boolean,"submit_label"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "forms_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "forms_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"hotspots": {
                  Row: {
                    "action": NonNullable<Json>,"body": string,"created_at": string,"cta": Json | null,"demo_id": string,"h": number,"id": string,"placement": string,"position": number,"pulse": boolean,"step_id": string,"title": string,"updated_at": string,"w": number,"workspace_id": string,"x": number,"y": number,"style": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action"?: NonNullable<Json>,"body"?: string,"created_at"?: string,"cta"?: Json | null,"demo_id": string,"h"?: number,"id"?: string,"placement"?: string,"position"?: number,"pulse"?: boolean,"step_id": string,"title"?: string,"updated_at"?: string,"w"?: number,"workspace_id": string,"x": number,"y": number,"style"?: string
                  }
                  Update: {
                    "action"?: NonNullable<Json>,"body"?: string,"created_at"?: string,"cta"?: Json | null,"demo_id"?: string,"h"?: number,"id"?: string,"placement"?: string,"position"?: number,"pulse"?: boolean,"step_id"?: string,"title"?: string,"updated_at"?: string,"w"?: number,"workspace_id"?: string,"x"?: number,"y"?: number,"style"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hotspots_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hotspots_step_id_fkey"
      columns: ["step_id"]
isOneToOne: false
      referencedRelation: "steps"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hotspots_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["workspace_role"],"token": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["workspace_role"],"token"?: string,"workspace_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["workspace_role"],"token"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "consent": boolean,"created_at": string,"demo_id": string | null,"email": string,"fields": NonNullable<Json>,"id": string,"link_id": string | null,"version_id": string | null,"visitor_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent"?: boolean,"created_at"?: string,"demo_id"?: string | null,"email": string,"fields"?: NonNullable<Json>,"id"?: string,"link_id"?: string | null,"version_id"?: string | null,"visitor_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "consent"?: boolean,"created_at"?: string,"demo_id"?: string | null,"email"?: string,"fields"?: NonNullable<Json>,"id"?: string,"link_id"?: string | null,"version_id"?: string | null,"visitor_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_link_id_fkey"
      columns: ["link_id"]
isOneToOne: false
      referencedRelation: "share_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "demo_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "leads_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["workspace_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "code": string,"limits": NonNullable<Json>,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"limits"?: NonNullable<Json>,"name": string,"sort"?: number
                  }
                  Update: {
                    "code"?: string,"limits"?: NonNullable<Json>,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"locale": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"locale"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"learner_progress": {
        Row: {
                    "attempts_used": number,"best_score": number | null,"demo_id": string,"extra_attempts": number,"last_step": number,"learner_id": string,"started_at": string,"status": string,"steps_seen": number,"total_steps": number,"updated_at": string,"validated_at": string | null,"workspace_id": string
                  }
        Insert: {
                    "attempts_used"?: number,"best_score"?: number | null,"demo_id": string,"extra_attempts"?: number,"last_step"?: number,"learner_id": string,"started_at"?: string,"status"?: string,"steps_seen"?: number,"total_steps"?: number,"updated_at"?: string,"validated_at"?: string | null,"workspace_id": string
                  }
        Update: {
                    "attempts_used"?: number,"best_score"?: number | null,"demo_id"?: string,"extra_attempts"?: number,"last_step"?: number,"learner_id"?: string,"started_at"?: string,"status"?: string,"steps_seen"?: number,"total_steps"?: number,"updated_at"?: string,"validated_at"?: string | null,"workspace_id"?: string
                  }
        Relationships: []
      }
"learners": {
        Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"invited_at": string,"last_reminded_at": string | null,"removed_at": string | null,"structure_id": string | null,"token": string,"workspace_id": string
                  }
        Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string,"id"?: string,"invited_at"?: string,"last_reminded_at"?: string | null,"removed_at"?: string | null,"structure_id"?: string | null,"token"?: string,"workspace_id": string
                  }
        Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"invited_at"?: string,"last_reminded_at"?: string | null,"removed_at"?: string | null,"structure_id"?: string | null,"token"?: string,"workspace_id"?: string
                  }
        Relationships: []
      }
"path_modules": {
        Row: {
                    "demo_id": string,"path_id": string,"position": number,"required": boolean,"workspace_id": string
                  }
        Insert: {
                    "demo_id": string,"path_id": string,"position"?: number,"required"?: boolean,"workspace_id"?: string
                  }
        Update: {
                    "demo_id"?: string,"path_id"?: string,"position"?: number,"required"?: boolean,"workspace_id"?: string
                  }
        Relationships: []
      }
"paths": {
        Row: {
                    "created_at": string,"goal": number,"id": string,"ordered": boolean,"title": string,"updated_at": string,"workspace_id": string
                  }
        Insert: {
                    "created_at"?: string,"goal"?: number,"id"?: string,"ordered"?: boolean,"title"?: string,"updated_at"?: string,"workspace_id": string
                  }
        Update: {
                    "created_at"?: string,"goal"?: number,"id"?: string,"ordered"?: boolean,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
        Relationships: []
      }
"structures": {
        Row: {
                    "created_at": string,"domains": string[],"id": string,"name": string,"workspace_id": string
                  }
        Insert: {
                    "created_at"?: string,"domains"?: string[],"id"?: string,"name": string,"workspace_id": string
                  }
        Update: {
                    "created_at"?: string,"domains"?: string[],"id"?: string,"name"?: string,"workspace_id"?: string
                  }
        Relationships: []
      }
"quiz_attempts": {
        Row: {
                    "answers": NonNullable<Json>,"correct": number,"created_at": string,"demo_id": string,"id": string,"learner_id": string | null,"link_id": string | null,"passed": boolean,"score": number,"session_id": string | null,"total": number,"version_id": string,"visitor_id": string,"workspace_id": string
                  }
        Insert: {
                    "answers": NonNullable<Json>,"correct": number,"created_at"?: string,"demo_id": string,"id"?: string,"link_id"?: string | null,"passed": boolean,"score": number,"session_id"?: string | null,"total": number,"version_id": string,"visitor_id": string,"workspace_id": string
                  }
        Update: {
                    "answers"?: NonNullable<Json>,"correct"?: number,"created_at"?: string,"demo_id"?: string,"id"?: string,"link_id"?: string | null,"passed"?: boolean,"score"?: number,"session_id"?: string | null,"total"?: number,"version_id"?: string,"visitor_id"?: string,"workspace_id"?: string
                  }
        Relationships: []
      }
"quiz_questions": {
        Row: {
                    "answers": NonNullable<Json>,"created_at": string,"demo_id": string,"explanation": string,"id": string,"points": number,"position": number,"prompt": string,"step_id": string | null,"type": string,"updated_at": string,"workspace_id": string
                  }
        Insert: {
                    "answers"?: NonNullable<Json>,"created_at"?: string,"demo_id": string,"explanation"?: string,"id"?: string,"points"?: number,"position"?: number,"prompt"?: string,"step_id"?: string | null,"type"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
        Update: {
                    "answers"?: NonNullable<Json>,"created_at"?: string,"demo_id"?: string,"explanation"?: string,"id"?: string,"points"?: number,"position"?: number,"prompt"?: string,"step_id"?: string | null,"type"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
        Relationships: []
      }
"share_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"demo_id": string,"expires_at": string | null,"id": string,"is_active": boolean,"name": string,"token": string,"variables": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"demo_id": string,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"token"?: string,"variables"?: NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"demo_id"?: string,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"token"?: string,"variables"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_links_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "share_links_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"step_comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"demo_id": string,"id": string,"resolved_at": string | null,"resolved_by": string | null,"step_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body": string,"created_at"?: string,"demo_id"?: string,"id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"step_id": string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"demo_id"?: string,"id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"step_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: []
                },"steps": {
                  Row: {
                    "blurs": NonNullable<Json>,"body": string,"chapter_id": string | null,"created_at": string,"cta": Json | null,"demo_id": string,"element_meta": NonNullable<Json>,"gate_form_id": string | null,"id": string,"image_height": number | null,"image_path": string | null,"image_width": number | null,"kind": Database["public"]['Enums']["step_kind"],"page_title": string | null,"page_url": string | null,"position": number,"snapshot_path": string | null,"title": string,"updated_at": string,"workspace_id": string,"zoom": Json | null,"options": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "blurs"?: NonNullable<Json>,"body"?: string,"chapter_id"?: string | null,"created_at"?: string,"cta"?: Json | null,"demo_id": string,"element_meta"?: NonNullable<Json>,"gate_form_id"?: string | null,"id"?: string,"image_height"?: number | null,"image_path"?: string | null,"image_width"?: number | null,"kind"?: Database["public"]['Enums']["step_kind"],"page_title"?: string | null,"page_url"?: string | null,"position"?: number,"snapshot_path"?: string | null,"title"?: string,"updated_at"?: string,"workspace_id": string,"zoom"?: Json | null,"options"?: NonNullable<Json>
                  }
                  Update: {
                    "blurs"?: NonNullable<Json>,"body"?: string,"chapter_id"?: string | null,"created_at"?: string,"cta"?: Json | null,"demo_id"?: string,"element_meta"?: NonNullable<Json>,"gate_form_id"?: string | null,"id"?: string,"image_height"?: number | null,"image_path"?: string | null,"image_width"?: number | null,"kind"?: Database["public"]['Enums']["step_kind"],"page_title"?: string | null,"page_url"?: string | null,"position"?: number,"snapshot_path"?: string | null,"title"?: string,"updated_at"?: string,"workspace_id"?: string,"zoom"?: Json | null,"options"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "steps_chapter_id_fkey"
      columns: ["chapter_id"]
isOneToOne: false
      referencedRelation: "chapters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steps_demo_id_fkey"
      columns: ["demo_id"]
isOneToOne: false
      referencedRelation: "demos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steps_gate_form_id_fkey"
      columns: ["gate_form_id"]
isOneToOne: false
      referencedRelation: "forms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steps_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "current_period_end": string | null,"plan_code": string,"provider": string | null,"provider_ref": string | null,"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_period_end"?: string | null,"plan_code": string,"provider"?: string | null,"provider_ref"?: string | null,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "current_period_end"?: string | null,"plan_code"?: string,"provider"?: string | null,"provider_ref"?: string | null,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "subscriptions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"themes": {
                  Row: {
                    "created_at": string,"id": string,"is_default": boolean,"name": string,"tokens": NonNullable<Json>,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"tokens"?: NonNullable<Json>,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_default"?: boolean,"name"?: string,"tokens"?: NonNullable<Json>,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "themes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"variables": {
                  Row: {
                    "default_value": string,"id": string,"key": string,"label": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "default_value"?: string,"id"?: string,"key": string,"label"?: string,"workspace_id": string
                  }
                  Update: {
                    "default_value"?: string,"id"?: string,"key"?: string,"label"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "variables_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"logo_path": string | null,"name": string,"plan_code": string,"public_links_enabled": boolean,"settings": NonNullable<Json>,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_path"?: string | null,"name": string,"plan_code"?: string,"public_links_enabled"?: boolean,"settings"?: NonNullable<Json>,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"logo_path"?: string | null,"name"?: string,"plan_code"?: string,"public_links_enabled"?: boolean,"settings"?: NonNullable<Json>,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["code"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"create_workspace":
{ Args: { "p_name": string,"p_slug"?: string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"logo_path": string | null,
"name": string,
"plan_code": string,
"public_links_enabled": boolean,
"settings": NonNullable<Json>,
"slug": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "workspaces"
        isOneToOne: true
        isSetofReturn: false
      } },
"demo_analytics":
{ Args: { "p_demo": string,"p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"demo_workspace":
{ Args: { "p_demo": string }; Returns: string
                           },
"duplicate_demo":
{ Args: { "p_demo": string }; Returns: string
                           },
"ensure_events_partitions":
{ Args: { "months_ahead"?: number }; Returns: undefined
                           },
"finalize_publication":
{ Args: { "p_version": string }; Returns: undefined
                           },
"get_invitation":
{ Args: { "p_token": string }; Returns: {
              "accepted": boolean,"email": string,"expired": boolean,"role": Database["public"]['Enums']["workspace_role"],"workspace_name": string
            }[]
                           },
"has_role":
{ Args: { "min_role": Database["public"]['Enums']["workspace_role"],"ws": string }; Returns: boolean
                           },
"limit_reached":
{ Args: { "current_count": number,"key": string,"ws": string }; Returns: boolean
                           },
"list_members":
{ Args: { "p_workspace": string }; Returns: {
              "created_at": string,"email": string,"full_name": string,"role": Database["public"]['Enums']["workspace_role"],"user_id": string
            }[]
                           },
"my_role":
{ Args: { "ws": string }; Returns: Database["public"]['Enums']["workspace_role"]
                           },
"path_uuid":
{ Args: { "idx": number,"path": string }; Returns: string
                           },
"plan_limit":
{ Args: { "key": string,"ws": string }; Returns: Json
                           },
"publish_demo":
{ Args: { "p_ack"?: Json,"p_demo": string }; Returns: Json
                           },
"quiz_stats":
{ Args: { "p_demo": string }; Returns: Json
                           },
"structure_overview":
{ Args: { "p_path": string }; Returns: Json
                           },
"submit_quiz_attempt":
{ Args: { "p_batch": Json }; Returns: Json
                           },
"learner_resume":
{ Args: { "p_demo": string,"p_token": string }; Returns: Json
                           },
"learner_track":
{ Args: { "p_demo": string,"p_step": number,"p_token": string,"p_total": number }; Returns: undefined
                           },
"mark_learners_reminded":
{ Args: { "p_learners": string[] }; Returns: string[]
                           },
"purge_old_events":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"resolve_share_link":
{ Args: { "p_token": string }; Returns: Json
                           },
"submit_lead":
{ Args: { "p_consent"?: boolean,"p_demo": string,"p_email": string,"p_fields"?: Json,"p_link_token"?: string,"p_version": string,"p_visitor"?: string }; Returns: string
                           },
"track_events":
{ Args: { "p_batch": Json }; Returns: number
                           },
"unpublish_demo":
{ Args: { "p_demo": string }; Returns: undefined
                           },
"workspace_overview":
{ Args: { "p_days"?: number,"p_workspace": string }; Returns: {
              "completions": number,"demo_id": string,"leads": number,"views": number,"visitors": number
            }[]
                           },
"set_comment_resolved":
{ Args: { "p_comment": string,"p_resolved": boolean }; Returns: undefined
                           },
"workspace_analytics":
{ Args: { "p_demo"?: string | null,"p_from": string,"p_source"?: string | null,"p_to"?: string,"p_workspace": string }; Returns: Json
                           },
"workspace_kpis":
{ Args: { "p_from": string,"p_to"?: string,"p_workspace": string }; Returns: Json
                           },
"workspace_sessions":
{ Args: { "p_demo"?: string | null,"p_from": string,"p_limit"?: number,"p_offset"?: number,"p_source"?: string | null,"p_to"?: string,"p_workspace": string }; Returns: Json
                           },
"workspace_usage":
{ Args: { "p_workspace": string }; Returns: Json
                           }
          }
          Enums: {
            "demo_status": "draft"|"published"|"archived","step_kind": "image"|"text"|"html","workspace_role": "viewer"|"editor"|"admin"|"owner"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "demo_status": ["draft", "published", "archived"],"step_kind": ["image", "text", "html"],"workspace_role": ["viewer", "editor", "admin", "owner"]
          }
        }
} as const
