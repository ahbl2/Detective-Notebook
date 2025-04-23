const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Config operations
    getConfig: () => ipcRenderer.invoke('get-config'),
    updateConfig: (config) => ipcRenderer.invoke('update-config', config),
    
    // Database operations
    getCategories: () => ipcRenderer.invoke('get-categories'),
    addCategory: (name) => ipcRenderer.invoke('add-category', name),
    deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
    
    // Entry operations
    getEntries: (categoryId) => ipcRenderer.invoke('get-entries', categoryId),
    addEntry: (entry) => ipcRenderer.invoke('add-entry', entry),
    updateEntry: (entry) => ipcRenderer.invoke('update-entry', entry),
    deleteEntry: (id) => ipcRenderer.invoke('delete-entry', id),
    
    // File operations
    saveFile: (file) => ipcRenderer.invoke('saveFile', file),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    downloadFile: (filePath) => ipcRenderer.invoke('download-file', filePath),
    
    // Rating operations
    getRatings: (entryId) => ipcRenderer.invoke('get-ratings', entryId),
    addRating: (rating) => ipcRenderer.invoke('add-rating', rating),
    getUserRating: (entryId) => ipcRenderer.invoke('get-user-rating', entryId),
    incrementViewCount: (entryId) => ipcRenderer.invoke('increment-view-count', entryId),
    
    // Comment operations
    getComments: (entryId) => ipcRenderer.invoke('get-comments', entryId),
    addComment: (comment) => ipcRenderer.invoke('add-comment', comment),
    
    // Export/Import operations
    exportData: (options) => ipcRenderer.invoke('export-data', options),
    importData: (data) => ipcRenderer.invoke('import-data', data),
    
    // App info
    getAppInfo: () => ipcRenderer.invoke('get-app-info')
  }
); 