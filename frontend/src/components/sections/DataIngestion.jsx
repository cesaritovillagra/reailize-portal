import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { T, api } from '../../App.jsx';
import { t } from '../../i18n.js';

const STATUSES      = ['Open', 'In Progress', 'On Hold', 'Escalated', 'Blocked', 'Closed'];

// ── Date helpers ──────────────────────────────────────────────
function formatDate(dateStr, lang) {
  if (!dateStr) return '';
  // Handle ISO format (2026-05-14T03:00:00.000Z) or YYYY-MM-DD
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year  = String(d.getUTCFullYear()).slice(-2);
  return lang === 'en' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
}

function parseToISO(input, lang) {
  if (!input) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  const parts = input.split('/');
  if (parts.length === 3) {
    let [a, b, y] = parts;
    const day   = lang === 'en' ? b : a;
    const month = lang === 'en' ? a : b;
    if (y.length === 2) y = '20' + y;   // 26 → 2026
    if (y.length === 4) y = y;
    return `${y}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  }
  return input;
}
function DateField({ value, onChange, lang, style }) {
  const pickerRef = useRef(null);
  // value stored internally as YYYY-MM-DD
  const isoVal     = value ? (value.slice(0,10)) : '';
  const displayVal = value ? formatDate(value, lang) : '';

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        value={displayVal}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onChange(parseToISO(e.target.value, lang))}
        placeholder={lang === 'en' ? 'MM/DD/YY' : 'DD/MM/YY'}
        style={{ ...style, paddingRight: 34 }}
      />
      {/* Hidden native date picker */}
      <input
        ref={pickerRef}
        type="date"
        value={isoVal}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, top: 0, right: 0 }}
        tabIndex={-1}
      />
      {/* Calendar icon button */}
      <button
        type="button"
        onClick={() => pickerRef.current?.showPicker()}
        style={{
          position: 'absolute', right: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b6b80', fontSize: 15, padding: 0, lineHeight: 1,
          display: 'flex', alignItems: 'center',
        }}
        title={lang === 'en' ? 'Pick a date' : 'Elegir fecha'}
      >
        📅
      </button>
    </div>
  );
}

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
  { key: 'rca',                   label: 'RCA / Root Cause'       },
];

function Badge({ label, color }) {
  return (
    <span style={{ background: `${color}22`, color, borderRadius: 99, padding: '2px 10px', fontSize: 11,
      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, display: 'inline-block' }}>
      {label}
    </span>
  );
}

function statusColor(status) {
  if (status === 'Closed')      return T.SUCCESS;
  if (status === 'In Progress') return T.WARN;
  if (status === 'Blocked')     return T.DANGER;
  if (status === 'Escalated')   return '#ff9800';
  if (status === 'On Hold')     return T.MUTED;
  return T.CYAN;
}

function TicketCard({ ticket, onView, onDelete, lang }) {
  return (
    <div className="ticket-card" style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: '1.2rem', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => onView(ticket)}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.ACCENT, fontSize: 13 }}>
            {ticket.task_id}
          </span>
          {ticket.jira_id && (
            <span style={{ color: T.MUTED, fontSize: 12, marginLeft: 8 }}>{ticket.jira_id}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Badge label={ticket.status} color={statusColor(ticket.status)} />
          <button onClick={() => onView(ticket)} className="btn-row-action"
            style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
              color: T.MUTED, padding: '3px 10px', fontSize: 12 }}>
            {lang === 'es' ? 'Ver/Editar' : 'View/Edit'}
          </button>
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

/* ── Ticket Detail / Edit Modal ───────────────────────────── */
function TicketModal({ ticket, lang, onClose, onSaved, onDeleted }) {
  const [form, setForm]     = useState({ ...ticket });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api(`/tickets/${ticket.id}`, { method: 'PUT', body: form });
      onSaved({ ...form });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(t(lang, 'deleteConfirm'))) return;
    try {
      await api(`/tickets/${ticket.id}`, { method: 'DELETE' });
      onDeleted(ticket.id);
    } catch {}
  };

  const inputStyle = {
    width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
    borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
    fontFamily: 'Inter, sans-serif', outline: 'none',
  };
  const taStyle = { ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.6 };
  const labelStyle = { display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
    fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 };

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem' }}>
      <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 16,
        padding: '2rem', maxWidth: 760, width: '100%', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: T.ACCENT }}>
              {ticket.task_id}
            </div>
            {ticket.jira_id && (
              <div style={{ color: T.MUTED, fontSize: 13, marginTop: 2 }}>{ticket.jira_id}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.MUTED,
            fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
            borderRadius: 8, padding: '0.7rem 1rem', color: T.DANGER, fontSize: 13, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Top fields grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: '1.2rem' }}>
          {[
            { key: 'jira_id',      label: 'JIRA ID' },
            { key: 'date_created', label: lang === 'es' ? 'Fecha creación' : 'Created date', isDate: true },
            { key: 'date_closed',  label: lang === 'es' ? 'Fecha cierre' : 'Closed date',   isDate: true },
            { key: 'days_open',    label: lang === 'es' ? 'Días abierto' : 'Days open',      readOnly: true },
            { key: 'category',     label: t(lang, 'category') },
            { key: 'environment',  label: t(lang, 'environment') },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label.toUpperCase()}</label>
              {f.isDate ? (
                <DateField
                  value={form[f.key] || ''}
                  onChange={val => set(f.key, val)}
                  lang={lang}
                  style={inputStyle}
                />
              ) : f.readOnly ? (
                <div style={{ ...inputStyle, color: form[f.key] != null ? T.SUCCESS : T.MUTED,
                  fontWeight: form[f.key] != null ? 700 : 400 }}>
                  {form[f.key] != null ? `${form[f.key]} ${lang === 'es' ? 'días' : 'days'}` : '—'}
                </div>
              ) : (
                <input
                  value={form[f.key] || ''}
                  onChange={e => set(f.key, e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
          <div>
            <label style={labelStyle}>STATUS</label>
            <select value={form.status || 'Open'} onChange={e => set('status', e.target.value)}
              style={{ ...inputStyle }}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t(lang, 'problemTypeLabel').toUpperCase()}</label>
            <select value={form.problem_type || ''} onChange={e => set('problem_type', e.target.value)}
              style={{ ...inputStyle }}>
              <option value="">{t(lang, 'selectOption')}</option>
              {PROBLEM_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Text fields */}
        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: '0.9rem' }}>
            <label style={labelStyle}>{f.label.toUpperCase()}</label>
            <textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={taStyle} />
          </div>
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <button onClick={del} style={{ background: 'none', border: `1px solid ${T.DANGER}44`,
            borderRadius: 8, padding: '0.65rem 1.2rem', color: T.DANGER, fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer' }}>
            🗑 {t(lang, 'delete')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${T.BORDER}`,
              borderRadius: 8, padding: '0.65rem 1.2rem', color: T.MUTED, fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer' }}>
              {t(lang, 'cancel')}
            </button>
            <button onClick={save} disabled={saving} style={{ background: T.ACCENT, border: 'none',
              borderRadius: 8, padding: '0.65rem 1.4rem', color: '#fff', fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.7 : 1 }}>
              {saving ? t(lang, 'saving') : t(lang, 'saveChanges')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── File upload tab ──────────────────────────────────────── */
function FileUploadTab({ project, lang, onTicketsSaved }) {
  const fileRef            = useRef();
  const [rows, setRows]    = useState(null);   // parsed rows from backend
  const [isTxt, setIsTxt]  = useState(false);
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
      setIsTxt(data.isTxt || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const processAll = async () => {
    if (!rows || !project) return;
    setProcessing(true);
    setProgress({ done: 0, total: rows.length, errors: 0, errorDetails: [] });
    let errors = 0;
    const errorDetails = [];

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
          body: { raw_input: rawText, lang, project_id: project?.id },
        });
        await api('/tickets', {
          method: 'POST',
          body: { ...preview, project_id: project.id },
        });
      } catch (err) {
        errors++;
        errorDetails.push({
          index: i + 1,
          preview: rawText.slice(0, 120) + (rawText.length > 120 ? '…' : ''),
          message: err.message || 'Error desconocido',
        });
      }
      setProgress({ done: i + 1, total: rows.length, errors, errorDetails: [...errorDetails] });
    }

    setProcessing(false);
    setDone(true);
    onTicketsSaved();
  };

  const reset = () => {
    setRows(null); setIsTxt(false); setFileName(''); setDone(false); setError('');
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
              ? 'Seleccioná un archivo CSV, Excel o TXT. El sistema procesará cada ticket con Claude automáticamente.'
              : 'Select a CSV, Excel or TXT file. The system will process each ticket with Claude automatically.'}
          </p>
          <button onClick={() => fileRef.current.click()} className="btn-primary"
            style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
              color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>
            {lang === 'es' ? '📎 Elegir archivo' : '📎 Choose file'}
          </button>
          <span style={{ color: T.MUTED, fontSize: 11, marginLeft: 12 }}>CSV, XLS, XLSX, TXT</span>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" style={{ display: 'none' }} onChange={handleFile} />
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

          {/* Preview — TXT: show raw text; CSV/Excel: show table */}
          {isTxt ? (
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ color: T.MUTED, fontSize: 12, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
                {rows.length} {rows.length === 1
                  ? (lang === 'es' ? 'ticket detectado' : 'ticket detected')
                  : (lang === 'es' ? 'tickets detectados (separados por ---)' : 'tickets detected (separated by ---)')}
              </div>
              <div style={{ borderRadius: 8, border: `1px solid ${T.BORDER}`,
                maxHeight: 280, overflowY: 'auto', background: T.PANEL2 }}>
                {rows.map((row, i) => (
                  <div key={i} style={{
                    borderBottom: i < rows.length - 1 ? `1px solid ${T.BORDER}` : 'none',
                    padding: '0.6rem 1rem',
                  }}>
                    <div style={{ fontSize: 10, color: T.ACCENT, fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700, marginBottom: 4 }}>TICKET {i + 1}</div>
                    <pre style={{ margin: 0, fontSize: 11, color: T.INK,
                      fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                      maxHeight: 100, overflow: 'hidden' }}>
                      {row.raw_input?.slice(0, 300)}{row.raw_input?.length > 300 ? '…' : ''}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : (
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
          )}

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
            <div style={{ marginTop: 8 }}>
              <div style={{ color: T.DANGER, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {progress.errors} {lang === 'es' ? 'errores:' : 'errors:'}
              </div>
              {(progress.errorDetails || []).map((e, i) => (
                <div key={i} style={{ background: 'rgba(255,68,68,0.08)', border: `1px solid ${T.DANGER}`,
                  borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 11,
                  fontFamily: 'Inter, sans-serif' }}>
                  <span style={{ color: T.DANGER, fontWeight: 700 }}>Ticket #{e.index}:</span>
                  <span style={{ color: T.MUTED, marginLeft: 6 }}>{e.message}</span>
                  <div style={{ color: T.MUTED, marginTop: 3, fontStyle: 'italic', opacity: 0.7 }}>{e.preview}</div>
                </div>
              ))}
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
            {progress.errors > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: T.DANGER, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  {progress.errors} {lang === 'es' ? 'tickets con error:' : 'tickets with errors:'}
                </div>
                {(progress.errorDetails || []).map((e, i) => (
                  <div key={i} style={{ background: 'rgba(255,68,68,0.08)', border: `1px solid ${T.DANGER}`,
                    borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12,
                    fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
                    <span style={{ color: T.DANGER, fontWeight: 700 }}>Ticket #{e.index}:</span>
                    <span style={{ color: T.MUTED, marginLeft: 6 }}>{e.message}</span>
                    <div style={{ color: T.MUTED, marginTop: 4, fontStyle: 'italic', opacity: 0.7, fontSize: 11 }}>{e.preview}</div>
                  </div>
                ))}
              </div>
            )}
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
  const [viewTicket, setViewTicket] = useState(null);
  const [tab, setTab]               = useState('list');

  // Update ticket tab state
  const [updateInput,      setUpdateInput]      = useState('');
  const [updatePreview,    setUpdatePreview]    = useState(null);  // { ticket_db_id, jira_id, updated }
  const [updateProcessing, setUpdateProcessing] = useState(false);
  const [updateSaving,     setUpdateSaving]     = useState(false);
  const [updateError,      setUpdateError]      = useState('');
  const [updateSaved,      setUpdateSaved]      = useState(false);

  // Ticket Guide
  const [guideContent,  setGuideContent]  = useState('');
  const [guideLoading,  setGuideLoading]  = useState(false);
  const [guideSaving,   setGuideSaving]   = useState(false);
  const [guideSaved,    setGuideSaved]    = useState(false);
  const [guideError,    setGuideError]    = useState('');

  useEffect(() => {
    if (!project) return;
    setGuideLoading(true);
    api(`/ticket-guide?project_id=${project.id}`)
      .then(r => { setGuideContent(r.content || ''); setGuideLoading(false); })
      .catch(() => setGuideLoading(false));
  }, [project]);

  const saveGuide = async () => {
    if (!project) return;
    if (!guideContent?.trim()) {
      const confirm = window.confirm(
        lang === 'es'
          ? '⚠️ El editor está vacío. Si guardás, se borrarán todas las instrucciones de formato. ¿Querés continuar?'
          : '⚠️ The editor is empty. Saving will delete all format instructions. Do you want to continue?'
      );
      if (!confirm) return;
    }
    setGuideSaving(true); setGuideError(''); setGuideSaved(false);
    try {
      const res = await api('/ticket-guide', { method: 'PUT', body: { project_id: project.id, content: guideContent } });
      if (res.content) setGuideContent(res.content); // refresh with beautified version
      setGuideSaved(true);
      setTimeout(() => setGuideSaved(false), 3000);
    } catch (err) {
      setGuideError(err.message);
    } finally {
      setGuideSaving(false);
    }
  };

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterJiraId,   setFilterJiraId]   = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page,     setPage]     = useState(1);

  const buildQuery = (extra = {}) => {
    const p = { project_id: project.id, ...extra };
    if (filterDateFrom) p.date_from = filterDateFrom;
    if (filterDateTo)   p.date_to   = filterDateTo;
    if (filterStatus)   p.status    = filterStatus;
    if (filterJiraId)   p.jira_id   = filterJiraId;
    return new URLSearchParams(p).toString();
  };

  const loadTickets = (extra = {}) => {
    if (!project) return;
    setLoading(true);
    api(`/tickets?${buildQuery(extra)}`)
      .then(tk => { setTickets(tk); setPage(1); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!project) return;
    loadTickets();
  }, [project]);

  const processInput = async () => {
    if (!rawInput.trim()) return;
    setProcessing(true); setError('');
    try {
      const result = await api('/tickets/preview', { method: 'POST', body: { raw_input: rawInput, lang, project_id: project?.id } });
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
      setViewTicket(null);
    } catch {}
  };

  const reloadTickets = () => {
    if (!project) return;
    api(`/tickets?project_id=${project.id}`)
      .then(tk => { setTickets(tk); setTab('list'); })
      .catch(() => {});
  };

  const clearFilters = () => {
    setFilterDateFrom(''); setFilterDateTo('');
    setFilterStatus(''); setFilterJiraId('');
    if (!project) return;
    setLoading(true);
    api(`/tickets?project_id=${project.id}`)
      .then(tk => { setTickets(tk); setLoading(false); })
      .catch(() => setLoading(false));
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
    ['update', lang === 'es' ? '✏️ Actualizar Ticket' : '✏️ Update Ticket'],
    ['upload', lang === 'es' ? '📎 Subir archivo' : '📎 Upload file'],
    ['guide',  lang === 'es' ? '📋 Formato de Tickets' : '📋 Ticket Format'],
  ];

  return (
    <div className="fadeUp">
      {/* Ticket detail/edit modal */}
      {viewTicket && (
        <TicketModal
          ticket={viewTicket}
          lang={lang}
          onClose={() => setViewTicket(null)}
          onSaved={(updated) => {
            setTickets(prev => prev.map(tk => tk.id === updated.id ? updated : tk));
            setViewTicket(null);
          }}
          onDeleted={(id) => {
            setTickets(prev => prev.filter(tk => tk.id !== id));
            setViewTicket(null);
          }}
        />
      )}

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
          <div key={key} onClick={() => { setTab(key); setPreview(null); setUpdatePreview(null); setUpdateError(''); setUpdateSaved(false); }} className="nav-tab" style={{
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
          {/* Filter bar */}
          <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 12,
            padding: '1rem 1.2rem', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
                  {lang === 'es' ? 'DESDE' : 'FROM'}
                </label>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                  style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 6,
                    padding: '0.45rem 0.7rem', color: T.INK, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
                  {lang === 'es' ? 'HASTA' : 'TO'}
                </label>
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                  style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 6,
                    padding: '0.45rem 0.7rem', color: T.INK, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>STATUS</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 6,
                    padding: '0.45rem 0.7rem', color: T.INK, fontSize: 13, outline: 'none' }}>
                  <option value="">{lang === 'es' ? 'Todos' : 'All'}</option>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>JIRA ID</label>
                <input value={filterJiraId} onChange={e => setFilterJiraId(e.target.value)}
                  placeholder="CTAP-XXXXX"
                  onKeyDown={e => e.key === 'Enter' && loadTickets()}
                  style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 6,
                    padding: '0.45rem 0.7rem', color: T.INK, fontSize: 13, outline: 'none', width: 140 }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => loadTickets()} className="btn-primary"
                  style={{ background: T.ACCENT, border: 'none', borderRadius: 6, padding: '0.45rem 1rem',
                    color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 }}>
                  {lang === 'es' ? '🔍 Buscar' : '🔍 Search'}
                </button>
                <button onClick={clearFilters} className="btn-secondary"
                  style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                    padding: '0.45rem 0.8rem', color: T.MUTED, fontSize: 13 }}>
                  {lang === 'es' ? 'Limpiar' : 'Clear'}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>{t(lang, 'loadingTickets')}</div>
          ) : tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: T.MUTED }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div>{t(lang, 'noTickets')}</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>{t(lang, 'noTicketsHint')}</div>
            </div>
          ) : (() => {
            const totalPages = Math.ceil(tickets.length / pageSize);
            const start = (page - 1) * pageSize;
            const paginated = tickets.slice(start, start + pageSize);
            return (
              <>
                {/* Top bar: count + page size selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ color: T.MUTED, fontSize: 12 }}>
                    {lang === 'es'
                      ? `Mostrando ${start + 1}–${Math.min(start + pageSize, tickets.length)} de ${tickets.length} tickets`
                      : `Showing ${start + 1}–${Math.min(start + pageSize, tickets.length)} of ${tickets.length} tickets`}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: T.MUTED, fontSize: 12 }}>{lang === 'es' ? 'Ver:' : 'Show:'}</span>
                    {[25, 50, 100, 200].map(n => (
                      <button key={n} onClick={() => { setPageSize(n); setPage(1); }}
                        style={{
                          background: pageSize === n ? T.ACCENT : 'none',
                          border: `1px solid ${pageSize === n ? T.ACCENT : T.BORDER}`,
                          borderRadius: 6, padding: '2px 10px', fontSize: 12,
                          color: pageSize === n ? '#fff' : T.MUTED,
                          cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                        }}>{n}</button>
                    ))}
                  </div>
                </div>

                {/* Ticket cards */}
                {paginated.map(tk => (
                  <TicketCard key={tk.id} ticket={tk} onView={setViewTicket} onDelete={deleteTicket} lang={lang} />
                ))}

                {/* Pagination nav */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
                    gap: 8, marginTop: 16 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                        padding: '4px 12px', color: page === 1 ? T.MUTED : T.INK,
                        cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                      ‹ {lang === 'es' ? 'Anterior' : 'Prev'}
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                      .reduce((acc, n, i, arr) => {
                        if (i > 0 && n - arr[i-1] > 1) acc.push('...');
                        acc.push(n); return acc;
                      }, [])
                      .map((n, i) => n === '...'
                        ? <span key={`ellipsis-${i}`} style={{ color: T.MUTED, fontSize: 13 }}>…</span>
                        : <button key={n} onClick={() => setPage(n)}
                            style={{ background: page === n ? T.ACCENT : 'none',
                              border: `1px solid ${page === n ? T.ACCENT : T.BORDER}`,
                              borderRadius: 6, padding: '4px 10px', fontSize: 13,
                              color: page === n ? '#fff' : T.MUTED, cursor: 'pointer' }}>
                            {n}
                          </button>
                      )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 6,
                        padding: '4px 12px', color: page === totalPages ? T.MUTED : T.INK,
                        cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                      {lang === 'es' ? 'Siguiente' : 'Next'} ›
                    </button>
                  </div>
                )}
              </>
            );
          })()}
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

      {/* UPDATE TICKET TAB */}
      {tab === 'update' && (
        <div>
          {updateError && (
            <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${T.DANGER}`,
              borderRadius: 8, padding: '0.8rem 1rem', color: T.DANGER, fontSize: 13,
              marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
              {updateError}
              <button onClick={() => setUpdateError('')}
                style={{ float:'right', background:'none', border:'none', color: T.DANGER, fontSize: 18, lineHeight:1 }}>×</button>
            </div>
          )}

          {updateSaved && (
            <div style={{ background: 'rgba(0,208,132,0.1)', border: `1px solid ${T.SUCCESS}`,
              borderRadius: 8, padding: '0.8rem 1rem', color: T.SUCCESS, fontSize: 13,
              marginBottom: '1rem' }}>
              ✓ {lang === 'es' ? 'Ticket actualizado correctamente.' : 'Ticket updated successfully.'}
            </div>
          )}

          {!updatePreview ? (
            /* ── Input phase ── */
            <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15, marginBottom: 6 }}>
                  {lang === 'es' ? '✏️ Actualizar ticket existente' : '✏️ Update existing ticket'}
                </div>
                <div style={{ color: T.MUTED, fontSize: 13, lineHeight: 1.7 }}>
                  {lang === 'es'
                    ? 'Escribí el JIRA ID y la actualización en texto libre. Claude va a encontrar el ticket, actualizar todos los campos relevantes y mostrarte una vista previa antes de guardar.'
                    : 'Write the JIRA ID and the update in free text. Claude will find the ticket, update all relevant fields and show you a preview before saving.'}
                </div>
              </div>

              {/* Info box */}
              <div style={{ background: 'rgba(125,208,226,0.08)', border: '1px solid rgba(125,208,226,0.25)',
                borderRadius: 10, padding: '0.7rem 1rem', color: T.CYAN, fontSize: 12,
                lineHeight: 1.6, marginBottom: '1.2rem' }}>
                💡 {lang === 'es'
                  ? 'Ejemplos: "CTAP-78097 — se confirmó que el FW fue corregido, issue cerrado." · "CTAP-65432 está bloqueado esperando respuesta del equipo CHF."'
                  : 'Examples: "CTAP-78097 — FW correction confirmed, issue closed." · "CTAP-65432 is blocked waiting for CHF team response."'}
              </div>

              <textarea
                value={updateInput}
                onChange={e => setUpdateInput(e.target.value)}
                placeholder={lang === 'es'
                  ? 'Ej: CTAP-78097 — se cerró el issue. El equipo de FW corrigió las rutas faltantes en redwa100gfw01. RCA confirmado: misconfiguration en la interfaz de FEXN.'
                  : 'E.g.: CTAP-78097 — issue closed. FW team fixed missing routes on redwa100gfw01. Confirmed RCA: FEXN interface misconfiguration.'}
                style={{ width: '100%', minHeight: 140, background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                  borderRadius: 8, padding: '0.8rem 1rem', color: T.INK, fontSize: 13,
                  fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none',
                  lineHeight: 1.7, boxSizing: 'border-box', marginBottom: '1.2rem' }}
              />

              <button
                onClick={async () => {
                  if (!updateInput.trim()) return;
                  setUpdateProcessing(true); setUpdateError(''); setUpdateSaved(false);
                  try {
                    const result = await api('/tickets/update-from-text', {
                      method: 'POST',
                      body: { raw_update: updateInput, lang, project_id: project?.id },
                    });
                    setUpdatePreview(result);
                  } catch (err) {
                    setUpdateError(err.message);
                  } finally {
                    setUpdateProcessing(false);
                  }
                }}
                disabled={updateProcessing || !updateInput.trim()}
                className="btn-primary"
                style={{ background: T.ACCENT, border: 'none', borderRadius: 8,
                  padding: '0.7rem 1.8rem', color: '#fff',
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                  fontSize: 14, opacity: updateProcessing || !updateInput.trim() ? 0.6 : 1 }}>
                {updateProcessing
                  ? (lang === 'es' ? '⏳ Procesando…' : '⏳ Processing…')
                  : (lang === 'es' ? '🔍 Vista previa' : '🔍 Preview')}
              </button>
            </div>

          ) : (
            /* ── Preview phase ── */
            <div>
              {/* Preview header */}
              <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14,
                padding: '1rem 1.4rem', marginBottom: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15 }}>
                    {lang === 'es' ? '🔍 Vista previa — ' : '🔍 Preview — '}
                    <span style={{ color: T.ACCENT }}>{updatePreview.jira_id}</span>
                  </span>
                  <div style={{ color: T.MUTED, fontSize: 12, marginTop: 3 }}>
                    {lang === 'es'
                      ? 'Revisá los cambios propuestos. Podés editarlos antes de guardar.'
                      : 'Review the proposed changes. You can edit them before saving.'}
                  </div>
                </div>
                <button onClick={() => { setUpdatePreview(null); setUpdateSaved(false); }}
                  style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                    padding: '5px 14px', color: T.MUTED, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif" }}>
                  {lang === 'es' ? '← Volver' : '← Back'}
                </button>
              </div>

              {/* Editable preview fields */}
              <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.4rem' }}>
                {/* Top grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: '1rem' }}>
                  {[
                    { key: 'task_id', label: 'TASK ID', readOnly: true },
                    { key: 'jira_id', label: 'JIRA ID' },
                    { key: 'status', label: 'STATUS', type: 'select' },
                    { key: 'date_created', label: lang === 'es' ? 'FECHA CREACIÓN' : 'DATE CREATED', type: 'date' },
                    { key: 'date_closed', label: lang === 'es' ? 'FECHA CIERRE' : 'DATE CLOSED', type: 'date' },
                    { key: 'environment', label: 'ENVIRONMENT' },
                    { key: 'category', label: 'CATEGORY' },
                    { key: 'problem_type', label: 'PROBLEM TYPE', type: 'problemType' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                        fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>{f.label}</label>
                      {f.readOnly ? (
                        <div style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 6,
                          padding: '0.5rem 0.8rem', color: T.MUTED, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                          {updatePreview.updated[f.key] || '—'}
                        </div>
                      ) : f.type === 'select' ? (
                        <select value={updatePreview.updated[f.key] || 'Open'}
                          onChange={e => setUpdatePreview(p => ({ ...p, updated: { ...p.updated, [f.key]: e.target.value } }))}
                          style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                            borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13, outline: 'none' }}>
                          {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : f.type === 'problemType' ? (
                        <select value={updatePreview.updated[f.key] || ''}
                          onChange={e => setUpdatePreview(p => ({ ...p, updated: { ...p.updated, [f.key]: e.target.value } }))}
                          style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                            borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13, outline: 'none' }}>
                          <option value="">{lang === 'es' ? 'Seleccionar…' : 'Select…'}</option>
                          {PROBLEM_TYPES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : f.type === 'date' ? (
                        <DateField
                          value={updatePreview.updated[f.key] || ''}
                          onChange={v => setUpdatePreview(p => ({ ...p, updated: { ...p.updated, [f.key]: v } }))}
                          lang={lang}
                          style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                            borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
                            fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                        />
                      ) : (
                        <input value={updatePreview.updated[f.key] || ''}
                          onChange={e => setUpdatePreview(p => ({ ...p, updated: { ...p.updated, [f.key]: e.target.value } }))}
                          style={{ width: '100%', background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                            borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
                            fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Text area fields */}
                {FIELDS.map(f => (
                  <div key={f.key} style={{ marginBottom: '0.9rem' }}>
                    <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 4,
                      fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>
                      {f.label.toUpperCase()}
                    </label>
                    <textarea value={updatePreview.updated[f.key] || ''}
                      onChange={e => setUpdatePreview(p => ({ ...p, updated: { ...p.updated, [f.key]: e.target.value } }))}
                      style={{ width: '100%', minHeight: 72, background: T.PANEL2, border: `1px solid ${T.BORDER}`,
                        borderRadius: 6, padding: '0.5rem 0.8rem', color: T.INK, fontSize: 13,
                        fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none',
                        lineHeight: 1.6, boxSizing: 'border-box' }} />
                  </div>
                ))}

                {/* Save / back */}
                <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
                  <button
                    onClick={async () => {
                      if (!updatePreview) return;
                      setUpdateSaving(true); setUpdateError(''); setUpdateSaved(false);
                      try {
                        const u = updatePreview.updated;
                        await api(`/tickets/${updatePreview.ticket_db_id}`, {
                          method: 'PUT',
                          body: {
                            jira_id: u.jira_id,
                            date_created: u.date_created || null,
                            date_closed: u.date_closed || null,
                            category: u.category,
                            environment: u.environment,
                            status: u.status,
                            description: u.description,
                            current_situation: u.current_situation,
                            impact: u.impact,
                            value_added: u.value_added,
                            next_steps: u.next_steps,
                            governance: u.governance,
                            strategic_relevance: u.strategic_relevance,
                            key_technical_insight: u.key_technical_insight,
                            rca: u.rca || '',
                            led_by: u.led_by,
                            tier1_involvement: u.tier1_involvement,
                            problem_type: u.problem_type,
                            network_functions: u.network_functions || [],
                          }
                        });
                        setUpdateSaved(true);
                        setUpdatePreview(null);
                        setUpdateInput('');
                        reloadTickets();
                      } catch (err) {
                        setUpdateError(err.message);
                      } finally {
                        setUpdateSaving(false);
                      }
                    }}
                    disabled={updateSaving}
                    className="btn-primary"
                    style={{ background: T.SUCCESS, border: 'none', borderRadius: 8,
                      padding: '0.7rem 1.8rem', color: '#fff',
                      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                      fontSize: 14, opacity: updateSaving ? 0.7 : 1 }}>
                    {updateSaving
                      ? (lang === 'es' ? '⏳ Guardando…' : '⏳ Saving…')
                      : (lang === 'es' ? '✅ Confirmar y Guardar' : '✅ Confirm & Save')}
                  </button>
                  <button onClick={() => { setUpdatePreview(null); setUpdateSaved(false); }}
                    style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                      padding: '0.7rem 1.2rem', color: T.MUTED, fontSize: 14, cursor: 'pointer' }}>
                    {lang === 'es' ? 'Editar texto' : 'Edit text'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UPLOAD FILE TAB */}
      {tab === 'upload' && (
        <FileUploadTab project={project} lang={lang} onTicketsSaved={reloadTickets} />
      )}

      {/* GUÍA DE TICKETS — vista previa */}
      {tab === 'guide' && (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.4rem', borderBottom: `1px solid ${T.BORDER}`, background: T.PANEL2,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15 }}>
                {lang === 'es' ? 'Formato de Tickets' : 'Ticket Format'}
              </span>
              <span style={{ marginLeft: 12, color: T.MUTED, fontSize: 12 }}>
                {lang === 'es' ? 'Esta guía la usa Claude para autocompletar tickets' : 'Claude uses this guide to auto-complete tickets'}
              </span>
            </div>
            <button onClick={() => setTab('guide-edit')}
              style={{ background: 'none', border: `1px solid ${T.BORDER}`, borderRadius: 8,
                padding: '5px 14px', color: T.MUTED, fontSize: 12, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif" }}>
              ✏️ {lang === 'es' ? 'Editar' : 'Edit'}
            </button>
          </div>
          <div style={{ padding: '1.2rem 1.5rem', minHeight: 300, maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            {guideLoading ? (
              <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem' }}>
                {lang === 'es' ? 'Cargando guía…' : 'Loading guide…'}
              </div>
            ) : guideContent?.trim() ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontSize: 13, color: T.INK, fontFamily: 'Inter, sans-serif', lineHeight: 1.8 }}>
                {guideContent}
              </pre>
            ) : (
              <div style={{ color: T.MUTED, textAlign: 'center', padding: '3rem', fontSize: 14 }}>
                {lang === 'es'
                  ? 'No hay guía configurada. Usá la pestaña "Editar Guía" para agregar instrucciones.'
                  : 'No guide configured yet. Use the "Edit Guide" tab to add instructions.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDITAR GUÍA */}
      {tab === 'guide-edit' && (
        <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.4rem', borderBottom: `1px solid ${T.BORDER}`, background: T.PANEL2,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 15 }}>
              ✏️ {lang === 'es' ? 'Editar Formato de Tickets' : 'Edit Ticket Format'}
            </span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {guideSaved && (
                <span style={{ color: T.SUCCESS, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}>
                  ✓ {lang === 'es' ? 'Guardado' : 'Saved'}
                </span>
              )}
              {guideError && (
                <span style={{ color: T.DANGER, fontSize: 12 }}>{guideError}</span>
              )}
              <button onClick={saveGuide} disabled={guideSaving} className="btn-primary"
                style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.55rem 1.3rem',
                  color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13,
                  opacity: guideSaving ? 0.7 : 1, cursor: guideSaving ? 'not-allowed' : 'pointer' }}>
                {guideSaving
                  ? (lang === 'es' ? '✨ Formateando…' : '✨ Formatting…')
                  : (lang === 'es' ? 'Guardar Guía' : 'Save Guide')}
              </button>
            </div>
          </div>
          {/* Info box */}
          <div style={{ margin: '1rem 1.4rem 0', background: 'rgba(125,208,226,0.08)',
            border: '1px solid rgba(125,208,226,0.25)', borderRadius: 10,
            padding: '0.8rem 1.1rem', color: T.CYAN, fontSize: 13, lineHeight: 1.6 }}>
            {lang === 'es'
              ? '💡 Claude va a leer esta guía automáticamente cada vez que procese un ticket nuevo o un archivo. Escribí las reglas, criterios y contexto que necesita para completar los campos correctamente.'
              : '💡 Claude will automatically read this guide every time it processes a new ticket or file. Write the rules, criteria and context needed to correctly fill in the fields.'}
          </div>
          <div style={{ padding: '1rem 1.4rem', height: 'calc(100vh - 420px)', boxSizing: 'border-box' }}>
            <textarea
              value={guideContent}
              onChange={e => setGuideContent(e.target.value)}
              style={{ width: '100%', height: '100%', background: 'transparent', border: 'none',
                color: T.INK, fontSize: 13, fontFamily: 'Inter, sans-serif',
                resize: 'none', outline: 'none', lineHeight: 1.8, boxSizing: 'border-box' }}
              placeholder={lang === 'es'
                ? 'Escribí acá las instrucciones para que Claude procese los tickets correctamente…'
                : 'Write here the instructions for Claude to correctly process tickets…'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
