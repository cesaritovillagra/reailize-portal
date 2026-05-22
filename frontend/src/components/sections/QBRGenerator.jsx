import { useState } from 'react';
import { T, api, apiBlob } from '../../App.jsx';
import { t } from '../../i18n.js';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

export default function QBRGenerator({ user, project, lang }) {
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
          content: result.content,
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
      setError(t(lang, 'error') + ': PowerPoint');
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
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 24, color: T.INK, marginBottom: 4 }}>
          {t(lang, 'qbrGeneratorTitle')}
        </h1>
        <div style={{ color: T.MUTED, fontSize: 13 }}>{t(lang, 'project')}: <span style={{ color: T.ACCENT }}>{project.name}</span></div>
      </div>

      {/* Date selector */}
      <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: T.INK, fontSize: 15, marginBottom: '1rem' }}>
          {t(lang, 'selectPeriod')}
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>{t(lang, 'from')}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
                padding: '0.65rem 1rem', color: T.INK, fontSize: 14, outline: 'none',
                fontFamily: 'Inter, sans-serif', colorScheme: 'dark' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: T.MUTED, fontSize: 11, marginBottom: 6,
              fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.5 }}>{t(lang, 'to')}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8,
                padding: '0.65rem 1rem', color: T.INK, fontSize: 14, outline: 'none',
                fontFamily: 'Inter, sans-serif', colorScheme: 'dark' }} />
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
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: T.INK, fontSize: 18 }}>
              {t(lang, 'qbrGenerated')}
            </h2>
            <button onClick={exportPPTX} disabled={exporting} className="btn-accent-outline"
              style={{ background: T.PANEL, border: `1px solid ${T.ACCENT}`, borderRadius: 8,
                padding: '0.65rem 1.4rem', color: T.ACCENT,
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: exporting ? 0.7 : 1 }}>
              {exporting ? t(lang, 'exporting') : t(lang, 'exportPPTX')}
            </button>
          </div>

          {/* Charts grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: '1.5rem' }}>
            <ChartCard title={t(lang, 'ticketsByStatus')}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={result.charts.byStatus} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value" nameKey="label" label={({ label, percent }) => `${label} ${(percent*100).toFixed(0)}%`}
                    labelLine={false}>
                    {result.charts.byStatus.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.PANEL2, border: `1px solid ${T.BORDER}`, borderRadius: 8, color: T.INK }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t(lang, 'ownership')}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={result.charts.byOwnership} cx="50%" cy="50%" outerRadius={65}
                    dataKey="value" nameKey="label">
                    {result.charts.byOwnership.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#F40085' : '#7AD0E2'} />
                    ))}
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

          {/* QBR Content */}
          <div style={{ background: T.PANEL, border: `1px solid ${T.BORDER}`, borderRadius: 14, padding: '2rem' }}>
            <div style={{ color: T.INK, fontSize: 14, fontFamily: 'Inter, sans-serif', lineHeight: 1.9,
              whiteSpace: 'pre-wrap' }}>
              {result.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
