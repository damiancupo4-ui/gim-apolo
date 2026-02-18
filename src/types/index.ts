export interface Socio {
  id: string;
  carnet: string;
  nombreCompleto: string;
  dni: string;
  fechaInicio: string;
  formaPago: 'efectivo' | 'transferencia';
  monto: number;
  estado: 'vigente' | 'vencido';
  // (opcional) teléfono: si más adelante lo querés usar
  telefono?: string;
}

export interface Retiro {
  id: string;
  numero: string;
  monto: number;
  fecha: string;
  descripcion?: string;
}

export interface Gasto {
  id: string;
  monto: number;
  proveedor: string;
  motivo: string;
  remito: string;
  fecha: string;
}

export interface Ingreso {
  id: string;
  carnet: string;
  nombreSocio: string;
  monto: number;
  formaPago: 'efectivo' | 'transferencia';
  fecha: string;

  /** opcional: para clasificar movimientos */
  concepto?: 'alta' | 'renovacion' | 'otro';
}

export interface Turno {
  id: string;
  usuario: string;
  fechaInicio: string;
  fechaFin?: string;
  montoInicial: number;
  montoFinal?: number;
  recaudacion?: number;
  cerrado: boolean;

  /** métricas agregadas del turno (altas/renovaciones) */
  metrics?: {
    altasCarnet: number;
    renovaciones: number;
  };
}

export interface DatosGimnasio {
  socios: Socio[];
  retiros: Retiro[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  turnos: Turno[];
  contadores: {
    carnet: number;
    retiro: number;
  };
  
  // Campos adicionales para compatibilidad
  productos?: any[];
  movimientos?: any[];
  ventas?: any[];
}
