import { useState } from 'react';
import { T, api } from '../../App.jsx';

function EyeIcon({ open }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  const [show, setShow] = useState(false);
  const isPass = type === 'password';
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
        fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </label>
      <div style={{ position: 'relative' }}>
        <input type={isPass && !show ? 'password' : 'text'} value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
            borderRadius: 8, padding: isPass ? '0.7rem 2.8rem 0.7rem 1rem' : '0.7rem 1rem',
            color: T.INK, fontSize: 14, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
        {isPass && (
          <button type="button" onClick={() => setShow(v => !v)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: T.MUTED, padding: 0, lineHeight: 0 }}>
            <EyeIcon open={show} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function UserProfile({ user, onUpdate, onLogout }) {
  const [name, setName]         = useState(user.name || '');
  const [lastname, setLastname] = useState(user.lastname || '');
  const [email, setEmail]       = useState(user.email || '');
  const [username, setUsername] = useState(user.username || '');
  const [saving, setSaving]     = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError]     = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [savingPass, setSavingPass]   = useState(false);

  const saveProfile = async () => {
    setSaving(true); setProfileError(''); setSavedMsg('');
    try {
      await api('/auth/profile', { method: 'PUT', body: { name, lastname, email, username } });
      onUpdate({ ...user, name, lastname, email, username });
      setSavedMsg('Perfil actualizado correctamente');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPassError(''); setPassSuccess('');
    if (newPass.length < 8) {
      setPassError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('Las contraseñas no coinciden. Por favor verificá e intentá de nuevo.');
      return;
    }
    setSavingPass(true);
    try {
      await api('/auth/password', { method: 'PUT', body: { currentPassword: currentPass, newPassword: newPass } });
      setPassSuccess('¡Contraseña cambiada correctamente!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      setTimeout(() => setPassSuccess(''), 4000);
    } catch (err) {
      setPassError(err.message);
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="fadeUp" style={{ maxWidth: 600 }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: '1.5rem' }}>
        Mi Perfil
      </h1>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 24, fontFamily: "'Space Grotesk', sans-serif" }}>
          {name?.[0]}{lastname?.[0]}
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 18 }}>
            {name} {lastname}
          </div>
          <div style={{ color: T.MUTED, fontSize: 13 }}>{email}</div>
          <div style={{ color: T.CYAN, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
            {user.role === 'admin' ? '⭐ Administrador' : '👤 Usuario'}
          </div>
        </div>
      </div>

      {/* Personal data */}
      <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: '1.2rem' }}>
          Datos personales
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Nombre" value={name} onChange={setName} />
          <Input label="Apellido" value={lastname} onChange={setLastname} />
          <Input label="Email" value={email} onChange={setEmail} />
          <Input label="Usuario de login" value={username} onChange={setUsername} />
        </div>
        {profileError && (
          <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
            borderRadius: 8, padding: '0.6rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: 10 }}>
            {profileError}
          </div>
        )}
        {savedMsg && (
          <div style={{ background: 'rgba(0,208,132,0.1)', border: `1px solid ${T.SUCCESS}`,
            borderRadius: 8, padding: '0.6rem 1rem', color: T.SUCCESS, fontSize: 13, marginBottom: 10 }}>
            {savedMsg}
          </div>
        )}
        <button onClick={saveProfile} disabled={saving}
          style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
            color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
            fontSize: 14, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Guardando…' : '💾 Guardar cambios'}
        </button>
      </div>

      {/* Change password */}
      <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: '1.2rem' }}>
          Cambiar contraseña
        </h3>
        <Input label="Contraseña actual" value={currentPass} onChange={setCurrentPass} type="password" />
        <Input label="Nueva contraseña" value={newPass} onChange={setNewPass} type="password" />
        <Input label="Repetir nueva contraseña" value={confirmPass} onChange={setConfirmPass} type="password" />
        {confirmPass && newPass && confirmPass !== newPass && (
          <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
            borderRadius: 8, padding: '0.6rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: 10 }}>
            Las contraseñas no coinciden. Por favor verificá e intentá de nuevo.
          </div>
        )}
        {passError && (
          <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
            borderRadius: 8, padding: '0.6rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: 10 }}>
            {passError}
          </div>
        )}
        {passSuccess && (
          <div style={{ background: 'rgba(0,208,132,0.1)', border: `1px solid ${T.SUCCESS}`,
            borderRadius: 8, padding: '0.6rem 1rem', color: T.SUCCESS, fontSize: 13, marginBottom: 10 }}>
            {passSuccess}
          </div>
        )}
        <button onClick={changePassword} disabled={savingPass || !currentPass || !newPass || !confirmPass}
          style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
            color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
            fontSize: 14, opacity: (savingPass || !currentPass) ? 0.6 : 1 }}>
          {savingPass ? 'Cambiando…' : '🔒 Cambiar contraseña'}
        </button>
      </div>

      {/* Logout */}
      <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: 6 }}>
          Sesión
        </h3>
        <p style={{ color: T.MUTED, fontSize: 13, marginBottom: '1rem' }}>
          Al cerrar sesión, vas a ser redirigido a la pantalla de login.
        </p>
        <div style={{ height: 1, background: T.BORDER, marginBottom: '1rem' }} />
        <button onClick={onLogout}
          style={{ background: 'none', border: `1px solid ${T.DANGER}`, borderRadius: 8,
            padding: '0.7rem 1.5rem', color: T.DANGER,
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </div>
  );
}
