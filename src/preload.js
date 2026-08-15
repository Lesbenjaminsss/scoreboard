'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  refresh: () => ipcRenderer.invoke('refresh'),
  setSettings: (patch) => ipcRenderer.invoke('set-settings', patch),
  setLeague: (id) => ipcRenderer.invoke('set-league', id),
  toggleFavoriteLeague: (id) => ipcRenderer.invoke('toggle-favorite-league', id),
  toggleMatch: (id) => ipcRenderer.invoke('toggle-match', id),
  setSelectedMatches: (ids) => ipcRenderer.invoke('set-selected-matches', ids),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  onState: (cb) => {
    ipcRenderer.on('state', (_e, state) => cb(state));
    return () => ipcRenderer.removeAllListeners('state');
  },
});
