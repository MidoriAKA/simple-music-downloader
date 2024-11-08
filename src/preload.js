const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  downloadVideo: (data) => ipcRenderer.invoke('download-video', data),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  addCover: (data) => ipcRenderer.invoke('add-cover-to-mp3-directory', data),
});
