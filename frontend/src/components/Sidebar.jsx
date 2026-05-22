import { useState } from 'react';
import { T } from '../App.jsx';
import { t } from '../i18n.js';

export default function Sidebar({ user, section, setSection, project, setProject, onLogout, lang, onLangChange }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const NAV_ITEMS = [
    { key: 'projects', label: t(lang, 'projectsMenu'), icon: '📁' },
    { key: 'data',     label: t(lang, 'dataIngestion'), icon: '📥' },
    { key: 'qbrconf',  label: t(lang, 'qbrConfig'),     icon: '⚙️'  },
    { key: 'qbrgen',   label: t(lang, 'qbrGenerator'),  icon: '📊' },
  ];

  const ADMIN_ITEMS = [
    { key: 'admin', label: t(lang, 'userManagement'), icon: '🔧' },
  ];

  // Sections that require a project selected
  const PROJECT_REQUIRED = ['data', 'qbrconf', 'qbrgen'];

  const handleNav = (key) => {
    if (PROJECT_REQUIRED.includes(key) && !project) {
      setSection('projects');
    } else {
      setSection(key);
    }
  };

  const s = (key) => {
    const isActive  = section === key;
    const isHovered = hoveredItem === key && !isActive;
    return {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0.65rem 1rem', borderRadius: 8, marginBottom: 2, cursor: 'default',
      background: isActive  ? `rgba(244,0,133,0.12)`
                : isHovered ? `rgba(244,0,133,0.06)`
                : 'transparent',
      color: isActive ? T.ACCENT : T.INK,
      borderLeft: isActive  ? `2px solid ${T.ACCENT}`
                : isHovered ? `2px solid rgba(244,0,133,0.35)`
                : '2px solid transparent',
      fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13,
      transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    };
  };

  return (
    <aside style={{
      width: 240, minWidth: 240, background: T.PANEL,
      borderRight: `1px solid ${T.BORDER}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '1.2rem 1.2rem 1rem', borderBottom: `1px solid ${T.BORDER}`,
        display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <img
          src="/logo.png"
          alt="Reailize"
          style={{ height: 32, width: 'auto', display: 'block', filter: 'invert(1) hue-rotate(180deg)' }}
        />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.8rem 0.8rem 0' }}>
        <div style={{ color: T.MUTED, fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: 0.8, padding: '0.4rem 1rem 0.4rem', marginBottom: 4 }}>
          {t(lang, 'menu')}
        </div>
        {NAV_ITEMS.map(item => (
          <div key={item.key}
            onClick={() => handleNav(item.key)}
            onMouseEnter={() => setHoveredItem(item.key)}
            onMouseLeave={() => setHoveredItem(null)}
            style={s(item.key)}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}

        {user?.role === 'admin' && (
          <>
            <div style={{ height: 1, background: T.BORDER, margin: '0.8rem 0.5rem' }} />
            <div style={{ color: T.MUTED, fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: 0.8, padding: '0.4rem 1rem 0.4rem', marginBottom: 4 }}>
              {t(lang, 'administration')}
            </div>
            {ADMIN_ITEMS.map(item => (
              <div key={item.key}
                onClick={() => setSection(item.key)}
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
                style={s(item.key)}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div style={{ borderTop: `1px solid ${T.BORDER}`, padding: '0.8rem' }}>

        {/* Active project indicator */}
        {project && (
          <div style={{
            marginBottom: '0.6rem', padding: '0.5rem 0.8rem',
            background: `rgba(244,0,133,0.06)`,
            border: `1px solid rgba(244,0,133,0.2)`,
            borderRadius: 8, borderLeft: `2px solid ${T.ACCENT}`,
          }}>
            <div style={{ color: T.MUTED, fontSize: 10, fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: 0.5, marginBottom: 2 }}>
              {t(lang, 'activeProjectLabel')}
            </div>
            <div style={{ color: T.ACCENT, fontSize: 12, fontFamily: 'Inter, sans-serif',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📁 {project.name}
            </div>
          </div>
        )}

        {/* Language toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '0.6rem', padding: '0 0.2rem' }}>
          <span style={{ color: T.MUTED, fontSize: 11, fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: 0.5 }}>
            {t(lang, 'language')}
          </span>
          <div style={{ display: 'flex', background: T.PANEL2, borderRadius: 99,
            border: `1px solid ${T.BORDER}`, overflow: 'hidden' }}>
            {['es', 'en'].map(l => (
              <button key={l} onClick={() => onLangChange(l)}
                style={{
                  background: lang === l ? T.ACCENT : 'transparent',
                  border: 'none', padding: '3px 10px', fontSize: 11, fontWeight: 700,
                  color: lang === l ? '#fff' : T.MUTED,
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: 'all 0.15s', borderRadius: 99,
                }}>
                {l === 'es' ? '🇦🇷 ES' : '🇺🇸 EN'}
              </button>
            ))}
          </div>
        </div>

        {/* User card */}
        <div
          onClick={() => setSection('profile')}
          onMouseEnter={() => setHoveredItem('__profile__')}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.8rem',
            borderRadius: 8,
            background: section === 'profile'
              ? `rgba(244,0,133,0.12)`
              : hoveredItem === '__profile__'
              ? `rgba(244,0,133,0.06)`
              : T.PANEL2,
            border: `1px solid ${
              section === 'profile'
                ? T.ACCENT
                : hoveredItem === '__profile__'
                ? `rgba(244,0,133,0.35)`
                : T.BORDER
            }`,
            transition: 'background 0.15s, border-color 0.15s',
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
            <div style={{ color: T.MUTED, fontSize: 11, textTransform: 'capitalize' }}>
              {user.role === 'admin' ? t(lang, 'admin').replace('⭐ ', '') : t(lang, 'user').replace('👤 ', '')}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
