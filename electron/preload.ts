import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // Add any other IPC calls your app needs
  openExternalLink: (url: string) => {
    ipcRenderer.send('open-external', url);
  },
});

// Optional: Check if running in Electron
if (window.electronAPI) {
  console.log('✓ Running in Electron environment');
}
