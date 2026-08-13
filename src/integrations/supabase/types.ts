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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      day_closures: {
        Row: {
          closed_at: string
          closed_by: string | null
          count: number
          day: string
          id: string
          shop_id: string | null
          shop_key: string | null
          total: number
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          count?: number
          day: string
          id?: string
          shop_id?: string | null
          shop_key?: string | null
          total?: number
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          count?: number
          day?: string
          id?: string
          shop_id?: string | null
          shop_key?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "day_closures_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      device_credentials: {
        Row: {
          created_at: string
          credential_id: string
          device_info: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_info?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_info?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      installment_payments: {
        Row: {
          amount: number
          id: string
          installment_id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          recorded_by: string | null
          recorded_by_name: string | null
        }
        Insert: {
          amount: number
          id?: string
          installment_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
        }
        Update: {
          amount?: number
          id?: string
          installment_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          recorded_by?: string | null
          recorded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string
          customer_note: string | null
          customer_phone: string | null
          deposit: number
          id: string
          sale_id: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_note?: string | null
          customer_phone?: string | null
          deposit?: number
          id?: string
          sale_id: string
          total: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_note?: string | null
          customer_phone?: string | null
          deposit?: number
          id?: string
          sale_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          kind: string
          position: number
          product_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          product_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          position?: number
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          search_text: string | null
          stock: number
          updated_at: string
          variants: string[]
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          search_text?: string | null
          stock?: number
          updated_at?: string
          variants?: string[]
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          search_text?: string | null
          stock?: number
          updated_at?: string
          variants?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          joined_at: string
          name: string
          phone: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id: string
          joined_at?: string
          name: string
          phone: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          joined_at?: string
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: []
      }
      sales: {
        Row: {
          base_price: number
          group_id: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          product_id: string | null
          product_name: string
          receipt_no: string
          shop_id: string | null
          sold_at: string
          sold_by: string | null
          sold_by_name: string | null
          sold_price: number
          variant: string | null
          verify_code: string
        }
        Insert: {
          base_price?: number
          group_id?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          product_id?: string | null
          product_name: string
          receipt_no?: string
          shop_id?: string | null
          sold_at?: string
          sold_by?: string | null
          sold_by_name?: string | null
          sold_price: number
          variant?: string | null
          verify_code?: string
        }
        Update: {
          base_price?: number
          group_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          product_id?: string | null
          product_name?: string
          receipt_no?: string
          shop_id?: string | null
          sold_at?: string
          sold_by?: string | null
          sold_by_name?: string | null
          sold_price?: number
          variant?: string | null
          verify_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      search_cache: {
        Row: {
          created_at: string
          payload: Json
          term: string
        }
        Insert: {
          created_at?: string
          payload: Json
          term: string
        }
        Update: {
          created_at?: string
          payload?: Json
          term?: string
        }
        Relationships: []
      }
      search_terms: {
        Row: {
          hits: number
          id: string
          last_used: string
          term: string
          user_id: string
        }
        Insert: {
          hits?: number
          id?: string
          last_used?: string
          term: string
          user_id: string
        }
        Update: {
          hits?: number
          id?: string
          last_used?: string
          term?: string
          user_id?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          created_at: string
          footer: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          footer?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          footer?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      approval_status: "pending" | "approved" | "denied"
      payment_method: "cash" | "mpesa" | "installment"
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
      app_role: ["admin", "staff"],
      approval_status: ["pending", "approved", "denied"],
      payment_method: ["cash", "mpesa", "installment"],
    },
  },
} as const
