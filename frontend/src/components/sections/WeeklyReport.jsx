import { useState, useEffect } from 'react';
import { api, apiBlob, T } from '../../App.jsx';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getDefaultDates() {
  const today = new Date();
  const day = today.getDay();
  const daysSinceWed = ((day - 3 + 7) % 7) || 7;
  const lastWed = new Date(today);
  lastWed.setDate(today.getDate() - daysSinceWed);
  const prevWed = new Date(lastWed);
  prevWed.setDate(lastWed.getDate() - 7);
  return {
    from: prevWed.toISOString().slice(0, 10),
    to:   lastWed.toISOString().slice(0, 10),
  };
}

function BoldText({ text, baseStyle }) {
  if (!text) return null;
  const parts = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0, match, key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex)
      parts.push(<span key={key++} style={baseStyle}>{text.slice(lastIndex, match.index)}</span>);
    parts.push(<strong key={key++} style={{ ...baseStyle, color: T.INK, fontWeight: 700 }}>{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length)
    parts.push(<span key={key++} style={baseStyle}>{text.slice(lastIndex)}</span>);
  return <>{parts}</>;
}

const STATUS_COLORS = {
  blue:   '#3B82F6',
  green:  T.SUCCESS,
  orange: T.WARN,
  red:    T.DANGER,
};
const OVERALL_COLORS = {
  Green:  T.SUCCESS,
  Yellow: T.WARN,
  Orange: '#FF8C00',
  Red:    T.DANGER,
};
const STATUS_LABELS = {
  blue:   'COMPLETED',
  green:  'ON TRACK',
  orange: 'BLOCKED',
  red:    'CRITICAL',
};
const ICONS = {
  alert:   '🚨',
  pin:     '📌',
  warning: '⚠️',
  bell:    '🔔',
  normal:  '●',
};

// ─── sub-components ───────────────────────────────────────────────────────────

function TicketRow({ ticket, onToggleExclude }) {
  const excluded = ticket.exclude_from_weekly;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0.55rem 0.9rem',
      borderRadius: 8,
      background: excluded ? 'rgba(255,255,255,0.02)' : T.PANEL2,
      border: `1px solid ${excluded ? 'rgba(255,255,255,0.05)' : T.BORDER}`,
      marginBottom: 6,
      opacity: excluded ? 0.45 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Exclude toggle */}
      <button
        onClick={() => onToggleExclude(ticket.id)}
        title={excluded ? 'Incluir en reporte' : 'Excluir del reporte'}
        style={{
          flexShrink: 0,
          width: 22, height: 22, borderRadius: '50%',
          background: excluded ? 'transparent' : `rgba(244,0,133,0.15)`,
          border: `1px solid ${excluded ? T.BORDER : T.ACCENT}`,
          color: excluded ? T.MUTED : T.ACCENT,
          fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>
        {excluded ? '+' : '×'}
      </button>

      {/* Status dot */}
      <span style={{
        flexShrink: 0, width: 8, height: 8, borderRadius: '50%',
        background: ticket.status === 'Closed' ? T.SUCCESS
          : ticket.status === 'Blocked' || ticket.status === 'Escalated' ? T.WARN
          : T.MUTED,
      }} />

      {/* JIRA ID */}
      {ticket.jira_id && (
        <span style={{
          flexShrink: 0,
          fontSize: 11, fontWeight: 700, color: T.ACCENT,
          fontFamily: 'Space Grotesk, sans-serif',
          background: 'rgba(244,0,133,0.08)',
          padding: '2px 7px', borderRadius: 4,
          border: `1px solid rgba(244,0,133,0.2)`,
        }}>{ticket.jira_id}</span>
      )}

      {/* Description */}
      <span style={{
        flex: 1, fontSize: 12, color: T.INK,
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {ticket.description?.slice(0, 100) || ticket.task_id}
      </span>

      {/* Status badge */}
      <span style={{
        flexShrink: 0,
        fontSize: 10, fontWeight: 600,
        fontFamily: 'Space Grotesk, sans-serif',
        color: ticket.status === 'Closed' ? T.SUCCESS
          : ticket.status === 'Open' ? T.MUTED : T.WARN,
        padding: '2px 8px', borderRadius: 4,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${T.BORDER}`,
      }}>{ticket.status}</span>
    </div>
  );
}

function InitiativeCard({ item }) {
  const scol = STATUS_COLORS[item.status_color] || T.MUTED;
  const icon = ICONS[item.icon] || '●';
  const label = STATUS_LABELS[item.status_color] || item.status_color?.toUpperCase();

  return (
    <div style={{
      position: 'relative',
      background: T.PANEL2,
      border: `1px solid ${T.BORDER}`,
      borderLeft: `3px solid ${scol}`,
      borderRadius: 10,
      padding: '1rem 1.2rem',
      marginBottom: 14,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: T.INK,
              fontFamily: 'Space Grotesk, sans-serif',
            }}>{item.milestone}</span>
            {/* Status pill */}
            <span style={{
              fontSize: 10, fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: scol,
              background: `${scol}18`,
              border: `1px solid ${scol}55`,
              padding: '2px 8px', borderRadius: 20,
            }}>{label}</span>
          </div>
          {/* JIRA chips */}
          {item.jiras?.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {item.jiras.map(j => (
                <span key={j} style={{
                  fontSize: 10, fontWeight: 600,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: T.ACCENT,
                  background: 'rgba(244,0,133,0.08)',
                  border: `1px solid rgba(244,0,133,0.2)`,
                  padding: '1px 7px', borderRadius: 4,
                }}>{j}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status text */}
      <p style={{
        fontSize: 13, lineHeight: 1.65,
        color: 'rgba(240,240,245,0.75)',
        fontFamily: 'Inter, sans-serif',
        margin: '0 0 10px 0',
      }}>
        <BoldText text={item.status_text} baseStyle={{ color: 'rgba(240,240,245,0.75)', fontSize: 13, fontFamily: 'Inter, sans-serif' }} />
      </p>

      {/* Next steps */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${T.BORDER}`,
        borderRadius: 6, padding: '0.55rem 0.8rem',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ACCENT,
          fontFamily: 'Space Grotesk, sans-serif', letterSpacing: 0.8,
          marginBottom: 4 }}>NEXT STEPS</div>
        <div style={{ fontSize: 12, color: T.MUTED, fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>
          {item.next_steps}
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function WeeklyReport({ user, project, lang }) {
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom]   = useState(defaults.from);
  const [dateTo,   setDateTo]     = useState(defaults.to);
  const [tickets,  setTickets]    = useState(null);   // { period, carryover }
  const [loading,  setLoading]    = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report,   setReport]     = useState(null);
  const [exporting, setExporting] = useState(false);
  const [error,    setError]      = useState('');

  // Reset on project change
  useEffect(() => { setTickets(null); setReport(null); setError(''); }, [project?.id]);

  const loadTickets = async () => {
    if (!project) return;
    setLoading(true); setError(''); setReport(null);
    try {
      const data = await api(`/weekly/tickets?project_id=${project.id}&date_from=${dateFrom}&date_to=${dateTo}`);
      setTickets(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExclude = async (id) => {
    try {
      const res = await api(`/weekly/exclude/${id}`, { method: 'PUT' });
      setTickets(prev => {
        const update = (arr) => arr.map(t => t.id === id ? { ...t, exclude_from_weekly: res.exclude_from_weekly } : t);
        return { period: update(prev.period), carryover: update(prev.carryover) };
      });
    } catch (e) { setError(e.message); }
  };

  const generateReport = async () => {
    if (!tickets) return;
    const period   = tickets.period.filter(t => !t.exclude_from_weekly);
    const carryover = tickets.carryover.filter(t => !t.exclude_from_weekly);
    if (!period.length && !carryover.length) {
      setError('No hay tickets incluidos para generar el reporte.'); return;
    }
    setGenerating(true); setError('');
    try {
      const res = await api('/weekly/generate', {
        method: 'POST',
        body: { period_tickets: period, carryover_tickets: carryover,
                date_from: dateFrom, date_to: dateTo, lang: 'en' }
      });
      setReport(res);
    } catch (e) {
      setError('Error al generar: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const exportPPTX = async () => {
    if (!report) return;
    setExporting(true); setError('');
    try {
      const blob = await apiBlob('/weekly/export', {
        method: 'POST',
        body: { report, project_name: project?.name || 'IoT Project' }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const label = (report.period_label || '').replace(/[^a-zA-Z0-9]/g, '_');
      a.href = url;
      a.download = `Weekly_Status_${label || Date.now()}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Error al exportar: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── no project guard ───────────────────────────────────
  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ color: T.MUTED, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
            Seleccioná un proyecto para generar el reporte semanal.
          </p>
        </div>
      </div>
    );
  }

  const overallCol = OVERALL_COLORS[report?.overall_status] || T.MUTED;
  const includedPeriod   = tickets?.period.filter(t => !t.exclude_from_weekly).length ?? 0;
  const includedCarryover = tickets?.carryover.filter(t => !t.exclude_from_weekly).length ?? 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700,
            fontFamily: 'Space Grotesk, sans-serif', color: T.INK }}>
            Weekly Status Report
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 700, color: T.ACCENT,
            background: 'rgba(244,0,133,0.1)', border: `1px solid rgba(244,0,133,0.3)`,
            padding: '2px 8px', borderRadius: 20, letterSpacing: 0.8,
            fontFamily: 'Space Grotesk, sans-serif',
          }}>EXECUTIVE</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: T.MUTED }}>
          {project.name} — AI-powered executive summary from JIRA tickets
        </p>
      </div>

      {/* ── Date range + Load ── */}
      <div style={{
        background: T.PANEL2, border: `1px solid ${T.BORDER}`,
        borderRadius: 10, padding: '1rem 1.2rem',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        marginBottom: 22,
      }}>
        <span style={{ fontSize: 12, color: T.MUTED, fontFamily: 'Space Grotesk, sans-serif',
          letterSpacing: 0.5, whiteSpace: 'nowrap' }}>PERIOD</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={dateInputStyle} />
        <span style={{ color: T.MUTED, fontSize: 13 }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={dateInputStyle} />
        <div style={{ flex: 1 }} />
        <button onClick={loadTickets} disabled={loading}
          style={btnStyle(loading)}>
          {loading ? '⏳ Cargando…' : '🔄 Cargar Tickets'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.08)', border: `1px solid rgba(255,68,68,0.3)`,
          borderRadius: 8, padding: '0.7rem 1rem', marginBottom: 18,
          fontSize: 13, color: '#ff8888', fontFamily: 'Inter, sans-serif',
        }}>⚠️ {error}</div>
      )}

      {/* ── Ticket lists ── */}
      {tickets && (
        <div style={{ marginBottom: 22 }}>

          {/* Period tickets */}
          <Section
            title="Period Tickets"
            subtitle={`Created / updated ${dateFrom} → ${dateTo}`}
            count={tickets.period.length}
            includedCount={includedPeriod}
            accent="#3B82F6"
          >
            {tickets.period.length === 0
              ? <Empty text="No hay tickets en este período." />
              : tickets.period.map(t => (
                  <TicketRow key={t.id} ticket={t} onToggleExclude={toggleExclude} />
                ))
            }
          </Section>

          {/* Carry-over tickets */}
          <Section
            title="Carry-Over Tickets"
            subtitle="Older open / in-progress tickets"
            count={tickets.carryover.length}
            includedCount={includedCarryover}
            accent={T.WARN}
          >
            {tickets.carryover.length === 0
              ? <Empty text="No hay tickets carry-over." />
              : tickets.carryover.map(t => (
                  <TicketRow key={t.id} ticket={t} onToggleExclude={toggleExclude} />
                ))
            }
          </Section>

          {/* Generate button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={generateReport} disabled={generating || (!includedPeriod && !includedCarryover)}
              style={btnStyle(generating || (!includedPeriod && !includedCarryover), true)}>
              {generating
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</span> Generando con Claude…</>
                : `✨ Generate Report (${includedPeriod + includedCarryover} tickets)`}
            </button>
          </div>
        </div>
      )}

      {/* ── Generating animation ── */}
      {generating && (
        <div style={{
          textAlign: 'center', padding: '2rem', color: T.MUTED,
          fontSize: 13, fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.7 }}>🤖</div>
          Claude is analyzing {includedPeriod + includedCarryover} tickets and building your executive report…
        </div>
      )}

      {/* ── Report output ── */}
      {report && (
        <div>
          {/* Report header */}
          <div style={{
            background: T.PANEL2, border: `1px solid ${T.BORDER}`,
            borderRadius: 10, padding: '1.2rem 1.4rem',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: T.MUTED, letterSpacing: 0.8,
                  fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>EXECUTIVE SUMMARY</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.INK,
                  fontFamily: 'Space Grotesk, sans-serif' }}>
                  {report.period_label}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Overall status badge */}
                <div style={{
                  padding: '5px 14px', borderRadius: 20,
                  background: `${overallCol}18`,
                  border: `1px solid ${overallCol}55`,
                  fontSize: 12, fontWeight: 700,
                  color: overallCol,
                  fontFamily: 'Space Grotesk, sans-serif',
                }}>
                  ● {report.overall_status?.toUpperCase()}
                </div>
                {/* Export button */}
                <button onClick={exportPPTX} disabled={exporting}
                  style={{
                    background: exporting ? T.PANEL : 'rgba(244,0,133,0.12)',
                    border: `1px solid ${T.ACCENT}`,
                    color: T.ACCENT,
                    padding: '5px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                    opacity: exporting ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}>
                  {exporting ? '⏳ Exportando…' : '⬇ Export PPTX'}
                </button>
              </div>
            </div>

            {/* Summary text */}
            <p style={{
              margin: 0, fontSize: 13, lineHeight: 1.7,
              color: 'rgba(240,240,245,0.8)',
              fontFamily: 'Inter, sans-serif',
            }}>
              {report.overall_summary}
            </p>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLORS[key], flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, color: T.MUTED, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Initiatives */}
          {report.initiatives?.map((item, i) => (
            <InitiativeCard key={i} item={item} />
          ))}

          {/* Bottom export button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={exportPPTX} disabled={exporting}
              style={btnStyle(exporting, true)}>
              {exporting ? '⏳ Exportando…' : '⬇ Export to PowerPoint'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── style helpers ────────────────────────────────────────────────────────────

const dateInputStyle = {
  background: T.PANEL, border: `1px solid ${T.BORDER}`,
  color: T.INK, padding: '6px 10px', borderRadius: 8,
  fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
  cursor: 'pointer',
  colorScheme: 'dark',
};

function btnStyle(disabled, primary = false) {
  return {
    background: disabled
      ? `rgba(255,255,255,0.04)`
      : primary ? T.ACCENT : 'rgba(244,0,133,0.1)',
    border: `1px solid ${disabled ? T.BORDER : T.ACCENT}`,
    color: disabled ? T.MUTED : primary ? '#fff' : T.ACCENT,
    padding: '8px 18px', borderRadius: 8,
    fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Space Grotesk, sans-serif',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: 7,
  };
}

function Section({ title, subtitle, count, includedCount, accent, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      marginBottom: 16,
      border: `1px solid ${T.BORDER}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0.75rem 1rem',
          background: T.PANEL2,
          cursor: 'pointer',
          borderBottom: open ? `1px solid ${T.BORDER}` : 'none',
        }}>
        <span style={{ fontSize: 13, color: T.MUTED, transition: 'transform 0.2s',
          transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: T.INK,
          fontFamily: 'Space Grotesk, sans-serif',
        }}>{title}</span>
        <span style={{
          fontSize: 11, color: accent,
          background: `${accent}15`, border: `1px solid ${accent}40`,
          padding: '1px 8px', borderRadius: 20,
          fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
        }}>{includedCount}/{count}</span>
        <span style={{ fontSize: 11, color: T.MUTED, fontFamily: 'Inter, sans-serif' }}>{subtitle}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.MUTED, fontFamily: 'Inter, sans-serif' }}>
          {open ? 'Clic para colapsar' : 'Clic para expandir'}
        </span>
      </div>
      {open && (
        <div style={{ padding: '0.8rem 1rem', background: T.PANEL }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <p style={{ margin: 0, padding: '0.5rem 0', fontSize: 12, color: T.MUTED,
      fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
      {text}
    </p>
  );
}
