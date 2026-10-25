'use strict';
const { contextBridge, ipcRenderer } = require('electron');
// Only the packaged local shell gets this bridge. The website has no preload.
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  command: action => ipcRenderer.invoke('desktop:command', action),
  getState: () => ipcRenderer.invoke('desktop:state'),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop:state-changed', listener);
    return () => ipcRenderer.removeListener('desktop:state-changed', listener);
  },
}));
