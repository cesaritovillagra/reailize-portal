import { useState, useEffect, useRef } from 'react';
import { T, api } from '../../App.jsx';
import { t } from '../../i18n.js';

const STATUSES      = ['Open', 'In Progress', 'Closed'];
const PROBLEM_TYPES = ['application','infrastructure','observability','configuration','replication','failover','working_as_designed','transient'];
const FIELDS = [
  { key: 'description',          label: 'Description'           },
  { key: 'current_situation',    label: 'Current Situation'     },
  { key: 'impact',               label: 'Impact'                },
  { key: 'value_added',          label: 'Value Added'           },
  { key: 'next_steps',           label: 'Next Steps'            },
  { key: 'governance',           label: 'Governance & Ownership'},
  { key: 'strategic_relevance',  label: 'Strategic Relevance'   },
  { key: 'key_technical_insight',label: 'Key Technical Insight' },
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

export default function DataIngestion({ user, project, lang }) {
  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [rawInput, setRawInput]   = useState('');
  const [preview, setPreview]     = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [editTicket, setEditTicket] = useState(null);
  const [tab, setTab]             = useState('list'); // 'list' | 'new'
  const fileRef = useRef();

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api(`/tickets?project_id=${project.id}`)
      .then(t => { setTickets(t); setLoading(false); })
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
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch {}
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.name.endsWith('.mpp')) {
      setError(t(lang, 'mppError'));
      return;
    }
    const text = await file.text();
    setRawInput(prev => prev ? `${prev}\n\n---\n${text}` : text);
    setTab('new');
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
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: `1px solid ${T.BORDER}`, paddingBottom: 0 }}>
        {[['list', t(lang, 'tickets')], ['new', t(lang, 'newTicket')]].map(([key, label]) => (
          <div key={key} onClick={() => setTab(key)} className="nav-tab" style={{
            padding: '0.6rem 1.2rem', fontSize: 14,
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
            color: tab === key ? T.ACCENT : T.MUTED,
            borderBottom: tab === key ? `2px solid ${T.ACCENT}` : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={processInput} disabled={processing || !rawInput.trim()} className="btn-primary"
              style={{ background: T.ACCENT, border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem',
                color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700,
                fontSize: 14, opacity: processing ? 0.7 : 1 }}>
              {processing ? t(lang, 'processing') : t(lang, 'processWithClaude')}
            </button>

            <span style={{ color: T.MUTED, fontSize: 13 }}>o</span>

            <button onClick={() => fileRef.current.click()} className="btn-secondary"
              style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
                padding: '0.7rem 1.2rem', color: T.INK, fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>
              {t(lang, 'uploadFile')}
            </button>
            <input ref={fileRef} type="file"
              accept=".txt,.csv,.xlsx,.xls,.xml,.docx,.doc"
              style={{ display: 'none' }} onChange={handleFile} />
            <span style={{ color: T.MUTED, fontSize: 11 }}>{t(lang, 'fileTypes')}</span>
          </div>
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
            {/* Basic fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: '1rem' }}>
              {[
                { key: 'jira_id', label: 'JIRA ID' },
                { key: 'date_created', label: t(lang, 'dateCreated') },
                { key: 'category', label: t(lang, 'category') },
                { key: 'environment', label: t(lang, 'environment') },
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

            {/* Text fields */}
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
    </div>
  );
}
