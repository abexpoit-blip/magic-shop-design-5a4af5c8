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
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      application_notes: {
        Row: {
          application_id: string
          author_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          application_id: string
          author_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          application_id?: string
          author_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          address: string | null
          base: string
          bin: string
          brand: string
          cc_number: string | null
          city: string | null
          country: string
          created_at: string
          cvv: string | null
          email: string | null
          exp_month: string | null
          exp_year: string | null
          has_email: boolean
          has_phone: boolean
          holder_name: string | null
          id: string
          phone: string | null
          price: number
          refundable: boolean
          reserved_at: string | null
          reserved_by: string | null
          seller_id: string
          state: string | null
          status: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          base: string
          bin: string
          brand: string
          cc_number?: string | null
          city?: string | null
          country: string
          created_at?: string
          cvv?: string | null
          email?: string | null
          exp_month?: string | null
          exp_year?: string | null
          has_email?: boolean
          has_phone?: boolean
          holder_name?: string | null
          id?: string
          phone?: string | null
          price: number
          refundable?: boolean
          reserved_at?: string | null
          reserved_by?: string | null
          seller_id: string
          state?: string | null
          status?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          base?: string
          bin?: string
          brand?: string
          cc_number?: string | null
          city?: string | null
          country?: string
          created_at?: string
          cvv?: string | null
          email?: string | null
          exp_month?: string | null
          exp_year?: string | null
          has_email?: boolean
          has_phone?: boolean
          holder_name?: string | null
          id?: string
          phone?: string | null
          price?: number
          refundable?: boolean
          reserved_at?: string | null
          reserved_by?: string | null
          seller_id?: string
          state?: string | null
          status?: string
          zip?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          added_at: string
          card_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          card_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          card_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards_public"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_addresses: {
        Row: {
          address: string
          id: string
          method: string
          network: string | null
          qr_url: string | null
          updated_at: string
        }
        Insert: {
          address: string
          id?: string
          method: string
          network?: string | null
          qr_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          id?: string
          method?: string
          network?: string | null
          qr_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          txid: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          txid?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          txid?: string | null
          user_id?: string
        }
        Relationships: []
      }
      news_updates: {
        Row: {
          count: number
          created_at: string
          id: string
          label: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          card_snapshot: Json
          id: string
          order_id: string
          price: number
        }
        Insert: {
          card_snapshot: Json
          id?: string
          order_id: string
          price: number
        }
        Update: {
          card_snapshot?: Json
          id?: string
          order_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          status: string
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          address: string
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          paid_at: string | null
          seller_id: string
          status: string
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          id?: string
          method: string
          note?: string | null
          paid_at?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: []
      }
      price_rules: {
        Row: {
          brand: string | null
          country: string | null
          created_at: string
          id: string
          price: number
          priority: number
          refundable: boolean | null
          seller_id: string
        }
        Insert: {
          brand?: string | null
          country?: string | null
          created_at?: string
          id?: string
          price: number
          priority?: number
          refundable?: boolean | null
          seller_id: string
        }
        Update: {
          brand?: string | null
          country?: string | null
          created_at?: string
          id?: string
          price?: number
          priority?: number
          refundable?: boolean | null
          seller_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          banned: boolean
          commission_percent: number
          created_at: string
          display_name: string | null
          id: string
          is_seller: boolean
          is_seller_verified: boolean
          is_seller_visible: boolean
          seller_bio: string | null
          seller_display_name: string | null
          seller_status: string | null
          trust_tier: Database["public"]["Enums"]["trust_tier"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          banned?: boolean
          commission_percent?: number
          created_at?: string
          display_name?: string | null
          id: string
          is_seller?: boolean
          is_seller_verified?: boolean
          is_seller_visible?: boolean
          seller_bio?: string | null
          seller_display_name?: string | null
          seller_status?: string | null
          trust_tier?: Database["public"]["Enums"]["trust_tier"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          banned?: boolean
          commission_percent?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_seller?: boolean
          is_seller_verified?: boolean
          is_seller_visible?: boolean
          seller_bio?: string | null
          seller_display_name?: string | null
          seller_status?: string | null
          trust_tier?: Database["public"]["Enums"]["trust_tier"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          buyer_id: string
          card_id: string | null
          created_at: string
          id: string
          kind: string
          order_id: string | null
          reason: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          status: string
        }
        Insert: {
          buyer_id: string
          card_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          reason?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          buyer_id?: string
          card_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          reason?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_applications: {
        Row: {
          admin_note: string | null
          contact: string | null
          created_at: string
          description: string | null
          expected_volume: string | null
          id: string
          jabber: string | null
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_bins: string | null
          shop_name: string | null
          status: string
          telegram: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          expected_volume?: string | null
          id?: string
          jabber?: string | null
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_bins?: string | null
          shop_name?: string | null
          status?: string
          telegram?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          expected_volume?: string | null
          id?: string
          jabber?: string | null
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_bins?: string | null
          shop_name?: string | null
          status?: string
          telegram?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          default_commission_percent: number
          hero_cta: string
          hero_eyebrow: string
          hero_sub: string
          hero_title: string
          id: number
          min_card_price: number
          shop_name: string
          shop_tag: string
          ticker_items: Json
          updated_at: string
        }
        Insert: {
          default_commission_percent?: number
          hero_cta?: string
          hero_eyebrow?: string
          hero_sub?: string
          hero_title?: string
          id?: number
          min_card_price?: number
          shop_name?: string
          shop_tag?: string
          ticker_items?: Json
          updated_at?: string
        }
        Update: {
          default_commission_percent?: number
          hero_cta?: string
          hero_eyebrow?: string
          hero_sub?: string
          hero_title?: string
          id?: number
          min_card_price?: number
          shop_name?: string
          shop_tag?: string
          ticker_items?: Json
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          reply: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          reply?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          reply?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          method: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          method?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          method?: string | null
          note?: string | null
          user_id?: string
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
      cards_public: {
        Row: {
          base: string | null
          bin: string | null
          brand: string | null
          city: string | null
          country: string | null
          created_at: string | null
          exp_month: string | null
          exp_year: string | null
          has_email: boolean | null
          has_phone: boolean | null
          id: string | null
          price: number | null
          refundable: boolean | null
          seller_id: string | null
          state: string | null
          status: string | null
          zip: string | null
        }
        Insert: {
          base?: string | null
          bin?: string | null
          brand?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          exp_month?: string | null
          exp_year?: string | null
          has_email?: boolean | null
          has_phone?: boolean | null
          id?: string | null
          price?: number | null
          refundable?: boolean | null
          seller_id?: string | null
          state?: string | null
          status?: string | null
          zip?: string | null
        }
        Update: {
          base?: string | null
          bin?: string | null
          brand?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          exp_month?: string | null
          exp_year?: string | null
          has_email?: boolean | null
          has_phone?: boolean | null
          id?: string | null
          price?: number | null
          refundable?: boolean | null
          seller_id?: string | null
          state?: string | null
          status?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "seller" | "user"
      trust_tier: "none" | "verified" | "trusted" | "vip"
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
      app_role: ["admin", "seller", "user"],
      trust_tier: ["none", "verified", "trusted", "vip"],
    },
  },
} as const
