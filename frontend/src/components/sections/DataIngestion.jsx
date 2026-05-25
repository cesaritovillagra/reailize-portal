import { useState, useEffect, useRef } from 'react';
import { T, api } from '../../App.jsx';
import { t } from '../../i18n.js';

const STATUSES      = ['Open', 'In Progress', 'Closed'];
const PROBLEM_TYPES = ['application','infrastructure','observability','configuration','replication','failover','working_as_designed','transient'];
const FIELDS = [
  { key: 'description',           label: 'Description'            },
  { key: 'current_situation',     label: 'Current Situation'      },
  { key: 'impact',                label: 'Impact'                 },
  { key: 'value_added',           label: 'Value Added'            },
  { key: 'next_steps',            label: 'Next Steps'             },
  { key: 'governance',            label: 'Governance & Ownership' },
  { key: 'strategic_relevance',   label: 'Strategic Relevance'    },
  { key: 'key_technical_insight', label: 'Key Technical Insight'  },
];

function Badge({ label, color }) {
  return (
    <span style={{ background: `${color}22`, color, borderRadius: 99, padding: '2px 10px', fontSize: 11,
      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, display: 'inline-block' }}>
      {label}
    </span>
  );
}

function TicketCard({ ticket, onEdit, onDelete, lang }) {
  const statusColor = ticket.status === 'Closed' ? T.SUCCESS : ticket.status === 'In Progress' ? T.WARN : T.CYAN;
  return (
    <div className="ticket-card" style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: '1.2rem', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.ACCENT, fontSize: 13 }}>
            {ticket.task_id}
          </span>
          {ticket.jira_id && (
            <span style={{ color: T.MUTED, fontSize: 12, marginLeft: 8 }}>{ticket.jira_id}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Badge label={ticket.status} color={statusColor} />
          <button onClick={() => onEdit(ticket)} className="btn-row-action"
            style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
              color: T.MUTED, padding: '3px 10px', fontSize: 12 }}>{t(lang, 'edit')}</button>
          <button onClick={() => onDelete(ticket.id)} className="btn-row-danger"
            style={{ background: 'none', border: `1px solid ${T.DANGER}22`, borderRadius: 6,
              color: T.DANGER, padding: '3px 10px', fontSize: 12 }}>{t(lang, 'delete')}</button>
        </div>
      </div>
      <div style={{ color: T.INK, fontSize: 13, marginBottom: 6, lineHeight: 1.5 }}>
        {ticket.description?.slice(0, 180)}{ticket.description?.length > 180 ? '…' : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {ticket.problem_type && <Badge label={ticket.problem_type} color={T.CYAN} />}
        {ticket.led_by && <Badge label={ticket.tier1_involvement ? 'Tier 1-led' : 'TPM-led'} color={ticket.tier1_involvement ? T.WARN : T.ACCENT} />}
        {(ticket.network_functions || []).slice(0,4).map(nf => (
          <Badge key={nf} label={nf} color={T.LGRAY} />
        ))}
        {(ticket.network_functions || []).length > 4 && (
          <Badge label={`+${ticket.network_functions.length - 4}`} color={T.MUTED} />
        )}
      </div>
    </div>
  );
}

/* ── File upload tab ──────────────────────────────────────── */
function FileUploadTab({ project, lang, onTicketsSaved }) {
  const fileRef            = useRef();
  const [rows, setRows]    = useState(null);   // parsed rows from backend
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing]   = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress]     = useState({ done: 0, total: 0, errors: 0 });
  const [done, setDone]    = useState(false);
  const [error, setError]  = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(''); setRows(null); setDone(false);
    setFileName(file.name);
    setParsing(true);
    try {
      const token = localStorage.getItem('rz_token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/files/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al parsear');
      setRows(data.rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const processAll = async () => {
    if (!rows || !project) return;
    setProcessing(true);
    setProgress({ done: 0, total: rows.length, errors: 0 });
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Convert row object to readable text for Claude
      const rawText = Object.entries(row)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      try {
        const preview = await api('/tickets/preview', {
          method: 'POST',
          body: { raw_input: rawText, lang },
        });
        await api('/tickets', {
          method: 'POST',
          body: { ...preview, project_id: project.id },
        });
      } catch {
        errors++;
      }
      setProgress({ done: i + 1, total: rows.length, errors });
    }

    setProcessing(false);
    setDone(true);
    onTicketsSaved();
  };

  const reset = () => {
    setRows(null); setFileName(''); setDone(false); setError('');
    setProgress({ done: 0, total: 0, errors: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const cols = rows && rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem' }}>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
          borderRadius: 8, padding: '0.7rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
          {error}
          <button onClick={() => setError('')} style={{ float:'right', background:'none', border:'none', color: T.DANGER, fontSize:18 }}>×</button>
        </div>
      )}

      {/* Step 1 — File picker */}
      {!rows && !parsing && (
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: 6 }}>
            {lang === 'es' ? 'Subir archivo' : 'Upload file'}
          </h3>
          <p style={{ color: T.MUTED, fontSize: 13, marginBottom: '1.2rem', lineHeight: 1.6 }}>
            {lang === 'es'
              ? 'Seleccioná un archivo CSV o Excel. El sistema va a parsear cada fila y procesarla con Claude automáticamente.'
              : 'Select a CSV or Excel file. The system will parse each row and process it with Claude automatically.'}
          </p>
          <button onClick={() => fileRef.current.click()} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
            {lang === 'es' ? '📎 Elegir archivo' : '📎 Choose file'}
          </button>
          <span style={{ color: T.MUTED, fontSize: 11, marginLeft: 12 }}>CSV, XLS, XLSX</span>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {/* Parsing spinner */}
      {parsing && (
        <div style={{ textAlign: 'center', padding: '2rem', color: T.MUTED }}>
          <div style={{ fontSize: 13 }}>{lang === 'es' ? '⏳ Leyendo archivo…' : '⏳ Reading file…'}</div>
        </div>
      )}

      {/* Step 2 — Preview table */}
      {rows && !processing && !done && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15 }}>
                📄 {fileName}
              </div>
              <div style={{ color: T.MUTED, fontSize: 12, marginTop: 2 }}>
                {rows.length} {lang === 'es' ? 'filas encontradas' : 'rows found'}
              </div>
            </div>
            <button onClick={reset} className="btn-secondary"
              style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                padding: '0.4rem 0.9rem', color: T.MUTED, fontSize: 12 }}>
              {lang === 'es' ? 'Cambiar archivo' : 'Change file'}
            </button>
          </div>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', marginBottom: '1.2rem', borderRadius: 8,
            border: `1px solid ${T.BORDER}`, maxHeight: 280, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.PANEL2, borderBottom: `1px solid ${T.BORDER}` }}>
                  {cols.map(c => (
                    <th key={c} style={{ padding: '0.5rem 0.8rem', textAlign: 'left', color: T.MUTED,
                      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {c}
                    </th>
                  ))}
                  {Object.keys(rows[0] || {}).length > 6 && (
                    <th style={{ padding: '0.5rem 0.8rem', color: T.MUTED }}>…</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.BORDER}33` }}>
                    {cols.map(c => (
                      <td key={c} style={{ padding: '0.45rem 0.8rem', color: T.INK,
                        fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <div style={{ padding: '0.5rem 0.8rem', color: T.MUTED, fontSize: 11, textAlign: 'center',
                borderTop: `1px solid ${T.BORDER}` }}>
                {lang === 'es' ? `… y ${rows.length - 10} filas más` : `… and ${rows.length - 10} more rows`}
              </div>
            )}
          </div>

          <div style={{ background: `rgba(244,0,133,0.06)`, border: `1px solid rgba(244,0,133,0.2)`,
            borderRadius: 8, padding: '0.8rem 1rem', fontSize: 13, color: T.INK, marginBottom: '1.2rem' }}>
            ⚠️ {lang === 'es'
              ? `Cada fila se va a enviar a Claude para procesar los ${FIELDS.length + 6} campos automáticamente. Dependiendo de la cantidad, puede tardar varios minutos.`
              : `Each row will be sent to Claude to automatically process all ${FIELDS.length + 6} fields. Depending on the count, this may take several minutes.`}
          </div>

          <button onClick={processAll} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.8rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
            {lang === 'es' ? `✨ Procesar ${rows.length} filas con Claude` : `✨ Process ${rows.length} rows with Claude`}
          </button>
        </div>
      )}

      {/* Step 3 — Processing progress */}
      {processing && (
        <div style={{ padding: '1rem 0' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK,
            fontSize: 15, marginBottom: '1rem' }}>
            {lang === 'es' ? '⏳ Procesando con Claude…' : '⏳ Processing with Claude…'}
          </div>
          <div style={{ background: T.PANEL2, borderRadius: 99, height: 8, marginBottom: 8 }}>
            <div style={{ background: T.ACCENT, borderRadius: 99, height: 8,
              width: `${pct}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.MUTED, fontSize: 12 }}>
            <span>{progress.done} / {progress.total} {lang === 'es' ? 'filas' : 'rows'}</span>
            <span>{pct}%</span>
          </div>
          {progress.errors > 0 && (
            <div style={{ color: T.DANGER, fontSize: 12, marginTop: 6 }}>
              {progress.errors} {lang === 'es' ? 'errores' : 'errors'}
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Done */}
      {done && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16, marginBottom: 6 }}>
            {lang === 'es' ? '¡Listo!' : 'Done!'}
          </div>
          <div style={{ color: T.MUTED, fontSize: 13, marginBottom: '1.5rem' }}>
            {progress.done - progress.errors} {lang === 'es' ? 'tickets guardados correctamente' : 'tickets saved successfully'}
            {progress.errors > 0 && ` · ${progress.errors} ${lang === 'es' ? 'errores' : 'errors'}`}
          </div>
          <button onClick={reset} className="btn-secondary"
            style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
              padding: '0.6rem 1.2rem', color: T.MUTED, fontSize: 13 }}>
            {lang === 'es' ? 'Subir otro archivo' : 'Upload another file'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function DataIngestion({ user, project, lang }) {
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [rawInput, setRawInput]     = useState('');
  const [preview, setPreview]       = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [editTicket, setEditTicket] = useState(null);
  const [tab, setTab]               = useState('list'); // 'list' | 'new' | 'upload'

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api(`/tickets?project_id=${project.id}`)
      .then(tk => { setTickets(tk); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project]);

  const processInput = async () => {
    if (!rawInput.trim()) return;
    setProcessing(true); setError('');
    try {
      const result = await api('/tickets/preview', { method: 'POST', body: { raw_input: rawInput, lang } });
      setPreview({ ...result, raw_input: rawInput });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const saveTicket = async () => {
    if (!preview || !project) return;
    setSaving(true); setError('');
    try {
      const saved = await api('/tickets', { method: 'POST', body: { ...preview, project_id: project.id } });
      setTickets(prev => [saved, ...prev]);
      setPreview(null); setRawInput(''); setTab('list');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTicket = async (id) => {
    if (!confirm(t(lang, 'deleteConfirm'))) return;
    try {
      await api(`/tickets/${id}`, { method: 'DELETE' });
      setTickets(prev => prev.filter(tk => tk.id !== id));
    } catch {}
  };

  const reloadTickets = () => {
    if (!project) return;
    api(`/tickets?project_id=${project.id}`)
      .then(tk => { setTickets(tk); setTab('list'); })
      .catch(() => {});
  };

  if (!project) {
    return (
      <div className="fadeUp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: T.MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 16 }}>{t(lang, 'selectProjectFirst')}</div>
        </div>
      </div>
    );
  }

  const TABS = [
    ['list',   t(lang, 'tickets')],
    ['new',    t(lang, 'newTicket')],
    ['upload', lang === 'es' ? '📎 Subir archivo' : '📎 Upload file'],
  ];

  return (
    <div className="fadeUp">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: 4 }}>
          {t(lang, 'dataIngestionTitle')}
        </h1>
        <div style={{ color: T.MUTED, fontSize: 13 }}>{t(lang, 'project')}: <span style={{ color: T.ACCENT }}>{project.name}</span></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: `1px solid ${T.BORDER}` }}>
        {TABS.map(([key, label]) => (
          <div key={key} onClick={() => { setTab(key); setPreview(null); }} className="nav-tab" style={{
            padding: '0.6rem 1.2rem', fontSize: 14,
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
            color: tab === key ? T.ACCENT : T.MUTED,
            borderBottom: tab === key ? `2px solid ${T.ACCENT}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s', cursor: 'default',
          }}>{label}</div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
          borderRadius: 8, padding: '0.8rem 1rem', color: T.DANGER, fontSize: 13,
          marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
          {error}
          <button onClick={() => setError('')} style={{ float:'right', background:'none', border:'none', color: T.DANGER, fontSize: 18, lineHeight:1 }}>×</button>
        </div>
      )}

      {/* LIST TAB */}
      {tab === 'list' && (
        <div>
          {loading ? (
            <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>{t(lang, 'loadingTickets')}</div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: T.MUTED }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div>{t(lang, 'noTickets')}</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>{t(lang, 'noTicketsHint')}</div>
            </div>
          ) : (
            tickets.map(tk => (
              <TicketCard key={tk.id} ticket={tk} onEdit={setEditTicket} onDelete={deleteTicket} lang={lang} />
            ))
          )}
        </div>
      )}

      {/* NEW TICKET TAB */}
      {tab === 'new' && !preview && (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem' }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, marginBottom: 6, fontSize: 16 }}>
            {t(lang, 'enterTicketInfo')}
          </h3>
          <p style={{ color: T.MUTED, fontSize: 13, marginBottom: '1rem', lineHeight: 1.6 }}>
            {t(lang, 'ticketDesc')}
          </p>
          <textarea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder={t(lang, 'ticketPlaceholder')}
            style={{
              width: '100%', minHeight: 160, background: T.PANEL2, border: `1px solid ${T.BORDER}`,
              borderRadius: 8, padding: '0.8rem 1rem', color: T.INK, fontSize: 14,
              fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none',
              lineHeight: 1.6, marginBottom: '1rem',
            }}
          />
          <button onClick={processInput} disabled={processing || !rawInput.trim()} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
              fontSize: 14, opacity: processing ? 0.7 : 1 }}>
            {processing ? t(lang, 'processing') : t(lang, 'processWithClaude')}
          </button>
        </div>
      )}

      {/* PREVIEW */}
      {tab === 'new' && preview && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 16 }}>
              {t(lang, 'reviewTicket')}
            </h3>
            <button onClick={() => setPreview(null)} className="btn-secondary"
              style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                color: T.MUTED, padding: '0.4rem 0.9rem', fontSize: 13 }}>
              {t(lang, 'back')}
            </button>
          </div>
          <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: '1rem' }}>
              {[
                { key: 'jira_id',      label: 'JIRA ID' },
                { key: 'date_created', label: t(lang, 'dateCreated') },
                { key: 'category',     label: t(lang, 'category') },
                { key: 'environment',  label: t(lang, 'environment') },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                    fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
                    {f.label.toUpperCase()}
                  </label>
                  <input value={preview[f.key] || ''} onChange={e => setPreview(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                      borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
                      fontFamily: 'Inter, sans-serif', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>STATUS</label>
                <select value={preview.status || 'Open'} onChange={e => setPreview(p => ({ ...p, status: e.target.value }))}
                  style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                    borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13, outline: 'none' }}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>{t(lang, 'problemTypeLabel').toUpperCase()}</label>
                <select value={preview.problem_type || ''} onChange={e => setPreview(p => ({ ...p, problem_type: e.target.value }))}
                  style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                    borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13, outline: 'none' }}>
                  <option value="">{t(lang, 'selectOption')}</option>
                  {PROBLEM_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {FIELDS.map(f => (
              <div key={f.key} style={{ marginBottom: '0.9rem' }}>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
                  {f.label.toUpperCase()}
                </label>
                <textarea value={preview[f.key] || ''} onChange={e => setPreview(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', minHeight: 72, background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                    borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
                    fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', lineHeight: 1.6 }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
              <button onClick={saveTicket} disabled={saving} className="btn-primary"
                style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.8rem',
                  color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                  fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                {saving ? t(lang, 'saving') : t(lang, 'saveTicket')}
              </button>
              <button onClick={() => { setPreview(null); setRawInput(''); }} className="btn-secondary"
                style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                  padding: '0.7rem 1.2rem', color: T.MUTED, fontSize: 14 }}>
                {t(lang, 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD FILE TAB */}
      {tab === 'upload' && (
        <FileUploadTab project={project} lang={lang} onTicketsSaved={reloadTickets} />
      )}
    </div>
  );
}
