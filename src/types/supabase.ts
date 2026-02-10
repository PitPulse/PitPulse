export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
          updated_at: string
          variant: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          updated_at?: string
          variant?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          location: string | null
          name: string
          start_date: string | null
          tba_key: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          start_date?: string | null
          tba_key: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          start_date?: string | null
          tba_key?: string
          year?: number
        }
        Relationships: []
      }
      matches: {
        Row: {
          blue_score: number | null
          blue_teams: number[]
          comp_level: string
          created_at: string
          event_id: string
          id: string
          match_number: number
          red_score: number | null
          red_teams: number[]
          set_number: number | null
        }
        Insert: {
          blue_score?: number | null
          blue_teams?: number[]
          comp_level: string
          created_at?: string
          event_id: string
          id?: string
          match_number: number
          red_score?: number | null
          red_teams?: number[]
          set_number?: number | null
        }
        Update: {
          blue_score?: number | null
          blue_teams?: number[]
          comp_level?: string
          created_at?: string
          event_id?: string
          id?: string
          match_number?: number
          red_score?: number | null
          red_teams?: number[]
          set_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          team_number: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          name: string
          team_number?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          team_number?: number | null
        }
        Relationships: []
      }
      pick_lists: {
        Row: {
          content: Json
          created_at: string
          event_id: string
          id: string
          org_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          event_id: string
          id?: string
          org_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          event_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_staff: boolean
          onboarding_complete: boolean
          org_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          team_roles: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_staff?: boolean
          onboarding_complete?: boolean
          org_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_roles?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_staff?: boolean
          onboarding_complete?: boolean
          org_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_roles?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scout_assignments: {
        Row: {
          assigned_to: string
          created_at: string | null
          id: string
          match_id: string
          org_id: string
          position: string
          team_number: number
        }
        Insert: {
          assigned_to: string
          created_at?: string | null
          id?: string
          match_id: string
          org_id: string
          position: string
          team_number: number
        }
        Update: {
          assigned_to?: string
          created_at?: string | null
          id?: string
          match_id?: string
          org_id?: string
          position?: string
          team_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "scout_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_assignments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scout_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scouting_entries: {
        Row: {
          auto_mobility: boolean | null
          auto_score: number
          auto_start_position: string | null
          created_at: string
          defense_rating: number
          endgame_score: number
          endgame_state: string | null
          id: string
          match_id: string
          notes: string | null
          org_id: string
          reliability_rating: number
          scouted_by: string
          team_number: number
          teleop_defense: boolean | null
          teleop_score: number
        }
        Insert: {
          auto_mobility?: boolean | null
          auto_score?: number
          auto_start_position?: string | null
          created_at?: string
          defense_rating?: number
          endgame_score?: number
          endgame_state?: string | null
          id?: string
          match_id: string
          notes?: string | null
          org_id: string
          reliability_rating?: number
          scouted_by: string
          team_number: number
          teleop_defense?: boolean | null
          teleop_score?: number
        }
        Update: {
          auto_mobility?: boolean | null
          auto_score?: number
          auto_start_position?: string | null
          created_at?: string
          defense_rating?: number
          endgame_score?: number
          endgame_state?: string | null
          id?: string
          match_id?: string
          notes?: string | null
          org_id?: string
          reliability_rating?: number
          scouted_by?: string
          team_number?: number
          teleop_defense?: boolean | null
          teleop_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "scouting_entries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scouting_entries_scouted_by_fkey"
            columns: ["scouted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_briefs: {
        Row: {
          content: Json
          created_at: string
          id: string
          match_id: string
          org_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          match_id: string
          org_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          match_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_briefs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_briefs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_event_stats: {
        Row: {
          auto_epa: number | null
          created_at: string
          endgame_epa: number | null
          epa: number | null
          event_id: string
          id: string
          last_synced_at: string | null
          team_number: number
          teleop_epa: number | null
          updated_at: string
          win_rate: number | null
        }
        Insert: {
          auto_epa?: number | null
          created_at?: string
          endgame_epa?: number | null
          epa?: number | null
          event_id: string
          id?: string
          last_synced_at?: string | null
          team_number: number
          teleop_epa?: number | null
          updated_at?: string
          win_rate?: number | null
        }
        Update: {
          auto_epa?: number | null
          created_at?: string
          endgame_epa?: number | null
          epa?: number | null
          event_id?: string
          id?: string
          last_synced_at?: string | null
          team_number?: number
          teleop_epa?: number | null
          updated_at?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_event_stats_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          match_key: string | null
          message_type: string
          org_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          match_key?: string | null
          message_type?: string
          org_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          match_key?: string | null
          message_type?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string | null
          state: string | null
          team_number: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string | null
          state?: string | null
          team_number: number
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string | null
          state?: string | null
          team_number?: number
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          name: string
          quote: string
          rating: number
          role: string
          sort_order: number
          team: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          name: string
          quote: string
          rating?: number
          role: string
          sort_order?: number
          team: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          name?: string
          quote?: string
          rating?: number
          role?: string
          sort_order?: number
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: never; Returns: string }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      user_role: "scout" | "strategist" | "captain"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["scout", "strategist", "captain"],
    },
  },
} as const
