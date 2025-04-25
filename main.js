const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const extract = require('extract-zip');

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
      label: 'Settings',
      submenu: [
        {
          label: 'Categories',
          click: () => mainWindow.webContents.send('show-category-settings')
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          click: () => mainWindow.webContents.send('show-preferences')
        }
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
          icon TEXT DEFAULT 'folder',
          color TEXT DEFAULT '#3498db',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // Add columns if they don't exist - using a more compatible approach
        db.all(`PRAGMA table_info(categories)`, [], (err, rows) => {
          if (err) {
            console.error('Error checking categories table:', err);
            return;
          }

          const columns = rows || [];
          const columnNames = columns.map(col => col.name);

          db.serialize(() => {
            // Add icon column if it doesn't exist
            if (!columnNames.includes('icon')) {
              db.run('ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT "folder"', (err) => {
                if (err && !err.message.includes('duplicate column')) {
                  console.error('Error adding icon column:', err);
                }
              });
            }

            // Add color column if it doesn't exist
            if (!columnNames.includes('color')) {
              db.run('ALTER TABLE categories ADD COLUMN color TEXT DEFAULT "#3498db"', (err) => {
                if (err && !err.message.includes('duplicate column')) {
                  console.error('Error adding color column:', err);
                }
              });
            }
          });
        });

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
          rating INTEGER CHECK (rating >= 1 AND rating <= 5),
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

        // Create a new table for files
        db.run(`
          CREATE TABLE IF NOT EXISTS entry_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
          )
        `);

        // Create favorites table
        db.run(`CREATE TABLE IF NOT EXISTS favorites (
          id TEXT PRIMARY KEY,
          entry_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
          UNIQUE(entry_id, device_id)
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
    db.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM entries WHERE category_id = c.id) as entryCount
      FROM categories c
      ORDER BY c.name
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('add-category', async (event, categoryData) => {
  const { name, icon, color } = categoryData;
  const id = uuidv4();
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)');
    stmt.run([id, name, icon || 'folder', color || '#3498db'], function(err) {
      if (err) {
        console.error('Error adding category:', err);
        reject(err);
      } else {
        resolve({ id, name, icon, color });
      }
    });
    stmt.finalize();
  });
});

// Update category handler
ipcMain.handle('update-category', async (event, categoryData) => {
  const { id, name, icon, color } = categoryData;
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?');
    stmt.run([name, icon || 'folder', color || '#3498db', id], function(err) {
      if (err) {
        console.error('Error updating category:', err);
        reject(err);
      } else {
        resolve({ id, name, icon, color });
      }
    });
    stmt.finalize();
  });
});

ipcMain.handle('get-entries', (event, categoryId) => {
  return new Promise((resolve, reject) => {
    if (!categoryId) {
      reject(new Error('No category ID provided'));
      return;
    }

    db.all(`
      SELECT e.*, c.name as category_name,
        (SELECT AVG(rating) FROM ratings WHERE entry_id = e.id) as rating,
        (SELECT COUNT(*) FROM ratings WHERE entry_id = e.id) as rating_count,
        (SELECT GROUP_CONCAT(ef.file_path || '|' || ef.file_name)
         FROM entry_files ef
         WHERE ef.entry_id = e.id) as files,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM entries e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN favorites f ON e.id = f.entry_id AND f.device_id = ?
      WHERE e.category_id = ?
      ORDER BY e.updated_at DESC
    `, [config.deviceId, categoryId], (err, rows) => {
      if (err) {
        console.error('Error getting entries:', err);
        reject(err);
      } else {
        // Process the files string into an array of file objects
        const entries = rows.map(row => {
          const entry = { ...row };
          if (entry.files) {
            entry.files = entry.files.split(',').map(fileStr => {
              const [path, name] = fileStr.split('|');
              return { path, name };
            });
          } else {
            entry.files = [];
          }
          return entry;
        });
        resolve(entries);
      }
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
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const query = `
        INSERT INTO entries (
          id, title, description, wisdom, category_id,
          device_id, created_at, updated_at, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        id,
        entry.title,
        entry.description || '',
        entry.wisdom || '',
        entry.categoryId,
        config.deviceId,
        now,
        now,
        entry.tags || ''
      ];

      db.run(query, params, function(err) {
        if (err) {
          console.error('Database error adding entry:', err);
          db.run('ROLLBACK');
          reject(err);
          return;
        }

        // Insert files if present
        if (entry.files && entry.files.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO entry_files (entry_id, file_path, file_name, created_at)
            VALUES (?, ?, ?, ?)
          `);

          entry.files.forEach(file => {
            stmt.run([id, file.path, file.name, now]);
          });

          stmt.finalize((err) => {
            if (err) {
              console.error('Error inserting files:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err);
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              console.log('Entry and files added successfully:', id);
              resolve({ id, ...entry, created_at: now, updated_at: now });
            });
          });
        } else {
          db.run('COMMIT', (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              db.run('ROLLBACK');
              reject(err);
              return;
            }

            console.log('Entry added successfully:', id);
            resolve({ id, ...entry, created_at: now, updated_at: now });
          });
        }
      });
    });
  });
});

// Modify the saveFile handler
ipcMain.handle('save-file', async (event, fileData) => {
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
    
    // Start a transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Update the entry
      db.run(`
        UPDATE entries SET
          title = ?,
          description = ?,
          wisdom = ?,
          category_id = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        entry.title,
        entry.description || '',
        entry.wisdom || '',
        entry.categoryId,
        now,
        entry.id
      ], function(err) {
        if (err) {
          console.error('Error updating entry:', err);
          db.run('ROLLBACK');
          reject(err);
          return;
        }

        // Delete existing files
        db.run('DELETE FROM entry_files WHERE entry_id = ?', [entry.id], (err) => {
          if (err) {
            console.error('Error deleting existing files:', err);
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          // Insert new files
          if (entry.files && entry.files.length > 0) {
            const stmt = db.prepare(`
              INSERT INTO entry_files (entry_id, file_path, file_name, created_at)
              VALUES (?, ?, ?, ?)
            `);

            entry.files.forEach(file => {
              stmt.run([entry.id, file.path, file.name, now]);
            });

            stmt.finalize((err) => {
              if (err) {
                console.error('Error inserting files:', err);
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                console.log('Entry and files updated successfully:', entry.id);
                resolve({ ...entry, updated_at: now });
              });
            });
          } else {
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('Error committing transaction:', err);
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              console.log('Entry updated successfully:', entry.id);
              resolve({ ...entry, updated_at: now });
            });
          }
        });
      });
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

    const fullPath = path.join(app.getPath('userData'), 'files', filePath);
    console.log('Attempting to open file:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('File not found:', fullPath);
      reject(new Error('File not found'));
      return;
    }

    shell.openPath(fullPath)
      .then(() => resolve({ success: true }))
      .catch(err => {
        console.error('Error opening file:', err);
        reject(err);
      });
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

// Get a user's rating for an entry
ipcMain.handle('get-user-rating', (event, entryId) => {
  return new Promise((resolve, reject) => {
    if (!entryId) {
      reject(new Error('No entry ID provided'));
      return;
    }

    db.get(
      'SELECT rating FROM ratings WHERE entry_id = ? AND device_id = ?',
      [entryId, config.deviceId],
      (err, row) => {
        if (err) {
          console.error('Error getting user rating:', err);
          reject(err);
        } else {
          resolve(row ? row.rating : null);
        }
      }
    );
  });
});

// Update the add-rating handler to handle rating updates
ipcMain.handle('add-rating', (event, rating) => {
  return new Promise((resolve, reject) => {
    if (!rating || !rating.entry_id || !rating.rating) {
      reject(new Error('Invalid rating data'));
      return;
    }

    // First check if user has already rated this entry
    db.get(
      'SELECT id FROM ratings WHERE entry_id = ? AND device_id = ?',
      [rating.entry_id, config.deviceId],
      (err, row) => {
        if (err) {
          console.error('Error checking existing rating:', err);
          reject(err);
          return;
        }

        if (row) {
          // Update existing rating
          db.run(
            'UPDATE ratings SET rating = ?, created_at = ? WHERE id = ?',
            [rating.rating, new Date().toISOString(), row.id],
            function(err) {
              if (err) {
                console.error('Error updating rating:', err);
                reject(err);
              } else {
                resolve({ id: row.id, entry_id: rating.entry_id, rating: rating.rating });
              }
            }
          );
        } else {
          // Add new rating
          const id = uuidv4();
          db.run(
            'INSERT INTO ratings (id, entry_id, device_id, rating, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, rating.entry_id, config.deviceId, rating.rating, new Date().toISOString()],
            function(err) {
              if (err) {
                console.error('Error adding rating:', err);
                reject(err);
              } else {
                resolve({ id, entry_id: rating.entry_id, rating: rating.rating });
              }
            }
          );
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

ipcMain.handle('export-data', async (event, options) => {
    try {
        const exportData = {
            categories: [],
            entries: [],
            ratings: [],
            comments: []
        };

        // Get all data from database
        const [categories, entries, ratings, comments] = await Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM categories', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM entries', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM ratings', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT * FROM comments', [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            })
        ]);

        exportData.categories = categories;
        exportData.entries = entries;
        exportData.ratings = ratings;
        exportData.comments = comments;

        // Save to file
        const { dialog } = require('electron');
        const path = require('path');
        const fs = require('fs');
        const archiver = require('archiver');

        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Data',
            defaultPath: path.join(app.getPath('downloads'), 'digital-detective-export.zip'),
            filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        });

        if (!filePath) {
            throw new Error('Export cancelled');
        }

        // Create zip file
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                resolve({ success: true });
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Add the data as JSON
            archive.append(JSON.stringify(exportData, null, 2), { name: 'data.json' });

            // Add files if requested
            if (options.includeFiles) {
                const filesDir = path.join(app.getPath('userData'), 'files');
                if (fs.existsSync(filesDir)) {
                    archive.directory(filesDir, 'files');
                }
            }

            archive.finalize();
        });
    } catch (error) {
        console.error('Export error:', error);
        throw error;
    }
});

ipcMain.handle('import-data', async (event, options) => {
    try {
        const { dialog } = require('electron');
        const path = require('path');
        const fs = require('fs');
        const extract = require('extract-zip');

        const { filePaths } = await dialog.showOpenDialog({
            title: 'Import Data',
            filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
            properties: ['openFile']
        });

        if (!filePaths || filePaths.length === 0) {
            return { cancelled: true };  // Return cancelled status instead of throwing error
        }

        const importPath = filePaths[0];
        const tempDir = path.join(app.getPath('temp'), 'digital-detective-import');

        // Clean up temp directory if it exists
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
        fs.mkdirSync(tempDir);

        // Extract the zip file
        await extract(importPath, { dir: tempDir });

        // Read the data file
        const dataFile = path.join(tempDir, 'data.json');
        if (!fs.existsSync(dataFile)) {
            throw new Error('Invalid import file: missing data.json');
        }

        const importData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

        // Start a transaction
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        try {
            // Import categories
            for (const category of importData.categories) {
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT OR REPLACE INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)',
                        [category.id, category.name, category.color, category.icon],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            // Import entries
            for (const entry of importData.entries) {
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT OR REPLACE INTO entries (id, title, description, wisdom, category_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [entry.id, entry.title, entry.description, entry.wisdom, entry.category_id, entry.tags, entry.created_at, entry.updated_at],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            // Import files if they exist
            const importFilesDir = path.join(tempDir, 'files');
            if (fs.existsSync(importFilesDir)) {
                const filesDir = path.join(app.getPath('userData'), 'files');
                fs.cpSync(importFilesDir, filesDir, { recursive: true });
            }

            // Commit transaction
            await new Promise((resolve, reject) => {
                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Clean up
            fs.rmSync(tempDir, { recursive: true });

            return { success: true };
        } catch (error) {
            // Rollback on error
            await new Promise((resolve) => {
                db.run('ROLLBACK', () => resolve());
            });
            throw error;
        }
    } catch (error) {
        console.error('Import error:', error);
        throw error;
    }
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
    const fullPath = path.join(app.getPath('userData'), 'files', filePath);
    console.log('Attempting to download file:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error('File not found:', fullPath);
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

// Increment view count for an entry
ipcMain.handle('increment-view-count', (event, entryId) => {
    return new Promise((resolve, reject) => {
        if (!entryId) {
            reject(new Error('No entry ID provided'));
            return;
        }

        db.run('UPDATE entries SET view_count = view_count + 1 WHERE id = ?', [entryId], (err) => {
            if (err) {
                console.error('Error incrementing view count:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
});

// Add new IPC handlers for favorites
ipcMain.handle('toggle-favorite', (event, entryId) => {
    return new Promise((resolve, reject) => {
        if (!entryId) {
            reject(new Error('No entry ID provided'));
            return;
        }

        // Check if entry is already favorited
        db.get(
            'SELECT id FROM favorites WHERE entry_id = ? AND device_id = ?',
            [entryId, config.deviceId],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (row) {
                    // Remove from favorites
                    db.run(
                        'DELETE FROM favorites WHERE id = ?',
                        [row.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve({ isFavorite: false });
                        }
                    );
                } else {
                    // Add to favorites
                    const id = uuidv4();
                    db.run(
                        'INSERT INTO favorites (id, entry_id, device_id) VALUES (?, ?, ?)',
                        [id, entryId, config.deviceId],
                        (err) => {
                            if (err) reject(err);
                            else resolve({ isFavorite: true });
                        }
                    );
                }
            }
        );
    });
});

ipcMain.handle('get-dashboard-data', () => {
    return new Promise((resolve, reject) => {
        const data = {
            favorites: [],
            recentEntries: [],
            recentlyAdded: []
        };

        db.serialize(() => {
            // Get favorited entries
            db.all(`
                SELECT e.*, c.name as category_name,
                    (SELECT AVG(rating) FROM ratings WHERE entry_id = e.id) as rating,
                    (SELECT COUNT(*) FROM ratings WHERE entry_id = e.id) as rating_count,
                    (SELECT GROUP_CONCAT(ef.file_path || '|' || ef.file_name)
                     FROM entry_files ef
                     WHERE ef.entry_id = e.id) as files,
                    1 as is_favorite
                FROM entries e
                LEFT JOIN categories c ON e.category_id = c.id
                INNER JOIN favorites f ON e.id = f.entry_id
                WHERE f.device_id = ?
                ORDER BY e.updated_at DESC
            `, [config.deviceId], (err, favorites) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Process files for favorites
                data.favorites = favorites.map(entry => {
                    if (entry.files) {
                        entry.files = entry.files.split(',').map(fileStr => {
                            const [path, name] = fileStr.split('|');
                            return { path, name };
                        });
                    } else {
                        entry.files = [];
                    }
                    return entry;
                });

                // Get recently updated entries (modified after creation)
                db.all(`
                    SELECT DISTINCT e.*, c.name as category_name,
                        (SELECT AVG(rating) FROM ratings WHERE entry_id = e.id) as rating,
                        (SELECT COUNT(*) FROM ratings WHERE entry_id = e.id) as rating_count,
                        (SELECT GROUP_CONCAT(ef.file_path || '|' || ef.file_name)
                         FROM entry_files ef
                         WHERE ef.entry_id = e.id) as files,
                        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                        e.updated_at as last_content_update
                    FROM entries e
                    LEFT JOIN categories c ON e.category_id = c.id
                    LEFT JOIN favorites f ON e.id = f.entry_id AND f.device_id = ?
                    WHERE 
                        -- Only show entries that have been modified after creation
                        e.updated_at > e.created_at
                        AND e.updated_at >= datetime('now', '-7 days')
                    ORDER BY last_content_update DESC
                    LIMIT 10
                `, [config.deviceId], (err, recent) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Process files for recent entries
                    data.recentEntries = recent.map(entry => {
                        if (entry.files) {
                            entry.files = entry.files.split(',').map(fileStr => {
                                const [path, name] = fileStr.split('|');
                                return { path, name };
                            });
                        } else {
                            entry.files = [];
                        }
                        return entry;
                    });

                    // Get recently added entries (created in last 7 days)
                    db.all(`
                        SELECT DISTINCT e.*, c.name as category_name,
                            (SELECT AVG(rating) FROM ratings WHERE entry_id = e.id) as rating,
                            (SELECT COUNT(*) FROM ratings WHERE entry_id = e.id) as rating_count,
                            (SELECT GROUP_CONCAT(ef.file_path || '|' || ef.file_name)
                             FROM entry_files ef
                             WHERE ef.entry_id = e.id) as files,
                            CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
                            e.created_at as last_content_update
                        FROM entries e
                        LEFT JOIN categories c ON e.category_id = c.id
                        LEFT JOIN favorites f ON e.id = f.entry_id AND f.device_id = ?
                        WHERE 
                            -- Show entries created within the last 7 days
                            e.created_at >= datetime('now', '-7 days')
                            -- Exclude entries that have been modified (they'll be in recent updates)
                            AND e.updated_at = e.created_at
                        ORDER BY last_content_update DESC
                        LIMIT 10
                    `, [config.deviceId], (err, added) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        // Process files for recently added entries
                        data.recentlyAdded = added.map(entry => {
                            if (entry.files) {
                                entry.files = entry.files.split(',').map(fileStr => {
                                    const [path, name] = fileStr.split('|');
                                    return { path, name };
                                });
                            } else {
                                entry.files = [];
                            }
                            return entry;
                        });

                        resolve(data);
                    });
                });
            });
        });
    });
});

// Category management
ipcMain.handle('save-categories', async (event, categories) => {
    try {
        await fs.writeFile(
            path.join(app.getPath('userData'), 'categories.json'),
            JSON.stringify(categories, null, 2)
        );
        return true;
    } catch (error) {
        console.error('Error saving categories:', error);
        throw error;
    }
});

ipcMain.handle('load-categories', async () => {
    try {
        const categoriesPath = path.join(app.getPath('userData'), 'categories.json');
        if (await fs.access(categoriesPath).then(() => true).catch(() => false)) {
            const data = await fs.readFile(categoriesPath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error loading categories:', error);
        return [];
    }
});

// Add window reset handler
ipcMain.on('force-window-reset', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        // Force a window blur/focus cycle
        win.minimize();
        setTimeout(() => {
            win.restore();
            win.focus();
        }, 10);
    }
});

// Add near other IPC handlers
ipcMain.on('force-window-refresh', () => {
    // Get all windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        // Force the window to blur
        win.blur();
        // Force a window refresh
        win.webContents.invalidate();
        // Bring window back to focus
        setTimeout(() => {
            win.focus();
            win.webContents.focus();
        }, 50);
    });
});

// Add near other IPC handlers
ipcMain.on('prepare-for-ui-update', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        // Temporarily disable input events at the window level
        win.webContents.executeJavaScript(`
            document.body.style.pointerEvents = 'none';
            setTimeout(() => {
                document.body.style.pointerEvents = 'auto';
            }, 100);
        `);
    }
});

ipcMain.on('ui-update-complete', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        // Re-enable input and ensure window is ready
        win.webContents.executeJavaScript(`
            document.body.style.pointerEvents = 'auto';
            document.documentElement.style.pointerEvents = 'auto';
            void document.body.offsetHeight;
        `);
    }
});

// Add these handlers near other IPC handlers
ipcMain.handle('reset-window-state', () => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        // Force window to release focus and then regain it
        window.blur();
        window.webContents.setUserAgent(window.webContents.getUserAgent());
        window.focus();
        
        // Reset input mode
        window.webContents.sendInputEvent({
            type: 'keyUp',
            keyCode: 'Tab'
        });
    });
});

ipcMain.handle('force-input-reset', () => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        // Reset the webContents state
        window.webContents.reload();
        
        // Wait for the reload to complete
        window.webContents.once('did-finish-load', () => {
            window.focus();
        });
    });
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