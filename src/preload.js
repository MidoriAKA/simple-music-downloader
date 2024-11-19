const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  pasteFromClipboard: () => ipcRenderer.invoke("paste-from-clipboard"),
  downloadVideo: (data) => ipcRenderer.invoke("download-video", data),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  addCover: (data) => ipcRenderer.invoke("add-cover-to-mp3-directory", data),
});
