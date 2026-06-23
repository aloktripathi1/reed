export type Database = {
  public: {
    Tables: {
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: 'active' | 'resolved' | 'abandoned'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status?: 'active' | 'resolved' | 'abandoned'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: 'active' | 'resolved' | 'abandoned'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      behavioral_signals: {
        Row: {
          id: string
          user_id: string
          type: 'doubt' | 'undervalued_strength' | 'avoidance_pattern' | 'other'
          description: string
          first_observed_at: string
          last_observed_at: string
          occurrence_count: number
          related_goal_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: 'doubt' | 'undervalued_strength' | 'avoidance_pattern' | 'other'
          description: string
          first_observed_at?: string
          last_observed_at?: string
          occurrence_count?: number
          related_goal_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'doubt' | 'undervalued_strength' | 'avoidance_pattern' | 'other'
          description?: string
          first_observed_at?: string
          last_observed_at?: string
          occurrence_count?: number
          related_goal_id?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          started_at: string
          ended_at: string | null
          opened_with_nudge: boolean
          nudge_commitment_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          started_at?: string
          ended_at?: string | null
          opened_with_nudge?: boolean
          nudge_commitment_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          started_at?: string
          ended_at?: string | null
          opened_with_nudge?: boolean
          nudge_commitment_id?: string | null
        }
        Relationships: []
      }
      commitments: {
        Row: {
          id: string
          user_id: string
          description: string
          source_session_id: string | null
          target_timeframe: string | null
          status: 'open' | 'fulfilled' | 'acknowledged_not_done' | 'expired'
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          source_session_id?: string | null
          target_timeframe?: string | null
          status?: 'open' | 'fulfilled' | 'acknowledged_not_done' | 'expired'
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          source_session_id?: string | null
          target_timeframe?: string | null
          status?: 'open' | 'fulfilled' | 'acknowledged_not_done' | 'expired'
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          attachment_filename: string | null
          attachment_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          attachment_filename?: string | null
          attachment_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant'
          content?: string
          attachment_filename?: string | null
          attachment_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Row-type aliases for convenience
export type Goal = Database['public']['Tables']['goals']['Row']
export type BehavioralSignal = Database['public']['Tables']['behavioral_signals']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type Commitment = Database['public']['Tables']['commitments']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
