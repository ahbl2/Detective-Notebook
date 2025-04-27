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
    addCategory: (category) => ipcRenderer.invoke('add-category', category),
    updateCategory: (category) => ipcRenderer.invoke('update-category', category),
    deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
    
    // Event listeners
    receive: (channel, func) => {
        // List of allowed channels
        const validChannels = [
            'show-category-settings',
            'export-data',
            'import-data'
        ];
        
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    
    // Entry operations
    getEntries: (categoryId) => ipcRenderer.invoke('get-entries', categoryId),
    addEntry: (entry) => ipcRenderer.invoke('add-entry', entry),
    updateEntry: (entry) => ipcRenderer.invoke('update-entry', entry),
    deleteEntry: (id) => ipcRenderer.invoke('delete-entry', id),
    
    // File operations
    save_file: (file) => ipcRenderer.invoke('save-file', file),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    downloadFile: (filePath) => ipcRenderer.invoke('download-file', filePath),
    
    // Rating operations
    getRatings: (entryId) => ipcRenderer.invoke('get-ratings', entryId),
    addRating: (rating) => ipcRenderer.invoke('add-rating', rating),
    getUserRating: (entryId) => ipcRenderer.invoke('get-user-rating', entryId),
    incrementViewCount: (entryId) => ipcRenderer.invoke('increment-view-count', entryId),
    
    // Favorite operations
    toggleFavorite: (entryId) => ipcRenderer.invoke('toggle-favorite', entryId),
    getDashboardData: () => ipcRenderer.invoke('get-dashboard-data'),
    
    // Comment operations
    getComments: (entryId) => ipcRenderer.invoke('get-comments', entryId),
    addComment: (comment) => ipcRenderer.invoke('add-comment', comment),
    
    // Export/Import operations
    exportData: (options) => ipcRenderer.invoke('export-data', options),
    importData: (data) => ipcRenderer.invoke('import-data', data),
    
    // App info
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    saveEntry: (entry) => ipcRenderer.invoke('save-entry', entry),
    loadEntries: () => ipcRenderer.invoke('load-entries'),
    saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
    loadFile: (filePath) => ipcRenderer.invoke('load-file', filePath),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    saveCategories: (categories) => ipcRenderer.invoke('save-categories', categories),
    loadCategories: () => ipcRenderer.invoke('load-categories'),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, data) => {
        const validChannels = ['reset-window-state', 'force-input-reset'];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    // Asset Manager operations
    getAssetTypes: () => ipcRenderer.invoke('get-asset-types'),
    addAssetType: (data) => ipcRenderer.invoke('add-asset-type', data),
    updateAssetType: (data) => ipcRenderer.invoke('update-asset-type', data),
    deleteAssetType: (id) => ipcRenderer.invoke('delete-asset-type', id),
    getAssets: (type_id) => ipcRenderer.invoke('get-assets', type_id),
    addAsset: (data) => ipcRenderer.invoke('add-asset', data),
    updateAsset: (data) => ipcRenderer.invoke('update-asset', data),
    deleteAsset: (id) => ipcRenderer.invoke('delete-asset', id),
    exportAssetsToCSV: (data) => ipcRenderer.invoke('export-assets-to-csv', data)
  }
); 