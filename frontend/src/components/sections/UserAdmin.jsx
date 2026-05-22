import { useState, useEffect } from 'react';
import { T, api } from '../../App.jsx';

function Badge({ label, color }) {
  return (
    <span style={{ background: `${color}22`, color, borderRadius: 99, padding: '2px 10px',
      fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
      {label}
    </span>
  );
}

const EMPTY = { name: '', lastname: '', email: '', username: '', password: '', role: 'user' };

export default function UserAdmin({ user }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    setLoading(true);
    api('/users').then(u => { setUsers(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const saveUser = async () => {
    setError(''); setSaving(true);
    try {
      if (form.id) {
        await api(`/users/${form.id}`, { method: 'PUT', body: form });
        setUsers(prev => prev.map(u => u.id === form.id ? { ...u, ...form } : u));
        setSuccess('Usuario actualizado');
      } else {
        const created = await api('/users', { method: 'POST', body: form });
        setUsers(prev => [created, ...prev]);
        setSuccess('Usuario creado correctamente');
      }
      setForm(EMPTY); setShowForm(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    if (!confirm('¿Desactivar este usuario? No podrá ingresar al portal.')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, active: false } : u));
    } catch {}
  };

  return (
    <div className="fadeUp">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: 4 }}>
            Gestión de Usuarios
          </h1>
          <div style={{ color: T.MUTED, fontSize: 13 }}>{users.length} usuarios registrados</div>
        </div>
        <button onClick={() => { setForm(EMPTY); setShowForm(true); setError(''); }}
          style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.4rem',
            color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
          ＋ Nuevo usuario
        </button>
      </div>

      {success && (
        <div style={{ background: 'rgba(0,208,132,0.1)', border: `1px solid ${T.SUCCESS}`,
          borderRadius: 8, padding: '0.7rem 1rem', color: T.SUCCESS, fontSize: 13, marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: '1.2rem' }}>
            {form.id ? 'Editar usuario' : 'Crear nuevo usuario'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: '1rem' }}>
            {[['name','Nombre'],['lastname','Apellido'],['email','Email'],['username','Usuario']].map(([key, label]) => (
              <div key={key}>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>{label.toUpperCase()}</label>
                <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                    borderRadius: 6, padding: '0.55rem 0.8rem', color: T.INK, fontSize: 13,
                    fontFamily: 'Inter, sans-serif', outline: 'none' }} />
              </div>
            ))}
            {!form.id && (
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>CONTRASEÑA</label>
                <input type="password" value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                    borderRadius: 6, padding: '0.55rem 0.8rem', color: T.INK, fontSize: 13,
                    fontFamily: 'Inter, sans-serif', outline: 'none' }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>ROL</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                  borderRadius: 6, padding: '0.55rem 0.8rem', color: T.INK, fontSize: 13, outline: 'none' }}>
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          {error && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
              borderRadius: 8, padding: '0.6rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: 10 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveUser} disabled={saving}
              style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem',
                color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
              {saving ? 'Guardando…' : '💾 Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setError(''); }}
              style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                padding: '0.65rem 1.2rem', color: T.MUTED, fontSize: 14 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>Cargando usuarios…</div>
      ) : (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.BORDER}` }}>
                {['Usuario','Nombre','Email','Rol','Estado','Acciones'].map(h => (
                  <th key={h} style={{ padding: '0.8rem 1rem', textAlign: 'left', color: T.MUTED,
                    fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5,
                    fontWeight: 600 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length-1 ? `1px solid ${T.BORDER}` : 'none',
                  background: i % 2 === 0 ? 'transparent' : `${T.PANEL2}50` }}>
                  <td style={{ padding: '0.8rem 1rem', color: T.INK, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                    {u.username}
                  </td>
                  <td style={{ padding: '0.8rem 1rem', color: T.INK, fontSize: 13 }}>
                    {u.name} {u.lastname}
                  </td>
                  <td style={{ padding: '0.8rem 1rem', color: T.MUTED, fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <Badge label={u.role === 'admin' ? '⭐ Admin' : '👤 Usuario'} color={u.role === 'admin' ? T.ACCENT : T.CYAN} />
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <Badge label={u.active ? 'Activo' : 'Inactivo'} color={u.active ? T.SUCCESS : T.MUTED} />
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setForm({ ...u, password: '' }); setShowForm(true); setError(''); }}
                        style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                          color: T.INK, padding: '3px 10px', fontSize: 12 }}>Editar</button>
                      {u.id !== user.id && u.active && (
                        <button onClick={() => deactivate(u.id)}
                          style={{ background: 'none', border: `1px solid ${T.DANGER}33`, borderRadius: 6,
                            color: T.DANGER, padding: '3px 10px', fontSize: 12 }}>Desactivar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
