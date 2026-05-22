import { useState, useEffect, useCallback } from 'react';
import Login        from './components/Login.jsx';
import Sidebar      from './components/Sidebar.jsx';
import DataIngestion from './components/sections/DataIngestion.jsx';
import QBRConfig    from './components/sections/QBRConfig.jsx';
import QBRGenerator from './components/sections/QBRGenerator.jsx';
import UserProfile  from './components/sections/UserProfile.jsx';
import UserAdmin    from './components/sections/UserAdmin.jsx';

// ── Design tokens ──────────────────────────────────────────
export const T = {
  PANEL:   '#13131a',
  PANEL2:  '#1a1a24',
  BORDER:  '#2a2a38',
  MUTED:   '#6b6b80',
  INK:     '#f0f0f5',
  ACCENT:  '#F40085',
  CYAN:    '#7AD0E2',
  GRAY:    '#4D4D4D',
  LGRAY:   '#AFAEAF',
  SUCCESS: '#00d084',
  WARN:    '#ffb800',
  DANGER:  '#ff4444',
  BG:      '#0d0d0d',
};

// ── Custom cursor ──────────────────────────────────────────
function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const move = (e) => { setPos({ x: e.clientX, y: e.clientY }); setVisible(true); };
    const hide  = () => setVisible(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseleave', hide);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseleave', hide); };
  }, []);

  if (!visible) return null;
  return (
    <>
      {/* Halo */}
      <div style={{
        position: 'fixed', left: pos.x, top: pos.y, width: 32, height: 32,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%', pointerEvents: 'none', zIndex: 99998,
        background: 'radial-gradient(circle, rgba(244,0,133,0) 15%, rgba(244,0,133,0.20) 40%, rgba(244,0,133,0.07) 65%, rgba(244,0,133,0) 100%)',
      }} />
      {/* Dot */}
      <div style={{
        position: 'fixed', left: pos.x, top: pos.y, width: 8, height: 8,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%', background: T.ACCENT, pointerEvents: 'none', zIndex: 99999,
      }} />
    </>
  );
}

// ── API helper ─────────────────────────────────────────────
export async function api(path, options = {}) {
  const token = localStorage.getItem('rz_token');
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error || 'Error del servidor');
  }
  return res.json();
}

export async function apiBlob(path, options = {}) {
  const token = localStorage.getItem('rz_token');
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error('Error al exportar');
  return res.blob();
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [section, setSection]   = useState('data');
  const [project, setProject]   = useState(null);

  // Restore session on load
  useEffect(() => {
    const token = localStorage.getItem('rz_token');
    if (!token) { setLoading(false); return; }
    api('/auth/me')
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => { localStorage.removeItem('rz_token'); setLoading(false); });
  }, []);

  const handleLogin = useCallback((userData, token) => {
    localStorage.setItem('rz_token', token);
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('rz_token');
    setUser(null);
    setProject(null);
    setSection('data');
  }, []);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: T.BG }}>
        <span style={{ color: T.MUTED, fontFamily: 'Inter, sans-serif', fontSize: 16 }}>Cargando…</span>
        <CustomCursor />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <CustomCursor />
      </>
    );
  }

  const renderSection = () => {
    switch (section) {
      case 'data':    return <DataIngestion user={user} project={project} />;
      case 'qbrconf': return <QBRConfig     user={user} project={project} />;
      case 'qbrgen':  return <QBRGenerator  user={user} project={project} />;
      case 'profile': return <UserProfile   user={user} onUpdate={setUser} onLogout={handleLogout} />;
      case 'admin':   return <UserAdmin     user={user} />;
      default:        return <DataIngestion user={user} project={project} />;
    }
  };

  return (
    <>
      <CustomCursor />
      <div style={{ display:'flex', height:'100vh', background: T.BG, overflow:'hidden' }}>
        <Sidebar
          user={user}
          section={section}
          setSection={setSection}
          project={project}
          setProject={setProject}
          onLogout={handleLogout}
        />
        <main style={{
          flex: 1, overflowY: 'auto', padding: '2rem',
          background: T.BG, minWidth: 0,
        }}>
          {renderSection()}
        </main>
      </div>
    </>
  );
}
