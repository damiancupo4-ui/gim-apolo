import React, { useMemo, useState } from 'react';
import { CreditCard, DollarSign, ArrowDownCircle, ArrowUpCircle, ClipboardList, CalendarCheck } from 'lucide-react';
import { Socio, Retiro, Gasto, Ingreso, Turno } from '../types';

type Props = {
  socios: Socio[];
  retiros: Retiro[];
  gastos: Gasto[];
  ingresos: Ingreso[];
  turnos: Turno[];
  contadorRetiro: number;
  onAddIngreso: (ingreso: Omit<Ingreso, 'id'>) => void;
  onAddRetiro: (retiro: Omit<Retiro, 'id' | 'numero'>) => void;
  onAddGasto: (gasto: Omit<Gasto, 'id'>) => void;
  onIniciarTurno: (usuario: string, montoInicial: number) => void;
  onCerrarTurno: (montoFinal: number) => void;
};

type Movimiento =
  | { tipo: 'ingreso'; fecha: string; monto: number; detalle: string; sub: string }
  | { tipo: 'retiro'; fecha: string; monto: number; detalle: string; sub: string }
  | { tipo: 'gasto'; fecha: string; monto: number; detalle: string; sub: string };

function inRange(iso: string, fromISO: string, toISO?: string) {
  const t = new Date(iso).getTime();
  const a = new Date(fromISO).getTime();
  const b = toISO ? new Date(toISO).getTime() : Date.now();
  return t >= a && t <= b;
}

function fmt(n: number) {
  if (n == null || isNaN(n) || !isFinite(n)) {
    return '0.00';
  }
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const Caja: React.FC<Props> = ({
  socios,
  retiros,
  gastos,
  ingresos,
  turnos,
  contadorRetiro,
  onAddIngreso,
  onAddRetiro,
  onAddGasto,
  onIniciarTurno,
  onCerrarTurno,
}) => {
  const turnoAbierto = useMemo(() => turnos.find(t => !t.cerrado), [turnos]);

  // Resúmenes del turno
  const resumen = useMemo(() => {
    if (!turnoAbierto) {
      return {
        montoInicial: 0,
        ingresosEf: 0,
        ingresosTx: 0,
        retiros: 0,
        gastos: 0,
        efectivoDisponible: 0,
      };
    }
    const from = turnoAbierto.fechaInicio;
    const to = turnoAbierto.fechaFin;

    const ingEf = ingresos
      .filter(i => i.formaPago === 'efectivo' && inRange(i.fecha, from, to))
      .reduce((a, b) => a + (b.monto || 0), 0);

    const ingTx = ingresos
      .filter(i => i.formaPago === 'transferencia' && inRange(i.fecha, from, to))
      .reduce((a, b) => a + (b.monto || 0), 0);

    const ret = retiros
      .filter(r => inRange(r.fecha, from, to))
      .reduce((a, b) => a + (b.monto || 0), 0);

    const gas = gastos
      .filter(g => inRange(g.fecha, from, to))
      .reduce((a, b) => a + (b.monto || 0), 0);

    const efectivo = (turnoAbierto.montoInicial || 0) + ingEf - ret - gas;
    return {
      montoInicial: turnoAbierto.montoInicial || 0,
      ingresosEf: ingEf,
      ingresosTx: ingTx,
      retiros: ret,
      gastos: gas,
      efectivoDisponible: Math.max(0, Number(efectivo.toFixed(2))),
    };
  }, [turnoAbierto, ingresos, retiros, gastos]);

  // Lista de movimientos del turno abierto
  const movimientos: Movimiento[] = useMemo(() => {
    if (!turnoAbierto) return [];
    const from = turnoAbierto.fechaInicio;
    const to = turnoAbierto.fechaFin;

    const movIngr: Movimiento[] = ingresos
      .filter(i => inRange(i.fecha, from, to))
      .map(i => ({
        tipo: 'ingreso' as const,
        fecha: i.fecha,
        monto: i.monto,
        detalle: `Carnet ${i.carnet} — ${i.nombreSocio}`,
        sub: i.concepto === 'alta' ? 'Alta' : i.concepto === 'renovacion' ? 'Renovación' : (i.formaPago || ''),
      }));

    const movRet: Movimiento[] = retiros
      .filter(r => inRange(r.fecha, from, to))
      .map(r => ({
        tipo: 'retiro' as const,
        fecha: r.fecha,
        monto: r.monto,
        detalle: `Retiro #${r.numero}`,
        sub: r.descripcion || '',
      }));

    const movGas: Movimiento[] = gastos
      .filter(g => inRange(g.fecha, from, to))
      .map(g => ({
        tipo: 'gasto' as const,
        fecha: g.fecha,
        monto: g.monto,
        detalle: `${g.proveedor} — ${g.motivo}`,
        sub: g.remito ? `Remito: ${g.remito}` : '',
      }));

    return [...movIngr, ...movRet, ...movGas].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }, [turnoAbierto, ingresos, retiros, gastos]);

  // Formularios
  const [usr, setUsr] = useState('');
  const [montoIni, setMontoIni] = useState<number>(0);

  const [retMonto, setRetMonto] = useState<number>(0);
  const [retDesc, setRetDesc] = useState('');

  const [gasMonto, setGasMonto] = useState<number>(0);
  const [gasProv, setGasProv] = useState('');
  const [gasMotivo, setGasMotivo] = useState('');
  const [gasRemito, setGasRemito] = useState('');

  const [montoFinal, setMontoFinal] = useState<number>(0);

  // Sugerir el monto final = efectivo disponible
  React.useEffect(() => {
    if (turnoAbierto) setMontoFinal(resumen.efectivoDisponible);
  }, [turnoAbierto, resumen.efectivoDisponible]);

  const puedeCerrar = turnoAbierto ? montoFinal <= resumen.efectivoDisponible + 0.0001 : false;

  const iniciar = () => {
    if (!usr.trim()) return alert('Ingresá el usuario del turno.');
    onIniciarTurno(usr.trim(), Number(montoIni) || 0);
    setUsr('');
    setMontoIni(0);
  };

  const agregarRetiro = () => {
    if (!turnoAbierto) return alert('Abrí un turno para registrar retiros.');
    const m = Number(retMonto) || 0;
    if (m <= 0) return alert('Monto inválido.');
    onAddRetiro({ monto: m, fecha: new Date().toISOString(), descripcion: retDesc || undefined });
    setRetMonto(0);
    setRetDesc('');
  };

  const agregarGasto = () => {
    if (!turnoAbierto) return alert('Abrí un turno para registrar gastos.');
    const m = Number(gasMonto) || 0;
    if (m <= 0) return alert('Monto inválido.');
    if (!gasProv.trim() || !gasMotivo.trim()) return alert('Proveedor y motivo son obligatorios.');
    onAddGasto({
      monto: m,
      proveedor: gasProv.trim(),
      motivo: gasMotivo.trim(),
      remito: gasRemito.trim(),
      fecha: new Date().toISOString(),
    });
    setGasMonto(0);
    setGasProv('');
    setGasMotivo('');
    setGasRemito('');
  };

  const cerrar = () => {
    if (!turnoAbierto) return;
    if (!puedeCerrar) {
      return alert(
        `El monto final ($${fmt(Number(montoFinal || 0))}) no puede exceder el efectivo disponible ($${fmt(resumen.efectivoDisponible)}).`
      );
    }
    onCerrarTurno(Number(montoFinal) || 0);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">Caja</h2>
        <div className="flex items-center gap-2 text-sm">
          <CalendarCheck className="w-4 h-4 text-gray-500" />
          {turnoAbierto ? (
            <span className="text-green-700">
              Turno abierto • {turnoAbierto.usuario} • {new Date(turnoAbierto.fechaInicio).toLocaleString()}
            </span>
          ) : (
            <span className="text-red-700">No hay turno abierto</span>
          )}
        </div>
      </div>

      {/* Iniciar turno */}
      {!turnoAbierto && (
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Iniciar turno</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              placeholder="Usuario"
              className="border rounded px-3 py-2"
              value={usr}
              onChange={e => setUsr(e.target.value)}
            />
            <input
              type="number"
              placeholder="Monto inicial"
              className="border rounded px-3 py-2"
              value={montoIni}
              onChange={e => setMontoIni(Number(e.target.value))}
              min={0}
            />
            <button onClick={iniciar} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4">
              Iniciar
            </button>
          </div>
        </div>
      )}

      {/* Resumen turno */}
      {turnoAbierto && (
        <>
          <div className="grid md:grid-cols-5 gap-4">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <DollarSign className="w-4 h-4" /> Monto inicial
              </div>
              <div className="text-2xl font-bold mt-1">${fmt(resumen.montoInicial)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <CreditCard className="w-4 h-4" /> Ingresos (efectivo)
              </div>
              <div className="text-2xl font-bold mt-1 text-green-700">+ ${fmt(resumen.ingresosEf)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <CreditCard className="w-4 h-4" /> Ingresos (transferencia)
              </div>
              <div className="text-2xl font-bold mt-1">+ ${fmt(resumen.ingresosTx)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <ArrowUpCircle className="w-4 h-4" /> Retiros
              </div>
              <div className="text-2xl font-bold mt-1 text-red-700">- ${fmt(resumen.retiros)}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <ArrowDownCircle className="w-4 h-4" /> Gastos
              </div>
              <div className="text-2xl font-bold mt-1 text-red-700">- ${fmt(resumen.gastos)}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <ClipboardList className="w-4 h-4" /> Métricas del turno
              </div>
              <div className="mt-3 space-y-1">
                <div>Altas de carnet: <span className="font-semibold">{turnoAbierto.metrics?.altasCarnet ?? 0}</span></div>
                <div>Renovaciones: <span className="font-semibold">{turnoAbierto.metrics?.renovaciones ?? 0}</span></div>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <DollarSign className="w-4 h-4" /> Efectivo disponible
              </div>
              <div className="text-3xl font-extrabold mt-1">${fmt(resumen.efectivoDisponible)}</div>
              <div className="text-xs text-gray-500 mt-1">= Inicial + Ingresos (efectivo) − Retiros − Gastos</div>
            </div>

            {/* Cierre de turno */}
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="font-semibold text-gray-800 mb-2">Cerrar turno</div>
              <label className="text-sm text-gray-600">Monto final (sugerido: efectivo disponible)</label>
              <input
                type="number"
                className="border rounded px-3 py-2 w-full mt-1"
                value={montoFinal}
                onChange={e => setMontoFinal(Number(e.target.value))}
                min={0}
              />
              {!puedeCerrar && (
                <div className="text-red-600 text-sm mt-1">
                  El monto final no puede exceder ${fmt(resumen.efectivoDisponible)}.
                </div>
              )}
              <button
                onClick={cerrar}
                className={`mt-3 w-full rounded px-4 py-2 text-white ${puedeCerrar ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                disabled={!puedeCerrar}
              >
                Cerrar turno
              </button>
            </div>
          </div>

          {/* Formularios rápidos: Retiro / Gasto */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="font-semibold mb-2">Registrar Retiro</div>
              <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                <input
                  type="number"
                  placeholder="Monto"
                  className="border rounded px-3 py-2"
                  value={retMonto}
                  onChange={e => setRetMonto(Number(e.target.value))}
                  min={0}
                />
                <input
                  placeholder="Descripción (opcional)"
                  className="border rounded px-3 py-2 sm:col-span-2"
                  value={retDesc}
                  onChange={e => setRetDesc(e.target.value)}
                />
                <button onClick={agregarRetiro} className="bg-amber-600 hover:bg-amber-700 text-white rounded px-4 py-2 sm:col-span-2">
                  Agregar Retiro
                </button>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="font-semibold mb-2">Registrar Gasto</div>
              <div className="grid gap-2">
                <input
                  type="number"
                  placeholder="Monto"
                  className="border rounded px-3 py-2"
                  value={gasMonto}
                  onChange={e => setGasMonto(Number(e.target.value))}
                  min={0}
                />
                <input
                  placeholder="Proveedor"
                  className="border rounded px-3 py-2"
                  value={gasProv}
                  onChange={e => setGasProv(e.target.value)}
                />
                <input
                  placeholder="Motivo"
                  className="border rounded px-3 py-2"
                  value={gasMotivo}
                  onChange={e => setGasMotivo(e.target.value)}
                />
                <input
                  placeholder="Remito (opcional)"
                  className="border rounded px-3 py-2"
                  value={gasRemito}
                  onChange={e => setGasRemito(e.target.value)}
                />
                <button onClick={agregarGasto} className="bg-rose-600 hover:bg-rose-700 text-white rounded px-4 py-2">
                  Agregar Gasto
                </button>
              </div>
            </div>
          </div>

          {/* Movimientos del turno */}
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">Movimientos del turno</h3>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Fecha/Hora</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Detalle</th>
                    <th className="text-right p-2">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={4}>Sin movimientos en este turno.</td>
                    </tr>
                  )}
                  {movimientos.map((m, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{new Date(m.fecha).toLocaleString()}</td>
                      <td className="p-2 capitalize">
                        {m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'retiro' ? 'Retiro' : 'Gasto'}
                        {m.sub ? <span className="ml-2 text-xs text-gray-500">({m.sub})</span> : null}
                      </td>
                      <td className="p-2">{m.detalle}</td>
                      <td className={`p-2 text-right ${m.tipo === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                        {m.tipo === 'ingreso' ? '+' : '-'} ${fmt(m.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Historial de cierres */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">Cierres de turno</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Inicio</th>
                <th className="text-left p-2">Fin</th>
                <th className="text-left p-2">Usuario</th>
                <th className="text-right p-2">Inicial</th>
                <th className="text-right p-2">Final</th>
                <th className="text-right p-2">Recaudación</th>
                <th className="text-right p-2">Altas</th>
                <th className="text-right p-2">Renovaciones</th>
              </tr>
            </thead>
            <tbody>
              {turnos.filter(t => t.cerrado).length === 0 && (
                <tr>
                  <td className="p-3 text-gray-500" colSpan={8}>Sin cierres aún.</td>
                </tr>
              )}
              {turnos
                .filter(t => t.cerrado)
                .sort((a, b) => new Date(b.fechaFin || 0).getTime() - new Date(a.fechaFin || 0).getTime())
                .map(t => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{new Date(t.fechaInicio).toLocaleString()}</td>
                    <td className="p-2">{t.fechaFin ? new Date(t.fechaFin).toLocaleString() : '-'}</td>
                    <td className="p-2">{t.usuario}</td>
                    <td className="p-2 text-right">${fmt(t.montoInicial || 0)}</td>
                    <td className="p-2 text-right">${fmt(t.montoFinal || 0)}</td>
                    <td className="p-2 text-right">${fmt(t.recaudacion || 0)}</td>
                    <td className="p-2 text-right">{t.metrics?.altasCarnet ?? 0}</td>
                    <td className="p-2 text-right">{t.metrics?.renovaciones ?? 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Caja;
export { Caja };
