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
  triggerSystemReboot: () => ipcRenderer.invoke('trigger-system-reboot'),
  saveLegacyScripts: (payload) => ipcRenderer.invoke('save-legacy-scripts', payload),
  listLocationProfiles: () => ipcRenderer.invoke('list-location-profiles'),
  saveLocationProfile: (profile) => ipcRenderer.invoke('save-location-profile', { profile }),
  loadLocationProfile: (profileId) => ipcRenderer.invoke('load-location-profile', { profileId }),
  deleteLocationProfile: (profileId) => ipcRenderer.invoke('delete-location-profile', { profileId }),
  exportLocationProfileFile: (profile) => ipcRenderer.invoke('export-location-profile-file', { profile }),
  importLocationProfileFile: (payload) => ipcRenderer.invoke('import-location-profile-file', payload),
});
