// src/pages/Backups.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportBackupManual,
  importBackupManual,
  chooseBackupFolder,
  configureAutoBackup,
  getDataPath,
  getWebBackupFolderName,
} from '../utils/localStorage';
import { Download, Upload, FolderOpen, Clock, RefreshCw, Monitor, Globe } from 'lucide-react';

type Mode = 'interval' | 'time';

export default function Backups() {
  const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const fsAccessSupported = typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';

  const [folder, setFolder] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(false);

  const [mode, setMode] = useState<Mode>('interval');
  const [everyValue, setEveryValue] = useState<number>(60);
  const [everyUnit, setEveryUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');

  const [time, setTime] = useState<string>('23:59');

  const [msg, setMsg] = useState<string | null>(null);
  const [dataPath, setDataPath] = useState<string>('');

  const webIntervalRef = useRef<number | null>(null);
  const webTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    getDataPath().then((p) => p && setDataPath(p));
    // Si ya hay carpeta elegida en Web, mostrar su nombre
    getWebBackupFolderName().then((name) => name && setFolder(name));
  }, []);

  const everyMs = useMemo(() => {
    const v = Number(everyValue) || 0;
    const factor = everyUnit === 'minutes' ? 60_000 : everyUnit === 'hours' ? 3_600_000 : 86_400_000;
    return v * factor;
  }, [everyValue, everyUnit]);

  function clearWebSchedulers() {
    if (webIntervalRef.current) {
      clearInterval(webIntervalRef.current);
      webIntervalRef.current = null;
    }
    if (webTimeoutRef.current) {
      clearTimeout(webTimeoutRef.current);
      webTimeoutRef.current = null;
    }
  }

  async function doWebBackupTick() {
    try {
      const r = await exportBackupManual(); // ahora escribe en carpeta elegida (FS Access) o descarga
      if (!r.ok) throw new Error(r.error || 'falló exportación');
    } catch (e: any) {
      setMsg(`❌ Error generando backup: ${e?.message || 'desconocido'}`);
    }
  }

  // Programación automática en Web (mientras pestaña abierta)
  useEffect(() => {
    if (isDesktop) return; // En escritorio programa el proceso de Electron
    clearWebSchedulers();

    if (!enabled) return;

    if (mode === 'interval') {
      const ms = Math.max(60_000, everyMs || 0);
      void doWebBackupTick(); // uno inmediato
      webIntervalRef.current = window.setInterval(doWebBackupTick, ms);
      setMsg(`🕒 Web: backup cada ${Math.round(ms / 60000)} min. (requiere pestaña abierta)`);
    } else {
      const [HH, MM] = (time || '23:59').split(':').map((n) => parseInt(n, 10));
      const planNext = () => {
        const now = new Date();
        const next = new Date();
        next.setHours(HH || 23, MM || 59, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const delay = next.getTime() - now.getTime();
        webTimeoutRef.current = window.setTimeout(async () => {
          await doWebBackupTick();
          planNext();
        }, delay);
        const mins = Math.round(delay / 60000);
        setMsg(`🕒 Web: próximo backup en ~${mins} min (pestaña abierta).`);
      };
      planNext();
    }

    return () => clearWebSchedulers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, mode, everyMs, time, isDesktop]);

  async function exportar() {
    try {
      const r = await exportBackupManual();
      if (r.ok) {
        if (r.error) {
          setMsg(`⚠️ ${r.error}`);
        } else {
          setMsg('✅ Backup guardado en la carpeta seleccionada');
        }
      } else {
        setMsg(`❌ Error: ${r.error || 'desconocido'}`);
      }
    } catch (e: any) {
      setMsg(`❌ Error exportando: ${e?.message || 'desconocido'}`);
    }
  }

  async function importar() {
    try {
      const r = await importBackupManual();
      setMsg(r.ok ? '✅ Backup importado' : `❌ Error: ${r.error || 'desconocido'}`);
    } catch (e: any) {
      setMsg(`❌ Error importando: ${e?.message || 'desconocido'}`);
    }
  }

  async function pickFolder() {
    try {
      const f = await chooseBackupFolder(); // en desktop usa dialog nativo; en web abre showDirectoryPicker
      if (f) {
        setFolder(f);
        setMsg(`📁 Carpeta seleccionada: ${f}`);
      } else {
        setMsg(isDesktop ? 'ℹ️ Selección cancelada.' : 'ℹ️ No se seleccionó carpeta o sin permisos.');
      }
    } catch (e: any) {
      setMsg(`❌ Error eligiendo carpeta: ${e?.message || 'desconocido'}`);
    }
  }

  async function guardarProg() {
    if (!isDesktop) {
      if (!enabled) {
        setMsg('✅ Backup automático desactivado');
        return;
      }
      if (!folder) {
        setMsg('⚠️ Selecciona una carpeta primero para que los backups se guarden ahí');
        return;
      }
      setMsg('✅ Backup automático configurado. Los archivos se guardarán en la carpeta seleccionada.');
      return;
    }
    if (enabled && !folder) {
      setMsg('Elegí una carpeta destino primero.');
      return;
    }
    try {
      const ok = await configureAutoBackup({
        enabled,
        folder,
        mode,
        everyMs: mode === 'interval' ? everyMs : undefined,
        time: mode === 'time' ? time : undefined,
      });
      setMsg(ok ? '🕒 Programación guardada (Escritorio)' : '❌ No se pudo programar');
    } catch (e: any) {
      setMsg(`❌ Error guardando programación: ${e?.message || 'desconocido'}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Backups</h2>
        <div
          className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
            isDesktop ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}
          title={isDesktop ? 'Ejecutando en Electron (app de escritorio)' : 'Ejecutando en navegador (Vite)'}
        >
          {isDesktop ? <Monitor className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
          {isDesktop ? 'Escritorio' : 'Web'}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Archivo de datos actual: <span className="font-mono">{dataPath || '-'}</span>
      </p>

      {msg && <div className="px-3 py-2 bg-gray-50 border rounded text-sm">{msg}</div>}

      {/* Manual */}
      <div className="flex flex-wrap gap-3">
        <button onClick={exportar} className="px-4 py-2 border rounded flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar backup (JSON)
        </button>
        <button onClick={importar} className="px-4 py-2 border rounded flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Importar backup (JSON)
        </button>
      </div>

      {/* Automático */}
      <div className="border rounded p-4 space-y-3 bg-white">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Backup automático
        </h3>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Activar {isDesktop ? '(Escritorio)' : '(Web — requiere pestaña abierta)'}
          </label>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="interval"
                checked={mode === 'interval'}
                onChange={() => setMode('interval')}
              />
              Intervalo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value="time"
                checked={mode === 'time'}
                onChange={() => setMode('time')}
              />
              Hora diaria
            </label>
          </div>
        </div>

        {mode === 'interval' ? (
          <div className="flex items-center gap-2">
            <span>Cada</span>
            <input
              type="number"
              min={1}
              value={everyValue}
              onChange={(e) => setEveryValue(Number(e.target.value))}
              className="w-24 border rounded px-2 py-1"
            />
            <select
              className="border rounded px-2 py-1"
              value={everyUnit}
              onChange={(e) => setEveryUnit(e.target.value as any)}
            >
              <option value="minutes">minutos</option>
              <option value="hours">horas</option>
              <option value="days">días</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Hora:
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={pickFolder}
            className="px-3 py-2 border rounded flex items-center gap-2"
            title={
              isDesktop
                ? 'Elegir carpeta destino (Escritorio)'
                : fsAccessSupported
                ? 'Elegir carpeta destino (Web, requiere permisos)'
                : 'Tu navegador no soporta File System Access API'
            }
          >
            <FolderOpen className="w-4 h-4" />
            Elegir carpeta…
          </button>
          <span className="text-sm text-gray-600 truncate">
            {folder ? folder : fsAccessSupported ? '- sin seleccionar -' : '- navegador sin soporte -'}
          </span>
        </div>

        <button
          onClick={guardarProg}
          className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Guardar programación
        </button>

        <p className="text-xs text-gray-500">
          <strong>Importante:</strong> Los backups se guardarán en la carpeta que selecciones. Si no seleccionas carpeta 
          o pierdes los permisos, se descargarán automáticamente. Para mejores resultados, selecciona una carpeta 
          de Google Drive para sincronización automática.
        </p>
      </div>
    </div>
  );
}
