const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE user_id=$1 AND archived=false ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/projects
router.post('/', authMiddleware, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO projects (user_id, name, description) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, name, description || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description } = req.body;
  try {
    await pool.query(
      'UPDATE projects SET name=$1, description=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4',
      [name, description, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/projects/:id (archive)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE projects SET archived=true, updated_at=NOW() WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
