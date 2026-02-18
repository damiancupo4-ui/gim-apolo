// src/pages/Asistencias.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getSupabaseAsistencias,
  getSupabaseAsistenciasMesCount,
  buscarSugerenciasSociosSupabase,
  addAsistenciaByCarnetOrNombreSupabase,
  exportAsistenciasSupabaseJSON,
  exportAsistenciasSupabaseCSV,
} from '../utils/supabaseAsistencias';
import { calcularEstadoSocio } from '../utils/localStorage';
import {
  Download,
  Upload,
  Search,
  FileText,
  User,
  Hash,
  AlertTriangle,
  CheckCircle,
  Calendar,
  CalendarDays,
  Activity,
  BarChart3,
  X,
} from 'lucide-react';

const hoyISO = new Date().toISOString().slice(0, 10);

type Sug = {
  id: string;
  carnet: string;
  nombreCompleto: string;
  dni?: string;
  fechaInicio: string;
  estado: 'vigente' | 'vencido';
};

export default function Asistencias() {
  const [tick, setTick] = useState(0);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'warning' | 'error'>(
    'success'
  );
  const [filtro, setFiltro] = useState('');
  const [from, setFrom] = useState(hoyISO);
  const [to, setTo] = useState(hoyISO);

  const [sugerencias, setSugerencias] = useState<Sug[]>([]);
  const [openSug, setOpenSug] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const sugBoxRef = useRef<HTMLDivElement>(null);

  // Estado para asistencias desde Supabase
  const [asistencias, setAsistencias] = useState<any[]>([]);
  const [loadingAsistencias, setLoadingAsistencias] = useState(false);

  // Conteo real de asistencias del mes desde Supabase (para evitar el 1000 fijo)
  const [asistenciasMesCountServer, setAsistenciasMesCountServer] =
    useState<number | null>(null);

  // Cargar asistencias + conteo real del mes
  const loadAsistencias = async () => {
    setLoadingAsistencias(true);
    try {
      const data = await getSupabaseAsistencias();
      setAsistencias(data || []);

      // Conteo real del mes actual directamente en Supabase
      const now = new Date();
      try {
        const countMes = await getSupabaseAsistenciasMesCount(
          now.getFullYear(),
          now.getMonth()
        );
        setAsistenciasMesCountServer(countMes);
      } catch (err) {
        console.error('Error obteniendo conteo mensual desde Supabase:', err);
      }
    } catch (error) {
      console.error('Error cargando asistencias:', error);
    } finally {
      setLoadingAsistencias(false);
    }
  };

  // Cargar asistencias al inicializar y cuando tick cambie
  useEffect(() => {
    loadAsistencias();
  }, [tick]);

  // Asistencias del día actual (sin borrar anteriores)
  const asistenciasHoy = useMemo(() => {
    // Usar fecha local para evitar problemas de zona horaria
    const hoy = new Date();
    const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
    const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
    
    const inicioTime = inicioDelDia.getTime();
    const finTime = finDelDia.getTime();

    return asistencias
      .filter((a: any) => {
        const t = new Date(a.timestamp_iso).getTime();
        return !Number.isNaN(t) && t >= inicioTime && t <= finTime;
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp_iso).getTime() -
          new Date(a.timestamp_iso).getTime()
      );
  }, [asistencias]);

  // Estadísticas para las tarjetas de asistencias
  const stats = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    // Inicio y fin del mes actual en timestamps
    const inicioMes = new Date(thisYear, thisMonth, 1, 0, 0, 0, 0);
    const finMes = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59, 999);
    const inicioMesTime = inicioMes.getTime();
    const finMesTime = finMes.getTime();

    // Última hora (desde hace 60 minutos hasta ahora)
    const unaHoraAtras = new Date(now.getTime() - 60 * 60 * 1000);
    const unaHoraAtrasTime = unaHoraAtras.getTime();
    const ahoraTime = now.getTime();

    const asistenciasPorDia: Record<string, number> = {};
    const asistenciasMismoDiaSemana: Record<string, number> = {};
    let asistenciasMesCountLocal = 0;
    let asistenciasUltimaHora = 0;
    const asistenciasUltimaHoraDetalle: any[] = [];

    asistencias.forEach((a: any) => {
      const ts = a.timestamp_iso;
      if (!ts) return;

      const t = new Date(ts).getTime();
      if (Number.isNaN(t)) return;

      // Contar asistencias de la última hora
      if (t >= unaHoraAtrasTime && t <= ahoraTime) {
        asistenciasUltimaHora++;
        asistenciasUltimaHoraDetalle.push(a);
      }

      // Solo asistencias dentro del mes actual
      if (t >= inicioMesTime && t <= finMesTime) {
        asistenciasMesCountLocal++;

        const dateKey = ts.slice(0, 10); // YYYY-MM-DD
        const fechaAsistencia = new Date(ts);
        
        // Excluir domingos (día 0) del conteo para promedio diario
        if (fechaAsistencia.getDay() !== 0) {
          asistenciasPorDia[dateKey] = (asistenciasPorDia[dateKey] || 0) + 1;
        }

        // Histórico del mismo día de la semana en el mes (excluyendo hoy y domingos)
        if (fechaAsistencia.getDay() === now.getDay() && dateKey !== hoyISO && fechaAsistencia.getDay() !== 0) {
          asistenciasMismoDiaSemana[dateKey] =
            (asistenciasMismoDiaSemana[dateKey] || 0) + 1;
        }
      }
    });

    // Contar solo días que no sean domingo para el promedio
    const diasConAsistencias = Object.keys(asistenciasPorDia);
    const totalAsistenciasSinDomingos = Object.values(asistenciasPorDia).reduce((acc, count) => acc + count, 0);
    
    // Calcular días hábiles transcurridos en el mes (excluyendo domingos y días futuros)
    const diasHabilesTranscurridos = [];
    const inicioMesDate = new Date(thisYear, thisMonth, 1);
    const hoyDate = new Date(thisYear, thisMonth, now.getDate());
    
    for (let d = new Date(inicioMesDate); d <= hoyDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) { // No es domingo
        diasHabilesTranscurridos.push(d.getDate());
      }
    }
    
    const promedioDiario = diasHabilesTranscurridos.length > 0
      ? totalAsistenciasSinDomingos / diasHabilesTranscurridos.length
      : 0;

    const fechasMismoDia = Object.keys(asistenciasMismoDiaSemana);
    const totalMismoDia = fechasMismoDia.reduce(
      (acc, key) => acc + asistenciasMismoDiaSemana[key],
      0
    );
    const promedioMismoDia = fechasMismoDia.length
      ? totalMismoDia / fechasMismoDia.length
      : 0;

    // Si tenemos conteo real del servidor, lo usamos para la tarjeta de "Asistencias del mes"
    const asistenciasMesCount =
      asistenciasMesCountServer ?? asistenciasMesCountLocal;

    console.log('Stats calculadas:', {
      asistenciasHoyCount: asistenciasHoy.length,
      asistenciasMesCountLocal,
      asistenciasMesCountServer,
      asistenciasMesCountUsado: asistenciasMesCount,
      asistenciasUltimaHora,
      totalAsistencias: asistencias.length,
      primerasFechas: asistencias
        .slice(0, 5)
        .map((a) => (a.timestamp_iso ? a.timestamp_iso.slice(0, 10) : null)),
    });

    return {
      asistenciasHoyCount: asistenciasHoy.length,
      asistenciasMesCount,
      asistenciasUltimaHora,
      asistenciasUltimaHoraDetalle: asistenciasUltimaHoraDetalle.sort(
        (a, b) => new Date(b.timestamp_iso).getTime() - new Date(a.timestamp_iso).getTime()
      ),
      promedioDiario,
      promedioMismoDia,
      horaRangoTexto: `${unaHoraAtras.toLocaleTimeString('es-AR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })} - ${now.toLocaleTimeString('es-AR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`,
    };
  }, [asistencias, asistenciasHoy.length, asistenciasMesCountServer]);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const base = asistencias;
    if (!q) return base;
    return base.filter(
      (a: any) =>
        a.numeroSocio?.toString().includes(q) ||
        a.nombre_completo?.toLowerCase().includes(q) ||
        (a.by_usuario || '').toLowerCase().includes(q)
    );
  }, [asistencias, filtro]);

  // Sugerencias mientras tipeás (nombre/carnet/DNI)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const q = input.trim();
      if (!q) {
        setSugerencias([]);
        setActiveIdx(-1);
        return;
      }
      const list = await buscarSugerenciasSociosSupabase(q, 20);
      if (alive) {
        setSugerencias(list);
        setOpenSug(list.length > 0);
        setActiveIdx(list.length ? 0 : -1);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [input]);

  // Cerrar dropdown si clic fuera
  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!openSug) return;
      const target = ev.target as Node;
      if (
        sugBoxRef.current?.contains(target) ||
        inputRef.current?.contains(target)
      )
        return;
      setOpenSug(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openSug]);

  async function marcarValor(valor: string) {
    if (!valor.trim()) return;
    const rec = await addAsistenciaByCarnetOrNombreSupabase(valor);
    if (!rec) {
      setMsg('⚠️ No se encontró socio por carnet, nombre o DNI.');
      setMsgType('error');
    } else {
      // Calcular estado del socio para mostrar mensaje apropiado
      const estado = calcularEstadoSocio(rec.fecha_inicio || '');
      if (estado === 'vigente') {
        setMsg(
          `✅ Asistencia registrada: Carnet ${rec.carnet} — ${rec.nombre_completo} (MEMBRESÍA VIGENTE)`
        );
        setMsgType('success');
      } else {
        setMsg(
          `⚠️ Asistencia registrada: Carnet ${rec.carnet} — ${rec.nombre_completo} (MEMBRESÍA VENCIDA - NECESITA RENOVAR)`
        );
        setMsgType('warning');
      }
      setInput('');
      setSugerencias([]);
      setOpenSug(false);
      setActiveIdx(-1);
      setTick((x) => x + 1); // fuerza refresco
    }
  }

  async function marcar() {
    if (!input.trim()) return;
    await marcarValor(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!openSug || sugerencias.length === 0) {
      if (e.key === 'Enter') marcar();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, sugerencias.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = sugerencias[activeIdx] || sugerencias[0];
      if (s) marcarValor(s.carnet || s.nombreCompleto);
    } else if (e.key === 'Escape') {
      setOpenSug(false);
    }
  }

  const doExportJSON = () => exportAsistenciasSupabaseJSON(from, to);
  const doExportCSV = () => exportAsistenciasSupabaseCSV(from, to);
  const doImport = async () => {
    setMsg(
      '⚠️ Importación no disponible con Supabase. Los datos se sincronizan automáticamente.'
    );
    setMsgType('warning');
  };

  const formatPromedio = (n: number) => n.toFixed(1);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Asistencias</h1>

      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        {/* Asistencias del día */}
        <div className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Asistencias del día
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.asistenciasHoyCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="bg-blue-100 rounded-full p-3">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        {/* Asistencias de la última hora */}
        <div className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Última hora
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.asistenciasUltimaHora}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats.horaRangoTexto}
            </p>
          </div>
          <div className="bg-orange-100 rounded-full p-3">
            <Activity className="w-5 h-5 text-orange-600" />
          </div>
        </div>

        {/* Asistencias del mes (usa conteo real de Supabase) */}
        <div className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Asistencias del mes
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.asistenciasMesCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleString('es-AR', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="bg-emerald-100 rounded-full p-3">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* Promedio asistencias diarias */}
        <div className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Promedio diario
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatPromedio(stats.promedioDiario)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Sobre días con asistencia este mes
            </p>
          </div>
          <div className="bg-violet-100 rounded-full p-3">
            <Activity className="w-5 h-5 text-violet-600" />
          </div>
        </div>

        {/* Promedio mismo día de la semana */}
        <div className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">
              Promedio mismo día
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatPromedio(stats.promedioMismoDia)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Histórico de este mismo día de la semana (mes actual)
            </p>
          </div>
          <div className="bg-amber-100 rounded-full p-3">
            <BarChart3 className="w-5 h-5 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Registrar */}
      <div className="mb-6 relative">
        <label className="block text-sm font-medium">Marcar asistencia</label>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            <input
              ref={inputRef}
              autoFocus
              placeholder="Carnet, nombre o DNI..."
              className="border rounded px-3 py-2 w-full pl-9"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => setOpenSug(sugerencias.length > 0)}
            />
            {/* Dropdown sugerencias */}
            {openSug && sugerencias.length > 0 && (
              <div
                ref={sugBoxRef}
                className="absolute z-20 mt-1 w-full bg-white border rounded shadow-lg max-h-64 overflow-auto"
              >
                {sugerencias.map((s, i) => {
                  const active = i === activeIdx;
                  const isVigente = s.estado === 'vigente';
                  return (
                    <div
                      key={s.id}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between border-l-4 ${
                        active
                          ? isVigente
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-600 text-white border-red-600'
                          : isVigente
                          ? 'hover:bg-green-50 border-green-500 bg-green-25'
                          : 'hover:bg-red-50 border-red-500 bg-red-25'
                      }`}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        marcarValor(s.carnet || s.nombreCompleto);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1.5 rounded ${
                            active
                              ? 'bg-white bg-opacity-20'
                              : isVigente
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}
                        >
                          {isVigente ? (
                            <CheckCircle
                              className={`w-4 h-4 ${
                                active ? 'text-white' : 'text-green-600'
                              }`}
                            />
                          ) : (
                            <AlertTriangle
                              className={`w-4 h-4 ${
                                active ? 'text-white' : 'text-red-600'
                              }`}
                            />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {s.nombreCompleto}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                isVigente
                                  ? active
                                    ? 'bg-white bg-opacity-20 text-white'
                                    : 'bg-green-600 text-white'
                                  : active
                                  ? 'bg-white bg-opacity-20 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {isVigente ? 'VIGENTE' : 'VENCIDO'}
                            </span>
                          </div>
                          <div
                            className={`text-xs ${
                              active
                                ? 'text-white text-opacity-80'
                                : 'text-gray-600'
                            }`}
                          >
                            Carnet: {s.carnet}
                            {s.dni ? ` · DNI: ${s.dni}` : ''}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs ${
                          active
                            ? 'text-white text-opacity-70'
                            : 'text-gray-500'
                        }`}
                      >
                        Enter
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={marcar}
            className="px-3 py-2 rounded bg-blue-600 text-white"
          >
            Marcar
          </button>
        </div>
        {!!msg && (
          <p
            className={`mt-2 text-sm ${
              msgType === 'success'
                ? 'text-green-700'
                : msgType === 'warning'
                ? 'text-yellow-700'
                : 'text-red-700'
            }`}
          >
            {msg}
          </p>
        )}
      </div>

      {/* Hoy */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Hoy</h2>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString()}
          </div>
        </div>
        {asistenciasHoy.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay asistencias registradas hoy</p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {asistenciasHoy.map((a) => (
              <div
                key={a.id}
                className="bg-white border rounded-lg p-3 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Hash className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">
                      {a.nombre_completo}
                    </div>
                    <div className="text-sm text-gray-600">
                      Carnet: {a.carnet}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-800">
                    {new Date(a.timestamp_iso).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.by_usuario || 'Sistema'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial / Filtro / Export */}
      <div className="bg-white border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-gray-500">
              Buscar en historial
            </label>
            <input
              placeholder="Filtrar por nombre, número de socio u operador..."
              className="border rounded px-3 py-2 w-full"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Desde</label>
            <input
              type="date"
              className="border rounded px-2 py-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Hasta</label>
            <input
              type="date"
              className="border rounded px-2 py-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            onClick={doExportJSON}
            className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 text-white"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
          <button
            onClick={doExportCSV}
            className="flex items-center gap-2 px-3 py-2 rounded bg-gray-800 text-white"
          >
            <FileText className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={doImport}
            className="flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white"
          >
            <Upload className="w-4 h-4" /> Importar
          </button>
        </div>

        {loadingAsistencias && (
          <div className="mt-4 text-center text-gray-500">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              Cargando asistencias...
            </div>
          </div>
        )}

        <div className="overflow-auto mt-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left p-2">Fecha/Hora</th>
                <th className="text-left p-2">Carnet</th>
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Operador</th>
                <th className="text-left p-2">Turno</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-500" colSpan={5}>
                    Sin registros.
                  </td>
                </tr>
              )}
              {visibles.map((a: any) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">
                    {new Date(a.timestamp_iso).toLocaleString()}
                  </td>
                  <td className="p-2 font-mono">{a.carnet}</td>
                  <td className="p-2">{a.nombre_completo}</td>
                  <td className="p-2">{a.by_usuario || '-'}</td>
                  <td className="p-2">{a.turno_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}