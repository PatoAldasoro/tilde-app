
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "calendar_events": {
                  Row: {
                    "category": string,"confirmed": boolean,"created_at": string,"date": string,"external_id": string | null,"feed_id": string | null,"id": string,"lead_days": number | null,"start_time": string | null,"subject_id": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "category": string,"confirmed"?: boolean,"created_at"?: string,"date": string,"external_id"?: string | null,"feed_id"?: string | null,"id"?: string,"lead_days"?: number | null,"start_time"?: string | null,"subject_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "category"?: string,"confirmed"?: boolean,"created_at"?: string,"date"?: string,"external_id"?: string | null,"feed_id"?: string | null,"id"?: string,"lead_days"?: number | null,"start_time"?: string | null,"subject_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_feed_fk"
      columns: ["feed_id","user_id"]
isOneToOne: false
      referencedRelation: "calendar_feeds"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "calendar_events_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"calendar_feeds": {
                  Row: {
                    "created_at": string,"id": string,"last_synced_at": string | null,"name": string,"skipped": (string)[],"url": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_synced_at"?: string | null,"name": string,"skipped"?: (string)[],"url": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_synced_at"?: string | null,"name"?: string,"skipped"?: (string)[],"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "accent_color": string | null,"created_at": string,"default_task_lead_days": number,"edge_menu": boolean,"locale": string,"theme": string,"timezone": string,"updated_at": string,"user_id": string,"visible_weekdays": (number)[]
                  }
                  Insert: {
                    "accent_color"?: string | null,"created_at"?: string,"default_task_lead_days"?: number,"edge_menu"?: boolean,"locale"?: string,"theme"?: string,"timezone"?: string,"updated_at"?: string,"user_id": string,"visible_weekdays"?: (number)[]
                  }
                  Update: {
                    "accent_color"?: string | null,"created_at"?: string,"default_task_lead_days"?: number,"edge_menu"?: boolean,"locale"?: string,"theme"?: string,"timezone"?: string,"updated_at"?: string,"user_id"?: string,"visible_weekdays"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"schedule_blocks": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"room": string | null,"start_time": string,"subject_id": string,"user_id": string,"weekday": number
                  }
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"room"?: string | null,"start_time": string,"subject_id": string,"user_id"?: string,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"room"?: string | null,"start_time"?: string,"subject_id"?: string,"user_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_blocks_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"schedule_events": {
                  Row: {
                    "color_key": string,"created_at": string,"date": string | null,"end_time": string,"icon": string | null,"id": string,"recurrence": string,"start_date": string | null,"start_time": string,"title": string,"until_date": string | null,"user_id": string,"weekdays": (number)[]
                  }
                  Insert: {
                    "color_key": string,"created_at"?: string,"date"?: string | null,"end_time": string,"icon"?: string | null,"id"?: string,"recurrence"?: string,"start_date"?: string | null,"start_time": string,"title": string,"until_date"?: string | null,"user_id"?: string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "color_key"?: string,"created_at"?: string,"date"?: string | null,"end_time"?: string,"icon"?: string | null,"id"?: string,"recurrence"?: string,"start_date"?: string | null,"start_time"?: string,"title"?: string,"until_date"?: string | null,"user_id"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"schedule_exceptions": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"kind": string,"target_id": string,"target_type": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"kind": string,"target_id": string,"target_type": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"kind"?: string,"target_id"?: string,"target_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"study_session_tasks": {
                  Row: {
                    "created_at": string,"id": string,"session_id": string,"task_id": string | null,"title": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"session_id": string,"task_id"?: string | null,"title": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"session_id"?: string,"task_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_session_tasks_session_id_user_id_fkey"
      columns: ["session_id","user_id"]
isOneToOne: false
      referencedRelation: "study_sessions"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "study_session_tasks_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"study_sessions": {
                  Row: {
                    "away_count": number,"away_seconds": number,"break_seconds": number,"created_at": string,"cycles_completed": number,"ended_at": string,"focus_seconds": number,"id": string,"preset": string,"started_at": string,"subject_id": string | null,"subtasks_completed": number,"user_id": string
                  }
                  Insert: {
                    "away_count"?: number,"away_seconds"?: number,"break_seconds": number,"created_at"?: string,"cycles_completed": number,"ended_at": string,"focus_seconds": number,"id"?: string,"preset": string,"started_at": string,"subject_id"?: string | null,"subtasks_completed"?: number,"user_id"?: string
                  }
                  Update: {
                    "away_count"?: number,"away_seconds"?: number,"break_seconds"?: number,"created_at"?: string,"cycles_completed"?: number,"ended_at"?: string,"focus_seconds"?: number,"id"?: string,"preset"?: string,"started_at"?: string,"subject_id"?: string | null,"subtasks_completed"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_sessions_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"subject_documents": {
                  Row: {
                    "created_at": string,"drive_file_id": string | null,"id": string,"mime_type": string | null,"name": string,"source": string,"subject_id": string,"url": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"drive_file_id"?: string | null,"id"?: string,"mime_type"?: string | null,"name": string,"source": string,"subject_id": string,"url": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"drive_file_id"?: string | null,"id"?: string,"mime_type"?: string | null,"name"?: string,"source"?: string,"subject_id"?: string,"url"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subject_documents_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "archived_at": string | null,"color_key": string,"commission": string | null,"created_at": string,"credits": number | null,"grade_course": number | null,"grade_final": number | null,"icon": string | null,"id": string,"name": string,"sort_order": number,"teacher": string | null,"term_period": number | null,"term_year": number | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"color_key": string,"commission"?: string | null,"created_at"?: string,"credits"?: number | null,"grade_course"?: number | null,"grade_final"?: number | null,"icon"?: string | null,"id"?: string,"name": string,"sort_order"?: number,"teacher"?: string | null,"term_period"?: number | null,"term_year"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color_key"?: string,"commission"?: string | null,"created_at"?: string,"credits"?: number | null,"grade_course"?: number | null,"grade_final"?: number | null,"icon"?: string | null,"id"?: string,"name"?: string,"sort_order"?: number,"teacher"?: string | null,"term_period"?: number | null,"term_year"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"subtasks": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"sort_order": number,"task_id": string,"title": string,"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"sort_order"?: number,"task_id": string,"title": string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"sort_order"?: number,"task_id"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subtasks_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"due_date": string | null,"id": string,"lead_days": number | null,"planned_date": string | null,"priority": string,"sort_order": number,"source_calendar_event_id": string | null,"subject_id": string | null,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"due_date"?: string | null,"id"?: string,"lead_days"?: number | null,"planned_date"?: string | null,"priority"?: string,"sort_order"?: number,"source_calendar_event_id"?: string | null,"subject_id"?: string | null,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"due_date"?: string | null,"id"?: string,"lead_days"?: number | null,"planned_date"?: string | null,"priority"?: string,"sort_order"?: number,"source_calendar_event_id"?: string | null,"subject_id"?: string | null,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_source_calendar_event_id_user_id_fkey"
      columns: ["source_calendar_event_id","user_id"]
isOneToOne: false
      referencedRelation: "calendar_events"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_subject_id_user_id_fkey"
      columns: ["subject_id","user_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_color_key":
{ Args: { "value": string }; Returns: boolean
                           },
"keepalive":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"set_task_order":
{ Args: { "sort_orders": (number)[],"task_ids": (string)[] }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
