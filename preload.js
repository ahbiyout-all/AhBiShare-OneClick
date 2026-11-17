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
});
