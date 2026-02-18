// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Datos base
  loadGymData: () => ipcRenderer.invoke('gym:load'),
  saveGymData: (data) => ipcRenderer.invoke('gym:save', data),
  getDataPath: () => ipcRenderer.invoke('gym:getDataPath'),

  // Backups
  exportBackup: (data) => ipcRenderer.invoke('backup:export', data),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  pickBackupFolder: () => ipcRenderer.invoke('backup:pickFolder'),
  configureAutoBackup: (opts) => ipcRenderer.invoke('backup:configure', opts),
});
