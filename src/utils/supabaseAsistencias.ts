// src/utils/supabaseAsistencias.ts
import { supabase } from '../lib/supabase';
import { calcularEstadoSocio } from './localStorage';

type AsistenciaRecord = {
  id: string;
  socio_id: string | null;
  carnet: string;
  nombre_completo: string;
  fecha_inicio: string | null;
  turno_id: string | null;
  by_usuario: string | null;
  timestamp_iso: string;
};

type SugerenciaSocio = {
  id: string;
  carnet: string;
  nombreCompleto: string;
  dni?: string;
  fechaInicio: string;
  estado: 'vigente' | 'vencido';
};

// Obtener asistencias desde Supabase (últimas 1000 máx. que devuelve Supabase)
export async function getSupabaseAsistencias(): Promise<AsistenciaRecord[]> {
  try {
    const { data, error } = await supabase
      .from('asistencias')
      .select('*')
      .order('timestamp_iso', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error obteniendo asistencias:', error);
    return [];
  }
}

/**
 * Conteo real de asistencias del mes actual usando COUNT en el servidor.
 * Esto evita que la tarjeta quede clavada en 1000 por el límite de filas.
 *
 * @param year  Año (ej: 2025)
 * @param zeroBasedMonth Mes base 0 (0 = enero, 10 = noviembre, etc.)
 */
export async function getSupabaseAsistenciasMesCount(
  year: number,
  zeroBasedMonth: number
): Promise<number> {
  try {
    const inicioMes = new Date(year, zeroBasedMonth, 1, 0, 0, 0, 0).toISOString();
    const finMes = new Date(year, zeroBasedMonth + 1, 0, 23, 59, 59, 999).toISOString();

    const { count, error } = await supabase
      .from('asistencias')
      .select('id', { count: 'exact', head: true })
      .gte('timestamp_iso', inicioMes)
      .lte('timestamp_iso', finMes);

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error('Error obteniendo conteo de asistencias del mes:', error);
    return 0;
  }
}

// Buscar sugerencias de socios desde Supabase
export async function buscarSugerenciasSociosSupabase(
  query: string,
  limit = 20
): Promise<SugerenciaSocio[]> {
  try {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Buscar por número de socio, nombre o DNI
    const { data, error } = await supabase
      .from('socios')
      .select('id, carnet, nombre_completo, dni, fecha_inicio')
      .or(`carnet.ilike.%${q}%,nombre_completo.ilike.%${q}%,dni.ilike.%${q}%`)
      .order('carnet', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((s) => ({
      id: s.id,
      carnet: s.carnet,
      nombreCompleto: s.nombre_completo,
      dni: s.dni,
      fechaInicio: s.fecha_inicio,
      estado: calcularEstadoSocio(s.fecha_inicio),
    }));
  } catch (error) {
    console.error('Error buscando sugerencias:', error);
    return [];
  }
}

// Agregar asistencia por número de socio o nombre
export async function addAsistenciaByCarnetOrNombreSupabase(
  input: string
): Promise<AsistenciaRecord | null> {
  try {
    const q = input.trim().toLowerCase();
    if (!q) return null;

    // Buscar socio por número exacto, nombre o DNI
    const { data: socios, error: sociosError } = await supabase
      .from('socios')
      .select('*')
      .or(`carnet.ilike.%${q}%,nombre_completo.ilike.%${q}%,dni.ilike.%${q}%`)
      .limit(1);

    if (sociosError) throw sociosError;
    if (!socios || socios.length === 0) return null;

    const socio = socios[0];

    // Obtener turno abierto
    const { data: turnos, error: turnosError } = await supabase
      .from('turnos')
      .select('*')
      .eq('cerrado', false)
      .limit(1);

    if (turnosError) throw turnosError;
    const turnoAbierto = turnos?.[0];

    // Crear registro de asistencia
    const asistenciaData = {
      socio_id: socio.id,
      carnet: socio.carnet,
      nombre_completo: socio.nombre_completo,
      fecha_inicio: socio.fecha_inicio,
      turno_id: turnoAbierto?.id || null,
      by_usuario: turnoAbierto?.usuario || null,
      timestamp_iso: new Date().toISOString(),
    };

    const { data: asistencia, error: asistenciaError } = await supabase
      .from('asistencias')
      .insert(asistenciaData)
      .select()
      .single();

    if (asistenciaError) throw asistenciaError;

    return {
      id: asistencia.id,
      socio_id: asistencia.socio_id,
      carnet: asistencia.carnet,
      nombre_completo: asistencia.nombre_completo,
      fecha_inicio: asistencia.fecha_inicio,
      turno_id: asistencia.turno_id,
      by_usuario: asistencia.by_usuario,
      timestamp_iso: asistencia.timestamp_iso,
    };
  } catch (error) {
    console.error('Error agregando asistencia:', error);
    return null;
  }
}

// Exportar asistencias como JSON
export async function exportAsistenciasSupabaseJSON(
  fromISO: string,
  toISO: string
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('asistencias')
      .select('*')
      .gte('timestamp_iso', fromISO)
      .lte('timestamp_iso', toISO)
      .order('timestamp_iso', { ascending: false });

    if (error) throw error;

    const payload = {
      exportado: new Date().toISOString(),
      rango: { from: fromISO, to: toISO },
      total: data?.length || 0,
      asistencias: data || [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apolo-asistencias-supabase-${fromISO.slice(
      0,
      10
    )}_a_${toISO.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exportando asistencias:', error);
  }
}

// Exportar asistencias como CSV
export async function exportAsistenciasSupabaseCSV(
  fromISO: string,
  toISO: string
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('asistencias')
      .select('*')
      .gte('timestamp_iso', fromISO)
      .lte('timestamp_iso', toISO)
      .order('timestamp_iso', { ascending: false });

    if (error) throw error;

    const headers = ['FechaHora', 'Carnet', 'NombreCompleto', 'Operador', 'Turno'];
    const rows = (data || []).map((a) =>
      [
        new Date(a.timestamp_iso).toLocaleString(),
        a.carnet,
        `"${(a.nombre_completo || '').replace(/"/g, '""')}"`,
        a.by_usuario || '',
        a.turno_id || '',
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apolo-asistencias-supabase-${fromISO.slice(
      0,
      10
    )}_a_${toISO.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exportando asistencias CSV:', error);
  }
}
