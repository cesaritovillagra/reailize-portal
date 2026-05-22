import { useState, useEffect } from 'react';
import { T, api } from '../../App.jsx';
import { t } from '../../i18n.js';

export default function QBRConfig({ user, project, lang }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api(`/qbr/config?project_id=${project.id}`)
      .then(r => { setContent(r.content); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  const save = async () => {
    if (!project) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await api('/qbr/config', { method: 'PUT', body: { project_id: project.id, content } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!project) {
    return (
      <div className="fadeUp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: T.MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 16 }}>{t(lang, 'selectProjectQBRConfig')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fadeUp">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: 4 }}>
            {t(lang, 'qbrConfigTitle')}
          </h1>
          <div style={{ color: T.MUTED, fontSize: 13 }}>
            {t(lang, 'project')}: <span style={{ color: T.ACCENT }}>{project.name}</span>
            <span style={{ marginLeft: 12, color: T.MUTED }}>·</span>
            <span style={{ marginLeft: 12, color: T.MUTED }}>{t(lang, 'qbrConfigSubtitle')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && (
            <span style={{ color: T.SUCCESS, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
              {t(lang, 'saved')}
            </span>
          )}
          <button onClick={save} disabled={saving || loading} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
              fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? t(lang, 'saving') : t(lang, 'save')}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: `rgba(125,208,226,0.08)`, border: `1px solid rgba(125,208,226,0.25)`,
        borderRadius: 10, padding: '0.9rem 1.2rem', marginBottom: '1.2rem', color: T.CYAN, fontSize: 13,
        lineHeight: 1.6 }}>
        <strong>{t(lang, 'qbrConfigInfoTitle')}</strong> {t(lang, 'qbrConfigInfo')}
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
          borderRadius: 8, padding: '0.8rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>{t(lang, 'loadingConfig')}</div>
      ) : (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem' }}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            style={{
              width: '100%', minHeight: 'calc(100vh - 320px)',
              background: T.PANEL2, border: `1px solid ${T.BORDER}`,
              borderRadius: 8, padding: '1rem 1.2rem', color: T.INK,
              fontSize: 14, fontFamily: 'Inter, sans-serif',
              resize: 'vertical', outline: 'none', lineHeight: 1.8,
            }}
            placeholder={t(lang, 'configPlaceholder')}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem' }}>
            <span style={{ color: T.MUTED, fontSize: 12 }}>
              {content.length} {t(lang, 'characters')} · {t(lang, 'markdownSupported')}
            </span>
            <button onClick={save} disabled={saving} className="btn-primary"
              style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem',
                color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14,
                opacity: saving ? 0.7 : 1 }}>
              {saving ? t(lang, 'saving') : t(lang, 'saveConfig')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
