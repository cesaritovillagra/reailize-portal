const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../db/pool');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — admin only
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, lastname, email, username, role, active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/users — admin only
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, lastname, email, username, password, role } = req.body;
  if (!name || !lastname || !email || !username || !password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, lastname, email, username, password, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, lastname, email, username, role',
      [name, lastname, email, username, hashed, role || 'user']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Usuario o email ya existe' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/users/:id — admin only
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, lastname, email, username, role, active } = req.body;
  try {
    await pool.query(
      'UPDATE users SET name=$1, lastname=$2, email=$3, username=$4, role=$5, active=$6, updated_at=NOW() WHERE id=$7',
      [name, lastname, email, username, role, active, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE users SET active=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

module.exports = router;
