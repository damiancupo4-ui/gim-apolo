// src/App.tsx
import React, { useMemo, useState } from 'react';
import { Loader, Lock, Play } from 'lucide-react';
import { AuthWrapper } from './components/AuthWrapper';
import { Layout } from './components/Layout';
import { Socios } from './pages/Socios';
import { BuscarCarnet } from './pages/BuscarCarnet';
import Caja from './pages/Caja';
import { useSupabaseGymData } from './hooks/useSupabaseGymData';
import Asistencias from './pages/Asistencias';
import Backups from './pages/Backups';

function App() {
  // Página por defecto: asistencias
  const [currentPage, setCurrentPage] = useState('asistencias');

  const {
    data,
    isLoading,
    error,
    addSocio,
    addIngreso,
    addRetiro,
    addGasto,
    iniciarTurno,
    cerrarTurno,
    renovarMembresia,   // ← se usa en Socios
    updateSocio,        // ← se usa en Socios
    deleteSocio,        // ← se usa en Socios
  } = useSupabaseGymData();

  // Turno abierto / bloqueo
  const turnoAbierto = useMemo(() => data.turnos.find(t => !t.cerrado), [data.turnos]);
  const locked = !turnoAbierto;

  // Estado para iniciar turno desde la pantalla de bloqueo
  const [usuarioTurno, setUsuarioTurno] = useState('');
  const [montoInicialTurno, setMontoInicialTurno] = useState<number>(0);

  const handleAbrirTurno = async () => {
    if (!usuarioTurno.trim()) {
      alert('Ingresá un usuario para iniciar el turno.');
      return;
    }
    await iniciarTurno(usuarioTurno.trim(), Number(montoInicialTurno) || 0);
    setUsuarioTurno('');
    setMontoInicialTurno(0);
    setCurrentPage('caja'); // llevo a caja tras abrir
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'asistencias':
        return <Asistencias />;

      case 'backups':
        return <Backups />;

      case 'socios':
        return (
          <Socios
            socios={data.socios}
            onAddSocio={addSocio}
            contadorSocio={data.contadores.carnet}
            onUpdateSocio={updateSocio}
            onDeleteSocio={deleteSocio}
            onRenovar={(socioId: string) => renovarMembresia(socioId)}
          />
        );

      case 'buscar':
        return (
          <BuscarCarnet
            socios={data.socios}
            onNavigateBack={() => setCurrentPage('socios')}
            onUpdateSocio={updateSocio}
            onDeleteSocio={deleteSocio}
            onRenovar={renovarMembresia}
          />
        );

      case 'caja':
        return (
          <Caja
            socios={data.socios}
            retiros={data.retiros}
            gastos={data.gastos}
            ingresos={data.ingresos}
            turnos={data.turnos}
            contadorRetiro={data.contadores.retiro}
            onAddIngreso={addIngreso}
            onAddRetiro={addRetiro}
            onAddGasto={addGasto}
            onIniciarTurno={iniciarTurno}
            onCerrarTurno={cerrarTurno}
          />
        );

      default:
        // fallback a Socios
        return (
          <Socios
            socios={data.socios}
            onAddSocio={addSocio}
            contadorSocio={data.contadores.carnet}
            onUpdateSocio={updateSocio}
            onDeleteSocio={deleteSocio}
            onRenovar={renovarMembresia}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">APOLO GYM</h2>
          <p className="text-gray-600">Cargando desde Supabase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error de Conexión</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthWrapper>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage} locked={locked}>
        {locked ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-full max-w-md bg-white border rounded-2xl shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-semibold text-gray-800">Turno cerrado</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Para operar el sistema necesitás iniciar un turno.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Usuario</label>
                  <input
                    value={usuarioTurno}
                    onChange={e => setUsuarioTurno(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="Nombre del responsable"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Monto inicial</label>
                  <input
                    type="number"
                    value={montoInicialTurno}
                    onChange={e => setMontoInicialTurno(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                    min={0}
                  />
                </div>
                <button
                  onClick={handleAbrirTurno}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Iniciar turno
                </button>

                <button
                  onClick={() => setCurrentPage('caja')}
                  className="w-full border rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-50"
                  title="Ir a Caja"
                >
                  Ir a Caja
                </button>
              </div>
            </div>
          </div>
        ) : (
          renderCurrentPage()
        )}
      </Layout>
    </AuthWrapper>
  );
}

export default App;
