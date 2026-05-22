import { useState } from 'react';
import { T, api } from '../App.jsx';
import { t } from '../i18n.js';

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [lang, setLang]         = useState('es');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { username, password }
      });
      onLogin(res.user, res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#000000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div className="fadeUp" style={{
        background: T.PANEL, border: `1px solid ${T.BORDER}`,
        borderRadius: 14, padding: '2.5rem', width: '100%', maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/logo.png"
            alt="Reailize"
            style={{ height: 48, width: 'auto', display: 'inline-block', filter: 'invert(1) hue-rotate(180deg)' }}
          />
          <div style={{ color: T.MUTED, fontSize: 13, marginTop: 8 }}>{t(lang, 'portalManagement')}</div>
        </div>

        {/* Language toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
          <div style={{ display: 'flex', background: T.PANEL2, borderRadius: 99,
            border: `1px solid ${T.BORDER}`, overflow: 'hidden' }}>
            {['es', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)}
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

        {/* Divider */}
        <div style={{ height: 1, background: T.BORDER, marginBottom: '2rem' }} />

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <label style={{ display:'block', color: T.MUTED, fontSize: 12, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
            {t(lang, 'username').toUpperCase()}
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={t(lang, 'usernamePlaceholder')}
            required
            style={{
              width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
              borderRadius: 8, padding: '0.75rem 1rem', color: T.INK,
              fontSize: 14, marginBottom: '1.2rem', outline: 'none',
              fontFamily: 'Inter, sans-serif',
            }}
          />

          {/* Password */}
          <label style={{ display:'block', color: T.MUTED, fontSize: 12, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
            {t(lang, 'password').toUpperCase()}
          </label>
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                borderRadius: 8, padding: '0.75rem 2.8rem 0.75rem 1rem', color: T.INK,
                fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: T.MUTED, padding: 0, lineHeight: 0,
              }}
            >
              <EyeIcon open={showPass} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
              borderRadius: 8, padding: '0.7rem 1rem', color: T.DANGER,
              fontSize: 13, marginBottom: '1.2rem',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%', background: T.ACCENT, border: 'none',
              borderRadius: 8, padding: '0.85rem', color: '#fff',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
              fontSize: 15, opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t(lang, 'loggingIn') : t(lang, 'login')}
          </button>
        </form>
      </div>
    </div>
  );
}
