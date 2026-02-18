// electron/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// ==== CONFIG BÁSICA ====
const APP_NAME = 'APOLO GYM';
const DATA_FOLDER = path.join(app.getPath('documents'), 'apolo-gym');
const DATA_FILE = path.join(DATA_FOLDER, 'apolo-gym-data.json');
const SETTINGS_FILE = path.join(DATA_FOLDER, 'settings.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(DATA_FOLDER);

// ===== Settings =====
function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return {
    autoBackup: {
      enabled: false,
      folder: '',
      mode: 'interval', // 'interval' | 'time'
      everyMs: 60 * 60 * 1000, // 1 hora
      time: '23:59', // para mode 'time'
    },
  };
}
function writeSettings(s) {
  ensureDir(DATA_FOLDER);
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
}

// ==== VENTANA ====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: APP_NAME,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ==== DATOS PRINCIPALES ====
ipcMain.handle('gym:load', async () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      ensureDir(DATA_FOLDER);
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify({
          socios: [], retiros: [], gastos: [], ingresos: [], turnos: [],
          contadores: { carnet: 1, retiro: 1 },
          _asistencias: [], // soporte: si renderer guarda esto lo mantenemos
        }, null, 2),
        'utf8'
      );
    }
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error load data', e);
    return null;
  }
});

ipcMain.handle('gym:save', async (_evt, data) => {
  try {
    ensureDir(DATA_FOLDER);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error save data', e);
    return false;
  }
});

ipcMain.handle('gym:getDataPath', async () => DATA_FILE);

// ==== BACKUP MANUAL (con diálogo) ====
ipcMain.handle('backup:export', async (_evt, payloadData) => {
  try {
    const ts = new Date();
    const stamp = ts.toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(app.getPath('documents'), `apolo-backup-${stamp}.json`);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar backup',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    const payload = {
      version: 'apolo.backup.v1',
      exportedAt: ts.toISOString(),
      data: payloadData,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (e) {
    console.error('Export backup error', e);
    return { ok: false, error: e.message };
  }
});

// ==== IMPORTAR BACKUP (elige archivo) ====
ipcMain.handle('backup:import', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Importar backup',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };

    const content = fs.readFileSync(filePaths[0], 'utf8');
    const payload = JSON.parse(content);
    const imported = payload?.data ?? payload;
    return { ok: true, data: imported, source: filePaths[0] };
  } catch (e) {
    console.error('Import backup error', e);
    return { ok: false, error: e.message };
  }
});

// ==== ELEGIR CARPETA ====
ipcMain.handle('backup:pickFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Elegí carpeta de backups (ideal: tu Google Drive)',
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
  return { ok: true, folder: filePaths[0] };
});

// ==== AUTOBACKUP (intervalo o hora diaria) ====
let intervalHandle = null;
let dailyHandle = null;

function clearSchedulers() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
  if (dailyHandle) { clearTimeout(dailyHandle); dailyHandle = null; }
}

function writeBackupToFolder(targetFolder) {
  try {
    ensureDir(targetFolder);
    if (!fs.existsSync(DATA_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(targetFolder, `apolo-autobackup-${ts}.json`);
    const payload = { version: 'apolo.backup.v1', exportedAt: new Date().toISOString(), data };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Auto-backup write error', e);
  }
}

function scheduleAutoBackup(settings) {
  clearSchedulers();
  const cfg = settings?.autoBackup || {};
  if (!cfg.enabled || !cfg.folder) return;

  ensureDir(cfg.folder);

  if (cfg.mode === 'interval') {
    let ms = Number(cfg.everyMs || 0);
    if (!Number.isFinite(ms) || ms < 60_000) ms = 60_000; // mínimo 1 minuto
    intervalHandle = setInterval(() => writeBackupToFolder(cfg.folder), ms);
    // disparamos uno ahora para asegurar el primer backup
    writeBackupToFolder(cfg.folder);
  } else {
    // mode 'time': ejecutar una vez al día a HH:MM
    const when = cfg.time || '23:59';
    const [HH, MM] = when.split(':').map(n => parseInt(n, 10));
    const planNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(HH, MM, 0, 0);
      if (next <= now) next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
      const delay = next.getTime() - now.getTime();
      dailyHandle = setTimeout(() => {
        writeBackupToFolder(cfg.folder);
        planNext();
      }, delay);
    };
    planNext();
  }
}

ipcMain.handle('backup:configure', async (_evt, opts) => {
  const settings = readSettings();
  settings.autoBackup = {
    enabled: Boolean(opts?.enabled),
    folder: opts?.folder || '',
    mode: opts?.mode === 'time' ? 'time' : 'interval',
    everyMs: Number(opts?.everyMs || 0) || 60 * 60 * 1000,
    time: opts?.time || '23:59',
  };
  writeSettings(settings);
  scheduleAutoBackup(settings);
  return { ok: true, settings: settings.autoBackup };
});

// Inicializa scheduler si había configuración previa
scheduleAutoBackup(readSettings());
