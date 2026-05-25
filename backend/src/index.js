require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes     = require('./routes/auth');
const usersRoutes    = require('./routes/users');
const projectsRoutes = require('./routes/projects');
const ticketsRoutes  = require('./routes/tickets');
const qbrRoutes      = require('./routes/qbr');
const filesRoutes    = require('./routes/files');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',     authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tickets',  ticketsRoutes);
app.use('/api/qbr',      qbrRoutes);
app.use('/api/files',    filesRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, () => {
  console.log(`✅ Reailize Portal Backend corriendo en http://localhost:${PORT}`);
});
