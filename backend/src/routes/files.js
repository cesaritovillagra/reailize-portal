const express = require('express');
const multer  = require('multer');
const xlsx    = require('xlsx');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/files/parse — parse CSV or Excel and return rows as JSON
router.post('/parse', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const ext = req.file.originalname.split('.').pop().toLowerCase();

  try {
    let rows = [];

    if (ext === 'csv') {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return res.json({ rows: [], count: 0 });

      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
        if (!values.some(v => v)) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        rows.push(row);
      }

    } else if (['xlsx', 'xls'].includes(ext)) {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    } else if (ext === 'txt') {
      const text = req.file.buffer.toString('utf-8').trim();
      if (!text) return res.json({ rows: [], count: 0, isTxt: true });
      rows = [{ raw_input: text }];
      return res.json({ rows, count: rows.length, isTxt: true });

    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usá CSV, Excel (.xlsx / .xls) o TXT.' });
    }

    res.json({ rows, count: rows.length, isTxt: false });

  } catch (err) {
    console.error('Error parsing file:', err);
    res.status(500).json({ error: 'Error al procesar el archivo: ' + err.message });
  }
});

module.exports = router;
