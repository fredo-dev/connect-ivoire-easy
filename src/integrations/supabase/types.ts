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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cabiniste_members: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cabiniste_state: {
        Row: {
          available: boolean
          bonuses: number
          id: boolean
          stock: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available?: boolean
          bonuses?: number
          id?: boolean
          stock?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available?: boolean
          bonuses?: number
          id?: boolean
          stock?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          kind: string
          name: string
          operator: string
          price: number
          validity: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          id?: string
          kind: string
          name: string
          operator: string
          price: number
          validity: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          kind?: string
          name?: string
          operator?: string
          price?: number
          validity?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          operator: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          operator?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          operator?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_prizes: {
        Row: {
          active: boolean
          awarded_at: string | null
          created_at: string
          description: string
          ends_at: string
          id: string
          starts_at: string
          title: string
          winner_id: string | null
        }
        Insert: {
          active?: boolean
          awarded_at?: string | null
          created_at?: string
          description?: string
          ends_at: string
          id?: string
          starts_at: string
          title: string
          winner_id?: string | null
        }
        Update: {
          active?: boolean
          awarded_at?: string | null
          created_at?: string
          description?: string
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      quiz_sessions: {
        Row: {
          answers: Json
          created_at: string
          earned: number
          finish_reason: string | null
          finished_at: string | null
          id: string
          question_deadline: string | null
          questions: Json
          transaction_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          earned?: number
          finish_reason?: string | null
          finished_at?: string | null
          id?: string
          question_deadline?: string | null
          questions: Json
          transaction_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          earned?: number
          finish_reason?: string | null
          finished_at?: string | null
          id?: string
          question_deadline?: string | null
          questions?: Json
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          operator: string
          payment_reference: string | null
          phone: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          operator: string
          payment_reference?: string | null
          phone: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          operator?: string
          payment_reference?: string | null
          phone?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          delivered_at: string | null
          fee: number
          id: string
          jeko_id: string | null
          kind: string
          label: string
          operator: string
          payment_method: string
          phone: string
          plan_id: string | null
          reference: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          delivered_at?: string | null
          fee: number
          id?: string
          jeko_id?: string | null
          kind: string
          label: string
          operator: string
          payment_method: string
          phone: string
          plan_id?: string | null
          reference: string
          status?: string
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          delivered_at?: string | null
          fee?: number
          id?: string
          jeko_id?: string | null
          kind?: string
          label?: string
          operator?: string
          payment_method?: string
          phone?: string
          plan_id?: string | null
          reference?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cabiniste_deliver: {
        Args: { p_transaction: string; p_user: string }
        Returns: Json
      }
      cabiniste_report_issue: {
        Args: { p_reason: string; p_transaction: string; p_user: string }
        Returns: undefined
      }
      cabiniste_set_availability: {
        Args: { p_available: boolean; p_user: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_cabiniste: { Args: { _user_id: string }; Returns: boolean }
      quiz_answer: {
        Args: {
          p_choice: number
          p_index: number
          p_session: string
          p_user: string
        }
        Returns: Json
      }
      quiz_award: { Args: { p_prize: string }; Returns: string }
      quiz_expire: { Args: { p_user: string }; Returns: undefined }
      quiz_next: {
        Args: { p_session: string; p_user: string }
        Returns: undefined
      }
      quiz_start: {
        Args: { p_questions: Json; p_transaction: string; p_user: string }
        Returns: string
      }
      quiz_withdraw: {
        Args: { p_operator: string; p_phone: string; p_user: string }
        Returns: string
      }
      service_is_open: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
