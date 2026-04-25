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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          daily_earned: number
          daily_earned_date: string | null
          email: string | null
          flagged: boolean
          full_name: string | null
          id: string
          last_checkin: string | null
          last_deposit_at: string | null
          level: number
          locked_balance: number
          referral_code: string
          referred_by: string | null
          total_earnings: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          daily_earned?: number
          daily_earned_date?: string | null
          email?: string | null
          flagged?: boolean
          full_name?: string | null
          id: string
          last_checkin?: string | null
          last_deposit_at?: string | null
          level?: number
          locked_balance?: number
          referral_code: string
          referred_by?: string | null
          total_earnings?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          daily_earned?: number
          daily_earned_date?: string | null
          email?: string | null
          flagged?: boolean
          full_name?: string | null
          id?: string
          last_checkin?: string | null
          last_deposit_at?: string | null
          level?: number
          locked_balance?: number
          referral_code?: string
          referred_by?: string | null
          total_earnings?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          child_user: string
          created_at: string
          depth: number
          id: string
          parent_user: string
        }
        Insert: {
          child_user: string
          created_at?: string
          depth: number
          id?: string
          parent_user: string
        }
        Update: {
          child_user?: string
          created_at?: string
          depth?: number
          id?: string
          parent_user?: string
        }
        Relationships: []
      }
      task_catalog: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          min_level: number
          reward: number
          sort_order: number
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          min_level?: number
          reward?: number
          sort_order?: number
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          min_level?: number
          reward?: number
          sort_order?: number
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          catalog_id: string
          completed_at: string
          id: string
          reward: number
          user_id: string
        }
        Insert: {
          catalog_id: string
          completed_at?: string
          id?: string
          reward?: number
          user_id: string
        }
        Update: {
          catalog_id?: string
          completed_at?: string
          id?: string
          reward?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "task_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks_log: {
        Row: {
          completed_at: string
          id: string
          reward: number
          task_type: Database["public"]["Enums"]["task_type"]
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          reward: number
          task_type: Database["public"]["Enums"]["task_type"]
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          reward?: number
          task_type?: Database["public"]["Enums"]["task_type"]
          user_id?: string
        }
        Relationships: []
      }
      tile_unlocks: {
        Row: {
          fee_paid: number
          id: string
          tile_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          fee_paid?: number
          id?: string
          tile_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          fee_paid?: number
          id?: string
          tile_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["txn_status"]
          target_level: number | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          target_level?: number | null
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          target_level?: number | null
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          id: string
          notes: string | null
          payout_details: string
          payout_method: string
          processed_at: string | null
          requested_at: string
          reviewed_by: string | null
          status: Database["public"]["Enums"]["txn_status"]
          user_id: string
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          payout_details: string
          payout_method: string
          processed_at?: string | null
          requested_at?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          user_id: string
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          payout_details?: string
          payout_method?: string
          processed_at?: string | null
          requested_at?: string
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_first_admin: { Args: never; Returns: boolean }
      claim_admin_with_code: { Args: { _code: string }; Returns: boolean }
      gen_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      task_type: "checkin" | "watch" | "spin"
      txn_status: "pending" | "approved" | "rejected" | "completed"
      txn_type: "reward" | "upgrade" | "withdrawal" | "referral" | "checkin"
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
      app_role: ["admin", "moderator", "user"],
      task_type: ["checkin", "watch", "spin"],
      txn_status: ["pending", "approved", "rejected", "completed"],
      txn_type: ["reward", "upgrade", "withdrawal", "referral", "checkin"],
    },
  },
} as const
