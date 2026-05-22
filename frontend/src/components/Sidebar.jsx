import { useState, useEffect } from 'react';
import { T, api } from '../App.jsx';

const NAV_ITEMS = [
  { key: 'data',    label: 'Ingesta de Datos',    icon: '📥' },
  { key: 'qbrconf', label: 'Configuración QBR',   icon: '⚙️'  },
  { key: 'qbrgen',  label: 'Generador de QBR',    icon: '📊' },
];

const ADMIN_ITEMS = [
  { key: 'admin', label: 'Gestión de Usuarios', icon: '🔧' },
];

export default function Sidebar({ user, section, setSection, project, setProject, onLogout }) {
  const [projects, setProjects]           = useState([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showNewProject, setShowNewProject]   = useState(false);
  const [newProjectName, setNewProjectName]   = useState('');
  const [showProfile, setShowProfile]     = useState(false);

  useEffect(() => {
    api('/projects').then(p => {
      setProjects(p);
      if (p.length > 0 && !project) setProject(p[0]);
    }).catch(() => {});
  }, []);

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const p = await api('/projects', { method: 'POST', body: { name: newProjectName.trim() } });
      setProjects(prev => [...prev, p]);
      setProject(p);
      setNewProjectName('');
      setShowNewProject(false);
      setShowProjectMenu(false);
    } catch {}
  };

  const s = (key) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0.65rem 1rem', borderRadius: 8, marginBottom: 2,
    background: section === key ? `rgba(244,0,133,0.12)` : 'transparent',
    color: section === key ? T.ACCENT : T.INK,
    borderLeft: section === key ? `2px solid ${T.ACCENT}` : '2px solid transparent',
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: 14,
    transition: 'all 0.15s',
  });

  return (
    <aside style={{
      width: 240, minWidth: 240, background: T.PANEL,
      borderRight: `1px solid ${T.BORDER}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '1.5rem 1.2rem 1rem', borderBottom: `1px solid ${T.BORDER}` }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: -0.5 }}>
          <span style={{ color: T.INK }}>re</span>
          <span style={{ color: T.ACCENT }}>ai</span>
          <span style={{ color: T.INK }}>lize</span>
        </span>
      </div>

      {/* Project selector */}
      <div style={{ padding: '0.8rem 0.8rem 0', position: 'relative' }}>
        <div
          onClick={() => setShowProjectMenu(v => !v)}
          style={{
            background: T.PANEL2, border: `1px solid ${T.BORDER}`,
            borderRadius: 8, padding: '0.6rem 0.9rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: T.INK, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
            📁 {project?.name || 'Seleccioná un proyecto'}
          </span>
          <span style={{ color: T.MUTED, fontSize: 11 }}>▾</span>
        </div>

        {showProjectMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 8, right: 8, zIndex: 100,
            background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
            marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {projects.map(p => (
              <div key={p.id}
                onClick={() => { setProject(p); setShowProjectMenu(false); }}
                style={{
                  padding: '0.6rem 1rem', fontSize: 13, color: project?.id === p.id ? T.ACCENT : T.INK,
                  background: project?.id === p.id ? `rgba(244,0,133,0.08)` : 'transparent',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                📁 {p.name}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${T.BORDER}`, padding: '0.4rem 0.6rem' }}>
              {!showNewProject ? (
                <div
                  onClick={() => setShowNewProject(true)}
                  style={{ padding: '0.5rem 0.4rem', color: T.ACCENT, fontSize: 13,
                    fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  ＋ Nuevo proyecto
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 4, padding: '0.3rem 0' }}>
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createProject()}
                    placeholder="Nombre del proyecto"
                    style={{
                      flex: 1, background: T.PANEL, border: `1px solid ${T.BORDER}`,
                      borderRadius: 6, padding: '0.4rem 0.6rem', color: T.INK,
                      fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  <button onClick={createProject}
                    style={{ background: T.ACCENT, border: 'none', borderRadius: 6,
                      color: '#fff', padding: '0.4rem 0.7rem', fontSize: 12, fontWeight: 700 }}>
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.8rem 0.8rem 0' }}>
        <div style={{ color: T.MUTED, fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: 0.8, padding: '0.4rem 1rem 0.4rem', marginBottom: 4 }}>
          MENÚ
        </div>
        {NAV_ITEMS.map(item => (
          <div key={item.key} onClick={() => setSection(item.key)} style={s(item.key)}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}

        {user?.role === 'admin' && (
          <>
            <div style={{ height: 1, background: T.BORDER, margin: '0.8rem 0.5rem' }} />
            <div style={{ color: T.MUTED, fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: 0.8, padding: '0.4rem 1rem 0.4rem', marginBottom: 4 }}>
              ADMINISTRACIÓN
            </div>
            {ADMIN_ITEMS.map(item => (
              <div key={item.key} onClick={() => setSection(item.key)} style={s(item.key)}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User profile at bottom */}
      <div style={{ borderTop: `1px solid ${T.BORDER}`, padding: '0.8rem' }}>
        <div
          onClick={() => setSection('profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.8rem',
            borderRadius: 8, background: section === 'profile' ? `rgba(244,0,133,0.12)` : T.PANEL2,
            border: `1px solid ${section === 'profile' ? T.ACCENT : T.BORDER}`,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: T.ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 14,
            fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0,
          }}>
            {user.name?.[0]}{user.lastname?.[0]}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: T.INK, fontSize: 13, fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name} {user.lastname}
            </div>
            <div style={{ color: T.MUTED, fontSize: 11, textTransform: 'capitalize' }}>{user.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
