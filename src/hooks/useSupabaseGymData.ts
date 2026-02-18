import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DatosGimnasio, Socio, Retiro, Gasto, Ingreso, Turno } from '../types';
import { generarNumeroCarnet, generarNumeroRetiro, calcularEstadoSocio } from '../utils/localStorage';

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

export const useSupabaseGymData = () => {
  const [data, setData] = useState<DatosGimnasio>({
    socios: [],
    retiros: [],
    gastos: [],
    ingresos: [],
    turnos: [],
    contadores: { carnet: 1, retiro: 1 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos desde Supabase
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Cargar todas las tablas en paralelo
      const [
        { data: socios, error: sociosError },
        { data: retiros, error: retirosError },
        { data: gastos, error: gastosError },
        { data: ingresos, error: ingresosError },
        { data: turnos, error: turnosError },
        { data: contadores, error: contadoresError },
      ] = await Promise.all([
        supabase.from('socios').select('*').order('carnet', { ascending: false }),
        supabase.from('retiros').select('*').order('fecha', { ascending: false }),
        supabase.from('gastos').select('*').order('fecha', { ascending: false }),
        supabase.from('ingresos').select('*').order('fecha', { ascending: false }),
        supabase.from('turnos').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('contadores').select('*'),
      ]);

      if (sociosError) throw sociosError;
      if (retirosError) throw retirosError;
      if (gastosError) throw gastosError;
      if (ingresosError) throw ingresosError;
      if (turnosError) throw turnosError;
      if (contadoresError) throw contadoresError;

      // Transformar datos de Supabase al formato local
      const sociosTransformados: Socio[] = (socios || []).map(s => ({
        id: s.id,
        carnet: s.carnet,
        nombreCompleto: s.nombre_completo,
        dni: s.dni,
        telefono: s.telefono,
        fechaInicio: s.fecha_inicio,
        formaPago: s.forma_pago,
        monto: s.monto,
        estado: calcularEstadoSocio(s.fecha_inicio),
      }));

      const retirosTransformados: Retiro[] = (retiros || []).map(r => ({
        id: r.id,
        numero: r.numero,
        monto: r.monto,
        descripcion: r.descripcion,
        fecha: r.fecha,
      }));

      const gastosTransformados: Gasto[] = (gastos || []).map(g => ({
        id: g.id,
        monto: g.monto,
        proveedor: g.proveedor,
        motivo: g.motivo,
        remito: g.remito,
        fecha: g.fecha,
      }));

      const ingresosTransformados: Ingreso[] = (ingresos || []).map(i => ({
        id: i.id,
        carnet: i.carnet,
        nombreSocio: i.nombre_socio,
        monto: i.monto,
        formaPago: i.forma_pago,
        concepto: i.concepto,
        fecha: i.fecha,
      }));

      const turnosTransformados: Turno[] = (turnos || []).map(t => ({
        id: t.id,
        usuario: t.usuario,
        fechaInicio: t.fecha_inicio,
        fechaFin: t.fecha_fin,
        montoInicial: t.monto_inicial,
        montoFinal: t.monto_final,
        recaudacion: t.recaudacion,
        cerrado: t.cerrado,
        metrics: {
          altasCarnet: t.altas_carnet,
          renovaciones: t.renovaciones,
        },
      }));

      const contadoresMap = (contadores || []).reduce((acc, c) => {
        acc[c.tipo] = c.valor;
        return acc;
      }, {} as Record<string, number>);

      setData({
        socios: sociosTransformados,
        retiros: retirosTransformados,
        gastos: gastosTransformados,
        ingresos: ingresosTransformados,
        turnos: turnosTransformados,
        contadores: {
          carnet: contadoresMap.carnet || 1,
          retiro: contadoresMap.retiro || 1,
        },
      });
    } catch (err: any) {
      console.error('Error cargando datos:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar datos al inicializar
  useEffect(() => {
    loadData();
  }, []);

  // Incrementar contador
  const incrementarContador = async (tipo: 'carnet' | 'retiro') => {
    const { error } = await supabase
      .from('contadores')
      .update({ valor: data.contadores[tipo] + 1 })
      .eq('tipo', tipo);

    if (error) throw error;

    setData(prev => ({
      ...prev,
      contadores: {
        ...prev.contadores,
        [tipo]: prev.contadores[tipo] + 1,
      },
    }));
  };

  // Agregar socio
  const addSocio = async (socioData: Omit<Socio, 'id' | 'carnet' | 'estado'>) => {
    try {
      // Buscar un carnet único
      let nuevoCarnet: string;
      let contadorActual = data.contadores.carnet;
      let carnetUnico = false;
      
      while (!carnetUnico) {
        nuevoCarnet = generarNumeroCarnet(contadorActual);
        
        // Verificar si el carnet ya existe
        const { data: existingCarnets, error: checkError } = await supabase
          .from('socios')
          .select('carnet')
          .eq('carnet', nuevoCarnet)
          .limit(1);
        
        if (checkError) {
          throw checkError;
        }
        
        if (!existingCarnets || existingCarnets.length === 0) {
          // No se encontró el carnet, es único
          carnetUnico = true;
        } else {
          // El carnet ya existe, incrementar contador y probar de nuevo
          contadorActual++;
        }
      }
      
      // Insertar socio
      const { data: socioInsertado, error: socioError } = await supabase
        .from('socios')
        .insert({
          carnet: nuevoCarnet,
          nombre_completo: socioData.nombreCompleto,
          dni: socioData.dni,
          telefono: socioData.telefono || '',
          fecha_inicio: socioData.fechaInicio,
          forma_pago: socioData.formaPago,
          monto: socioData.monto,
          estado: calcularEstadoSocio(socioData.fechaInicio),
        })
        .select()
        .single();

      if (socioError) throw socioError;

      // Insertar ingreso por alta
      const { error: ingresoError } = await supabase
        .from('ingresos')
        .insert({
          carnet: nuevoCarnet,
          nombre_socio: socioData.nombreCompleto,
          monto: socioData.monto,
          forma_pago: socioData.formaPago,
          concepto: 'alta',
        });

      if (ingresoError) throw ingresoError;

      // Actualizar métricas del turno abierto
      const turnoAbierto = data.turnos.find(t => !t.cerrado);
      if (turnoAbierto) {
        const { error: turnoError } = await supabase
          .from('turnos')
          .update({ altas_carnet: turnoAbierto.metrics!.altasCarnet + 1 })
          .eq('id', turnoAbierto.id);

        if (turnoError) throw turnoError;
      }

      // Actualizar contador al siguiente número disponible
      const { error: contadorError } = await supabase
        .from('contadores')
        .update({ valor: contadorActual + 1 })
        .eq('tipo', 'carnet');

      if (contadorError) throw contadorError;

      setData(prev => ({
        ...prev,
        contadores: {
          ...prev.contadores,
          carnet: contadorActual + 1,
        },
      }));

      // Recargar datos
      await loadData();
    } catch (err: any) {
      console.error('Error agregando socio:', err);
      setError(err.message);
    }
  };

  // Agregar ingreso
  const addIngreso = async (ingresoData: Omit<Ingreso, 'id'>) => {
    try {
      const { error } = await supabase
        .from('ingresos')
        .insert({
          carnet: ingresoData.carnet,
          nombre_socio: ingresoData.nombreSocio,
          monto: ingresoData.monto,
          forma_pago: ingresoData.formaPago,
          concepto: ingresoData.concepto || 'otro',
        });

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error agregando ingreso:', err);
      setError(err.message);
    }
  };

  // Agregar retiro
  const addRetiro = async (retiroData: Omit<Retiro, 'id' | 'numero'>) => {
    try {
      const nuevoNumero = generarNumeroRetiro(data.contadores.retiro);
      
      const { error } = await supabase
        .from('retiros')
        .insert({
          numero: nuevoNumero,
          monto: retiroData.monto,
          descripcion: retiroData.descripcion || '',
        });

      if (error) throw error;
      
      await incrementarContador('retiro');
      await loadData();
    } catch (err: any) {
      console.error('Error agregando retiro:', err);
      setError(err.message);
    }
  };

  // Agregar gasto
  const addGasto = async (gastoData: Omit<Gasto, 'id'>) => {
    try {
      const { error } = await supabase
        .from('gastos')
        .insert({
          monto: gastoData.monto,
          proveedor: gastoData.proveedor,
          motivo: gastoData.motivo,
          remito: gastoData.remito,
        });

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error agregando gasto:', err);
      setError(err.message);
    }
  };

  // Iniciar turno
  const iniciarTurno = async (usuario: string, montoInicial: number) => {
    try {
      const { error } = await supabase
        .from('turnos')
        .insert({
          usuario,
          monto_inicial: montoInicial,
          cerrado: false,
          altas_carnet: 0,
          renovaciones: 0,
        });

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error iniciando turno:', err);
      setError(err.message);
    }
  };

  // Cerrar turno
  const cerrarTurno = async (montoFinal: number) => {
    try {
      const turnoAbierto = data.turnos.find(t => !t.cerrado);
      if (!turnoAbierto) return;

      const recaudacion = montoFinal - turnoAbierto.montoInicial;

      const { error } = await supabase
        .from('turnos')
        .update({
          fecha_fin: new Date().toISOString(),
          monto_final: montoFinal,
          recaudacion,
          cerrado: true,
        })
        .eq('id', turnoAbierto.id);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error cerrando turno:', err);
      setError(err.message);
    }
  };

  // Renovar membresía
  const renovarMembresia = async (socioId: string, formaPago: 'efectivo' | 'transferencia' = 'efectivo', monto: number = 30000) => {
    try {
      const socio = data.socios.find(s => s.id === socioId);
      if (!socio) return;

      const nuevaFecha = new Date().toISOString().slice(0, 10);

      // Actualizar socio
      const { error: socioError } = await supabase
        .from('socios')
        .update({
          fecha_inicio: nuevaFecha,
          estado: 'vigente',
        })
        .eq('id', socioId);

      if (socioError) throw socioError;

      // Insertar ingreso por renovación
      const { error: ingresoError } = await supabase
        .from('ingresos')
        .insert({
          carnet: socio.carnet,
          nombre_socio: socio.nombreCompleto,
          monto,
          forma_pago: formaPago,
          concepto: 'renovacion',
          fecha: new Date().toISOString(),
        });

      if (ingresoError) throw ingresoError;

      // Actualizar métricas del turno abierto
      const turnoAbierto = data.turnos.find(t => !t.cerrado);
      if (turnoAbierto) {
        const { error: turnoError } = await supabase
          .from('turnos')
          .update({ renovaciones: turnoAbierto.metrics!.renovaciones + 1 })
          .eq('id', turnoAbierto.id);

        if (turnoError) throw turnoError;
      }

      console.log('✅ Renovación completada:', { 
        socio: socio.nombreCompleto, 
        carnet: socio.carnet, 
        monto, 
        formaPago 
      });

      await loadData();
    } catch (err: any) {
      console.error('Error renovando membresía:', err);
      setError(err.message);
    }
  };

  // Actualizar socio
  const updateSocio = async (socioId: string, updates: Partial<Socio>) => {
    try {
      const updateData: any = {};
      
      if (updates.nombreCompleto) updateData.nombre_completo = updates.nombreCompleto;
      if (updates.dni) updateData.dni = updates.dni;
      if (updates.telefono !== undefined) updateData.telefono = updates.telefono;
      if (updates.fechaInicio) updateData.fecha_inicio = updates.fechaInicio;
      if (updates.formaPago) updateData.forma_pago = updates.formaPago;
      if (updates.monto !== undefined) updateData.monto = updates.monto;
      if (updates.carnet) updateData.carnet = updates.carnet;
      
      // Recalcular estado si cambió la fecha
      if (updates.fechaInicio) {
        updateData.estado = calcularEstadoSocio(updates.fechaInicio);
      }

      const { error } = await supabase
        .from('socios')
        .update(updateData)
        .eq('id', socioId);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error actualizando socio:', err);
      setError(err.message);
    }
  };

  // Eliminar socio
  const deleteSocio = async (socioId: string) => {
    try {
      // Obtener información del socio antes de eliminarlo para ajustar estadísticas
      const socio = data.socios.find(s => s.id === socioId);
      
      // Buscar si hay un ingreso asociado a este socio en el mes actual
      if (socio) {
        const now = new Date();
        const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        
        const { data: ingresosSocio, error: ingresosError } = await supabase
          .from('ingresos')
          .select('concepto')
          .eq('carnet', socio.carnet)
          .gte('fecha', inicioMes)
          .lte('fecha', finMes);
        
        if (ingresosError) {
          console.error('Error consultando ingresos del socio:', ingresosError);
        } else if (ingresosSocio && ingresosSocio.length > 0) {
          // Eliminar los ingresos asociados al socio del mes actual
          const { error: deleteIngresosError } = await supabase
            .from('ingresos')
            .delete()
            .eq('carnet', socio.carnet)
            .gte('fecha', inicioMes)
            .lte('fecha', finMes);
          
          if (deleteIngresosError) {
            console.error('Error eliminando ingresos del socio:', deleteIngresosError);
          }
        }
      }
      
      const { error } = await supabase
        .from('socios')
        .delete()
        .eq('id', socioId);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error eliminando socio:', err);
      setError(err.message);
    }
  };

  // Funciones para asistencias
  const addAsistencia = async (asistenciaData: Omit<AsistenciaRecord, 'id'>) => {
    try {
      const { error } = await supabase
        .from('asistencias')
        .insert({
          socio_id: asistenciaData.socio_id,
          carnet: asistenciaData.carnet,
          nombre_completo: asistenciaData.nombre_completo,
          fecha_inicio: asistenciaData.fecha_inicio,
          turno_id: asistenciaData.turno_id,
          by_usuario: asistenciaData.by_usuario,
          timestamp_iso: asistenciaData.timestamp_iso,
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error agregando asistencia:', err);
      setError(err.message);
    }
  };

  const getAsistencias = async (): Promise<AsistenciaRecord[]> => {
    try {
      const { data: asistencias, error } = await supabase
        .from('asistencias')
        .select('*')
        .order('timestamp_iso', { ascending: false });

      if (error) throw error;
      return asistencias || [];
    } catch (err: any) {
      console.error('Error obteniendo asistencias:', err);
      return [];
    }
  };

  return {
    data,
    isLoading,
    error,
    addSocio,
    addIngreso,
    addRetiro,
    addGasto,
    iniciarTurno,
    cerrarTurno,
    renovarMembresia,
    updateSocio,
    deleteSocio,
    addAsistencia,
    getAsistencias,
    reloadData: loadData,
  };
};