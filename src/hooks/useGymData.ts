import { useState, useEffect } from 'react';
import { DatosGimnasio, Socio, Retiro, Gasto, Ingreso, Turno } from '../types';
import { loadData, saveData, generarNumeroCarnet, generarNumeroRetiro, calcularEstadoSocio } from '../utils/localStorage';

export const useGymData = () => {
  const [data, setData] = useState<DatosGimnasio>({
    socios: [],
    retiros: [],
    gastos: [],
    ingresos: [],
    turnos: [],
    contadores: {
      carnet: 1,
      retiro: 1,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos al inicializar
  useEffect(() => {
    const initializeData = async () => {
      try {
        const loadedData = await loadData();
        
        // Verificar y arreglar carnets duplicados
        const carnetsMap = new Map<string, number>();
        loadedData.socios.forEach(socio => {
          const count = carnetsMap.get(socio.carnet) || 0;
          carnetsMap.set(socio.carnet, count + 1);
        });
        
        const duplicados = Array.from(carnetsMap.entries()).filter(([_, count]) => count > 1);
        if (duplicados.length > 0) {
          console.warn('Carnets duplicados detectados:', duplicados.map(([carnet]) => carnet));
        }
        
        setData(loadedData);
      } catch (error) {
        console.error('Error inicializando datos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeData();
  }, []);

  // Guardar datos cuando cambien
  useEffect(() => {
    if (!isLoading) {
      saveData(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /** Helpers turno */
  const getOpenTurnoIndex = (list: Turno[]) => list.findIndex(t => !t.cerrado);
  const nowISO = () => new Date().toISOString();

  /** Calcula efectivo disponible en caja para un turno */
  const computeEfectivoDisponible = (state: DatosGimnasio, turno: Turno) => {
    const from = new Date(turno.fechaInicio).getTime();
    const to = turno.fechaFin ? new Date(turno.fechaFin).getTime() : Date.now();

    const ingresosEf = state.ingresos
      .filter(i => i.formaPago === 'efectivo')
      .filter(i => {
        const t = new Date(i.fecha).getTime();
        return t >= from && t <= to;
      })
      .reduce((acc, i) => acc + (i.monto || 0), 0);

    const retirosTotal = state.retiros
      .filter(r => {
        const t = new Date(r.fecha).getTime();
        return t >= from && t <= to;
      })
      .reduce((acc, r) => acc + (r.monto || 0), 0);

    const gastosTotal = state.gastos
      .filter(g => {
        const t = new Date(g.fecha).getTime();
        return t >= from && t <= to;
      })
      .reduce((acc, g) => acc + (g.monto || 0), 0);

    const efectivo = (turno.montoInicial || 0) + ingresosEf - retirosTotal - gastosTotal;
    return { ingresosEf, retirosTotal, gastosTotal, efectivoDisponible: Math.max(0, Number(efectivo.toFixed(2))) };
  };

  /** Alta de socio: crea socio + ingreso; suma métrica en turno abierto */
  const addSocio = (socioData: Omit<Socio, 'id' | 'numeroSocio' | 'estado'>) => {
    const nuevoSocio: Socio = {
      id: crypto.randomUUID(),
      numeroSocio: generarNumeroSocio(data.contadores.socio),
      estado: calcularEstadoSocio(socioData.fechaInicio),
      ...socioData,
    };

    const ingresoAlta: Ingreso = {
      id: crypto.randomUUID(),
      numeroSocio: nuevoSocio.numeroSocio,
      nombreSocio: nuevoSocio.nombreCompleto,
      monto: socioData.monto,
      formaPago: socioData.formaPago,
      fecha: nowISO(),
      concepto: 'alta',
    };

    setData(prev => {
      const turnos = [...prev.turnos];
      const idx = getOpenTurnoIndex(turnos);
      if (idx !== -1) {
        const t = { ...turnos[idx] };
        t.metrics = t.metrics || { altasCarnet: 0, renovaciones: 0 };
        t.metrics.altasCarnet += 1;
        turnos[idx] = t;
      }
      return {
        ...prev,
        socios: [...prev.socios, nuevoSocio],
        ingresos: [...prev.ingresos, ingresoAlta],
        contadores: { ...prev.contadores, socio: prev.contadores.socio + 1 },
        turnos,
      };
    });
  };

  /** Registrar ingreso manual (no altera métricas) */
  const addIngreso = (ingresoData: Omit<Ingreso, 'id'>) => {
    const nuevoIngreso: Ingreso = { id: crypto.randomUUID(), ...ingresoData };
    setData(prev => ({ ...prev, ingresos: [...prev.ingresos, nuevoIngreso] }));
  };

  const addRetiro = (retiroData: Omit<Retiro, 'id' | 'numero'>) => {
    const nuevoRetiro: Retiro = {
      id: crypto.randomUUID(),
      numero: generarNumeroRetiro(data.contadores.retiro),
      ...retiroData,
    };
    setData(prev => ({
      ...prev,
      retiros: [...prev.retiros, nuevoRetiro],
      contadores: { ...prev.contadores, retiro: prev.contadores.retiro + 1 },
    }));
  };

  const addGasto = (gastoData: Omit<Gasto, 'id'>) => {
    const nuevoGasto: Gasto = { id: crypto.randomUUID(), ...gastoData };
    setData(prev => ({ ...prev, gastos: [...prev.gastos, nuevoGasto] }));
  };

  /** Iniciar turno: con métricas en 0 */
  const iniciarTurno = (usuario: string, montoInicial: number) => {
    const nuevoTurno: Turno = {
      id: crypto.randomUUID(),
      usuario,
      fechaInicio: nowISO(),
      montoInicial,
      cerrado: false,
      metrics: { altasCarnet: 0, renovaciones: 0 },
    };
    setData(prev => ({ ...prev, turnos: [...prev.turnos, nuevoTurno] }));
  };

  /** Renovar membresía: mueve fechaInicio a hoy + ingreso; suma métrica turno */
  const renovarMembresia = (socioId: string, formaPago: 'efectivo' | 'transferencia' = 'efectivo', monto: number = 30000) => {
    setData(prev => {
      const socios = prev.socios.map(s => {
        if (s.id !== socioId) return s;
        const nuevaFecha = new Date().toISOString().slice(0, 10);
        return { ...s, fechaInicio: nuevaFecha, estado: 'vigente' as const };
      });

      const socio = prev.socios.find(s => s.id === socioId);
      const ingresos = [...prev.ingresos];
      if (socio) {
        ingresos.push({
          id: crypto.randomUUID(),
          numeroSocio: socio.numeroSocio,
          nombreSocio: socio.nombreCompleto,
          monto,
          formaPago,
          fecha: nowISO(),
          concepto: 'renovacion',
        });
      }

      const turnos = [...prev.turnos];
      const idx = getOpenTurnoIndex(turnos);
      if (idx !== -1) {
        const t = { ...turnos[idx] };
        t.metrics = t.metrics || { altasCarnet: 0, renovaciones: 0 };
        t.metrics.renovaciones += 1;
        turnos[idx] = t;
      }

      return { ...prev, socios, ingresos, turnos };
    });
  };

  /** Cerrar turno: valida que el montoFinal no exceda el efectivo disponible */
  const cerrarTurno = (montoFinal: number) => {
    setData(prev => {
      const idx = getOpenTurnoIndex(prev.turnos);
      if (idx === -1) return prev;

      const turno = prev.turnos[idx];
      const { efectivoDisponible } = computeEfectivoDisponible(prev, turno);

      const final = Number(montoFinal || 0);
      if (final > efectivoDisponible + 0.0001) {
        alert(`El monto final ($${final.toFixed(2)}) no puede exceder el efectivo disponible en caja ($${efectivoDisponible.toFixed(2)}).`);
        return prev; // no cierra
      }

      const cerrado: Turno = {
        ...turno,
        fechaFin: nowISO(),
        montoFinal: final,
        recaudacion: Number((final - (turno.montoInicial || 0)).toFixed(2)),
        cerrado: true,
        metrics: turno.metrics || { altasCarnet: 0, renovaciones: 0 },
      };

      const turnos = [...prev.turnos];
      turnos[idx] = cerrado;
      return { ...prev, turnos };
    });
  };

  /** Actualizar socio existente */
  const updateSocio = (socioId: string, updates: Partial<Socio>) => {
    setData(prev => ({
      ...prev,
      socios: prev.socios.map(s => s.id === socioId ? { ...s, ...updates } : s)
    }));
  };

  /** Eliminar socio */
  const deleteSocio = (socioId: string) => {
    setData(prev => ({
      ...prev,
      socios: prev.socios.filter(s => s.id !== socioId)
    }));
  };

  return {
    data,
    isLoading,
    addSocio,
    addIngreso,
    addRetiro,
    addGasto,
    iniciarTurno,
    cerrarTurno,
    renovarMembresia,
    updateSocio,
    deleteSocio,
  };
};
