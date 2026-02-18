import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://llowctnahivqcqyenuwt.supabase.co';
const supabaseAnonKey = 'sb_publishable_wsUxe9pAX1tZug9MkH8cRQ_U8xgFB0D';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- DATABASE TYPES ---
export type Database = {
  public: {
    Tables: {
      socios: {
        Row: {
          id: string;
          carnet: string;
          nombre_completo: string;
          dni: string;
          telefono: string;
          fecha_inicio: string;
          forma_pago: 'efectivo' | 'transferencia';
          monto: number;
          estado: 'vigente' | 'vencido';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          carnet: string;
          nombre_completo: string;
          dni: string;
          telefono?: string;
          fecha_inicio?: string;
          forma_pago: 'efectivo' | 'transferencia';
          monto?: number;
          estado?: 'vigente' | 'vencido';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          carnet?: string;
          nombre_completo?: string;
          dni?: string;
          telefono?: string;
          fecha_inicio?: string;
          forma_pago?: 'efectivo' | 'transferencia';
          monto?: number;
          estado?: 'vigente' | 'vencido';
          created_at?: string;
          updated_at?: string;
        };
      };

      retiros: {
        Row: {
          id: string;
          numero: string;
          monto: number;
          descripcion: string;
          fecha: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          numero: string;
          monto: number;
          descripcion?: string;
          fecha?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          numero?: string;
          monto?: number;
          descripcion?: string;
          fecha?: string;
          created_at?: string;
        };
      };

      gastos: {
        Row: {
          id: string;
          monto: number;
          proveedor: string;
          motivo: string;
          remito: string;
          fecha: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          monto: number;
          proveedor: string;
          motivo: string;
          remito?: string;
          fecha?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          monto?: number;
          proveedor?: string;
          motivo?: string;
          remito?: string;
          fecha?: string;
          created_at?: string;
        };
      };

      ingresos: {
        Row: {
          id: string;
          carnet: string;
          nombre_socio: string;
          monto: number;
          forma_pago: 'efectivo' | 'transferencia';
          concepto: 'alta' | 'renovacion' | 'otro';
          fecha: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          carnet: string;
          nombre_socio: string;
          monto: number;
          forma_pago: 'efectivo' | 'transferencia';
          concepto?: 'alta' | 'renovacion' | 'otro';
          fecha?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          carnet?: string;
          nombre_socio?: string;
          monto?: number;
          forma_pago?: 'efectivo' | 'transferencia';
          concepto?: 'alta' | 'renovacion' | 'otro';
          fecha?: string;
          created_at?: string;
        };
      };

      turnos: {
        Row: {
          id: string;
          usuario: string;
          fecha_inicio: string;
          fecha_fin: string | null;
          monto_inicial: number;
          monto_final: number | null;
          recaudacion: number | null;
          cerrado: boolean;
          altas_carnet: number;
          renovaciones: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usuario: string;
          fecha_inicio?: string;
          fecha_fin?: string | null;
          monto_inicial?: number;
          monto_final?: number | null;
          recaudacion?: number | null;
          cerrado?: boolean;
          altas_carnet?: number;
          renovaciones?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          usuario?: string;
          fecha_inicio?: string;
          fecha_fin?: string | null;
          monto_inicial?: number;
          monto_final?: number | null;
          recaudacion?: number | null;
          cerrado?: boolean;
          altas_carnet?: number;
          renovaciones?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      asistencias: {
        Row: {
          id: string;
          socio_id: string | null;
          carnet: string;
          nombre_completo: string;
          fecha_inicio: string | null;
          turno_id: string | null;
          by_usuario: string | null;
          timestamp_iso: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          socio_id?: string | null;
          carnet: string;
          nombre_completo: string;
          fecha_inicio?: string | null;
          turno_id?: string | null;
          by_usuario?: string | null;
          timestamp_iso?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          socio_id?: string | null;
          carnet?: string;
          nombre_completo?: string;
          fecha_inicio?: string | null;
          turno_id?: string | null;
          by_usuario?: string | null;
          timestamp_iso?: string;
          created_at?: string;
        };
      };

      contadores: {
        Row: {
          id: string;
          tipo: 'carnet' | 'retiro';
          valor: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tipo: 'carnet' | 'retiro';
          valor?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tipo?: 'carnet' | 'retiro';
          valor?: number;
          updated_at?: string;
        };
      };
    };
  };
};
