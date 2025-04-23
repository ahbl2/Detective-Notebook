const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// Keep a global reference of the window object and database connection
let mainWindow;
let db = null;
let config;

// Database connection management
async function connectToDatabase() {
  return new Promise((resolve, reject) => {
    console.log('Connecting to database...');
    const dbPath = path.join(app.getPath('userData'), 'notebook.db');
    console.log('Database path:', dbPath);
    
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error connecting to database:', err);
        reject(err);
        return;
      }
      console.log('Successfully connected to database');
      resolve(database);
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('Database connection closed');
        db = null;
        resolve();
      }
    });
  });
}

// Load or create config
function loadConfig() {
  const configPath = path.join(app.getAppPath(), 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!config.deviceId) {
        config.deviceId = uuidv4();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    } else {
      config = {
        deviceId: uuidv4(),
        lastMerged: null,
        settings: {
          autoBackup: true,
          backupInterval: 7,
          mergeNotifications: true,
          mergeNotificationDays: 7,
          theme: 'light'
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  } catch (error) {
    console.error('Error loading config:', error);
    config = {
      deviceId: uuidv4(),
      lastMerged: null,
      settings: {
        autoBackup: true,
        backupInterval: 7,
        mergeNotifications: true,
        mergeNotificationDays: 7,
        theme: 'light'
      }
    };
  }
}

function createWindow() {
  // Load config first
  loadConfig();

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Data',
          click: () => mainWindow.webContents.send('export-data')
        },
        {
          label: 'Import Data',
          click: () => mainWindow.webContents.send('import-data')
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => { mainWindow.webContents.openDevTools(); }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Help Guide',
          click: () => mainWindow.webContents.send('show-help')
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              title: 'About Digital Detective Guide',
              message: 'Digital Detective Guide v1.0.0',
              detail: 'A tool for storing and sharing investigative knowledge.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Initialize database and directories
  initializeApp();
}

// Initialize app directories and database
async function initializeApp() {
  console.log('Initializing application...');
  
  // Use user data path for all persistent data
  const userDataPath = app.getPath('userData');
  console.log('User data path:', userDataPath);
  
  const directories = ['files', 'exports', 'help'].map(dir => path.join(userDataPath, dir));
  
  // Create required directories if they don't exist
  directories.forEach(dirPath => {
    if (!fs.existsSync(dirPath)) {
      console.log('Creating directory:', dirPath);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  try {
    // Initialize database connection
    db = await connectToDatabase();

    // Create tables if they don't exist
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Categories table
        db.run(`CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // Entries table
        db.run(`CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          wisdom TEXT,
          category_id TEXT,
          file_path TEXT,
          tags TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          view_count INTEGER DEFAULT 0,
          device_id TEXT,
          is_template BOOLEAN DEFAULT 0,
          FOREIGN KEY (category_id) REFERENCES categories(id)
        )`);

        // Ratings table
        db.run(`CREATE TABLE IF NOT EXISTS ratings (
          id TEXT PRIMARY KEY,
          entry_id TEXT,
          device_id TEXT,
          value INTEGER CHECK (value >= 1 AND value <= 5),
          comment TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id)
        )`);

        // Comments table
        db.run(`CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          entry_id TEXT,
          device_id TEXT,
          comment TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id)
        )`);

        // Version history table
        db.run(`CREATE TABLE IF NOT EXISTS version_history (
          id TEXT PRIMARY KEY,
          entry_id TEXT,
          title TEXT,
          description TEXT,
          wisdom TEXT,
          category_id TEXT,
          file_path TEXT,
          tags TEXT,
          device_id TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id)
        )`);

        // Check if categories table is empty
        db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
          if (err) {
            console.error('Error checking categories:', err);
            reject(err);
            return;
          }

          // Only insert default categories if the table is empty
          if (row.count === 0) {
            console.log('Initializing default categories...');
            // Insert default categories
            const defaultCategories = [
              'Search Warrants',
              'Interview & Interrogation',
              'Case Management',
              'Tech & Forensics',
              'Courtroom & Testimony',
              "Mentor's Notes"
            ];

            const stmt = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)');
            
            defaultCategories.forEach(category => {
              stmt.run([uuidv4(), category]);
            });
            
            stmt.finalize();
          }

          // Check categories after initialization
          checkCategories();
          resolve();
        });
      });
    });

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Add this after the initializeApp function
function checkCategories() {
  db.all('SELECT * FROM categories', (err, rows) => {
    if (err) {
      console.error('Error checking categories:', err);
      return;
    }
    console.log('Current categories in database:', rows);
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return config;
});

ipcMain.handle('update-config', (event, newConfig) => {
  config = { ...config, ...newConfig };
  const configPath = path.join(app.getAppPath(), 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
});

ipcMain.handle('get-categories', () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-category', (event, name) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run('INSERT INTO categories (id, name) VALUES (?, ?)',
      [id, name],
      function(err) {
        if (err) reject(err);
        else resolve({ id, name });
      });
  });
});

ipcMain.handle('get-entries', (event, categoryId) => {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT e.*, 
        (SELECT COUNT(*) FROM ratings WHERE entry_id = e.id) as rating_count,
        (SELECT AVG(value) FROM ratings WHERE entry_id = e.id) as rating
      FROM entries e
      WHERE category_id = ?
      ORDER BY created_at DESC
    `, [categoryId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-entry', (event, entry) => {
  return new Promise((resolve, reject) => {
    console.log('Attempting to add entry:', entry);
    
    if (!entry.title || !entry.categoryId) {
      console.error('Missing required fields:', { title: entry.title, categoryId: entry.categoryId });
      reject(new Error('Missing required fields'));
      return;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO entries (
        id, title, description, wisdom, category_id,
        file_path, device_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      entry.title,
      entry.description || '',
      entry.wisdom || '',
      entry.categoryId,
      entry.file_path || null,
      config.deviceId,
      now,
      now
    ];

    console.log('Executing query:', query);
    console.log('With parameters:', params);

    db.run(query, params, function(err) {
      if (err) {
        console.error('Database error adding entry:', err);
        reject(err);
      } else {
        console.log('Entry added successfully:', { id, ...entry });
        resolve({ id, ...entry });
      }
    });
  });
});

// Modify the saveFile handler
ipcMain.handle('saveFile', async (event, fileData) => {
  try {
    console.log('Received file save request:', fileData);
    
    if (!fileData || !fileData.name) {
      throw new Error('Invalid file data received');
    }
    
    // Create files directory in user data path
    const filesDir = path.join(app.getPath('userData'), 'files');
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }

    // Get original filename and extension
    const fileExt = path.extname(fileData.name);
    const baseName = path.basename(fileData.name, fileExt);
    
    // Generate unique filename
    let counter = 1;
    let newFileName;
    let destPath;
    
    do {
      newFileName = `${baseName}-${counter}${fileExt}`;
      destPath = path.join(filesDir, newFileName);
      counter++;
    } while (fs.existsSync(destPath));

    // Copy the file to our files directory
    if (fileData.path && fs.existsSync(fileData.path)) {
      fs.copyFileSync(fileData.path, destPath);
    } else {
      // If no path or file doesn't exist, create an empty file
      fs.writeFileSync(destPath, '');
    }
    
    console.log('File saved successfully:', {
      originalName: fileData.name,
      newFileName,
      filePath: newFileName // Return just the filename, not the full path
    });

    return {
      originalName: fileData.name,
      savedName: newFileName,
      filePath: newFileName
    };
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
});

// Add these IPC handlers
ipcMain.handle('update-entry', (event, entry) => {
  return new Promise((resolve, reject) => {
    console.log('Updating entry:', entry);
    
    if (!entry.id || !entry.title || !entry.categoryId) {
      console.error('Missing required fields for update:', entry);
      reject(new Error('Missing required fields'));
      return;
    }

    const now = new Date().toISOString();
    
    db.run(`
      UPDATE entries SET
        title = ?,
        description = ?,
        wisdom = ?,
        category_id = ?,
        file_path = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      entry.title,
      entry.description || '',
      entry.wisdom || '',
      entry.categoryId,
      entry.file_path || null,
      now,
      entry.id
    ], function(err) {
      if (err) {
        console.error('Error updating entry:', err);
        reject(err);
      } else {
        console.log('Entry updated successfully:', entry.id);
        resolve({ ...entry, updated_at: now });
      }
    });
  });
});

ipcMain.handle('delete-entry', (event, entryId) => {
  return new Promise((resolve, reject) => {
    console.log('Deleting entry:', entryId);
    
    if (!entryId) {
      reject(new Error('No entry ID provided'));
      return;
    }

    // First get the entry to check if it has a file
    db.get('SELECT file_path FROM entries WHERE id = ?', [entryId], (err, row) => {
      if (err) {
        console.error('Error getting entry for deletion:', err);
        reject(err);
        return;
      }

      // If there's a file, try to delete it
      if (row && row.file_path) {
        try {
          const filePath = path.join(app.getAppPath(), 'files', row.file_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.error('Error deleting file:', fileErr);
          // Continue with entry deletion even if file deletion fails
        }
      }

      // Delete the entry
      db.run('DELETE FROM entries WHERE id = ?', [entryId], function(err) {
        if (err) {
          console.error('Error deleting entry:', err);
          reject(err);
        } else {
          console.log('Entry deleted successfully:', entryId);
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('delete-category', (event, categoryId) => {
  return new Promise((resolve, reject) => {
    if (!categoryId) {
      reject(new Error('No category ID provided'));
      return;
    }

    // First delete all entries in this category
    db.run('DELETE FROM entries WHERE category_id = ?', [categoryId], (err) => {
      if (err) {
        console.error('Error deleting category entries:', err);
        reject(err);
        return;
      }

      // Then delete the category
      db.run('DELETE FROM categories WHERE id = ?', [categoryId], function(err) {
        if (err) {
          console.error('Error deleting category:', err);
          reject(err);
        } else {
          console.log('Category deleted successfully:', categoryId);
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('open-file', (event, filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error('No file path provided'));
      return;
    }

    const fullPath = path.join(app.getAppPath(), 'files', filePath);
    if (!fs.existsSync(fullPath)) {
      reject(new Error('File not found'));
      return;
    }

    shell.openPath(fullPath)
      .then(() => resolve({ success: true }))
      .catch(err => reject(err));
  });
});

ipcMain.handle('get-ratings', (event, entryId) => {
  return new Promise((resolve, reject) => {
    if (!entryId) {
      reject(new Error('No entry ID provided'));
      return;
    }

    db.all('SELECT * FROM ratings WHERE entry_id = ?', [entryId], (err, rows) => {
      if (err) {
        console.error('Error getting ratings:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('add-rating', (event, rating) => {
  return new Promise((resolve, reject) => {
    if (!rating || !rating.entry_id || !rating.value) {
      reject(new Error('Invalid rating data'));
      return;
    }

    const id = uuidv4();
    const { entry_id, value } = rating;
    db.run(
      'INSERT INTO ratings (id, entry_id, device_id, value, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, entry_id, config.deviceId, value, new Date().toISOString()],
      function(err) {
        if (err) {
          console.error('Error adding rating:', err);
          reject(err);
        } else {
          resolve({ id, entry_id, value });
        }
      }
    );
  });
});

ipcMain.handle('get-comments', (event, entryId) => {
  return new Promise((resolve, reject) => {
    if (!entryId) {
      reject(new Error('No entry ID provided'));
      return;
    }

    db.all('SELECT * FROM comments WHERE entry_id = ? ORDER BY created_at DESC', [entryId], (err, rows) => {
      if (err) {
        console.error('Error getting comments:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('add-comment', (event, comment) => {
  return new Promise((resolve, reject) => {
    if (!comment || !comment.entry_id || !comment.text) {
      reject(new Error('Invalid comment data'));
      return;
    }

    const { entry_id, text } = comment;
    db.run(
      'INSERT INTO comments (entry_id, text, created_at) VALUES (?, ?, ?)',
      [entry_id, text, new Date().toISOString()],
      function(err) {
        if (err) {
          console.error('Error adding comment:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, ...comment });
        }
      }
    );
  });
});

ipcMain.handle('export-data', (event, options) => {
  return new Promise((resolve, reject) => {
    const exportData = {
      categories: [],
      entries: [],
      ratings: [],
      comments: []
    };

    // Export categories
    db.all('SELECT * FROM categories', [], (err, categories) => {
      if (err) {
        console.error('Error exporting categories:', err);
        reject(err);
        return;
      }
      exportData.categories = categories;

      // Export entries
      db.all('SELECT * FROM entries', [], (err, entries) => {
        if (err) {
          console.error('Error exporting entries:', err);
          reject(err);
          return;
        }
        exportData.entries = entries;

        // Export ratings
        db.all('SELECT * FROM ratings', [], (err, ratings) => {
          if (err) {
            console.error('Error exporting ratings:', err);
            reject(err);
            return;
          }
          exportData.ratings = ratings;

          // Export comments
          db.all('SELECT * FROM comments', [], (err, comments) => {
            if (err) {
              console.error('Error exporting comments:', err);
              reject(err);
              return;
            }
            exportData.comments = comments;

            resolve(exportData);
          });
        });
      });
    });
  });
});

ipcMain.handle('import-data', (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data || !Array.isArray(data.categories)) {
      reject(new Error('Invalid import data'));
      return;
    }

    // Start a transaction
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        console.error('Error starting transaction:', err);
        reject(err);
        return;
      }

      // Import categories
      const categoryStmt = db.prepare('INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)');
      data.categories.forEach(category => {
        categoryStmt.run(category.id, category.name, category.created_at);
      });
      categoryStmt.finalize();

      // Import entries
      const entryStmt = db.prepare('INSERT INTO entries (id, title, description, category_id, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      data.entries.forEach(entry => {
        entryStmt.run(entry.id, entry.title, entry.description, entry.category_id, entry.file_path, entry.created_at);
      });
      entryStmt.finalize();

      // Import ratings
      const ratingStmt = db.prepare('INSERT INTO ratings (id, entry_id, value, comment, created_at) VALUES (?, ?, ?, ?, ?)');
      data.ratings.forEach(rating => {
        ratingStmt.run(rating.id, rating.entry_id, rating.value, rating.comment, rating.created_at);
      });
      ratingStmt.finalize();

      // Import comments
      const commentStmt = db.prepare('INSERT INTO comments (id, entry_id, text, created_at) VALUES (?, ?, ?, ?)');
      data.comments.forEach(comment => {
        commentStmt.run(comment.id, comment.entry_id, comment.text, comment.created_at);
      });
      commentStmt.finalize();

      // Commit the transaction
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('Error committing transaction:', err);
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  });
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch
  };
});

ipcMain.handle('download-file', async (event, filePath) => {
  try {
    const fullPath = path.join(app.getAppPath(), 'files', filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filePath,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.copyFileSync(fullPath, result.filePath);
      return { success: true, path: result.filePath };
    }
    
    return { success: false, message: 'Download cancelled' };
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  try {
    await closeDatabase();
  } catch (err) {
    console.error('Error during database cleanup:', err);
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Close database connection when app is closing
app.on('before-quit', async (event) => {
  event.preventDefault();
  try {
    await closeDatabase();
    app.exit(0);
  } catch (err) {
    console.error('Error during application quit:', err);
    app.exit(1);
  }
}); 