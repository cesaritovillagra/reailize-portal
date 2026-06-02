import { useState, useRef, useEffect } from 'react';
import { T, api, apiBlob } from '../../App.jsx';
import { t } from '../../i18n.js';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import QBRConfig from './QBRConfig.jsx';

const CHART_COLORS = ['#F40085','#7AD0E2','#00d084','#ffb800','#AFAEAF','#4D4D4D'];

function ChartCard({ title, children }) {
  return (
    <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: '1.2rem' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: T.INK,
        fontSize: 13, marginBottom: '1rem', borderBottom: `1px solid ${T.BORDER}`, paddingBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KpiBox({ value, label, color, emoji, detail }) {
  return (
    <div style={{ background: color, borderRadius: 12, padding: '1rem 1.5rem', textAlign: 'center', flex: 1 }}>
      {emoji && <div style={{ fontSize: 20, marginBottom: 2 }}>{emoji}</div>}
      <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
        {label}
      </div>
      {detail && detail.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.25)', paddingTop: 6 }}>
          {detail.map((d, i) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              {d}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentBox({ icon, title, items, bg, border, titleColor }) {
  // Normalize: support both string[] and {icon, text}[]
  const normalized = (items || []).map(i =>
    typeof i === 'string' ? { icon: '•', text: i } : i
  );
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '1rem 1.2rem', flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: titleColor, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>
        {icon} {title}
      </div>
      {normalized.map((item, i) => (
        <div key={i} style={{ fontSize: 13, color: T.INK, fontFamily: 'Inter, sans-serif',
          padding: '3px 0', display: 'flex', gap: 6 }}>
          <span style={{ flexShrink: 0 }}>{item.icon || '•'}</span>
          <span>{item.text || item}</span>
        </div>
      ))}
    </div>
  );
}

// ── Speech Guide Markdown Renderer (same style as QBRConfig) ─────────────────
function SpeechGuideMarkdown({ content }) {
  if (!content?.trim()) return null;
  const lines = content.split('\n');
  const els = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { els.push(<div key={i} style={{ height: 8 }} />); i++; continue; }
    if (/^---+$/.test(l.trim())) { els.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.BORDER}`, margin: '1rem 0' }} />); i++; continue; }
    const h2 = l.match(/^## (.+)/); const h3 = l.match(/^### (.+)/); const h1 = l.match(/^# (.+)/);
    if (h1) { els.push(<h1 key={i} style={{ fontSize: 22, fontWeight: 700, color: T.INK, fontFamily: "'Space Grotesk',sans-serif", margin: '1.4rem 0 0.5rem' }}>{h1[1]}</h1>); i++; continue; }
    if (h2) { els.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: T.INK, fontFamily: "'Space Grotesk',sans-serif", margin: '1.2rem 0 0.4rem', borderBottom: `1px solid ${T.BORDER}`, paddingBottom: 6 }}>{h2[1]}</h2>); i++; continue; }
    if (h3) { els.push(<h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: T.ACCENT, fontFamily: "'Space Grotesk',sans-serif", margin: '1rem 0 0.3rem' }}>{h3[1]}</h3>); i++; continue; }
    if (/^[-*] /.test(l)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.65 }}>{lines[i].replace(/^[-*] /, '')}</li>); i++; }
      els.push(<ul key={`ul${i}`} style={{ paddingLeft: 20, margin: '0.4rem 0', color: 'rgba(240,240,245,0.8)', fontSize: 14, fontFamily: 'Inter,sans-serif' }}>{items}</ul>); continue;
    }
    els.push(<p key={i} style={{ margin: '0.2rem 0', fontSize: 14, lineHeight: 1.75, color: 'rgba(240,240,245,0.82)', fontFamily: 'Inter,sans-serif' }}>{l}</p>); i++;
  }
  return <div style={{ padding: '0.5rem 0' }}>{els}</div>;
}

// ── Speech Section Preview ────────────────────────────────────────────────────
function SpeechSectionPreview({ section }) {
  const PINK = '#F40085', GREEN = '#00A878', CYAN = '#3B82F6', ORANGE = '#E07000';
  const YELLOW_BG = '#FFFDE7', GREEN_BG = '#E8F5EF', ORANGE_BG = '#FFF3E0', CYAN_BG = '#E8F0FE', PINK_BG = '#FDE8F3';

  if (section.id === 'what_stands_out') {
    const dp = section.data_points || [];
    return (
      <div style={{ background: YELLOW_BG, border: '1px solid #DDD', borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textAlign: 'center', marginBottom: 8 }}>What Stands Out</div>
        {dp[0] && (
          <div style={{ background: PINK, borderRadius: 8, padding: '0.4rem 0.8rem', textAlign: 'center',
            color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {dp[0]} 🎯
          </div>
        )}
        {dp.slice(1).map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#555', textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>{d}</div>
        ))}
      </div>
    );
  }

  if (section.id === 'ownership_status') {
    return (
      <div style={{ background: YELLOW_BG, border: '1px solid #DDD', borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#444', marginBottom: 6 }}>🥧 Ownership & Status</div>
        {(section.data_points || []).map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#555', padding: '2px 0',
            borderLeft: `3px solid ${i % 2 === 0 ? PINK : CYAN}`, paddingLeft: 6, marginBottom: 4 }}>{d}</div>
        ))}
      </div>
    );
  }

  if (section.id === 'nf_chart') {
    return (
      <div style={{ background: '#F8F8F8', border: '1px solid #DDD', borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#444', marginBottom: 6 }}>📊 Issues by Network Function</div>
        {(section.data_points || []).slice(0, 4).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: `${Math.max(20, 80 - i * 15)}%`, height: 14, borderRadius: 3,
              background: [PINK, CYAN, GREEN, ORANGE][i % 4] }} />
            <span style={{ fontSize: 9, color: '#555' }}>{d}</span>
          </div>
        ))}
      </div>
    );
  }

  if (section.id === 'achievements') {
    return (
      <div style={{ background: GREEN_BG, border: `1.5px solid ${GREEN}`, borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, marginBottom: 6 }}>✅ Key Achievements</div>
        {(section.data_points || []).map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#333', padding: '2px 0 2px 6px',
            borderLeft: `2px solid ${GREEN}`, marginBottom: 4 }}>{d}</div>
        ))}
      </div>
    );
  }

  if (section.id === 'challenges') {
    return (
      <div style={{ background: ORANGE_BG, border: `1.5px solid ${ORANGE}`, borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: ORANGE, marginBottom: 6 }}>⚠️ Challenges</div>
        {(section.data_points || []).map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#333', padding: '2px 0 2px 6px',
            borderLeft: `2px solid ${ORANGE}`, marginBottom: 4 }}>{d}</div>
        ))}
      </div>
    );
  }

  if (section.id === 'next_steps') {
    return (
      <div style={{ background: CYAN_BG, border: `1.5px solid ${CYAN}`, borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: CYAN, marginBottom: 6 }}>🎯 Next Steps & Targets</div>
        {(section.data_points || []).map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#333', padding: '2px 0 2px 6px',
            borderLeft: `2px solid ${CYAN}`, marginBottom: 4 }}>{d}</div>
        ))}
      </div>
    );
  }

  if (section.id === 'call_to_action') {
    return (
      <div style={{ background: PINK_BG, border: `2px solid ${PINK}`, borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: PINK, marginBottom: 6 }}>📢 Call to Action</div>
        {(section.data_points || []).map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: '#333', fontStyle: 'italic' }}>{d}</div>
        ))}
      </div>
    );
  }

  // Generic fallback
  return (
    <div style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 10, padding: '0.8rem', minWidth: 200 }}>
      {(section.data_points || []).map((d, i) => (
        <div key={i} style={{ fontSize: 10, color: T.INK, padding: '2px 0' }}>• {d}</div>
      ))}
    </div>
  );
}

function DateField({ value, onChange }) {
  const pickerRef = useRef(null);
  const display = value ? value.split('-').reverse().join('/') : null;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <div style={{
        background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
        padding: '0.65rem 2.2rem 0.65rem 1rem', color: display ? T.INK : T.MUTED,
        fontSize: 14, fontFamily: 'Inter, sans-serif', minWidth: 130, whiteSpace: 'nowrap',
      }}>
        {display ?? 'dd/mm/aaaa'}
      </div>
      <input ref={pickerRef} type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1} />
      <button type="button" onClick={() => pickerRef.current?.showPicker()}
        style={{ position: 'absolute', right: 8, background: 'none', border: 'none',
          color: T.MUTED, fontSize: 14, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
        title="Elegir fecha">📅</button>
    </div>
  );
}

export default function QBRGenerator({ user, project, lang }) {
  const [qbrTab, setQbrTab] = useState('generate');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  // Speech guide state
  const [speechGuide, setSpeechGuide]             = useState('');
  const [speechGuideSaving, setSpeechGuideSaving] = useState(false);
  const [speechGuideSaved, setSpeechGuideSaved]   = useState(false);
  const [speechGuideEditing, setSpeechGuideEditing] = useState(false);

  // Speech generator state
  const [speechFile, setSpeechFile]         = useState(null);
  const [speechGenerating, setSpeechGenerating] = useState(false);
  const [speechExporting, setSpeechExporting]   = useState(false);
  const [speechResult, setSpeechResult]     = useState(null);
  const [speechError, setSpeechError]       = useState('');
  const speechFileRef = useRef(null);

  // Load speech guide when project changes
  useEffect(() => {
    if (!project) return;
    api(`/speech/guide?project_id=${project.id}`).then(r => setSpeechGuide(r.content || '')).catch(() => {});
  }, [project?.id]);

  const saveSpeechGuide = async () => {
    if (!project) return;
    setSpeechGuideSaving(true); setSpeechGuideSaved(false);
    try {
      const r = await api('/speech/guide', { method: 'PUT', body: { project_id: project.id, content: speechGuide } });
      setSpeechGuide(r.content);
      setSpeechGuideSaved(true);
      setSpeechGuideEditing(false);
      setTimeout(() => setSpeechGuideSaved(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSpeechGuideSaving(false); }
  };

  const generateSpeech = async () => {
    if (!speechFile || !project) return;
    setSpeechGenerating(true); setSpeechError(''); setSpeechResult(null);
    try {
      const formData = new FormData();
      formData.append('pptx', speechFile);
      formData.append('project_id', project.id);
      const token = localStorage.getItem('rz_token');
      const res = await fetch('http://localhost:3001/api/speech/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setSpeechResult(await res.json());
    } catch (err) { setSpeechError(err.message); }
    finally { setSpeechGenerating(false); }
  };

  const exportSpeechDocx = async () => {
    if (!speechResult) return;
    setSpeechExporting(true);
    try {
      const blob = await apiBlob('/speech/export-docx', {
        method: 'POST',
        body: { speech: speechResult, project_name: project.name }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QBR_Speech_${project.name}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setSpeechError('Error al exportar Word'); }
    finally { setSpeechExporting(false); }
  };

  const generate = async () => {
    if (!project || !dateFrom || !dateTo) return;
    setGenerating(true); setError(''); setResult(null);
    try {
      const res = await api('/qbr/generate', {
        method: 'POST',
        body: { project_id: project.id, date_from: dateFrom, date_to: dateTo, lang }
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const exportPPTX = async () => {
    if (!result) return;
    setExporting(true);
    try {
      const blob = await apiBlob('/qbr/export-pptx', {
        method: 'POST',
        body: {
          slide_data: result.slide_data,
          charts: result.charts,
          date_from: dateFrom,
          date_to: dateTo,
          project_name: project.name
        }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QBR_${project.name}_${dateFrom}_${dateTo}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error al exportar PowerPoint');
    } finally {
      setExporting(false);
    }
  };

  if (!project) {
    return (
      <div className="fadeUp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: T.MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 16 }}>{t(lang, 'selectProjectQBRGen')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fadeUp">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: 4 }}>
          {t(lang, 'qbrGeneratorTitle')}
        </h1>
        <div style={{ color: T.MUTED, fontSize: 13 }}>{t(lang, 'project')}: <span style={{ color: T.ACCENT }}>{project.name}</span></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: `1px solid ${T.BORDER}`, flexWrap: 'wrap' }}>
        {[
          ['generate',      '📊 Generar QBR'],
          ['methodology',   '⚙️ Formato de QBRs'],
          ['speech-guide',  '🎤 Guía para el Speech'],
          ['speech-gen',    '🗣️ Generador de Speech'],
        ].map(([key, label]) => (
          <div key={key} onClick={() => setQbrTab(key)}
            style={{ padding: '0.6rem 1.2rem', fontSize: 14, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
              color: qbrTab === key ? T.ACCENT : T.MUTED,
              borderBottom: qbrTab === key ? `2px solid ${T.ACCENT}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Metodología QBR tab */}
      {qbrTab === 'methodology' && <QBRConfig user={user} project={project} lang={lang} />}

      {/* Guía para el Speech tab — mismo patrón que QBRConfig */}
      {qbrTab === 'speech-guide' && (
        <div className="fadeUp">
          <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${T.BORDER}`, padding: '0.75rem 1.2rem', background: T.PANEL2 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15 }}>
                🎤 Guía para el Speech de QBRs
              </span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {speechGuideSaved && (
                  <span style={{ color: T.SUCCESS, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
                    ✓ Guardado
                  </span>
                )}
                {speechGuideEditing ? (
                  <>
                    <button onClick={() => setSpeechGuideEditing(false)}
                      style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                        padding: '5px 14px', color: T.MUTED, fontSize: 12, cursor: 'pointer',
                        fontFamily: "'Space Grotesk', sans-serif" }}>
                      Cancelar
                    </button>
                    <button onClick={saveSpeechGuide} disabled={speechGuideSaving}
                      style={{ background: T.ACCENT, border: 'none', borderRadius: 8,
                        padding: '5px 16px', color: '#fff', fontSize: 12, fontWeight: 700,
                        cursor: speechGuideSaving ? 'not-allowed' : 'pointer',
                        opacity: speechGuideSaving ? 0.7 : 1,
                        fontFamily: "'Space Grotesk', sans-serif" }}>
                      {speechGuideSaving ? '✨ Formateando…' : 'Guardar'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setSpeechGuideEditing(true)}
                    style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                      padding: '5px 14px', color: T.MUTED, fontSize: 12, cursor: 'pointer',
                      fontFamily: "'Space Grotesk', sans-serif" }}>
                    ✏️ Editar
                  </button>
                )}
              </div>
            </div>
            {/* Content area */}
            <div style={{ height: 'calc(100vh - 320px)', overflowY: 'auto',
              padding: '1.2rem 1.5rem', boxSizing: 'border-box' }}>
              {speechGuideEditing ? (
                <textarea
                  value={speechGuide}
                  onChange={e => setSpeechGuide(e.target.value)}
                  style={{ width: '100%', height: '100%', background: 'transparent', border: 'none',
                    color: T.INK, fontSize: 14, fontFamily: 'Inter, sans-serif',
                    resize: 'none', outline: 'none', lineHeight: 1.8, boxSizing: 'border-box' }}
                  placeholder="Ej: Siempre hablar en primera persona como dueño del resultado. Evitar palabras como 'intenté', 'traté'. Usar expresiones como 'lideré', 'ejecuté', 'aseguré'..."
                />
              ) : speechGuide?.trim() ? (
                <SpeechGuideMarkdown content={speechGuide} />
              ) : (
                <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem', fontSize: 14 }}>
                  No hay guía configurada. Hacé clic en "Editar" para agregar instrucciones.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generador de Speech tab */}
      {qbrTab === 'speech-gen' && (
        <div className="fadeUp">
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: T.INK, marginBottom: 4 }}>
              🗣️ Generador de Speech de QBRs
            </h2>
            <div style={{ color: T.MUTED, fontSize: 13 }}>
              Subí el PPT del QBR y Claude generará el speech sección por sección.
            </div>
          </div>

          {/* File upload */}
          <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: T.INK, fontSize: 15, marginBottom: '1rem' }}>
              📎 Subir archivo PPTX
            </h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input ref={speechFileRef} type="file" accept=".pptx" style={{ display: 'none' }}
                onChange={e => { setSpeechFile(e.target.files[0]); setSpeechResult(null); setSpeechError(''); }} />
              <button onClick={() => speechFileRef.current?.click()} className="btn-secondary"
                style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
                  padding: '0.65rem 1.4rem', color: T.INK, fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600, fontSize: 14 }}>
                📁 Elegir archivo .pptx
              </button>
              {speechFile && (
                <span style={{ color: T.SUCCESS, fontSize: 13 }}>✅ {speechFile.name}</span>
              )}
              <button onClick={generateSpeech} disabled={!speechFile || speechGenerating} className="btn-primary"
                style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.65rem 1.8rem',
                  color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14,
                  opacity: (!speechFile || speechGenerating) ? 0.6 : 1 }}>
                {speechGenerating ? '⏳ Generando speech...' : '🎤 Generar Speech'}
              </button>
            </div>
          </div>

          {speechError && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
              borderRadius: 8, padding: '0.8rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
              {speechError}
            </div>
          )}

          {speechGenerating && (
            <div style={{ textAlign: 'center', padding: '3rem', color: T.MUTED }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎤</div>
              <div style={{ fontSize: 15, color: T.INK }}>Analizando el PPT y generando el speech...</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Esto puede tomar unos segundos</div>
            </div>
          )}

          {speechResult && (
            <div>
              {/* Export button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 18 }}>
                  {speechResult.title}
                </h2>
                <button onClick={exportSpeechDocx} disabled={speechExporting} className="btn-accent-outline"
                  style={{ background: T.PANEL, border: `1px solid ${T.ACCENT}`, borderRadius: 8,
                    padding: '0.65rem 1.4rem', color: T.ACCENT, fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
                    opacity: speechExporting ? 0.7 : 1 }}>
                  {speechExporting ? '⏳ Exportando...' : '📄 Exportar a Word'}
                </button>
              </div>

              {/* Speech sections */}
              {speechResult.sections?.map((section, idx) => (
                <div key={section.id} style={{ marginBottom: '1.5rem', background: T.PANEL,
                  border: `1px solid ${T.BORDER}`, borderRadius: 14, overflow: 'hidden' }}>

                  {/* Section header */}
                  <div style={{ background: T.PANEL2, borderBottom: `1px solid ${T.BORDER}`,
                    padding: '0.8rem 1.2rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: T.ACCENT, color: '#fff', borderRadius: '50%',
                      width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                      fontSize: 15, color: T.ACCENT }}>{section.title}</span>
                  </div>

                  <div style={{ padding: '1.2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Visual preview */}
                    <div style={{ flex: '0 0 auto', minWidth: 220 }}>
                      <div style={{ fontSize: 11, color: T.MUTED, fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>PREVIEW</div>
                      <SpeechSectionPreview section={section} />
                    </div>

                    {/* Speech text */}
                    <div style={{ flex: 1, minWidth: 280 }}>
                      <div style={{ fontSize: 11, color: T.MUTED, fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600, marginBottom: 8, letterSpacing: 0.5 }}>📢 LO QUE VAS A DECIR</div>
                      <div style={{ background: T.PANEL2, borderRadius: 10, padding: '1rem',
                        border: `1px solid ${T.BORDER}` }}>
                        {section.speech.split('\n').filter(p => p.trim()).map((p, i) => (
                          <p key={i} style={{ fontSize: 13, color: T.INK, fontFamily: 'Inter, sans-serif',
                            lineHeight: 1.7, marginBottom: 8 }}>{p}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generar QBR tab */}
      {qbrTab === 'generate' && <>

      {/* Date selector */}
      <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: T.INK, fontSize: 15, marginBottom: '1rem' }}>
          {t(lang, 'selectPeriod')}
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
              {t(lang, 'from')}
            </label>
            <DateField value={dateFrom} onChange={setDateFrom} />
          </div>
          <div>
            <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
              {t(lang, 'to')}
            </label>
            <DateField value={dateTo} onChange={setDateTo} />
          </div>
          <button onClick={generate} disabled={generating || !dateFrom || !dateTo} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.72rem 1.8rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
              fontSize: 14, opacity: generating ? 0.7 : 1 }}>
            {generating ? t(lang, 'generating') : t(lang, 'generateQBR')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
          borderRadius: 8, padding: '0.8rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {generating && (
        <div style={{ textAlign: 'center', padding: '3rem', color: T.MUTED }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 15, color: T.INK }}>{t(lang, 'generatingDesc')}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>{t(lang, 'generatingHint')}</div>
        </div>
      )}

      {result && (
        <div>
          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 18, marginBottom: 2 }}>
                {result.slide_data.slide_title}
              </h2>
              <div style={{ color: T.MUTED, fontSize: 13 }}>{result.slide_data.period_label}</div>
            </div>
            <button onClick={exportPPTX} disabled={exporting} className="btn-accent-outline"
              style={{ background: T.PANEL, border: `1px solid ${T.ACCENT}`, borderRadius: 8,
                padding: '0.65rem 1.4rem', color: T.ACCENT,
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8, opacity: exporting ? 0.7 : 1 }}>
              {exporting ? t(lang, 'exporting') : t(lang, 'exportPPTX')}
            </button>
          </div>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem' }}>
            <KpiBox value={result.slide_data.kpi_1?.value} label={result.slide_data.kpi_1?.label}
              emoji={result.slide_data.kpi_1?.emoji} detail={result.slide_data.kpi_1?.detail} color={T.ACCENT} />
            <KpiBox value={result.slide_data.kpi_2?.value} label={result.slide_data.kpi_2?.label}
              emoji={result.slide_data.kpi_2?.emoji} detail={result.slide_data.kpi_2?.detail} color='#00A878' />
            <KpiBox value={String(result.charts.totalTickets)} label="Tickets Managed" color='#3B82F6' />
            {result.charts.avgDays != null && (
              <KpiBox value={`${result.charts.avgDays}d`} label="Avg. Resolution" color='#6366F1' />
            )}
          </div>

          {/* Content boxes */}
          <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <ContentBox
              icon="✅" title="Key Achievements"
              items={result.slide_data.achievements || []}
              bg='#0f2a1e' border='#00A878' titleColor='#00d084' />
            <ContentBox
              icon="⚠️" title="Challenges"
              items={result.slide_data.challenges || []}
              bg='#2a1a0a' border='#E07000' titleColor='#ffb800' />
            <ContentBox
              icon="🎯" title="Next Steps"
              items={result.slide_data.next_steps || []}
              bg='#0a1a2a' border='#3B82F6' titleColor='#7AD0E2' />
          </div>

          {/* Call to Action */}
          {result.slide_data.call_to_action && (
            <div style={{ background: 'rgba(244,0,133,0.08)', border: `1.5px solid ${T.ACCENT}`,
              borderRadius: 12, padding: '1rem 1.4rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📢</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ACCENT,
                  fontFamily: "'Space Grotesk', sans-serif", marginBottom: 2 }}>CALL TO ACTION</div>
                <div style={{ fontSize: 13, color: T.INK, fontFamily: 'Inter, sans-serif' }}>
                  {result.slide_data.call_to_action}
                </div>
              </div>
            </div>
          )}

          {/* Charts grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <ChartCard title={t(lang, 'ticketsByStatus')}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={result.charts.byStatus} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value" nameKey="label"
                    label={({ label, percent }) => `${label} ${(percent*100).toFixed(0)}%`}
                    labelLine={false}>
                    {result.charts.byStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8, color: T.INK }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t(lang, 'ownership')}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={result.charts.byOwnership} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="label">
                    {result.charts.byOwnership.map((_, i) => <Cell key={i} fill={i === 0 ? '#F40085' : '#7AD0E2'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8, color: T.INK }} />
                  <Legend wrapperStyle={{ color: T.INK, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t(lang, 'problemType')}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.charts.byProblemType} layout="vertical">
                  <XAxis type="number" tick={{ fill: T.MUTED, fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fill: T.INK, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8, color: T.INK }} />
                  <Bar dataKey="value" fill="#F40085" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t(lang, 'networkFunctions')}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.charts.byNF} layout="vertical">
                  <XAxis type="number" tick={{ fill: T.MUTED, fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={60} tick={{ fill: T.INK, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8, color: T.INK }} />
                  <Bar dataKey="value" fill="#7AD0E2" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
