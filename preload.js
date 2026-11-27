const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ahbiShareElectron', {
  isElectron: true,
  runPowerShell: (script) => ipcRenderer.invoke('run-powershell', { script }),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', { targetPath }),
  getLocalNetworkInfo: () => ipcRenderer.invoke('get-local-network-info'),
  scanLanPeers: (subnetPrefix) => ipcRenderer.invoke('scan-lan-peers', { subnetPrefix }),
  pingHost: (target) => ipcRenderer.invoke('ping-host', { target }),
  getPortableStatus: () => ipcRenderer.invoke('get-portable-status'),
  loadPortableData: () => ipcRenderer.invoke('load-portable-data'),
  savePortableData: (document) => ipcRenderer.invoke('save-portable-data', { document }),
  appendAppLog: (entry) => ipcRenderer.invoke('append-app-log', entry),
  getAppLogInfo: (options) => ipcRenderer.invoke('get-app-log-info', options),
  listDataBackups: () => ipcRenderer.invoke('list-data-backups'),
  createDataBackup: (options) => ipcRenderer.invoke('create-data-backup', options),
  restoreDataBackup: (payload) => ipcRenderer.invoke('restore-data-backup', payload),
  deleteDataBackup: (payload) => ipcRenderer.invoke('delete-data-backup', payload),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  openLicenseFolder: () => ipcRenderer.invoke('open-license-folder'),
  triggerSystemReboot: () => ipcRenderer.invoke('trigger-system-reboot'),
  saveLegacyScripts: (payload) => ipcRenderer.invoke('save-legacy-scripts', payload),
  listLocationProfiles: () => ipcRenderer.invoke('list-location-profiles'),
  saveLocationProfile: (profile) => ipcRenderer.invoke('save-location-profile', { profile }),
  loadLocationProfile: (profileId) => ipcRenderer.invoke('load-location-profile', { profileId }),
  deleteLocationProfile: (profileId) => ipcRenderer.invoke('delete-location-profile', { profileId }),
  exportLocationProfileFile: (profile) => ipcRenderer.invoke('export-location-profile-file', { profile }),
  importLocationProfileFile: (payload) => ipcRenderer.invoke('import-location-profile-file', payload),
  checkGitHubUpdates: () => ipcRenderer.invoke('check-github-updates'),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', { url }),
  getUpdateRuntimeInfo: () => ipcRenderer.invoke('get-update-runtime-info'),
  installPortableUpdate: (payload) => ipcRenderer.invoke('install-portable-update', payload),
  cancelPortableUpdate: () => ipcRenderer.invoke('cancel-portable-update'),
  getAppLocaleInfo: () => ipcRenderer.invoke('get-app-locale-info'),
  setAppLocale: (locale) => ipcRenderer.invoke('set-app-locale', { locale }),
  onUpdateProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('github-update-progress', handler);
    return () => ipcRenderer.removeListener('github-update-progress', handler);
  },
});
