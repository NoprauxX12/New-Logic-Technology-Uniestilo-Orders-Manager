export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerta: {
        Row: {
          creada_por: string | null
          destinatario_id: string
          detalle: string
          estado: Database["public"]["Enums"]["estado_alerta"]
          fecha_atencion: string | null
          fecha_creacion: string
          id: string
          orden_id: string
          tela_llegada_en: string | null
          tela_recibida_por: string | null
          tipo: Database["public"]["Enums"]["tipo_alerta"]
        }
        Insert: {
          creada_por?: string | null
          destinatario_id: string
          detalle: string
          estado?: Database["public"]["Enums"]["estado_alerta"]
          fecha_atencion?: string | null
          fecha_creacion?: string
          id?: string
          orden_id: string
          tela_llegada_en?: string | null
          tela_recibida_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_alerta"]
        }
        Update: {
          creada_por?: string | null
          destinatario_id?: string
          detalle?: string
          estado?: Database["public"]["Enums"]["estado_alerta"]
          fecha_atencion?: string | null
          fecha_creacion?: string
          id?: string
          orden_id?: string
          tela_llegada_en?: string | null
          tela_recibida_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_alerta"]
        }
        Relationships: [
          {
            foreignKeyName: "alerta_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerta_tela_recibida_por_fkey"
            columns: ["tela_recibida_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      avance_seccion: {
        Row: {
          anulado_por: string | null
          checkpoint: Database["public"]["Enums"]["checkpoint"]
          fecha_hora: string
          id: string
          observaciones: string | null
          orden_id: string
          usuario_id: string
        }
        Insert: {
          anulado_por?: string | null
          checkpoint: Database["public"]["Enums"]["checkpoint"]
          fecha_hora?: string
          id?: string
          observaciones?: string | null
          orden_id: string
          usuario_id: string
        }
        Update: {
          anulado_por?: string | null
          checkpoint?: Database["public"]["Enums"]["checkpoint"]
          fecha_hora?: string
          id?: string
          observaciones?: string | null
          orden_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avance_seccion_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "reproceso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avance_seccion_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avance_seccion_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente: {
        Row: {
          contacto_celular: string
          contacto_nombre: string
          creado_en: string
          id: string
          nit: string
          razon_social: string
        }
        Insert: {
          contacto_celular: string
          contacto_nombre: string
          creado_en?: string
          id?: string
          nit: string
          razon_social: string
        }
        Update: {
          contacto_celular?: string
          contacto_nombre?: string
          creado_en?: string
          id?: string
          nit?: string
          razon_social?: string
        }
        Relationships: []
      }
      ficha_tecnica: {
        Row: {
          archivo_ruta: string
          fecha_subida: string
          id: string
          orden_id: string
          subida_por: string
        }
        Insert: {
          archivo_ruta: string
          fecha_subida?: string
          id?: string
          orden_id: string
          subida_por: string
        }
        Update: {
          archivo_ruta?: string
          fecha_subida?: string
          id?: string
          orden_id?: string
          subida_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "ficha_tecnica_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ficha_tecnica_subida_por_fkey"
            columns: ["subida_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      item_orden: {
        Row: {
          cantidad: number
          cantidad_tela: number | null
          creado_en: string
          descripcion: string
          id: string
          observaciones: string | null
          observaciones_tela: string | null
          orden_id: string
          tallaje: string | null
          tallas: string
          tipo_tela: string | null
          unidad_tela: string | null
          valor: number
        }
        Insert: {
          cantidad: number
          cantidad_tela?: number | null
          creado_en?: string
          descripcion: string
          id?: string
          observaciones?: string | null
          observaciones_tela?: string | null
          orden_id: string
          tallaje?: string | null
          tallas: string
          tipo_tela?: string | null
          unidad_tela?: string | null
          valor: number
        }
        Update: {
          cantidad?: number
          cantidad_tela?: number | null
          creado_en?: string
          descripcion?: string
          id?: string
          observaciones?: string | null
          observaciones_tela?: string | null
          orden_id?: string
          tallaje?: string | null
          tallas?: string
          tipo_tela?: string | null
          unidad_tela?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_orden_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_taller: {
        Row: {
          descripcion_prendas: string
          enviado_por: string
          fecha_envio: string
          fecha_recepcion: string | null
          id: string
          observaciones_recepcion: string | null
          orden_id: string
          recibido_completo: boolean | null
          recibido_por: string | null
          taller: string
        }
        Insert: {
          descripcion_prendas: string
          enviado_por: string
          fecha_envio?: string
          fecha_recepcion?: string | null
          id?: string
          observaciones_recepcion?: string | null
          orden_id: string
          recibido_completo?: boolean | null
          recibido_por?: string | null
          taller: string
        }
        Update: {
          descripcion_prendas?: string
          enviado_por?: string
          fecha_envio?: string
          fecha_recepcion?: string | null
          id?: string
          observaciones_recepcion?: string | null
          orden_id?: string
          recibido_completo?: boolean | null
          recibido_por?: string | null
          taller?: string
        }
        Relationships: [
          {
            foreignKeyName: "lote_taller_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_taller_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_taller_recibido_por_fkey"
            columns: ["recibido_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      orden: {
        Row: {
          cliente_id: string
          creado_en: string
          creado_por: string | null
          etapa_inicial: Database["public"]["Enums"]["checkpoint"] | null
          fecha_entrega: string
          fecha_ingreso: string
          id: string
          numero_factura: string | null
          numero_orden_compra: string
          numero_orden_programacion: number | null
          observaciones: string | null
          orden_original_id: string | null
          posicion_programacion: number | null
        }
        Insert: {
          cliente_id: string
          creado_en?: string
          creado_por?: string | null
          etapa_inicial?: Database["public"]["Enums"]["checkpoint"] | null
          fecha_entrega: string
          fecha_ingreso: string
          id?: string
          numero_factura?: string | null
          numero_orden_compra: string
          numero_orden_programacion?: number | null
          observaciones?: string | null
          orden_original_id?: string | null
          posicion_programacion?: number | null
        }
        Update: {
          cliente_id?: string
          creado_en?: string
          creado_por?: string | null
          etapa_inicial?: Database["public"]["Enums"]["checkpoint"] | null
          fecha_entrega?: string
          fecha_ingreso?: string
          id?: string
          numero_factura?: string | null
          numero_orden_compra?: string
          numero_orden_programacion?: number | null
          observaciones?: string | null
          orden_original_id?: string | null
          posicion_programacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orden_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_orden_original_id_fkey"
            columns: ["orden_original_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
        ]
      }
      reproceso: {
        Row: {
          checkpoint_destino: Database["public"]["Enums"]["checkpoint"]
          creado_en: string
          creado_por: string
          id: string
          motivo: string
          orden_id: string
        }
        Insert: {
          checkpoint_destino: Database["public"]["Enums"]["checkpoint"]
          creado_en?: string
          creado_por?: string
          id?: string
          motivo: string
          orden_id: string
        }
        Update: {
          checkpoint_destino?: Database["public"]["Enums"]["checkpoint"]
          creado_en?: string
          creado_por?: string
          id?: string
          motivo?: string
          orden_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reproceso_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reproceso_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "orden"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario: {
        Row: {
          activo: boolean
          creado_en: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          email: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
        }
        Update: {
          activo?: boolean
          creado_en?: string
          email?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crear_orden_de_correccion: {
        Args: {
          p_etapa_inicial: Database["public"]["Enums"]["checkpoint"]
          p_fecha_entrega: string
          p_items: Json
          p_motivo: string
          p_orden_original_id: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      devolver_orden_a_etapa: {
        Args: {
          p_checkpoint_destino: Database["public"]["Enums"]["checkpoint"]
          p_motivo: string
          p_orden_id: string
        }
        Returns: string
      }
      generar_alertas_proximidad_entrega: {
        Args: { p_dias?: number }
        Returns: number
      }
      nit_normalizado: { Args: { p_nit: string }; Returns: string }
      orden_espera_tela: { Args: { p_orden_id: string }; Returns: boolean }
      ordenes_esperando_tela: { Args: never; Returns: string[] }
      programar_ordenes_a_diseno: {
        Args: { p_ordenes: string[] }
        Returns: number
      }
      programar_tela: {
        Args: { p_items: Json; p_orden_id: string }
        Returns: undefined
      }
      registrar_orden: {
        Args: {
          p_contacto_celular: string
          p_contacto_nombre: string
          p_fecha_entrega: string
          p_fecha_ingreso: string
          p_items: Json
          p_nit: string
          p_numero_orden_compra: string
          p_observaciones: string
          p_razon_social: string
        }
        Returns: string
      }
      reportar_factura: {
        Args: { p_numero_factura: string; p_orden_id: string }
        Returns: string
      }
      rol_actual: { Args: never; Returns: Database["public"]["Enums"]["rol"] }
      rol_dueno: {
        Args: { p_checkpoint: Database["public"]["Enums"]["checkpoint"] }
        Returns: Database["public"]["Enums"]["rol"]
      }
    }
    Enums: {
      checkpoint:
        | "cotizacion_enviada"
        | "cotizacion_aprobada"
        | "programada_diseno"
        | "ficha_adjunta"
        | "tela_programada"
        | "corte_completado"
        | "recogido_bordado"
        | "llegada_marcacion"
        | "lista_despacho"
        | "etiquetas"
        | "documentos_despacho"
        | "factura_generada"
        | "cerrada"
      estado_alerta: "pendiente" | "atendida"
      rol:
        | "admin"
        | "secretaria"
        | "diseno"
        | "corte"
        | "logistica"
        | "marcacion"
        | "terminacion"
      tipo_alerta: "falta_tela" | "proximidad_entrega"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      checkpoint: [
        "cotizacion_enviada",
        "cotizacion_aprobada",
        "programada_diseno",
        "ficha_adjunta",
        "tela_programada",
        "corte_completado",
        "recogido_bordado",
        "llegada_marcacion",
        "lista_despacho",
        "etiquetas",
        "documentos_despacho",
        "factura_generada",
        "cerrada",
      ],
      estado_alerta: ["pendiente", "atendida"],
      rol: [
        "admin",
        "secretaria",
        "diseno",
        "corte",
        "logistica",
        "marcacion",
        "terminacion",
      ],
      tipo_alerta: ["falta_tela", "proximidad_entrega"],
    },
  },
} as const

