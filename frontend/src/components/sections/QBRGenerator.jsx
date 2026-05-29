import { useState, useRef } from 'react';
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

function KpiBox({ value, label, color }) {
  return (
    <div style={{ background: color, borderRadius: 12, padding: '1rem 1.5rem', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
        {label}
      </div>
    </div>
  );
}

function ContentBox({ icon, title, items, bg, border, titleColor }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '1rem 1.2rem', flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: titleColor, fontFamily: "'Space Grotesk', sans-serif", marginBottom: 8 }}>
        {icon} {title}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: 13, color: T.INK, fontFamily: 'Inter, sans-serif',
          padding: '3px 0', display: 'flex', gap: 6 }}>
          <span style={{ color: border, flexShrink: 0 }}>•</span>
          <span>{item}</span>
        </div>
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
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: `1px solid ${T.BORDER}` }}>
        {[
          ['generate',    lang === 'es' ? '📊 Generar QBR'     : '📊 Generate QBR'],
          ['methodology', lang === 'es' ? '⚙️ Formato de QBRs' : '⚙️ QBR Format'],
        ].map(([key, label]) => (
          <div key={key} onClick={() => setQbrTab(key)}
            style={{ padding: '0.6rem 1.2rem', fontSize: 14, cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
              color: qbrTab === key ? T.ACCENT : T.MUTED,
              borderBottom: qbrTab === key ? `2px solid ${T.ACCENT}` : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Metodología QBR tab */}
      {qbrTab === 'methodology' && <QBRConfig user={user} project={project} lang={lang} />}

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
            <KpiBox value={result.slide_data.kpi_1?.value} label={result.slide_data.kpi_1?.label} color={T.ACCENT} />
            <KpiBox value={result.slide_data.kpi_2?.value} label={result.slide_data.kpi_2?.label} color='#00A878' />
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
