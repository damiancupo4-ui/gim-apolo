import React, { useState, useMemo, useEffect } from 'react';
import { Socio } from '../types';
import { Users, Plus, Calendar, CreditCard, Phone, Car as IdCard, CreditCard as Edit, Trash2, RotateCcw, X, Save, Download, Upload, TrendingUp, TrendingDown, DollarSign, Eye, Clock, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { estaProximoAVencer } from '../utils/localStorage';

interface SociosProps {
  socios: Socio[];
  onAddSocio: (socio: Omit<Socio, 'id' | 'carnet' | 'estado'>) => void;
  contadorSocio: number;
  onUpdateSocio: (socioId: string, updates: Partial<Socio>) => void;
  onDeleteSocio: (socioId: string) => void;
  onRenovar: (socioId: string) => void;
}

type EstadisticasMes = {
  altasCount: number;
  renovacionesCount: number;
  altasDetalle: Array<{
    id: string;
    carnet: string;
    nombre_socio: string;
    monto: number;
    fecha: string;
  }>;
  renovacionesDetalle: Array<{
    id: string;
    carnet: string;
    nombre_socio: string;
    monto: number;
    fecha: string;
  }>;
};

export const Socios: React.FC<SociosProps> = ({
  socios,
  onAddSocio,
  contadorSocio,
  onUpdateSocio,
  onDeleteSocio,
  onRenovar,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editSocio, setEditSocio] = useState<Socio | null>(null);
  const [selectedSocio, setSelectedSocio] = useState<Socio | null>(null);
  const [socioHistorial, setSocioHistorial] = useState<any[]>([]);
  const [socioAsistencias, setSocioAsistencias] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [showEstadisticas, setShowEstadisticas] = useState(false);
  const [tipoEstadistica, setTipoEstadistica] = useState<'altas' | 'renovaciones'>('altas');
  const [estadisticasMes, setEstadisticasMes] = useState<EstadisticasMes>({
    altasCount: 0,
    renovacionesCount: 0,
    altasDetalle: [],
    renovacionesDetalle: []
  });
  const [filtroSocios, setFiltroSocios] = useState('');
  const [vistaFiltro, setVistaFiltro] = useState<'todos' | 'vigentes' | 'vencidos'>('todos');
  const [renovacionAnticipada, setRenovacionAnticipada] = useState<{
    socio: Socio | null;
    show: boolean;
    fechaInicio: string;
    tipoRenovacion: 'desde_hoy' | 'desde_vencimiento';
    monto: number;
    formaPago: 'efectivo' | 'transferencia';
  }>({
    socio: null,
    show: false,
    fechaInicio: new Date().toISOString().slice(0, 10),
    tipoRenovacion: 'desde_vencimiento',
    monto: 30000,
    formaPago: 'efectivo'
  });

  // Formulario
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    dni: '',
    telefono: '',
    fechaInicio: new Date().toISOString().slice(0, 10),
    formaPago: 'efectivo' as 'efectivo' | 'transferencia',
    monto: 30000,
  });

  // Función para obtener estadísticas del mes actual
  const cargarEstadisticasMes = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-based
      
      // Calcular inicio y fin del mes
      const inicioMes = new Date(year, month, 1).toISOString();
      const finMes = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

      console.log('🗓️ Consultando ingresos del mes:', { inicioMes, finMes, year, month: month + 1 });

      // Consultar todos los ingresos del mes actual
      const { data: ingresos, error } = await supabase
        .from('ingresos')
        .select('*')
        .gte('created_at', inicioMes)
        .lte('created_at', finMes)
        .order('fecha', { ascending: false });

      if (error) {
        console.error('❌ Error consultando ingresos:', error);
        throw error;
      }

      console.log('📊 Ingresos encontrados:', ingresos?.length || 0);
      console.log('📋 Primeros 5 ingresos:', ingresos?.slice(0, 5));

      const altas = (ingresos || []).filter(i => i.concepto === 'alta');
      const renovaciones = (ingresos || []).filter(i => i.concepto === 'renovacion');

      console.log('🆕 Altas encontradas:', altas.length);
      console.log('🔄 Renovaciones encontradas:', renovaciones.length);
      console.log('🔄 Detalle renovaciones:', renovaciones.map(r => ({ 
        carnet: r.carnet, 
        nombre: r.nombre_socio, 
        fecha: r.created_at || r.fecha,
        concepto: r.concepto 
      })));

      setEstadisticasMes({
        altasCount: altas.length,
        renovacionesCount: renovaciones.length,
        altasDetalle: altas.map(a => ({
          id: a.id,
          carnet: a.carnet,
          nombre_socio: a.nombre_socio,
          monto: a.monto,
          fecha: a.created_at || a.fecha
        })),
        renovacionesDetalle: renovaciones.map(r => ({
          id: r.id,
          carnet: r.carnet,
          nombre_socio: r.nombre_socio,
          monto: r.monto,
          fecha: r.created_at || r.fecha
        }))
      });

    } catch (error) {
      console.error('❌ Error cargando estadísticas:', error);
      setEstadisticasMes({
        altasCount: 0,
        renovacionesCount: 0,
        altasDetalle: [],
        renovacionesDetalle: []
      });
    }
  };

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    cargarEstadisticasMes();
  }, []);

  const sociosVigentes = useMemo(() => socios.filter(s => s.estado === 'vigente'), [socios]);
  const sociosVencidos = useMemo(() => socios.filter(s => s.estado === 'vencido'), [socios]);

  // Filtrar socios según el buscador y la vista seleccionada
  const sociosFiltrados = useMemo(() => {
    // Primero filtrar por vista
    let sociosPorVista = socios;
    if (vistaFiltro === 'vigentes') {
      sociosPorVista = socios.filter(s => s.estado === 'vigente');
    } else if (vistaFiltro === 'vencidos') {
      sociosPorVista = socios.filter(s => s.estado === 'vencido');
    }
    
    // Luego filtrar por búsqueda
    if (!filtroSocios.trim()) return sociosPorVista;
    const query = filtroSocios.trim().toLowerCase();
    return sociosPorVista.filter(socio => 
      socio.carnet.toLowerCase().includes(query) ||
      socio.nombreCompleto.toLowerCase().includes(query) ||
      socio.dni.toLowerCase().includes(query)
    );
  }, [socios, filtroSocios, vistaFiltro]);

  const resetForm = () => {
    setFormData({
      nombreCompleto: '',
      dni: '',
      telefono: '',
      fechaInicio: new Date().toISOString().slice(0, 10),
      formaPago: 'efectivo',
      monto: 30000,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombreCompleto.trim() || !formData.dni.trim()) {
      alert('Completá nombre y DNI.');
      return;
    }

    onAddSocio(formData);
    resetForm();
    setShowForm(false);
    // Recargar estadísticas después de agregar
    setTimeout(cargarEstadisticasMes, 500);
  };

  const handleEdit = (socio: Socio) => {
    setEditSocio({ ...socio });
  };

  const handleSaveEdit = () => {
    if (!editSocio) return;
    if (!editSocio.nombreCompleto.trim() || !editSocio.dni.trim()) {
      alert('Completá nombre y DNI.');
      return;
    }

    onUpdateSocio(editSocio.id, editSocio);
    setEditSocio(null);
  };

  const handleDelete = (socio: Socio) => {
    if (!confirm(`¿Eliminar a ${socio.nombreCompleto}? Esta acción no se puede deshacer.`)) return;
    onDeleteSocio(socio.id);
    // Recargar estadísticas después de eliminar
    setTimeout(cargarEstadisticasMes, 500);
  };

  const handleRenovar = (socio: Socio) => {
    if (!confirm(`¿Renovar membresía de ${socio.nombreCompleto}?`)) return;
    onRenovar(socio.id);
    // Recargar estadísticas después de renovar
    setTimeout(cargarEstadisticasMes, 500);
  };

  const handleRenovacionAnticipada = (socio: Socio) => {
    const fechaInicio = new Date(socio.fechaInicio);
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    
    setRenovacionAnticipada({
      socio,
      show: true,
      fechaInicio: new Date().toISOString().slice(0, 10),
      tipoRenovacion: 'desde_vencimiento',
      monto: 30000,
      formaPago: 'efectivo'
    });
  };

  const confirmarRenovacionAnticipada = () => {
    if (!renovacionAnticipada.socio) return;
    
    let nuevaFechaInicio: string;
    
    if (renovacionAnticipada.tipoRenovacion === 'desde_hoy') {
      nuevaFechaInicio = new Date().toISOString().slice(0, 10);
    } else {
      // Desde vencimiento actual
      const fechaInicio = new Date(renovacionAnticipada.socio.fechaInicio);
      const fechaVencimiento = new Date(fechaInicio);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
      nuevaFechaInicio = fechaVencimiento.toISOString().slice(0, 10);
    }
    
    // Actualizar el socio con la nueva fecha de inicio
    onUpdateSocio(renovacionAnticipada.socio.id, {
      fechaInicio: nuevaFechaInicio,
      monto: renovacionAnticipada.monto,
      formaPago: renovacionAnticipada.formaPago
    });
    
    // Cerrar modal
    setRenovacionAnticipada({
      socio: null,
      show: false,
      fechaInicio: new Date().toISOString().slice(0, 10),
      tipoRenovacion: 'desde_vencimiento',
      monto: 30000,
      formaPago: 'efectivo'
    });
    
    // Recargar estadísticas
    setTimeout(cargarEstadisticasMes, 500);
  };

  // Función para cargar historial del socio
  const cargarHistorialSocio = async (socio: Socio) => {
    setLoadingHistorial(true);
    try {
      // Cargar ingresos del socio
      const { data: ingresos, error: ingresosError } = await supabase
        .from('ingresos')
        .select('*')
        .eq('carnet', socio.carnet)
        .order('fecha', { ascending: false });

      if (ingresosError) throw ingresosError;

      // Cargar asistencias del socio
      const { data: asistencias, error: asistenciasError } = await supabase
        .from('asistencias')
        .select('*')
        .eq('carnet', socio.carnet)
        .order('timestamp_iso', { ascending: false })
        .limit(10); // Últimas 10 asistencias

      if (asistenciasError) throw asistenciasError;

      setSocioHistorial(ingresos || []);
      setSocioAsistencias(asistencias || []);
      setSelectedSocio(socio);
    } catch (error) {
      console.error('Error cargando historial del socio:', error);
      setSocioHistorial([]);
      setSocioAsistencias([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const exportarSocios = () => {
    const dataStr = JSON.stringify(socios, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `socios-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const mostrarEstadisticas = (tipo: 'altas' | 'renovaciones') => {
    console.log(`📊 Mostrando estadísticas de ${tipo}`);
    console.log(`📋 Datos disponibles:`, tipo === 'altas' ? estadisticasMes.altasDetalle : estadisticasMes.renovacionesDetalle);
    
    setTipoEstadistica(tipo);
    setShowEstadisticas(true);
  };

  const datosEstadistica = tipoEstadistica === 'altas' ? estadisticasMes.altasDetalle : estadisticasMes.renovacionesDetalle;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">Gestión de Socios</h2>
        <div className="flex gap-3">
          <button
            onClick={exportarSocios}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Nuevo Socio
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Socios</p>
              <p className="text-2xl font-bold text-gray-900">{socios.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Vigentes</p>
              <p className="text-2xl font-bold text-green-700">{sociosVigentes.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div 
          className="bg-white border rounded-xl p-4 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => mostrarEstadisticas('altas')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Altas del Mes</p>
              <p className="text-2xl font-bold text-blue-700">{estadisticasMes.altasCount}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div 
          className="bg-white border rounded-xl p-4 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => mostrarEstadisticas('renovaciones')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Renovaciones del Mes</p>
              <p className="text-2xl font-bold text-purple-700">{estadisticasMes.renovacionesCount}</p>
            </div>
            <RotateCcw className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="space-y-4">
          {/* Filtros de vista */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Vista:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setVistaFiltro('todos')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  vistaFiltro === 'todos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos ({socios.length})
              </button>
              <button
                onClick={() => setVistaFiltro('vigentes')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  vistaFiltro === 'vigentes'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Vigentes ({sociosVigentes.length})
              </button>
              <button
                onClick={() => setVistaFiltro('vencidos')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  vistaFiltro === 'vencidos'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Vencidos ({sociosVencidos.length})
              </button>
            </div>
          </div>
          
          {/* Buscador */}
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por carnet, nombre o DNI..."
              className="flex-1 border rounded-lg px-3 py-2"
              value={filtroSocios}
              onChange={(e) => setFiltroSocios(e.target.value)}
            />
            {filtroSocios && (
              <button
                onClick={() => setFiltroSocios('')}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de socios */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Carnets de Socios</h3>
        </div>
        
        <div className="p-6">
          {sociosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">
                {socios.length === 0 
                  ? 'No hay socios registrados' 
                  : filtroSocios 
                    ? 'No se encontraron socios con esos criterios'
                    : `No hay socios ${vistaFiltro === 'vigentes' ? 'vigentes' : vistaFiltro === 'vencidos' ? 'vencidos' : ''}`
                }
              </p>
              <p className="text-sm">
                {socios.length === 0 
                  ? 'Agregá el primer socio para comenzar'
                  : 'Probá con otros filtros o términos de búsqueda'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sociosFiltrados
                .sort((a, b) => {
                  const aNum = parseInt(a.carnet.split('-')[1] || '0');
                  const bNum = parseInt(b.carnet.split('-')[1] || '0');
                  return bNum - aNum;
                })
                .map(socio => (
                  <div
                    key={socio.id}
                    onClick={() => cargarHistorialSocio(socio)}
                    className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                      socio.estado === 'vigente'
                        ? 'border-green-500 bg-green-50 hover:bg-green-100'
                        : 'border-red-500 bg-red-50 hover:bg-red-100'
                    } cursor-pointer`}
                  >
                    {/* Header del carnet */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="font-bold text-lg text-gray-800">
                        Carnet: {socio.carnet}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-bold ${
                          socio.estado === 'vigente'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {socio.estado.toUpperCase()}
                      </span>
                    </div>

                    {/* Información del socio */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-800">{socio.nombreCompleto}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <IdCard className="w-4 h-4" />
                        <span>DNI: {socio.dni}</span>
                      </div>

                      {socio.telefono && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{socio.telefono}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Inicio: {new Date(socio.fechaInicio).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CreditCard className="w-4 h-4" />
                        <span>{socio.formaPago} — ${socio.monto.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cargarHistorialSocio(socio);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Eye className="w-3 h-3" />
                        Ver
                      </button>
                      
                      <button
                        onClick={() => handleEdit(socio)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs border rounded-lg hover:bg-gray-50"
                      >
                        <Edit className="w-3 h-3" />
                        Editar
                      </button>
                      
                      {(socio.estado === 'vencido' || estaProximoAVencer(socio)) && (
                        <button
                          onClick={() => socio.estado === 'vencido' ? handleRenovar(socio) : handleRenovacionAnticipada(socio)}
                          className={`flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs rounded-lg ${
                            socio.estado === 'vencido' 
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-yellow-600 text-white hover:bg-yellow-700'
                          }`}
                        >
                          {socio.estado === 'vencido' ? (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              Renovar
                            </>
                          ) : (
                            <>
                              <Calendar className="w-3 h-3" />
                              Renovar Anticipado
                            </>
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(socio)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Nuevo Socio</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={formData.nombreCompleto}
                  onChange={(e) => setFormData({ ...formData, nombreCompleto: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI
                </label>
                <input
                  type="text"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={formData.fechaInicio}
                  onChange={(e) => setFormData({ ...formData, fechaInicio: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de pago
                </label>
                <select
                  value={formData.formaPago}
                  onChange={(e) => setFormData({ ...formData, formaPago: e.target.value as 'efectivo' | 'transferencia' })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto
                </label>
                <input
                  type="number"
                  value={formData.monto}
                  onChange={(e) => setFormData({ ...formData, monto: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                  min="0"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      {editSocio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editar Socio</h3>
              <button
                onClick={() => setEditSocio(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carnet
                </label>
                <input
                  type="text"
                  value={editSocio.carnet}
                  onChange={(e) => setEditSocio({ ...editSocio, carnet: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={editSocio.nombreCompleto}
                  onChange={(e) => setEditSocio({ ...editSocio, nombreCompleto: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI
                </label>
                <input
                  type="text"
                  value={editSocio.dni}
                  onChange={(e) => setEditSocio({ ...editSocio, dni: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={editSocio.telefono || ''}
                  onChange={(e) => setEditSocio({ ...editSocio, telefono: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={editSocio.fechaInicio}
                  onChange={(e) => setEditSocio({ ...editSocio, fechaInicio: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de pago
                </label>
                <select
                  value={editSocio.formaPago}
                  onChange={(e) => setEditSocio({ ...editSocio, formaPago: e.target.value as 'efectivo' | 'transferencia' })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto
                </label>
                <input
                  type="number"
                  value={editSocio.monto}
                  onChange={(e) => setEditSocio({ ...editSocio, monto: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditSocio(null)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de estadísticas */}
      {showEstadisticas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {tipoEstadistica === 'altas' ? 'Altas del Mes' : 'Renovaciones del Mes'}
              </h3>
              <button
                onClick={() => setShowEstadisticas(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[60vh]">
              {datosEstadistica.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No hay registros para este mes</p>
                  <p className="text-sm">
                    Contador en tarjeta: {tipoEstadistica === 'altas' ? estadisticasMes.altasCount : estadisticasMes.renovacionesCount}
                  </p>
                  <p className="text-sm">
                    Registros encontrados: {datosEstadistica.length}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {datosEstadistica.map((item, index) => (
                    <div key={item.id || index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-800">
                            Carnet: {item.carnet} — {item.nombre_socio}
                          </div>
                          <div className="text-sm text-gray-600">
                            Fecha: {new Date(item.fecha).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            ${item.monto.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Total de registros: {datosEstadistica.length}</span>
                <span>
                  Total: ${datosEstadistica.reduce((sum, item) => sum + (item.monto || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle del socio */}
      {selectedSocio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${selectedSocio.estado === 'vigente' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h3 className="text-lg font-semibold">
                  {selectedSocio.nombreCompleto} - Carnet {selectedSocio.carnet}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSocio(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-auto max-h-[60vh]">
              {/* Información del socio */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Información Personal
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>DNI:</strong> {selectedSocio.dni}</div>
                    {selectedSocio.telefono && (
                      <div><strong>Teléfono:</strong> {selectedSocio.telefono}</div>
                    )}
                    <div><strong>Fecha de inicio:</strong> {new Date(selectedSocio.fechaInicio).toLocaleDateString()}</div>
                    <div><strong>Estado:</strong> 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                        selectedSocio.estado === 'vigente' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedSocio.estado.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Historial de pagos */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Historial de Pagos ({socioHistorial.length})
                  </h4>
                  {loadingHistorial ? (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                        Cargando...
                      </div>
                    </div>
                  ) : socioHistorial.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No hay pagos registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {socioHistorial.map((pago, index) => (
                        <div key={pago.id || index} className="bg-white rounded p-3 border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {pago.concepto === 'alta' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : pago.concepto === 'renovacion' ? (
                                <RotateCcw className="w-4 h-4 text-blue-600" />
                              ) : (
                                <CreditCard className="w-4 h-4 text-gray-600" />
                              )}
                              <span className="font-medium text-sm">
                                {pago.concepto === 'alta' ? 'Alta' : 
                                 pago.concepto === 'renovacion' ? 'Renovación' : 'Pago'}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">
                                ${pago.monto?.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {pago.forma_pago}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(pago.fecha).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Asistencias recientes */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Últimas Asistencias ({socioAsistencias.length})
                  </h4>
                  {loadingHistorial ? (
                    <div className="text-center py-4">
                      <div className="inline-flex items-center gap-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                        Cargando...
                      </div>
                    </div>
                  ) : socioAsistencias.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No hay asistencias registradas</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {socioAsistencias.map((asistencia, index) => (
                        <div key={asistencia.id || index} className="bg-white rounded p-3 border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-sm">
                                Asistencia
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-sm">
                                {new Date(asistencia.timestamp_iso).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(asistencia.timestamp_iso).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          {asistencia.by_usuario && (
                            <div className="text-xs text-gray-500 mt-1">
                              Registrado por: {asistencia.by_usuario}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resumen */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3">Resumen</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {socioHistorial.length}
                      </div>
                      <div className="text-blue-700">Pagos totales</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {socioAsistencias.length}
                      </div>
                      <div className="text-blue-700">Asistencias</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        ${socioHistorial.reduce((sum, pago) => sum + (pago.monto || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-blue-700 text-sm">Total pagado</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de renovación anticipada */}
      {renovacionAnticipada.show && renovacionAnticipada.socio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Renovación Anticipada</h3>
              <button
                onClick={() => setRenovacionAnticipada({ ...renovacionAnticipada, show: false })}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="font-medium text-yellow-800">
                  {renovacionAnticipada.socio.nombreCompleto}
                </div>
                <div className="text-sm text-yellow-700">
                  Carnet: {renovacionAnticipada.socio.carnet}
                </div>
                <div className="text-sm text-yellow-700">
                  Vence: {(() => {
                    const fechaInicio = new Date(renovacionAnticipada.socio.fechaInicio);
                    const fechaVencimiento = new Date(fechaInicio);
                    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
                    return fechaVencimiento.toLocaleDateString();
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de renovación
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tipoRenovacion"
                      value="desde_vencimiento"
                      checked={renovacionAnticipada.tipoRenovacion === 'desde_vencimiento'}
                      onChange={(e) => setRenovacionAnticipada({
                        ...renovacionAnticipada,
                        tipoRenovacion: e.target.value as 'desde_vencimiento'
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <strong>Desde vencimiento actual</strong> - Aprovecha todos los días pagados
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tipoRenovacion"
                      value="desde_hoy"
                      checked={renovacionAnticipada.tipoRenovacion === 'desde_hoy'}
                      onChange={(e) => setRenovacionAnticipada({
                        ...renovacionAnticipada,
                        tipoRenovacion: e.target.value as 'desde_hoy'
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <strong>Desde hoy</strong> - Inicia nuevo ciclo inmediatamente
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de pago
                </label>
                <select
                  value={renovacionAnticipada.formaPago}
                  onChange={(e) => setRenovacionAnticipada({
                    ...renovacionAnticipada,
                    formaPago: e.target.value as 'efectivo' | 'transferencia'
                  })}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto
                </label>
                <input
                  type="number"
                  value={renovacionAnticipada.monto}
                  onChange={(e) => setRenovacionAnticipada({
                    ...renovacionAnticipada,
                    monto: Number(e.target.value)
                  })}
                  className="w-full border rounded-lg px-3 py-2"
                  min="0"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setRenovacionAnticipada({ ...renovacionAnticipada, show: false })}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRenovacionAnticipada}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Renovar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};