const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'notebook.db'));

// Initialize database tables
db.serialize(() => {
  // AssetTypes table
  db.run(`CREATE TABLE IF NOT EXISTS AssetTypes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fields TEXT NOT NULL,
    default_sort_field TEXT,
    default_sort_asc INTEGER
  )`);

  // Assets table
  db.run(`CREATE TABLE IF NOT EXISTS Assets (
    id TEXT PRIMARY KEY,
    type_id TEXT NOT NULL,
    field_values TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  )`);
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// API Routes
app.get('/api/asset-types', async (req, res) => {
  db.all('SELECT * FROM AssetTypes', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => ({
      ...row,
      fields: JSON.parse(row.fields),
      default_sort_asc: row.default_sort_asc === 1
    })));
  });
});

app.post('/api/asset-types', async (req, res) => {
  const { name, fields, default_sort_field, default_sort_asc } = req.body;
  const id = uuidv4();
  
  db.run('INSERT INTO AssetTypes (id, name, fields, default_sort_field, default_sort_asc) VALUES (?, ?, ?, ?, ?)',
    [id, name, JSON.stringify(fields), default_sort_field, default_sort_asc ? 1 : 0],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, fields, default_sort_field, default_sort_asc });
    }
  );
});

app.get('/api/assets/:typeId', async (req, res) => {
  const { typeId } = req.params;
  
  db.all('SELECT * FROM Assets WHERE type_id = ?', [typeId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => ({
      ...row,
      field_values: JSON.parse(row.field_values)
    })));
  });
});

app.post('/api/assets', async (req, res) => {
  const { type_id, field_values } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.run('INSERT INTO Assets (id, type_id, field_values, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, type_id, JSON.stringify(field_values), now, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, type_id, field_values, created_at: now, updated_at: now });
    }
  );
});

// File upload endpoint
app.post('/api/files', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  res.json({
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 