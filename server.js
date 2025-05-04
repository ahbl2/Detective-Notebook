const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Database setup
const dbPath = path.join(__dirname, 'notebook.db');
const db = new sqlite3.Database(dbPath);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT 'folder',
      color TEXT DEFAULT '#3498db',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Entries table
    db.run(`CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      wisdom TEXT,
      category_id TEXT,
      tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      user_id TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Files table
    db.run(`CREATE TABLE IF NOT EXISTS entry_files (
      id TEXT PRIMARY KEY,
      entry_id TEXT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    )`);

    // Ratings table
    db.run(`CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      entry_id TEXT,
      user_id TEXT,
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Comments table
    db.run(`CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      entry_id TEXT,
      user_id TEXT,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  });
}

// Auth Routes
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    db.run('INSERT INTO users (id, username, password) VALUES (?, ?, ?)',
      [userId, username, hashedPassword],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign({ id: userId, username }, JWT_SECRET);
        res.json({ token });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    try {
      if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// Categories Routes
app.get('/api/categories', authenticateToken, (req, res) => {
  db.all('SELECT * FROM categories WHERE user_id = ?', [req.user.id], (err, categories) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(categories);
  });
});

app.post('/api/categories', authenticateToken, (req, res) => {
  const { name, icon, color } = req.body;
  const categoryId = uuidv4();
  
  db.run('INSERT INTO categories (id, name, icon, color, user_id) VALUES (?, ?, ?, ?, ?)',
    [categoryId, name, icon, color, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: categoryId, name, icon, color });
    }
  );
});

// Update category endpoint
app.put('/api/categories/:id', authenticateToken, (req, res) => {
  const { name, icon, color } = req.body;
  const categoryId = req.params.id;
  
  db.run('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?',
    [name, icon, color, categoryId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ id: categoryId, name, icon, color });
    }
  );
});

// Delete category endpoint
app.delete('/api/categories/:id', authenticateToken, (req, res) => {
  const categoryId = req.params.id;
  
  db.run('DELETE FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ message: 'Category deleted successfully' });
    }
  );
});

// Entries Routes
app.get('/api/entries', authenticateToken, (req, res) => {
  const { categoryId } = req.query;
  let query = 'SELECT e.*, c.name as category_name FROM entries e LEFT JOIN categories c ON e.category_id = c.id WHERE e.user_id = ?';
  const params = [req.user.id];

  if (categoryId) {
    query += ' AND e.category_id = ?';
    params.push(categoryId);
  }

  db.all(query, params, (err, entries) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(entries);
  });
});

app.post('/api/entries', authenticateToken, (req, res) => {
  const { title, description, wisdom, categoryId, tags } = req.body;
  const entryId = uuidv4();
  const now = new Date().toISOString();

  db.run('INSERT INTO entries (id, title, description, wisdom, category_id, tags, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [entryId, title, description, wisdom, categoryId, tags, req.user.id, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: entryId, title, description, wisdom, categoryId, tags, created_at: now, updated_at: now });
    }
  );
});

// Update entry endpoint
app.put('/api/entries/:id', authenticateToken, (req, res) => {
  const { title, description, wisdom, categoryId, tags } = req.body;
  const entryId = req.params.id;
  const now = new Date().toISOString();

  db.run('UPDATE entries SET title = ?, description = ?, wisdom = ?, category_id = ?, tags = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [title, description, wisdom, categoryId, tags, now, entryId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
      res.json({ id: entryId, title, description, wisdom, categoryId, tags, updated_at: now });
    }
  );
});

// Delete entry endpoint
app.delete('/api/entries/:id', authenticateToken, (req, res) => {
  const entryId = req.params.id;
  
  db.run('DELETE FROM entries WHERE id = ? AND user_id = ?',
    [entryId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
      res.json({ message: 'Entry deleted successfully' });
    }
  );
});

// File Routes
app.post('/api/files', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    path: req.file.path,
    filename: req.file.filename,
    originalname: req.file.originalname
  });
});

// Delete file endpoint
app.delete('/api/files/:id', authenticateToken, (req, res) => {
  const fileId = req.params.id;
  
  // First get the file info to delete the actual file
  db.get('SELECT * FROM entry_files WHERE id = ?', [fileId], (err, file) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Delete the physical file
    const filePath = path.join(__dirname, 'public', file.file_path);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
      
      // Delete the database record
      db.run('DELETE FROM entry_files WHERE id = ?', [fileId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'File deleted successfully' });
      });
    });
  });
});

// Ratings Routes
app.get('/api/entries/:id/ratings', authenticateToken, (req, res) => {
  const entryId = req.params.id;
  
  db.all('SELECT * FROM ratings WHERE entry_id = ?', [entryId], (err, ratings) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(ratings);
  });
});

app.post('/api/entries/:id/ratings', authenticateToken, (req, res) => {
  const entryId = req.params.id;
  const { rating } = req.body;
  const ratingId = uuidv4();
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Invalid rating value' });
  }

  db.run('INSERT INTO ratings (id, entry_id, user_id, rating) VALUES (?, ?, ?, ?)',
    [ratingId, entryId, req.user.id, rating],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: ratingId, entry_id: entryId, rating });
    }
  );
});

// Comments Routes
app.get('/api/entries/:id/comments', authenticateToken, (req, res) => {
  const entryId = req.params.id;
  
  db.all('SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.entry_id = ?',
    [entryId],
    (err, comments) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(comments);
    }
  );
});

app.post('/api/entries/:id/comments', authenticateToken, (req, res) => {
  const entryId = req.params.id;
  const { comment } = req.body;
  const commentId = uuidv4();
  
  if (!comment) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  db.run('INSERT INTO comments (id, entry_id, user_id, comment) VALUES (?, ?, ?, ?)',
    [commentId, entryId, req.user.id, comment],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: commentId, entry_id: entryId, comment });
    }
  );
});

// Configuration Routes
app.get('/api/config', authenticateToken, (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        deviceId: uuidv4(),
        lastMerged: new Date().toISOString(),
        settings: {
          autoBackup: true,
          backupInterval: 7,
          mergeNotifications: true,
          mergeNotificationDays: 7,
          theme: 'light',
          smartMerge: false
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return res.json(defaultConfig);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error reading configuration' });
  }
});

app.put('/api/config', authenticateToken, (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const newConfig = req.body;
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    res.json(newConfig);
  } catch (error) {
    res.status(500).json({ error: 'Error updating configuration' });
  }
});

// Export/Import Routes
app.post('/api/export', authenticateToken, (req, res) => {
  try {
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const exportFileName = `export-${Date.now()}.json`;
    const exportPath = path.join(exportDir, exportFileName);

    // Get all user data
    db.serialize(() => {
      db.all('SELECT * FROM categories WHERE user_id = ?', [req.user.id], (err, categories) => {
        if (err) throw err;
        db.all('SELECT * FROM entries WHERE user_id = ?', [req.user.id], (err, entries) => {
          if (err) throw err;
          
          const exportData = {
            categories,
            entries,
            exportDate: new Date().toISOString(),
            deviceId: req.body.deviceId
          };

          fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
          res.download(exportPath);
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error exporting data' });
  }
});

app.post('/api/import', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const importData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    
    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // Import categories
        importData.categories.forEach(category => {
          db.run('INSERT OR REPLACE INTO categories (id, name, icon, color, user_id) VALUES (?, ?, ?, ?, ?)',
            [category.id, category.name, category.icon, category.color, req.user.id]);
        });

        // Import entries
        importData.entries.forEach(entry => {
          db.run('INSERT OR REPLACE INTO entries (id, title, description, wisdom, category_id, tags, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [entry.id, entry.title, entry.description, entry.wisdom, entry.category_id, entry.tags, req.user.id, entry.created_at, entry.updated_at]);
        });

        db.run('COMMIT');
        res.json({ message: 'Import successful' });
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error importing data' });
  } finally {
    // Clean up the uploaded file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Asset Types Routes
app.get('/api/asset-types', authenticateToken, (req, res) => {
  db.all('SELECT * FROM asset_types WHERE user_id = ?', [req.user.id], (err, types) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // Parse fields from string to array for each type
    const parsedTypes = types.map(type => ({
      ...type,
      fields: typeof type.fields === 'string' ? JSON.parse(type.fields) : type.fields
    }));
    res.json(parsedTypes);
  });
});

app.post('/api/asset-types', authenticateToken, (req, res) => {
  const { name, fields } = req.body;
  const typeId = uuidv4();
  
  db.run('INSERT INTO asset_types (id, name, fields, user_id) VALUES (?, ?, ?, ?)',
    [typeId, name, JSON.stringify(fields), req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: typeId, name, fields });
    }
  );
});

app.put('/api/asset-types/:id', authenticateToken, (req, res) => {
  const { name, fields } = req.body;
  const typeId = req.params.id;
  
  db.run('UPDATE asset_types SET name = ?, fields = ? WHERE id = ? AND user_id = ?',
    [name, JSON.stringify(fields), typeId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Asset type not found' });
      res.json({ id: typeId, name, fields });
    }
  );
});

app.delete('/api/asset-types/:id', authenticateToken, (req, res) => {
  const typeId = req.params.id;
  
  db.run('DELETE FROM asset_types WHERE id = ? AND user_id = ?',
    [typeId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Asset type not found' });
      res.json({ message: 'Asset type deleted successfully' });
    }
  );
});

// Get a single asset type by ID
app.get('/api/asset-types/:id', authenticateToken, (req, res) => {
  const typeId = req.params.id;
  db.get('SELECT * FROM asset_types WHERE id = ? AND user_id = ?', [typeId, req.user.id], (err, type) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!type) return res.status(404).json({ error: 'Asset type not found' });
    // Parse fields from string to array
    type.fields = typeof type.fields === 'string' ? JSON.parse(type.fields) : type.fields;
    res.json(type);
  });
});

// Assets Routes
app.get('/api/assets', authenticateToken, (req, res) => {
  const { type_id } = req.query;
  let query = 'SELECT * FROM assets WHERE user_id = ?';
  const params = [req.user.id];

  if (type_id) {
    query += ' AND type_id = ?';
    params.push(type_id);
  }

  db.all(query, params, (err, assets) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // Parse fields from string to object for each asset
    const parsedAssets = assets.map(asset => ({
      ...asset,
      fields: typeof asset.fields === 'string' ? JSON.parse(asset.fields) : asset.fields
    }));
    res.json(parsedAssets);
  });
});

app.post('/api/assets', authenticateToken, (req, res) => {
  const { type_id, fields } = req.body;
  const assetId = uuidv4();
  const now = new Date().toISOString();

  db.run('INSERT INTO assets (id, type_id, fields, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [assetId, type_id, JSON.stringify(fields), req.user.id, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: assetId, type_id, fields, created_at: now, updated_at: now });
    }
  );
});

app.put('/api/assets/:id', authenticateToken, (req, res) => {
  const { fields } = req.body;
  const assetId = req.params.id;
  const now = new Date().toISOString();

  db.run('UPDATE assets SET fields = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [JSON.stringify(fields), now, assetId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Asset not found' });
      res.json({ id: assetId, fields, updated_at: now });
    }
  );
});

app.delete('/api/assets/:id', authenticateToken, (req, res) => {
  const assetId = req.params.id;
  
  db.run('DELETE FROM assets WHERE id = ? AND user_id = ?',
    [assetId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Asset not found' });
      res.json({ message: 'Asset deleted successfully' });
    }
  );
});

// CSV Export Route
app.get('/api/assets/export/:type_id', authenticateToken, (req, res) => {
  const typeId = req.params.type_id;
  
  db.get('SELECT * FROM asset_types WHERE id = ? AND user_id = ?', [typeId, req.user.id], (err, type) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!type) return res.status(404).json({ error: 'Asset type not found' });

    db.all('SELECT * FROM assets WHERE type_id = ? AND user_id = ?', [typeId, req.user.id], (err, assets) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      // Create CSV content
      const fields = JSON.parse(type.fields);
      const csvHeader = ['id', 'created_at', 'updated_at', ...fields.map(f => f.name)].join(',');
      const csvRows = assets.map(asset => {
        const assetFields = JSON.parse(asset.fields);
        return [
          asset.id,
          asset.created_at,
          asset.updated_at,
          ...fields.map(f => assetFields[f.name] || '')
        ].join(',');
      });

      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=assets-${typeId}-${Date.now()}.csv`);
      res.send(csvContent);
    });
  });
});

// Initialize asset tables
function initializeAssetTables() {
  db.serialize(() => {
    // Asset Types table
    db.run(`CREATE TABLE IF NOT EXISTS asset_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fields TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Assets table
    db.run(`CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      fields TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES asset_types(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  });
}

// Call initializeAssetTables after database initialization
initializeDatabase();
initializeAssetTables();

// Theme Routes
app.get('/api/themes', authenticateToken, (req, res) => {
  try {
    const themesPath = path.join(__dirname, 'public', 'themes.json');
    if (!fs.existsSync(themesPath)) {
      const defaultThemes = {
        themes: [
          {
            id: 'light',
            name: 'Light',
            colors: {
              primary: '#3498db',
              secondary: '#2ecc71',
              background: '#ffffff',
              text: '#333333',
              border: '#e0e0e0'
            }
          },
          {
            id: 'dark',
            name: 'Dark',
            colors: {
              primary: '#2980b9',
              secondary: '#27ae60',
              background: '#1a1a1a',
              text: '#ffffff',
              border: '#333333'
            }
          }
        ]
      };
      fs.writeFileSync(themesPath, JSON.stringify(defaultThemes, null, 2));
      return res.json(defaultThemes);
    }
    
    const themes = JSON.parse(fs.readFileSync(themesPath, 'utf8'));
    res.json(themes);
  } catch (error) {
    res.status(500).json({ error: 'Error reading themes' });
  }
});

app.post('/api/themes', authenticateToken, (req, res) => {
  try {
    const themesPath = path.join(__dirname, 'public', 'themes.json');
    const newThemes = req.body;
    fs.writeFileSync(themesPath, JSON.stringify(newThemes, null, 2));
    res.json(newThemes);
  } catch (error) {
    res.status(500).json({ error: 'Error updating themes' });
  }
});

// Web-compatible endpoint to get the current theme
app.get('/api/themes/current', (req, res) => {
    res.json({
        name: 'light',
        colors: {
            'primary-color': '#007bff',
            'secondary-color': '#6c757d',
            'background-color': '#ffffff',
            'text-color': '#222222',
            'border-color': '#e0e0e0',
            'accent-color': '#17a2b8'
        }
    });
});

// Backup Routes
app.get('/api/backup', authenticateToken, (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFileName = `backup-${Date.now()}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    // Get all user data
    db.serialize(() => {
      db.all('SELECT * FROM categories WHERE user_id = ?', [req.user.id], (err, categories) => {
        if (err) throw err;
        db.all('SELECT * FROM entries WHERE user_id = ?', [req.user.id], (err, entries) => {
          if (err) throw err;
          db.all('SELECT * FROM asset_types WHERE user_id = ?', [req.user.id], (err, assetTypes) => {
            if (err) throw err;
            db.all('SELECT * FROM assets WHERE user_id = ?', [req.user.id], (err, assets) => {
              if (err) throw err;
              
              const backupData = {
                categories,
                entries,
                assetTypes,
                assets,
                backupDate: new Date().toISOString(),
                userId: req.user.id
              };

              fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
              res.download(backupPath);
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error creating backup' });
  }
});

app.post('/api/restore', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded' });
    }

    const backupData = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    
    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      try {
        // Restore categories
        backupData.categories.forEach(category => {
          db.run('INSERT OR REPLACE INTO categories (id, name, icon, color, user_id) VALUES (?, ?, ?, ?, ?)',
            [category.id, category.name, category.icon, category.color, req.user.id]);
        });

        // Restore entries
        backupData.entries.forEach(entry => {
          db.run('INSERT OR REPLACE INTO entries (id, title, description, wisdom, category_id, tags, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [entry.id, entry.title, entry.description, entry.wisdom, entry.category_id, entry.tags, req.user.id, entry.created_at, entry.updated_at]);
        });

        // Restore asset types
        backupData.assetTypes.forEach(type => {
          db.run('INSERT OR REPLACE INTO asset_types (id, name, fields, user_id) VALUES (?, ?, ?, ?)',
            [type.id, type.name, type.fields, req.user.id]);
        });

        // Restore assets
        backupData.assets.forEach(asset => {
          db.run('INSERT OR REPLACE INTO assets (id, type_id, fields, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [asset.id, asset.type_id, asset.fields, req.user.id, asset.created_at, asset.updated_at]);
        });

        db.run('COMMIT');
        res.json({ message: 'Restore successful' });
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error restoring backup' });
  } finally {
    // Clean up the uploaded file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Auto-backup functionality
function autoBackup() {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Get all users
  db.all('SELECT id FROM users', [], (err, users) => {
    if (err) {
      console.error('Error getting users for auto-backup:', err);
      return;
    }

    users.forEach(user => {
      const backupFileName = `auto-backup-${user.id}-${Date.now()}.json`;
      const backupPath = path.join(backupDir, backupFileName);

      // Get all user data
      db.serialize(() => {
        db.all('SELECT * FROM categories WHERE user_id = ?', [user.id], (err, categories) => {
          if (err) return;
          db.all('SELECT * FROM entries WHERE user_id = ?', [user.id], (err, entries) => {
            if (err) return;
            db.all('SELECT * FROM asset_types WHERE user_id = ?', [user.id], (err, assetTypes) => {
              if (err) return;
              db.all('SELECT * FROM assets WHERE user_id = ?', [user.id], (err, assets) => {
                if (err) return;
                
                const backupData = {
                  categories,
                  entries,
                  assetTypes,
                  assets,
                  backupDate: new Date().toISOString(),
                  userId: user.id
                };

                fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
              });
            });
          });
        });
      });
    });
  });
}

// Schedule auto-backup every 24 hours
setInterval(autoBackup, 24 * 60 * 60 * 1000);

// File Management Routes
app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;

    // Store file metadata in database
    db.run('INSERT INTO files (name, path, type, size, user_id) VALUES (?, ?, ?, ?, ?)',
      [fileName, filePath, fileType, fileSize, req.user.id],
      function(err) {
        if (err) {
          fs.unlinkSync(filePath); // Clean up file if database insert fails
          throw err;
        }
        res.json({
          id: this.lastID,
          name: fileName,
          type: fileType,
          size: fileSize
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error uploading file' });
  }
});

app.get('/api/files/:id', authenticateToken, (req, res) => {
  db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, file) => {
    if (err || !file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(file.path, file.name);
  });
});

app.delete('/api/files/:id', authenticateToken, (req, res) => {
  db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, file) => {
    if (err || !file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete file from filesystem
    fs.unlink(file.path, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error deleting file' });
      }

      // Delete file record from database
      db.run('DELETE FROM files WHERE id = ?', [req.params.id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Error deleting file record' });
        }
        res.json({ message: 'File deleted successfully' });
      });
    });
  });
});

// Initialize files table
db.run(`CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Notification Routes
app.get('/api/notifications', authenticateToken, (req, res) => {
  db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, notifications) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching notifications' });
    }
    res.json(notifications);
  });
});

app.post('/api/notifications', authenticateToken, (req, res) => {
  const { title, message, type } = req.body;
  
  db.run('INSERT INTO notifications (title, message, type, user_id) VALUES (?, ?, ?, ?)',
    [title, message, type, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error creating notification' });
      }
      res.json({
        id: this.lastID,
        title,
        message,
        type,
        created_at: new Date().toISOString()
      });
    }
  );
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error marking notification as read' });
      }
      res.json({ message: 'Notification marked as read' });
    }
  );
});

app.delete('/api/notifications/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting notification' });
      }
      res.json({ message: 'Notification deleted successfully' });
    }
  );
});

// Initialize notifications table
db.run(`CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Templates Routes
app.get('/api/templates', authenticateToken, (req, res) => {
  db.all('SELECT * FROM templates WHERE user_id = ?', [req.user.id], (err, templates) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(templates);
  });
});

app.post('/api/templates', authenticateToken, (req, res) => {
  const { name, content, description, tags } = req.body;
  const templateId = uuidv4();
  
  db.run('INSERT INTO templates (id, name, content, description, tags, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [templateId, name, content, description, tags, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: templateId, name, content, description, tags });
    }
  );
});

app.put('/api/templates/:id', authenticateToken, (req, res) => {
  const { name, content, description, tags } = req.body;
  const templateId = req.params.id;
  
  db.run('UPDATE templates SET name = ?, content = ?, description = ?, tags = ? WHERE id = ? AND user_id = ?',
    [name, content, description, tags, templateId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Template not found' });
      res.json({ id: templateId, name, content, description, tags });
    }
  );
});

app.delete('/api/templates/:id', authenticateToken, (req, res) => {
  const templateId = req.params.id;
  
  db.run('DELETE FROM templates WHERE id = ? AND user_id = ?',
    [templateId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Template not found' });
      res.json({ message: 'Template deleted successfully' });
    }
  );
});

// Guide Routes
app.get('/api/guides', authenticateToken, (req, res) => {
  db.all('SELECT * FROM guides WHERE user_id = ? OR is_public = 1', [req.user.id], (err, guides) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(guides);
  });
});

app.post('/api/guides', authenticateToken, (req, res) => {
  const { title, content, category_id, is_public, tags } = req.body;
  const guideId = uuidv4();
  
  db.run('INSERT INTO guides (id, title, content, category_id, is_public, tags, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [guideId, title, content, category_id, is_public, tags, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: guideId, title, content, category_id, is_public, tags });
    }
  );
});

app.put('/api/guides/:id', authenticateToken, (req, res) => {
  const { title, content, category_id, is_public, tags } = req.body;
  const guideId = req.params.id;
  
  db.run('UPDATE guides SET title = ?, content = ?, category_id = ?, is_public = ?, tags = ? WHERE id = ? AND user_id = ?',
    [title, content, category_id, is_public, tags, guideId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Guide not found' });
      res.json({ id: guideId, title, content, category_id, is_public, tags });
    }
  );
});

app.delete('/api/guides/:id', authenticateToken, (req, res) => {
  const guideId = req.params.id;
  
  db.run('DELETE FROM guides WHERE id = ? AND user_id = ?',
    [guideId, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Guide not found' });
      res.json({ message: 'Guide deleted successfully' });
    }
  );
});

// Help Articles Routes
app.get('/api/help', authenticateToken, (req, res) => {
  db.all('SELECT * FROM help_articles WHERE is_published = 1 ORDER BY category, title', [], (err, articles) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(articles);
  });
});

app.get('/api/help/search', authenticateToken, (req, res) => {
  const { query } = req.query;
  
  db.all('SELECT * FROM help_articles WHERE is_published = 1 AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)',
    [`%${query}%`, `%${query}%`, `%${query}%`],
    (err, articles) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(articles);
    }
  );
});

// Initialize new tables
db.serialize(() => {
  // Templates table
  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Guides table
  db.run(`CREATE TABLE IF NOT EXISTS guides (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id TEXT,
    is_public INTEGER DEFAULT 0,
    tags TEXT,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Help Articles table
  db.run(`CREATE TABLE IF NOT EXISTS help_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT,
    is_published INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Initialize sections table
db.run(`CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    is_guide INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

// Initialize default sections if table is empty
db.get('SELECT COUNT(*) as count FROM sections', (err, row) => {
    if (err) {
        console.error('Error checking sections:', err);
        return;
    }
    
    if (row.count === 0) {
        const defaultSections = [
            { id: 'guide', name: 'The Guide', icon: 'fa-book', is_guide: 1 },
            { id: 'templates', name: 'Templates', icon: 'fa-file-alt', is_guide: 0 },
            { id: 'assets', name: 'Asset Manager', icon: 'fa-database', is_guide: 0 },
            { id: 'help', name: 'Help', icon: 'fa-question-circle', is_guide: 0 }
        ];
        
        const stmt = db.prepare('INSERT INTO sections (id, name, icon, is_guide) VALUES (?, ?, ?, ?)');
        defaultSections.forEach(section => {
            stmt.run([section.id, section.name, section.icon, section.is_guide]);
        });
        stmt.finalize();
    }
});

// Section management routes
app.get('/api/sections', authenticateToken, (req, res) => {
    db.all('SELECT * FROM sections ORDER BY created_at', (err, sections) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching sections' });
        }
        res.json(sections.map(section => ({
            ...section,
            isGuide: section.is_guide === 1
        })));
    });
});

app.post('/api/sections/current', authenticateToken, (req, res) => {
    const { sectionId } = req.body;
    
    db.get('SELECT * FROM sections WHERE id = ?', [sectionId], (err, section) => {
        if (err) {
            return res.status(500).json({ error: 'Error checking section' });
        }
        if (!section) {
            return res.status(400).json({ error: 'Invalid section ID' });
        }
        
        // Update user's current section in the database
        db.run('UPDATE users SET current_section = ? WHERE id = ?', 
            [sectionId, req.user.id], 
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error updating current section' });
                }
                res.json({ success: true, currentSection: sectionId });
            }
        );
    });
});

app.post('/api/sections/guide-dropdown', authenticateToken, (req, res) => {
    const { isOpen } = req.body;
    
    // Update user's guide dropdown state in the database
    db.run('UPDATE users SET guide_dropdown_open = ? WHERE id = ?', 
        [isOpen ? 1 : 0, req.user.id], 
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error updating guide dropdown state' });
            }
            res.json({ success: true, guideDropdownOpen: isOpen });
        }
    );
});

// Dashboard endpoint
app.get('/api/dashboard', authenticateToken, (req, res) => {
    // Return mock data for now
    res.json({
        total_entries: 0,
        total_categories: 0,
        total_files: 0,
        total_views: 0,
        recent_entries: [],
        popular_categories: []
    });
});

// Get user state (current section, guide dropdown)
app.get('/api/sections/get-user-state', authenticateToken, (req, res) => {
    // Return mock state for now
    res.json({
        currentSection: 'guide',
        guideDropdownOpen: true
    });
});

// Toggle guide dropdown
app.post('/api/sections/toggle-guide-dropdown', authenticateToken, (req, res) => {
    // Accept isOpen in body, just echo back for now
    const { isOpen } = req.body;
    res.json({ success: true, guideDropdownOpen: isOpen });
});

// Set current section
app.post('/api/sections/set-current-section', authenticateToken, (req, res) => {
    const { sectionId } = req.body;
    res.json({ success: true, currentSection: sectionId });
});

// One-time cleanup: ensure all asset_types.fields are valid JSON arrays
// This can be removed after running once
try {
  db.all('SELECT id, fields FROM asset_types', [], (err, types) => {
    if (err) {
      console.error('Error during asset_types cleanup:', err);
      return;
    }
    types.forEach(type => {
      if (typeof type.fields === 'string') {
        try {
          const parsed = JSON.parse(type.fields);
          if (!Array.isArray(parsed)) throw new Error('Not an array');
          // Re-save to ensure valid JSON array
          db.run('UPDATE asset_types SET fields = ? WHERE id = ?', [JSON.stringify(parsed), type.id], err => {
            if (err) {
              console.error(`Failed to update asset_type ${type.id}:`, err);
            } else {
              console.log(`Cleaned asset_type ${type.id}`);
            }
          });
        } catch (e) {
          console.error(`Invalid fields for asset_type ${type.id}:`, e);
        }
      }
    });
  });
} catch (e) {
  console.error('Cleanup script error:', e);
}

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 