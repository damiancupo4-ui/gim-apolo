// src/utils/localStorage.ts
import { DatosGimnasio, Socio } from '../types';

/* ========= Tipos ========= */
type AsistenciaRecord = {
  id: string;
  socioId: string;
  carnet: string;
  nombreCompleto: string;
  timestampISO: string;
  byUsuario?: string;
  turnoId?: string;
  fechaInicio?: string; // Para calcular estado del carnet
};

type AutoBackupMode = 'interval' | 'time';
type AutoBackupSettings = {
  enabled: boolean;
  mode: AutoBackupMode;
  /** válido si mode === 'interval' */
  intervalMinutes?: number;
  /** válido si mode === 'time', formato HH:MM 24h */
  timeOfDay?: string;
};

declare global {
  interface Window {
    electronAPI?: {
      loadGymData: () => Promise<any>;
      saveGymData: (data: any) => Promise<boolean>;
      getDataPath: () => Promise<string>;
      exportBackup?: (data: any) => Promise<{ ok: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      importBackup?: () => Promise<{ ok: boolean; data?: any; source?: string; canceled?: boolean; error?: string }>;
      pickBackupFolder?: () => Promise<{ ok: boolean; folder?: string; canceled?: boolean }>;
      configureAutoBackup?: (opts: AutoBackupSettings) => Promise<{ ok: boolean }>;
    };
  }
  interface FileSystemDirectoryHandle {
    name: string;
    requestPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    queryPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemFileHandle { createWritable(): Promise<any>; }
}

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;
const isWebFSAccessSupported = () =>
  typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function' && 'indexedDB' in window;

/* ========= Claves ========= */
const DATA_KEY = 'apolo-gym-data';
const ASIS_KEY_V1 = 'apolo-asistencias';      // legacy
const ASIS_KEY_V2 = 'apolo-asistencias-v2';   // actual
const KEY_WEB_BACKUP_DIR = 'apolo-web-backup-dir';
const KEY_AUTO_BACKUP_SETTINGS = 'apolo-auto-backup-settings';

/* ========= Defaults ========= */
const defaultData: DatosGimnasio = {
  socios: [],
  retiros: [],
  gastos: [],
  ingresos: [],
  turnos: [],
  contadores: {
    socio: 1,
    retiro: 1,
  },
};

/* ========= IndexedDB p/ Web FS Access (opcional backups) ========= */
const IDB_NAME = 'apolo-web';
const IDB_STORE = 'kv';
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(IDB_STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function idbSet(key: string, value: any) {
  return idbOpen().then(db => new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  }));
}
function idbGet<T>(k: string): Promise<T | undefined> {
  return idbOpen().then(db => new Promise<T | undefined>((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rq = tx.objectStore(IDB_STORE).get(k);
    rq.onsuccess = () => res(rq.result as T | undefined);
    rq.onerror = () => rej(rq.error);
  }));
}

/* ========= Helpers ========= */
function fixDuplicateSocios(socios: Socio[]): Socio[] {
  const socioMap = new Map<string, Socio[]>();
  
  // Agrupar socios por carnet
  socios.forEach(socio => {
    const carnet = socio.carnet;
    if (!socioMap.has(carnet)) {
      socioMap.set(carnet, []);
    }
    socioMap.get(carnet)!.push(socio);
  });
  
  const fixed: Socio[] = [];
  let nextCounter = 1;
  
  // Encontrar el próximo carnet disponible
  const existingCarnets = new Set<string>();
  socios.forEach(socio => {
    existingCarnets.add(socio.carnet);
  });
  
  const year = new Date().getFullYear().toString().slice(-2);
  while (existingCarnets.has(`${year}-${nextCounter.toString().padStart(3, '0')}`)) {
    nextCounter++;
  }
  
  socioMap.forEach((sociosConMismoCarnet, carnet) => {
    if (sociosConMismoCarnet.length === 1) {
      // No hay duplicados, mantener como está
      fixed.push(sociosConMismoCarnet[0]);
    } else {
      // Hay duplicados, mantener el primero y reasignar carnets a los demás
      const [primero, ...duplicados] = sociosConMismoCarnet.sort((a, b) => 
        new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
      );
      
      fixed.push(primero); // Mantener el primero con su carnet original
      
      // Reasignar carnets a los duplicados
      duplicados.forEach(socio => {
        const nuevoCarnet = `${year}-${nextCounter.toString().padStart(3, '0')}`;
        while (existingCarnets.has(nuevoCarnet)) {
          nextCounter++;
        }
        const finalCarnet = `${year}-${nextCounter.toString().padStart(3, '0')}`;
        existingCarnets.add(finalCarnet);
        fixed.push({ ...socio, carnet: finalCarnet });
        nextCounter++;
      });
    }
  });
  
  return fixed;
}

function parseMaybeArray(json: string | null): AsistenciaRecord[] {
  if (!json) return [];
  try {
    const p = JSON.parse(json);
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object' && 'id' in p) return [p as AsistenciaRecord];
    return [];
  } catch { return []; }
}
function loadAsistenciasRaw(): AsistenciaRecord[] {
  const v2 = parseMaybeArray(localStorage.getItem(ASIS_KEY_V2));
  if (v2.length) return v2;

  // migrar desde legacy una sola vez
  const legacy = parseMaybeArray(localStorage.getItem(ASIS_KEY_V1));
  if (legacy.length) {
    try { localStorage.setItem(ASIS_KEY_V2, JSON.stringify(legacy)); } catch {}
    return legacy;
  }
  return [];
}
function saveAsistenciasRaw(list: AsistenciaRecord[]) {
  localStorage.setItem(ASIS_KEY_V2, JSON.stringify(list));
}

const makeId = () =>
  (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowStampFile = () => new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

/* ========= Carga / guardado general ========= */
export const loadData = async (): Promise<DatosGimnasio> => {
  try {
    if (isElectron()) {
      const raw = (await window.electronAPI!.loadGymData()) || {};
      if (Array.isArray(raw?._asistencias)) saveAsistenciasRaw(raw._asistencias as AsistenciaRecord[]);
      const { _asistencias, ...base } = raw || {};
      const data = { ...defaultData, ...base };
      
      // Arreglar números de socio duplicados automáticamente
      if (data.socios && data.socios.length > 0) {
        data.socios = fixDuplicateSocios(data.socios);
      }
      
      return data;
    } else {
      const json = localStorage.getItem(DATA_KEY);
      if (!json) return defaultData;
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed?._asistencias)) saveAsistenciasRaw(parsed._asistencias as AsistenciaRecord[]);
      const { _asistencias, ...base } = parsed || {};
      const data = { ...defaultData, ...base };
      
      // Arreglar números de socio duplicados automáticamente
      if (data.socios && data.socios.length > 0) {
        data.socios = fixDuplicateSocios(data.socios);
      }
      
      return data;
    }
  } catch { return defaultData; }
};

export const saveData = async (data: DatosGimnasio): Promise<void> => {
  try {
    if (isElectron()) {
      const payload = { ...data, _asistencias: loadAsistenciasRaw() };
      await window.electronAPI!.saveGymData(payload);
    } else {
      localStorage.setItem(DATA_KEY, JSON.stringify({ ...data }));
    }
  } catch (e) { console.error('Error saving data:', e); }
};

export const getDataPath = async (): Promise<string | null> => {
  if (!isElectron()) return null;
  try { return await window.electronAPI!.getDataPath(); } catch { return null; }
};

/* ========= Reglas de negocio ========= */
export const calcularEstadoSocio = (fechaInicio: string): 'vigente' | 'vencido' => {
  const inicio = new Date(fechaInicio); const ahora = new Date();
  return (ahora.getTime() - inicio.getTime()) > 30 * 24 * 60 * 60 * 1000 ? 'vencido' : 'vigente';
};
export const generarNumeroCarnet = (contador: number): string => {
  const year = new Date().getFullYear().toString().slice(-2);
  return `${year}-${contador.toString().padStart(3, '0')}`;
};
export const generarNumeroSocio = (contador: number): number => contador;
export const generarNumeroRetiro = (contador: number): string => contador.toString().padStart(3, '0');

export const estaProximoAVencer = (socio: { fechaInicio: string }): boolean => {
  const fechaInicio = new Date(socio.fechaInicio);
  const fechaVencimiento = new Date(fechaInicio);
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
  
  const ahora = new Date();
  const diasParaVencer = Math.ceil((fechaVencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
  
  return diasParaVencer > 0 && diasParaVencer <= 7;
};

/* ========= Asistencias ========= */
export function getAsistencias(): AsistenciaRecord[] {
  const list = loadAsistenciasRaw();
  return list.sort((a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime());
}

function persistAsistencia(socio: Socio, data: DatosGimnasio): AsistenciaRecord {
  const turnoAbierto = (data.turnos || []).find(t => !t.cerrado);
  const rec: AsistenciaRecord = {
    id: makeId(),
    socioId: socio.id,
    carnet: socio.carnet,
    nombreCompleto: socio.nombreCompleto,
    timestampISO: new Date().toISOString(),
    byUsuario: turnoAbierto?.usuario,
    turnoId: turnoAbierto?.id,
    fechaInicio: socio.fechaInicio,
  };
  const list = loadAsistenciasRaw();
  list.push(rec);
  saveAsistenciasRaw(list);
  return rec;
}

export async function addAsistenciaPorNumeroONombre(input: string): Promise<AsistenciaRecord | null> {
  const q = input.trim().toLowerCase();
  if (!q) return null;

  const data = await loadData();
  const normDNI = (dni: string) => (dni || '').replace(/\D+/g, '');
  const qDigits = normDNI(q);

  // Buscar por carnet exacto
  const byCarnetExact = data.socios.find(s => s.carnet.toLowerCase() === q);
  if (byCarnetExact) return persistAsistencia(byCarnetExact, data);

  // Buscar por DNI exacto
  if (qDigits) {
    const byDniExact = data.socios.find(s => normDNI(s.dni || '') === qDigits);
    if (byDniExact) return persistAsistencia(byDniExact, data);
  }

  // Búsqueda parcial
  const candidate = data.socios.find(s => {
    const nombre = (s.nombreCompleto || '').toLowerCase();
    const carnetStr = s.carnet.toLowerCase();
    const dniDigits = normDNI(s.dni || '');
    return (qDigits && dniDigits.includes(qDigits)) || nombre.includes(q) || carnetStr.includes(q);
  });

  if (!candidate) return null;
  return persistAsistencia(candidate, data);
}

export function getAsistenciasReport(fromISO: string, toISO: string): {
  total: number;
  porSocio: Array<{ socioId: string; carnet: string; nombreCompleto: string; asistencias: number }>;
} {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  const list = loadAsistenciasRaw().filter(a => {
    const t = new Date(a.timestampISO).getTime();
    return t >= from && t <= to;
  });
  const map = new Map<string, { socioId: string; carnet: string; nombreCompleto: string; asistencias: number }>();
  for (const a of list) {
    const key = a.socioId || a.carnet;
    const prev = map.get(key) || { socioId: a.socioId, carnet: a.carnet, nombreCompleto: a.nombreCompleto, asistencias: 0 };
    prev.asistencias += 1;
    map.set(key, prev);
  }
  return { total: list.length, porSocio: Array.from(map.values()) };
}

/* ========= Exportar / Importar asistencias ========= */
export function exportAsistenciasJSONFile(fromISO: string, toISO: string): void {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  const list = loadAsistenciasRaw().filter(a => {
    const t = new Date(a.timestampISO).getTime();
    return t >= from && t <= to;
  });
  const payload = { exportado: new Date().toISOString(), rango: { from: fromISO, to: toISO }, total: list.length, asistencias: list };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `apolo-asistencias-${fromISO.slice(0,10)}_a_${toISO.slice(0,10)}.json`);
}
export function exportAsistenciasCSVFile(fromISO: string, toISO: string): void {
  const from = new Date(fromISO).getTime();
  const to = new Date(toISO).getTime();
  const list = loadAsistenciasRaw().filter(a => {
    const t = new Date(a.timestampISO).getTime();
    return t >= from && t <= to;
  });
  const headers = ['FechaHora','Carnet','NombreCompleto','Operador','Turno'];
  const rows = list.map(a => [
    new Date(a.timestampISO).toLocaleString(),
    a.carnet,
    `"${(a.nombreCompleto || '').replace(/"/g,'""')}"`,
    a.byUsuario || '',
    a.turnoId || ''
  ].join(','));
  const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `apolo-asistencias-${fromISO.slice(0,10)}_a_${toISO.slice(0,10)}.csv`);
}
export function importAsistenciasFromFile(): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve({ ok: false, error: 'Sin archivo' });
        const text = await file.text();
        const payload = JSON.parse(text);
        const list: AsistenciaRecord[] = Array.isArray(payload?.asistencias) ? payload.asistencias
          : Array.isArray(payload) ? payload
          : [];
        if (!Array.isArray(list)) return resolve({ ok: false, error: 'Formato inválido' });

        const current = loadAsistenciasRaw();
        const ids = new Set(current.map(a => a.id));
        const merged = [...current, ...list.filter(a => !ids.has(a.id))];
        saveAsistenciasRaw(merged);
        resolve({ ok: true });
      } catch (e: any) { resolve({ ok: false, error: e?.message || 'Error al importar' }); }
    };
    input.click();
  });
}

/* ========= Sugerencias búsqueda de socios ========= */
export async function buscarSugerenciasSocios(query: string, limit = 20): Promise<Array<{ id: string; carnet: string; nombreCompleto: string; dni?: string; fechaInicio: string; estado: 'vigente' | 'vencido' }>> {
  const q = (query || '').trim().toLowerCase();
  const all = await loadData();
  const socios = all?.socios ?? [];
  const onlyDigits = (s: string) => s.replace(/\D+/g, '');

  return socios
    .filter(s => {
      const carnetStr = s.carnet;
      const nombre = (s.nombreCompleto || '').toLowerCase();
      const dni = onlyDigits(s.dni || '');
      const qDigits = onlyDigits(q);
      return carnetStr.includes(q) || nombre.includes(q) || (!!qDigits && dni.includes(qDigits));
    })
    .sort((a,b) => {
      const aNum = parseInt(a.carnet.split('-')[1] || '0');
      const bNum = parseInt(b.carnet.split('-')[1] || '0');
      return bNum - aNum;
    })
    .slice(0, limit)
    .map(s => ({ 
      id: s.id, 
      carnet: s.carnet, 
      nombreCompleto: s.nombreCompleto, 
      dni: s.dni,
      fechaInicio: s.fechaInicio,
      estado: calcularEstadoSocio(s.fechaInicio)
    }));
}

/* ========= Carnets (export/import) ========= */
export async function exportCarnetsJSONFile(): Promise<void> {
  const all = await loadData();
  const socios = (all?.socios ?? []).map(s => {
    // Calcular fecha de vencimiento (30 días después de fecha de inicio)
    const fechaInicio = new Date(s.fechaInicio);
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    
    return {
      id: s.id,
      numeroSocio: s.numeroSocio,
      carnet: s.carnet,
      nombreCompleto: s.nombreCompleto,
      dni: s.dni,
      telefono: s.telefono,
      fechaInicio: s.fechaInicio,
      fechaVencimiento: fechaVencimiento.toISOString().slice(0, 10),
      formaPago: s.formaPago,
      monto: s.monto,
      estado: s.estado,
    };
  });
  const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), total: socios.length, socios }, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `apolo-socios-${new Date().toISOString().slice(0,10)}.json`);
}
export async function exportCarnetsCSVFile(): Promise<void> {
  const all = await loadData();
  const socios = all?.socios ?? [];
  const headers = ['NumeroSocio','Carnet','NombreCompleto','Telefono','FechaVencimiento','Estado'];
  const rows = socios.map(s => {
    // Calcular fecha de vencimiento (30 días después de fecha de inicio)
    const fechaInicio = new Date(s.fechaInicio);
    const fechaVencimiento = new Date(fechaInicio);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    
    const numeroSocio = s.numeroSocio?.toString() || s.carnet || '';
    const nombre = `"${(s.nombreCompleto || '').replace(/"/g,'""')}"`;
    const telefono = `"${(s.telefono || '').replace(/"/g,'""')}"`;
    const fechaVenc = fechaVencimiento.toLocaleDateString('es-AR');
    const estadoTexto = s.estado === 'vigente' ? 'ACTIVO' : 'VENCIDO';
    
    return [numeroSocio, s.carnet, nombre, telefono, fechaVenc, estadoTexto].join(',');
  });
  const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `apolo-socios-${new Date().toISOString().slice(0,10)}.csv`);
}
export async function importCarnetsFromFile(): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,.csv,text/csv';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve({ ok: false, error: 'Sin archivo' });
        const text = await file.text();
        let nuevos: any[] = [];

        if (file.name.toLowerCase().endsWith('.csv')) {
          // CSV esperado: Carnet,NombreCompleto,DNI,FechaInicio,FormaPago,Monto,Estado
          const lines = text.replace(/\r/g,'').split('\n').filter(Boolean);
          const [header, ...rows] = lines;
          const cols = header.split(',').map(s => s.trim().toLowerCase());
          const idx = (name: string) => cols.indexOf(name.toLowerCase());
          for (const r of rows) {
            const cells = r.split(',');
            nuevos.push({
              carnet: (cells[idx('carnet')] || '').trim(),
              nombreCompleto: (cells[idx('nombrecompleto')] || '').replace(/^"|"$/g,'').replace(/""/g,'"').trim(),
              dni: (cells[idx('dni')] || '').trim(),
              fechaInicio: (cells[idx('fechainicio')] || '').trim(),
              formaPago: (cells[idx('formapago')] || '').trim(),
              monto: Number(cells[idx('monto')] || 0),
              estado: (cells[idx('estado')] || '').trim(),
            });
          }
        } else {
          const j = JSON.parse(text);
          if (Array.isArray(j?.socios)) nuevos = j.socios;
          else if (Array.isArray(j)) nuevos = j;
          else return resolve({ ok: false, error: 'Formato inválido' });
        }

        const data = await loadData();
        const porCarnet = new Map<string, any>((data.socios || []).map(s => [s.carnet, s]));
        for (const it of nuevos) {
          if (!it?.carnet) continue;
          const existe = porCarnet.get(it.carnet);
          if (existe) {
            porCarnet.set(it.carnet, { ...existe, ...it });
          } else {
            porCarnet.set(it.carnet, {
              id: makeId(),
              ...it,
            });
          }
        }
        const merged = Array.from(porCarnet.values());
        await saveData({ ...data, socios: merged });
        resolve({ ok: true });
      } catch (e: any) { resolve({ ok: false, error: e?.message || 'Error al importar' }); }
    };
    input.click();
  });
}

/* ========= Descarga helper ========= */
function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ========= Backups manuales ========= */
export async function chooseBackupFolder(): Promise<string | null> {
  if (isElectron() && window.electronAPI?.pickBackupFolder) {
    const res = await window.electronAPI.pickBackupFolder();
    return res?.ok && !res.canceled ? (res.folder || null) : null;
  }
  if (!isWebFSAccessSupported()) return null;
  try {
    // @ts-ignore
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ id: 'apolo-backups', mode: 'readwrite', startIn: 'documents' });
    const perm = await handle.requestPermission?.({ mode: 'readwrite' });
    if (perm !== 'granted') return null;
    await idbSet(KEY_WEB_BACKUP_DIR, handle);
    return handle.name || 'carpeta';
  } catch { return null; }
}

export async function getWebBackupFolderName(): Promise<string | null> {
  if (!isWebFSAccessSupported()) return null;
  try {
    const h = (await idbGet<FileSystemDirectoryHandle>(KEY_WEB_BACKUP_DIR)) || null;
    if (!h) return null;
    const p = await h.queryPermission?.({ mode: 'readwrite' });
    if (p === 'granted') return h.name || 'carpeta';
    if (p === 'prompt') return (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted' ? (h.name || 'carpeta') : null;
    return null;
  } catch { return null; }
}

async function makeBackupPayload() {
  const data = await loadData();
  return { ...data, _asistencias: loadAsistenciasRaw() };
}

async function writeBackupToWebFolder(filename: string, payload: any): Promise<boolean> {
  try {
    const handle = await idbGet<FileSystemDirectoryHandle>(KEY_WEB_BACKUP_DIR);
    if (!handle) return false;
    const perm = await handle.requestPermission?.({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function exportBackupManual(): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload = await makeBackupPayload();
    if (isElectron() && window.electronAPI?.exportBackup) {
      const res = await window.electronAPI.exportBackup(payload);
      return res?.ok ? { ok: true } : { ok: false, error: res?.error || 'No se pudo exportar' };
    } else {
      // Intentar escribir en la carpeta seleccionada primero
      const filename = `apolo-backup-${nowStampFile()}.json`;
      const writeSuccess = await writeBackupToWebFolder(filename, payload);
      
      if (writeSuccess) {
        return { ok: true };
      } else {
        // Fallback: descargar si no se puede escribir en carpeta
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, filename);
        return { ok: true, error: 'Guardado en Descargas (no se pudo acceder a la carpeta seleccionada)' };
      }
    }
  } catch (e: any) { return { ok: false, error: e?.message || 'Error' }; }
}
export async function importBackupManual(): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve({ ok: false, error: 'Sin archivo' });
        const text = await file.text();
        const payload = JSON.parse(text);
        const data = payload?.data ?? payload;
        const { _asistencias, ...base } = data || {};
        await saveData(base);
        if (Array.isArray(_asistencias)) saveAsistenciasRaw(_asistencias);
        resolve({ ok: true });
      } catch (e: any) { resolve({ ok: false, error: e?.message || 'Error al importar' }); }
    };
    input.click();
  });
}

/* ========= Auto-backup (incluye configureAutoBackup) ========= */
let autoBackupIntervalId: number | null = null;
let autoBackupTimeoutId: number | null = null;

function clearWebAutoBackupTimers() {
  if (autoBackupIntervalId) { clearInterval(autoBackupIntervalId); autoBackupIntervalId = null; }
  if (autoBackupTimeoutId) { clearTimeout(autoBackupTimeoutId); autoBackupTimeoutId = null; }
}

function msUntilNextTimeOfDay(timeOfDay: string): number {
  const [hStr, mStr] = (timeOfDay || '03:00').split(':');
  const h = Math.max(0, Math.min(23, parseInt(hStr || '3', 10) || 3));
  const m = Math.max(0, Math.min(59, parseInt(mStr || '0', 10) || 0));
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function getAutoBackupSettings(): AutoBackupSettings {
  try {
    const j = localStorage.getItem(KEY_AUTO_BACKUP_SETTINGS);
    if (j) return JSON.parse(j) as AutoBackupSettings;
  } catch {}
  return { enabled: false, mode: 'interval', intervalMinutes: 60 };
}

async function performAutoBackup(): Promise<void> {
  try {
    const payload = await makeBackupPayload();
    const filename = `apolo-backup-auto-${nowStampFile()}.json`;
    
    // Intentar escribir en carpeta seleccionada
    const writeSuccess = await writeBackupToWebFolder(filename, payload);
    
    if (!writeSuccess) {
      // Fallback: descargar si no hay carpeta seleccionada o sin permisos
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      downloadBlob(blob, filename);
    }
  } catch (error) {
    console.error('Error en backup automático:', error);
  }
}

export async function configureAutoBackup(settings: AutoBackupSettings): Promise<{ ok: boolean; error?: string }> {
  try {
    // Persistir siempre
    localStorage.setItem(KEY_AUTO_BACKUP_SETTINGS, JSON.stringify(settings));

    // Si estamos en Electron y existe implementación nativa, delegamos
    if (isElectron() && window.electronAPI?.configureAutoBackup) {
      const res = await window.electronAPI.configureAutoBackup(settings);
      return res?.ok ? { ok: true } : { ok: false, error: 'Fallo auto-backup en Electron' };
    }

    // WEB: programar mientras la app esté abierta (PWA/SPA)
    clearWebAutoBackupTimers();
    if (!settings.enabled) return { ok: true };

    if (settings.mode === 'interval') {
      const minutes = Math.max(1, Number(settings.intervalMinutes || 60));
      
      // Ejecutar backup inmediato
      await performAutoBackup();
      
      // Programar backups periódicos
      autoBackupIntervalId = window.setInterval(performAutoBackup, minutes * 60 * 1000);
    } else {
      // time of day
      const firstDelay = msUntilNextTimeOfDay(settings.timeOfDay || '03:00');
      autoBackupTimeoutId = window.setTimeout(function tick() {
        performAutoBackup();
        // repetir cada 24h
        autoBackupTimeoutId = window.setTimeout(tick, 24 * 60 * 60 * 1000);
      }, firstDelay);
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error configurando auto-backup' };
  }
}
