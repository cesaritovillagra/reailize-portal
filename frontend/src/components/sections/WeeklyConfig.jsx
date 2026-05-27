import { useState, useEffect } from 'react';
import { T, api } from '../../App.jsx';

// ── Simple markdown renderer ──────────────────────────────────────────────────
function MarkdownPreview({ content }) {
  if (!content?.trim()) {
    return (
      <div style={{ color: T.MUTED, fontFamily: 'Inter, sans-serif', fontSize: 14,
        textAlign: 'center', padding: '3rem' }}>
        No hay contenido para previsualizar.
      </div>
    );
  }

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { elements.push(<div key={i} style={{ height: 8 }} />); i++; continue; }
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.BORDER}`, margin: '1rem 0' }} />);
      i++; continue;
    }
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h1) { elements.push(<h1 key={i} style={{ fontSize: 22, fontWeight: 700, color: T.INK, fontFamily: "'Space Grotesk', sans-serif", margin: '1.4rem 0 0.5rem' }}>{inlineFormat(h1[1])}</h1>); i++; continue; }
    if (h2) { elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: T.INK, fontFamily: "'Space Grotesk', sans-serif", margin: '1.2rem 0 0.4rem', borderBottom: `1px solid ${T.BORDER}`, paddingBottom: 6 }}>{inlineFormat(h2[1])}</h2>); i++; continue; }
    if (h3) { elements.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: T.ACCENT, fontFamily: "'Space Grotesk', sans-serif", margin: '1rem 0 0.3rem', letterSpacing: 0.5 }}>{inlineFormat(h3[1])}</h3>); i++; continue; }
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <pre key={i} style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
          padding: '0.8rem 1rem', fontSize: 12, color: '#a8d8ea', fontFamily: 'monospace',
          overflowX: 'auto', margin: '0.5rem 0' }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++; continue;
    }
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}>{inlineFormat(lines[i].replace(/^[-*] /, ''))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} style={{ paddingLeft: 20, margin: '0.4rem 0', color: 'rgba(240,240,245,0.8)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{items}</ul>);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}>{inlineFormat(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} style={{ paddingLeft: 20, margin: '0.4rem 0', color: 'rgba(240,240,245,0.8)', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>{items}</ol>);
      continue;
    }
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ borderLeft: `3px solid ${T.ACCENT}`, paddingLeft: 12, margin: '0.5rem 0',
          color: T.MUTED, fontStyle: 'italic', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
          {inlineFormat(line.replace(/^> /, ''))}
        </blockquote>
      );
      i++; continue;
    }
    elements.push(
      <p key={i} style={{ margin: '0.2rem 0', fontSize: 14, lineHeight: 1.75,
        color: 'rgba(240,240,245,0.82)', fontFamily: 'Inter, sans-serif' }}>
        {inlineFormat(line)}
      </p>
    );
    i++;
  }
  return <div style={{ padding: '0.5rem 0' }}>{elements}</div>;
}

function inlineFormat(text) {
  const parts = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, match, key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    if (match[2]) parts.push(<strong key={key++}><em>{match[2]}</em></strong>);
    else if (match[3]) parts.push(<strong key={key++} style={{ color: T.INK, fontWeight: 700 }}>{match[3]}</strong>);
    else if (match[4]) parts.push(<em key={key++} style={{ color: T.CYAN }}>{match[4]}</em>);
    else if (match[5]) parts.push(<code key={key++} style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 4, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace', color: '#a8d8ea' }}>{match[5]}</code>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WeeklyConfig({ project, lang }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api(`/weekly-guide?project_id=${project.id}`)
      .then(r => { setContent(r.content); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  const save = async () => {
    if (!content?.trim()) {
      const confirm = window.confirm(
        lang === 'es'
          ? '⚠️ El editor está vacío. Si guardás, se borrarán todas las instrucciones de formato. ¿Querés continuar?'
          : '⚠️ The editor is empty. Saving will delete all format instructions. Do you want to continue?'
      );
      if (!confirm) return;
    }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await api('/weekly-guide', { method: 'PUT', body: { project_id: project.id, content } });
      if (res.content) setContent(res.content); // refresh with beautified version
      setSaved(true);
      setEditing(false);
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
          <div style={{ fontSize: 16 }}>
            {lang === 'es' ? 'Seleccioná un proyecto para ver el formato.' : 'Select a project to view the format.'}
          </div>
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
            {lang === 'es' ? 'Formato del Reporte Semanal' : 'Weekly Report Format'}
          </h1>
          <div style={{ color: T.MUTED, fontSize: 13 }}>
            {lang === 'es' ? 'Proyecto' : 'Project'}: <span style={{ color: T.ACCENT }}>{project.name}</span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
          borderRadius: 8, padding: '0.8rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>
          {lang === 'es' ? 'Cargando...' : 'Loading...'}
        </div>
      ) : (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, overflow: 'hidden' }}>

          {/* Header bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: `1px solid ${T.BORDER}`, padding: '0.75rem 1.2rem', background: T.PANEL2 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15 }}>
              {lang === 'es' ? 'Formato del Reporte Semanal' : 'Weekly Report Format'}
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {saved && (
                <span style={{ color: T.SUCCESS, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
                  ✓ {lang === 'es' ? 'Guardado' : 'Saved'}
                </span>
              )}
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)}
                    style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                      padding: '5px 14px', color: T.MUTED, fontSize: 12, cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif" }}>
                    {lang === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button onClick={save} disabled={saving}
                    style={{ background: T.ACCENT, border: 'none', borderRadius: 8,
                      padding: '5px 16px', color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                      fontFamily: "'Space Grotesk', sans-serif" }}>
                    {saving ? (lang === 'es' ? '✨ Formateando…' : '✨ Formatting…') : (lang === 'es' ? 'Guardar' : 'Save')}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                    padding: '5px 14px', color: T.MUTED, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif" }}>
                  ✏️ {lang === 'es' ? 'Editar' : 'Edit'}
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          <div style={{ height: 'calc(100vh - 320px)', overflowY: 'auto',
            padding: '1.2rem 1.5rem', boxSizing: 'border-box' }}>
            {editing ? (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                style={{ width: '100%', height: '100%', background: 'transparent', border: 'none',
                  color: T.INK, fontSize: 14, fontFamily: 'Inter, sans-serif',
                  resize: 'none', outline: 'none', lineHeight: 1.8, boxSizing: 'border-box' }}
                placeholder={lang === 'es'
                  ? 'Escribí aquí las instrucciones de formato para el reporte semanal...'
                  : 'Write here the format instructions for the weekly report...'}
              />
            ) : content?.trim() ? (
              <MarkdownPreview content={content} />
            ) : (
              <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem', fontSize: 14 }}>
                {lang === 'es'
                  ? 'No hay formato configurado. Hacé clic en "Editar" para agregar instrucciones.'
                  : 'No format configured yet. Click "Edit" to add instructions.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
