import React, { useMemo, useState } from 'react';
import { Socio } from '../types';
import { Search, Pencil, Trash2, ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { calcularEstadoSocio } from '../utils/localStorage';

interface BuscarCarnetProps {
  socios: Socio[];
  onNavigateBack: () => void;
  onUpdateSocio: (socioId: string, updates: Partial<Socio>) => void;
  onDeleteSocio: (socioId: string) => void;
  onRenovar: (socioId: string) => void;
}

export const BuscarSocio: React.FC<BuscarCarnetProps> = ({
  socios,
  onNavigateBack,
  onUpdateSocio,
  onDeleteSocio,
  onRenovar,
}) => {
  const [query, setQuery] = useState('');
  const [editSocio, setEditSocio] = useState<Socio | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return socios.filter(s =>
      s.carnet.includes(q) || s.nombreCompleto.toLowerCase().includes(q)
    ).sort((a, b) => {
      const aNum = parseInt(a.carnet.split('-')[1] || '0');
      const bNum = parseInt(b.carnet.split('-')[1] || '0');
      return bNum - aNum;
    });
  }, [socios, query]);

  function abrirEdicion(s: Socio) {
    setEditSocio({ ...s });
    setMsg(null);
  }

  function cancelarEdicion() {
    setEditSocio(null);
  }

  function guardarCambios() {
    if (!editSocio) return;

    // Validaciones básicas
    if (!editSocio.nombreCompleto.trim() || !editSocio.dni.trim()) {
      setMsg('Completá nombre y DNI.');
      return;
    }

    // Validar que el número de socio no se repita
    const existe = socios.some(s => s.id !== editSocio.id && s.numeroSocio === editSocio.numeroSocio);
    if (existe) {
      setMsg(`Ya existe el número de socio ${editSocio.numeroSocio}.`);
      return;
    }

    // Recalcular estado por si cambió fechaInicio
    const estado = calcularEstadoSocio(editSocio.fechaInicio);
    onUpdateSocio(editSocio.id, { ...editSocio, estado });
    setEditSocio(null);
    setMsg('Cambios guardados.');
  }

  function eliminarSocio(id: string) {
    if (!confirm('¿Eliminar este socio? Esta acción no se puede deshacer.')) return;
    onDeleteSocio(id);
    setMsg('Socio eliminado.');
    if (editSocio?.id === id) setEditSocio(null);
  }

  function renovarSocio(socio: Socio) {
    if (!confirm(`¿Renovar membresía de ${socio.nombreCompleto}?`)) return;
    onRenovar(socio.id);
    setMsg('Membresía renovada.');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Buscar Socio</h2>
        <div />
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-5 h-5 text-gray-500" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ingresá carnet o nombre..."
          className="w-full border rounded px-3 py-2"
          onKeyDown={e => {
            if (e.key === 'Enter' && resultados.length === 1) abrirEdicion(resultados[0]);
          }}
        />
      </div>

      {msg && <div className="text-sm text-gray-700">{msg}</div>}

      {/* Resultados */}
      <div className="bg-white rounded-lg shadow p-4">
        {resultados.length === 0 ? (
          <div className="text-gray-500">Sin resultados.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resultados.map(s => (
              <div
                key={s.id}
                className={`border-2 rounded-lg p-4 ${s.estado === 'vigente' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="font-semibold text-gray-800">Carnet: {s.carnet}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.estado === 'vigente' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                    {s.estado.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  <div className="font-medium">{s.nombreCompleto}</div>
                  <div>DNI: {s.dni}</div>
                  <div>Inicio: {new Date(s.fechaInicio).toLocaleDateString()}</div>
                  <div>Pago: {s.formaPago} — ${s.monto}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => abrirEdicion(s)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 text-xs border rounded hover:bg-gray-50"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                  {s.estado === 'vencido' && (
                    <button
                      onClick={() => renovarSocio(s)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Renovar
                    </button>
                  )}
                  <button
                    onClick={() => eliminarSocio(s.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 text-xs border rounded text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editSocio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl">
            <h3 className="text-lg font-semibold mb-4">Editar socio</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Carnet</label>
                <input
                  value={editSocio.carnet}
                  onChange={e => setEditSocio({ ...editSocio, carnet: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre completo</label>
                <input
                  value={editSocio.nombreCompleto}
                  onChange={e => setEditSocio({ ...editSocio, nombreCompleto: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">DNI</label>
                <input
                  value={editSocio.dni}
                  onChange={e => setEditSocio({ ...editSocio, dni: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fecha de inicio</label>
                <input
                  type="date"
                  value={editSocio.fechaInicio}
                  onChange={e => setEditSocio({ ...editSocio, fechaInicio: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Forma de pago</label>
                <select
                  value={editSocio.formaPago}
                  onChange={e => setEditSocio({ ...editSocio, formaPago: e.target.value as 'efectivo' | 'transferencia' })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Monto</label>
                <input
                  type="number"
                  value={editSocio.monto}
                  onChange={e => setEditSocio({ ...editSocio, monto: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}

            <div className="mt-5 flex gap-2">
              <button
                onClick={guardarCambios}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={cancelarEdicion}
                className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BuscarCarnet = BuscarSocio;