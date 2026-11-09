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
      contact_submissions: {
        Row: {
          company: string
          created_at: string
          id: string
          message: string
          name: string
          phone: string
        }
        Insert: {
          company: string
          created_at?: string
          id?: string
          message: string
          name: string
          phone: string
        }
        Update: {
          company?: string
          created_at?: string
          id?: string
          message?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          assigned_to: string | null
          client: string
          created_at: string
          description: string
          id: string
          status: string
          status_note: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          status_note?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          status_note?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      machine_access: {
        Row: {
          machine_id: string
          user_id: string
        }
        Insert: {
          machine_id: string
          user_id: string
        }
        Update: {
          machine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_access_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_opens: {
        Row: {
          id: string
          machine_id: string
          opened_at: string
          user_id: string
        }
        Insert: {
          id?: string
          machine_id: string
          opened_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          machine_id?: string
          opened_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_opens_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          url?: string
        }
        Relationships: []
      }
      material_source: {
        Row: {
          id: number
          kind: string
          name: string
          synced_at: string
          url: string | null
        }
        Insert: {
          id?: number
          kind?: string
          name?: string
          synced_at?: string
          url?: string | null
        }
        Update: {
          id?: number
          kind?: string
          name?: string
          synced_at?: string
          url?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string
          id: string
          stock: string
        }
        Insert: {
          codigo?: string
          created_at?: string
          descripcion?: string
          id?: string
          stock?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string
          id?: string
          stock?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          enabled: boolean
          event: string
          recipients: string[]
        }
        Insert: {
          enabled?: boolean
          event: string
          recipients?: string[]
        }
        Update: {
          enabled?: boolean
          event?: string
          recipients?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_request_edit: boolean
          can_work_reports: boolean
          created_at: string
          id: string
          username: string
        }
        Insert: {
          can_request_edit?: boolean
          can_work_reports?: boolean
          created_at?: string
          id: string
          username: string
        }
        Update: {
          can_request_edit?: boolean
          can_work_reports?: boolean
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform?: string
          token: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      report_fixed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
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
      work_reports: {
        Row: {
          closed: boolean
          created_at: string
          data: Json
          edit_requested: boolean
          edit_used: boolean
          id: string
          number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          data?: Json
          edit_requested?: boolean
          edit_used?: boolean
          id?: string
          number?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          data?: Json
          edit_requested?: boolean
          edit_used?: boolean
          id?: string
          number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      can_work_reports: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_report_edit: { Args: { _id: string }; Returns: undefined }
      set_job_status: {
        Args: { _id: string; _note: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
