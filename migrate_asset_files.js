const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('notebook.db');

db.serialize(() => {
  db.all('SELECT id, fields FROM assets', [], (err, rows) => {
    if (err) throw err;

    rows.forEach(row => {
      let fields;
      try {
        fields = typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields;
      } catch (e) {
        console.error('Skipping asset with invalid fields:', row.id);
        return;
      }

      let changed = false;
      for (const key in fields) {
        const val = fields[key];
        // If it's a string and looks like a file path, convert it
        if (typeof val === 'string' && (val.includes('/') || val.includes('\\'))) {
          const fileName = val.split('/').pop().split('\\').pop();
          fields[key] = { path: val, name: fileName };
          changed = true;
        }
      }

      if (changed) {
        db.run('UPDATE assets SET fields = ? WHERE id = ?', [JSON.stringify(fields), row.id], err => {
          if (err) console.error('Failed to update asset', row.id, err);
          else console.log('Updated asset', row.id);
        });
      }
    });
  });
});

console.log('Migration script complete. You can delete this file after running.'); 