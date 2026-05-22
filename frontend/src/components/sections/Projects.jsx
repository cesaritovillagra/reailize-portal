import { useState, useEffect } from 'react';
import { T, api } from '../../App.jsx';
import { t } from '../../i18n.js';

/* ── Delete confirmation modal ───────────────────────────── */
function DeleteModal({ project, lang, onConfirm, onCancel, deleting }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: T.PANEL, border: `1px solid ${T.DANGER}66`,
        borderRadius: 16, padding: '2rem', maxWidth: 460, width: '100%',
        boxShadow: `0 0 0 1px ${T.DANGER}22, 0 24px 60px rgba(0,0,0,0.7)`,
      }}>
        {/* Title */}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
          fontSize: 18, color: T.INK, marginBottom: '0.5rem' }}>
          {t(lang, 'deleteProjectTitle')}
        </div>

        {/* Project name */}
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: T.MUTED,
          marginBottom: '1.2rem' }}>
          {lang === 'es' ? 'Proyecto' : 'Project'}:{' '}
          <span style={{ color: T.ACCENT, fontWeight: 600 }}>📁 {project.name}</span>
        </div>

        {/* Warning box */}
        <div style={{ background: `rgba(255,68,68,0.07)`, border: `1px solid ${T.DANGER}44`,
          borderRadius: 10, padding: '1rem 1.2rem', marginBottom: '1.5rem' }}>
          <div style={{ color: T.DANGER, fontSize: 13, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif", marginBottom: '0.7rem' }}>
            {t(lang, 'deleteProjectWarning')}
          </div>
          {[
            t(lang, 'deleteProjectWarnTickets'),
            t(lang, 'deleteProjectWarnQBRConfig'),
            t(lang, 'deleteProjectWarnQBRReports'),
          ].map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
              color: T.INK, fontSize: 13, fontFamily: 'Inter, sans-serif',
              marginBottom: i < 2 ? '0.4rem' : 0 }}>
              <span style={{ color: T.DANGER, marginTop: 1 }}>✕</span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={deleting} className="btn-secondary"
            style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
              padding: '0.65rem 1.2rem', color: T.MUTED, fontSize: 14,
              fontFamily: "'Space Grotesk', sans-serif" }}>
            {t(lang, 'cancel')}
          </button>
          <button onClick={onConfirm} disabled={deleting} className="btn-row-danger"
            style={{ background: T.DANGER, border: 'none', borderRadius: 8,
              padding: '0.65rem 1.4rem', color: '#fff', fontSize: 14,
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
              opacity: deleting ? 0.6 : 1 }}>
            {deleting
              ? (lang === 'es' ? 'Borrando…' : 'Deleting…')
              : t(lang, 'deleteProjectConfirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function Projects({ user, project, setProject, lang }) {
  const [projects, setProjects]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [newName, setNewName]           = useState('');
  const [newDesc, setNewDesc]           = useState('');
  const [saving, setSaving]             = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [editName, setEditName]         = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [error, setError]               = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // project to hard-delete
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    api('/projects')
      .then(p => { setProjects(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const createProject = async () => {
    if (!newName.trim()) return;
    setSaving(true); setError('');
    try {
      const p = await api('/projects', { method: 'POST', body: { name: newName.trim(), description: newDesc.trim() } });
      setProjects(prev => [...prev, p]);
      setProject(p);
      setNewName(''); setNewDesc(''); setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) return;
    try {
      await api(`/projects/${id}`, { method: 'PUT', body: { name: editName.trim(), description: editDesc.trim() } });
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name: editName.trim(), description: editDesc.trim() } : p));
      if (project?.id === id) setProject(prev => ({ ...prev, name: editName.trim(), description: editDesc.trim() }));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const archiveProject = async (id) => {
    if (!confirm(t(lang, 'archiveProjectConfirm'))) return;
    try {
      await api(`/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
      if (project?.id === id) setProject(projects.find(p => p.id !== id) || null);
    } catch {}
  };

  const hardDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/projects/${deleteTarget.id}/hard`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
      if (project?.id === deleteTarget.id) setProject(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(lang === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="fadeUp">
      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          lang={lang}
          onConfirm={hardDeleteProject}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: 4 }}>
            {t(lang, 'projectsTitle')}
          </h1>
          <div style={{ color: T.MUTED, fontSize: 13 }}>
            {projects.length} {t(lang, 'projectsCount')}
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.4rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
            {t(lang, 'newProject')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
          borderRadius: 8, padding: '0.7rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: T.DANGER, fontSize: 18 }}>×</button>
        </div>
      )}

      {/* New project form */}
      {showForm && (
        <div style={{ background: T.PANEL, border: `1px solid ${T.ACCENT}44`, borderRadius: 14,
          padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: '1rem' }}>
            {t(lang, 'newProject')}
          </h3>
          <div style={{ marginBottom: '0.9rem' }}>
            <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
              {t(lang, 'projectName').toUpperCase()}
            </label>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder={t(lang, 'projectNamePlaceholder')}
              style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                borderRadius: 8, padding: '0.7rem 1rem', color: T.INK, fontSize: 14,
                fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
              {t(lang, 'projectDesc').toUpperCase()} <span style={{ color: T.MUTED, fontWeight: 400 }}>({t(lang, 'optional')})</span>
            </label>
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder={t(lang, 'projectDescPlaceholder')}
              style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                borderRadius: 8, padding: '0.7rem 1rem', color: T.INK, fontSize: 14,
                fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createProject} disabled={saving || !newName.trim()} className="btn-primary"
              style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
                color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14,
                opacity: saving || !newName.trim() ? 0.6 : 1 }}>
              {saving ? t(lang, 'saving') : t(lang, 'createProjectBtn')}
            </button>
            <button onClick={() => { setShowForm(false); setNewName(''); setNewDesc(''); }} className="btn-secondary"
              style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                padding: '0.7rem 1.2rem', color: T.MUTED, fontSize: 14 }}>
              {t(lang, 'cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Projects list */}
      {loading ? (
        <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>{t(lang, 'loading')}</div>
      ) : projects.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: T.MUTED }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <div style={{ fontSize: 16, color: T.INK, marginBottom: 8 }}>{t(lang, 'noProjects')}</div>
          <div style={{ fontSize: 13 }}>{t(lang, 'noProjectsHint')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const isActive  = project?.id === p.id;
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="ticket-card"
                style={{
                  background: T.PANEL,
                  border: `1px solid ${isActive ? T.ACCENT : T.BORDER}`,
                  borderRadius: 14, padding: '1.2rem',
                  boxShadow: isActive ? `0 0 0 1px ${T.ACCENT}33, 0 4px 20px rgba(244,0,133,0.1)` : 'none',
                  position: 'relative',
                }}>

                {/* Active badge */}
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    background: `rgba(244,0,133,0.15)`, color: T.ACCENT,
                    fontSize: 10, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
                    padding: '2px 8px', borderRadius: 99, letterSpacing: 0.5,
                  }}>
                    {t(lang, 'activeProject')}
                  </div>
                )}

                {isEditing ? (
                  /* Edit mode */
                  <div>
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.ACCENT}`,
                        borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 14,
                        fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: 8 }}
                    />
                    <input
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder={t(lang, 'projectDescPlaceholder')}
                      style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                        borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
                        fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: 10 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => saveEdit(p.id)} className="btn-primary"
                        style={{ background: T.ACCENT, border: 'none', borderRadius: 6,
                          padding: '0.4rem 0.9rem', color: '#fff', fontSize: 12,
                          fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                        {t(lang, 'save')}
                      </button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary"
                        style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                          padding: '0.4rem 0.8rem', color: T.MUTED, fontSize: 12 }}>
                        {t(lang, 'cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <div style={{ marginBottom: 6, paddingRight: isActive ? 72 : 0 }}>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                        fontSize: 15, color: isActive ? T.ACCENT : T.INK, marginBottom: 4 }}>
                        📁 {p.name}
                      </div>
                      {p.description && (
                        <div style={{ color: T.MUTED, fontSize: 12, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                          {p.description}
                        </div>
                      )}
                      <div style={{ color: T.MUTED, fontSize: 11, marginTop: 6 }}>
                        {formatDate(p.created_at)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      {!isActive && (
                        <button onClick={() => setProject(p)} className="btn-primary"
                          style={{ background: T.ACCENT, border: 'none', borderRadius: 6,
                            padding: '0.4rem 0.9rem', color: '#fff', fontSize: 12,
                            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                          {t(lang, 'selectProject2')}
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingId(p.id); setEditName(p.name); setEditDesc(p.description || ''); }}
                        className="btn-row-action"
                        style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                          color: T.MUTED, padding: '0.4rem 0.9rem', fontSize: 12 }}>
                        {t(lang, 'edit')}
                      </button>
                      <button onClick={() => archiveProject(p.id)} className="btn-row-action"
                        style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                          color: T.MUTED, padding: '0.4rem 0.9rem', fontSize: 12 }}>
                        {t(lang, 'archive')}
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="btn-row-danger"
                        style={{ background: 'none', border: `1px solid ${T.DANGER}33`, borderRadius: 6,
                          color: T.DANGER, padding: '0.4rem 0.9rem', fontSize: 12 }}>
                        {t(lang, 'deleteProject')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
