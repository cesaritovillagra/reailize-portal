const express   = require('express');
const pool      = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const Anthropic  = require('@anthropic-ai/sdk');
const PptxGenJS  = require('pptxgenjs');

const router = express.Router();

// ─── GET /api/qbr/config ──────────────────────────────────────────────────────
router.get('/config', authMiddleware, async (req, res) => {
  const { project_id } = req.query;
  try {
    const result = await pool.query(
      'SELECT content FROM qbr_configs WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    res.json({ content: result.rows[0]?.content || DEFAULT_QBR_METHODOLOGY });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── Beautify markdown (for config saving) ────────────────────────────────────
async function beautifyMarkdown(rawContent) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You are a markdown formatting expert. Take the following content and reformat it using proper Markdown so it looks clean, organized, and visually appealing when rendered.

STRICT RULES:
- DO NOT add, remove, or change any information, instructions, or meaning
- DO NOT translate or rephrase — keep the exact same language and wording
- ONLY improve the visual structure: add headings (##, ###), bullet points (- ), bold text (**text**), horizontal rules (---), etc.
- Group related content under clear headings
- Use bullet points for lists or enumerated rules
- Use bold for key terms or important concepts
- Preserve all examples exactly as written
- IMPORTANT: "YO" in the text refers to the user (César), "VOS" refers to Claude. Never change or rephrase these pronouns
- Return ONLY the formatted markdown, no explanations

Content to format:
${rawContent}`
    }]
  });
  return message.content[0].text.trim();
}

// ─── PUT /api/qbr/config ──────────────────────────────────────────────────────
router.put('/config', authMiddleware, async (req, res) => {
  const { project_id, content } = req.body;
  try {
    let formatted = content;
    if (content && content.trim().length > 0) {
      try { formatted = await beautifyMarkdown(content); }
      catch (e) { console.error('Beautify error:', e.message); }
    }
    await pool.query(
      `INSERT INTO qbr_configs (user_id, project_id, content)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, project_id) DO UPDATE SET content=$3, updated_at=NOW()`,
      [req.user.id, project_id, formatted]
    );
    res.json({ ok: true, content: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// ─── POST /api/qbr/generate ───────────────────────────────────────────────────
router.post('/generate', authMiddleware, async (req, res) => {
  const { project_id, date_from, date_to } = req.body;
  try {
    const [ticketsRes, configRes] = await Promise.all([
      pool.query(
        `SELECT * FROM tickets WHERE user_id=$1 AND project_id=$2
         AND date_created >= $3 AND date_created <= $4 AND deleted=false
         ORDER BY date_created ASC`,
        [req.user.id, project_id, date_from, date_to]
      ),
      pool.query(
        'SELECT content FROM qbr_configs WHERE user_id=$1 AND project_id=$2',
        [req.user.id, project_id]
      )
    ]);

    const tickets = ticketsRes.rows;
    const config  = configRes.rows[0]?.content || DEFAULT_QBR_METHODOLOGY;

    if (tickets.length === 0)
      return res.status(400).json({ error: 'No hay tickets en ese rango de fechas' });

    const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt  = buildQBRPrompt(tickets, config, date_from, date_to, req.user);
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    // Parse JSON response
    let slide_data;
    try {
      const raw = message.content[0].text.trim().replace(/^```json\s*/,'').replace(/```$/,'');
      slide_data = JSON.parse(raw);
    } catch (e) {
      console.error('JSON parse error:', e.message, message.content[0].text.substring(0, 200));
      return res.status(500).json({ error: 'Error al parsear respuesta de la IA' });
    }

    const charts = buildChartsData(tickets);

    // Save report
    await pool.query(
      'INSERT INTO qbr_reports (user_id, project_id, date_from, date_to, content) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, project_id, date_from, date_to, JSON.stringify(slide_data)]
    );

    res.json({ slide_data, charts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar QBR' });
  }
});

// ─── POST /api/qbr/export-pptx ────────────────────────────────────────────────
router.post('/export-pptx', authMiddleware, async (req, res) => {
  const { slide_data, charts, date_from, date_to, project_name } = req.body;

  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

    // ── Palette ──────────────────────────────────────────────────────────────
    const PINK       = 'F40085';
    const WHITE      = 'FFFFFF';
    const DARK       = '2D2D2D';
    const MUTED      = '888888';
    const CYAN       = '3B82F6';
    const GREEN      = '00A878';
    const ORANGE     = 'E07000';
    const PURPLE     = '8B5CF6';
    const GREEN_BG   = 'E8F5EF';
    const ORANGE_BG  = 'FFF3E0';
    const CYAN_BG    = 'E8F0FE';
    const PINK_LIGHT = 'FDE8F3';
    const YELLOW_BG  = 'FFFDE7';
    const GRAY_LINE  = 'DDDDDD';

    // Multiple bar colors for NF chart
    const BAR_COLORS = [PINK, CYAN, GREEN, ORANGE, PURPLE, '14B8A6', 'F59E0B', 'EC4899'];

    // Normalize items (support both string[] and {icon,text}[])
    const norm = (items) => (items || []).map(i =>
      typeof i === 'string' ? { icon: '•', text: i } : i
    );

    const sd = slide_data || {};
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };

    // ── HEADER BAR ───────────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.48,
      fill: { color: PINK }, line: { color: PINK, pt: 0 },
    });
    slide.addText(sd.slide_title || `${project_name} — QBR`, {
      x: 0.25, y: 0.06, w: 9.8, h: 0.36,
      fontSize: 14, bold: true, color: WHITE, fontFace: 'Calibri', valign: 'middle',
    });
    slide.addText(sd.period_label || `${date_from} – ${date_to}`, {
      x: 10.1, y: 0.06, w: 3.0, h: 0.36,
      fontSize: 10, color: WHITE, fontFace: 'Calibri', align: 'right', valign: 'middle',
    });

    // ── VERTICAL DIVIDER ─────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.48, y: 0.58, w: 0.012, h: 6.5,
      fill: { color: GRAY_LINE }, line: { color: GRAY_LINE, pt: 0 },
    });

    // ── LEFT COLUMN ──────────────────────────────────────────────────────────
    const LX = 0.18, LW = 6.12;

    // "What Stands Out" visual panel
    const ws = sd.what_stands_out || {};
    const WS_H = 2.05;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: LX, y: 0.58, w: LW, h: WS_H,
      fill: { color: YELLOW_BG }, line: { color: GRAY_LINE, pt: 1 }, rectRadius: 0.07,
    });
    // Title
    slide.addText('What Stands Out', {
      x: LX + 0.12, y: 0.62, w: LW - 0.24, h: 0.26,
      fontSize: 11, bold: true, color: DARK, fontFace: 'Calibri', align: 'center',
    });
    // Badge: big number
    const badgeColor = ws.badge_color === 'green' ? GREEN : ws.badge_color === 'cyan' ? CYAN : PINK;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: LX + 1.3, y: 0.93, w: 1.6, h: 0.5,
      fill: { color: badgeColor }, line: { color: badgeColor, pt: 0 }, rectRadius: 0.06,
    });
    slide.addText(ws.badge_value || (charts?.totalTickets ? `${charts.totalTickets}` : '–'), {
      x: LX + 1.3, y: 0.93, w: 1.6, h: 0.5,
      fontSize: 20, bold: true, color: WHITE, fontFace: 'Calibri', align: 'center', valign: 'middle',
    });
    // Emoji next to badge
    if (ws.badge_emoji) {
      slide.addText(ws.badge_emoji, {
        x: LX + 3.05, y: 0.93, w: 0.55, h: 0.5,
        fontSize: 20, fontFace: 'Segoe UI Emoji', align: 'left', valign: 'middle',
      });
    }
    // Headline
    if (ws.headline) {
      slide.addText(ws.headline, {
        x: LX + 0.15, y: 1.5, w: LW - 0.3, h: 0.3,
        fontSize: 9, color: DARK, fontFace: 'Calibri', align: 'center', wrap: true,
      });
    }
    // Sub-label badge
    if (ws.sub_label) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: LX + 1.7, y: 1.85, w: 2.5, h: 0.24,
        fill: { color: GREEN }, line: { color: GREEN, pt: 0 }, rectRadius: 0.04,
      });
      slide.addText(ws.sub_label, {
        x: LX + 1.7, y: 1.85, w: 2.5, h: 0.24,
        fontSize: 8.5, bold: true, color: WHITE, fontFace: 'Calibri', align: 'center', valign: 'middle',
      });
    }
    // Secondary stat
    if (ws.secondary_stat) {
      slide.addText(ws.secondary_stat, {
        x: LX + 0.15, y: 2.14, w: LW - 0.3, h: 0.2,
        fontSize: 8.5, color: PINK, fontFace: 'Calibri', align: 'center', bold: true, italic: true,
      });
    }
    // Footnote
    if (ws.footnote) {
      slide.addText(ws.footnote, {
        x: LX + 0.15, y: 2.38, w: LW - 0.3, h: 0.18,
        fontSize: 7.5, color: MUTED, fontFace: 'Calibri', align: 'center', italic: true,
      });
    }

    // NF bar chart (vertical bars, multiple colors)
    const nfData = (charts?.byNF || [])
      .filter(d => d.label && d.label !== 'Unknown' && d.label !== 'null' && d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const CHART_Y = 0.58 + WS_H + 0.1;
    const CHART_H = 6.1 - CHART_Y;

    if (nfData.length > 0) {
      slide.addChart(pptx.ChartType.bar, [{
        name: 'Network Functions',
        labels: nfData.map(d => d.label),
        values: nfData.map(d => d.value),
      }], {
        x: LX, y: CHART_Y, w: LW, h: CHART_H,
        barDir: 'col',
        chartColors: nfData.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
        showLegend: false,
        dataLabelPosition: 'outEnd',
        dataLabelFontSize: 9,
        dataLabelColor: DARK,
        catAxisLabelFontSize: 8,
        catAxisLabelColor: DARK,
        valAxisLabelFontSize: 8,
        valAxisMinVal: 0,
        plotAreaBorderColor: GRAY_LINE,
        showTitle: true,
        title: 'Issues by Network Function',
        titleFontSize: 9,
        titleColor: MUTED,
      });
    }

    // Chart insight text below chart
    if (sd.chart_insight) {
      slide.addText(sd.chart_insight, {
        x: LX, y: 6.14, w: LW, h: 0.34,
        fontSize: 8, color: DARK, fontFace: 'Calibri', align: 'center', italic: true, wrap: true,
      });
    }

    // ── RIGHT COLUMN ─────────────────────────────────────────────────────────
    const RX = 6.62, RW = 6.53;
    let curY = 0.58;

    // KPI boxes (2 side by side)
    const kpi1 = sd.kpi_1 || {}, kpi2 = sd.kpi_2 || {};
    const kpiW = (RW - 0.1) / 2;
    const maxDetail = Math.max((kpi1.detail || []).length, (kpi2.detail || []).length);
    const KPI_H = 0.72 + Math.min(maxDetail, 5) * 0.18;

    [[kpi1, PINK], [kpi2, GREEN]].forEach(([kpi, color], i) => {
      const kx = RX + i * (kpiW + 0.1);
      slide.addShape(pptx.ShapeType.roundRect, {
        x: kx, y: curY, w: kpiW, h: KPI_H,
        fill: { color }, line: { color, pt: 0 }, rectRadius: 0.07,
      });
      const parts = [];
      if (kpi.emoji) parts.push({ text: kpi.emoji + ' ', options: { fontSize: 14, fontFace: 'Segoe UI Emoji', color: WHITE } });
      parts.push({ text: (kpi.value || '–') + '\n', options: { fontSize: 20, bold: true, color: WHITE, fontFace: 'Calibri' } });
      parts.push({ text: (kpi.label || '') + '\n', options: { fontSize: 8.5, color: WHITE, fontFace: 'Calibri' } });
      (kpi.detail || []).slice(0, 5).forEach(d => {
        parts.push({ text: '• ' + d + '\n', options: { fontSize: 7.5, color: WHITE, fontFace: 'Calibri' } });
      });
      slide.addText(parts, {
        x: kx + 0.1, y: curY + 0.08, w: kpiW - 0.2, h: KPI_H - 0.1,
        fontFace: 'Calibri', align: 'center', valign: 'top', wrap: true,
      });
    });
    curY += KPI_H + 0.1;

    // Helper: compute box height from item count
    const boxH = (items, titleH = 0.28, itemH = 0.3, pad = 0.2) =>
      titleH + items.length * itemH + pad;

    // Achievements (green)
    const achievements = norm(sd.achievements);
    const ACH_H = boxH(achievements);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: RX, y: curY, w: RW, h: ACH_H,
      fill: { color: GREEN_BG }, line: { color: GREEN, pt: 1.5 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '✅  Key Achievements\n', options: { fontSize: 10, bold: true, color: GREEN, fontFace: 'Calibri' } },
      ...achievements.map(a => ([
        { text: (a.icon || '•') + '  ', options: { fontSize: 9, fontFace: 'Segoe UI Emoji', color: DARK } },
        { text: (a.text || '') + '\n', options: { fontSize: 9, color: DARK, fontFace: 'Calibri' } },
      ])).flat(),
    ], { x: RX + 0.12, y: curY + 0.08, w: RW - 0.24, h: ACH_H - 0.1, fontFace: 'Calibri', valign: 'top', wrap: true });
    curY += ACH_H + 0.1;

    // Challenges (orange)
    const challenges = norm(sd.challenges);
    const CHAL_H = boxH(challenges);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: RX, y: curY, w: RW, h: CHAL_H,
      fill: { color: ORANGE_BG }, line: { color: ORANGE, pt: 1.5 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '⚠️  Challenges\n', options: { fontSize: 10, bold: true, color: ORANGE, fontFace: 'Segoe UI Emoji' } },
      ...challenges.map(c => ([
        { text: (c.icon || '•') + '  ', options: { fontSize: 9, fontFace: 'Segoe UI Emoji', color: DARK } },
        { text: (c.text || '') + '\n', options: { fontSize: 9, color: DARK, fontFace: 'Calibri' } },
      ])).flat(),
    ], { x: RX + 0.12, y: curY + 0.08, w: RW - 0.24, h: CHAL_H - 0.1, fontFace: 'Calibri', valign: 'top', wrap: true });
    curY += CHAL_H + 0.1;

    // Next Steps (cyan)
    const nextSteps = norm(sd.next_steps);
    const NS_H = boxH(nextSteps);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: RX, y: curY, w: RW, h: NS_H,
      fill: { color: CYAN_BG }, line: { color: CYAN, pt: 1.5 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '🎯  Next Steps & Targets\n', options: { fontSize: 10, bold: true, color: CYAN, fontFace: 'Segoe UI Emoji' } },
      ...nextSteps.map(n => ([
        { text: (n.icon || '•') + '  ', options: { fontSize: 9, fontFace: 'Segoe UI Emoji', color: DARK } },
        { text: (n.text || '') + '\n', options: { fontSize: 9, color: DARK, fontFace: 'Calibri' } },
      ])).flat(),
    ], { x: RX + 0.12, y: curY + 0.08, w: RW - 0.24, h: NS_H - 0.1, fontFace: 'Calibri', valign: 'top', wrap: true });
    curY += NS_H + 0.1;

    // Call to Action (light pink, PINK border)
    const CTA_H = 0.52;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: RX, y: curY, w: RW, h: CTA_H,
      fill: { color: PINK_LIGHT }, line: { color: PINK, pt: 2 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '📢  ', options: { fontSize: 10, fontFace: 'Segoe UI Emoji' } },
      { text: 'Call to Action: ', options: { fontSize: 10, bold: true, color: PINK, fontFace: 'Calibri' } },
      { text: sd.call_to_action || '', options: { fontSize: 9.5, color: DARK, fontFace: 'Calibri' } },
    ], { x: RX + 0.12, y: curY + 0.07, w: RW - 0.24, h: CTA_H - 0.1, fontFace: 'Calibri', valign: 'middle', wrap: true });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="QBR_${date_from}_${date_to}.pptx"`);
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar PowerPoint: ' + err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildChartsData(tickets) {
  const byStatus      = countBy(tickets, 'status');
  const byOwnership   = [
    { label: 'TPM-led (César)', value: tickets.filter(t => !t.tier1_involvement).length },
    { label: 'Tier 1-led',      value: tickets.filter(t =>  t.tier1_involvement).length },
  ];
  const byProblemType = countBy(tickets, 'problem_type');

  const nfCount = {};
  tickets.forEach(t => {
    (t.network_functions || []).forEach(nf => { nfCount[nf] = (nfCount[nf] || 0) + 1; });
  });
  const byNF = Object.entries(nfCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  // Avg resolution days (closed tickets only)
  const closed = tickets.filter(t => t.date_closed && t.date_created);
  let avgDays = null;
  if (closed.length > 0) {
    const total = closed.reduce((sum, t) => {
      return sum + Math.max(0, Math.round((new Date(t.date_closed) - new Date(t.date_created)) / 86400000));
    }, 0);
    avgDays = Math.round(total / closed.length);
  }

  return { byStatus, byOwnership, byProblemType, byNF, totalTickets: tickets.length, avgDays };
}

function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = item[key] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function buildQBRPrompt(tickets, config, date_from, date_to, user) {
  const total       = tickets.length;
  const closed      = tickets.filter(t => t.status === 'Closed').length;
  const closedPct   = Math.round((closed / total) * 100);
  const tier1Count  = tickets.filter(t => t.tier1_involvement).length;
  const tier1Pct    = Math.round((tier1Count / total) * 100);

  const closedTickets = tickets.filter(t => t.date_closed && t.date_created);
  let avgDays = null;
  if (closedTickets.length > 0) {
    const sum = closedTickets.reduce((acc, t) =>
      acc + Math.max(0, Math.round((new Date(t.date_closed) - new Date(t.date_created)) / 86400000)), 0);
    avgDays = Math.round(sum / closedTickets.length);
  }

  const ticketsSummary = tickets.map(t =>
    `[${t.task_id}] ${t.jira_id || ''} | Status: ${t.status} | Category: ${t.category || 'N/A'} | Problem: ${t.problem_type || 'N/A'}
     Impact: ${t.impact || ''}
     Value: ${t.value_added || ''}
     RCA: ${t.rca || ''}`
  ).join('\n\n');

  return `You are building a QBR (Quarterly Business Review) slide for ${user.name} ${user.lastname} — IoT Platform TPM.

PERIOD: ${date_from} to ${date_to}
STATS: ${total} tickets total | ${closed} closed (${closedPct}%) | ${tier1Count} Tier 1-led (${tier1Pct}%) | Avg resolution: ${avgDays != null ? avgDays + ' days' : 'N/A'}

QBR METHODOLOGY (apply strictly):
NOTE: "YO" = César (the user), "VOS" = Claude. Read as directives only — do NOT reproduce dialogue in output.
${config}

TICKET DATA:
${ticketsSummary}

YOUR TASK:
Generate content for ONE executive QBR slide. Return ONLY valid JSON — no markdown, no explanation, no code fences.

JSON structure (exact):
{
  "slide_title": "e.g. 'IoT 5GSA Platform — Q1 2026 QBR'",
  "period_label": "e.g. 'Jan – Mar 2026'",

  "kpi_1": {
    "value": "83%",
    "label": "Tickets Closed",
    "emoji": "✅",
    "detail": ["29 of 35 tickets resolved", "Top NF: SMF (12 issues)"]
  },
  "kpi_2": {
    "value": "6",
    "label": "OEMs Unblocked",
    "emoji": "🏭",
    "detail": ["Honda", "Ericsson", "Nokia", "Samsung", "ZTE", "Huawei"]
  },

  "what_stands_out": {
    "badge_value": "79%",
    "badge_color": "pink",
    "badge_emoji": "👍",
    "headline": "of issues resolved through Tier 1 + Tier 2 collaboration path",
    "sub_label": "Q1-26 Snapshot",
    "secondary_stat": "~21d avg. resolution — lowest in 4 quarters",
    "footnote": "Excludes tickets without Tier 2 involvement"
  },

  "chart_insight": "One sentence summarizing the NF chart — e.g. 'SMF and CHF drove 60% of all issues — infrastructure stability is the critical path'",

  "achievements": [
    { "icon": "🔧", "text": "Achievement 1 — max 15 words, executive tone, apply So What test" },
    { "icon": "📋", "text": "Achievement 2" },
    { "icon": "🔍", "text": "Achievement 3" }
  ],
  "challenges": [
    { "icon": "⚠️", "text": "Challenge 1 — max 15 words, concise" },
    { "icon": "🚫", "text": "Challenge 2" }
  ],
  "next_steps": [
    { "icon": "🎯", "text": "Next step 1 — max 12 words, forward-looking and actionable" },
    { "icon": "🔬", "text": "Next step 2" },
    { "icon": "🛡️", "text": "Next step 3" }
  ],
  "call_to_action": "One specific sentence, max 20 words, action required from management or partners"
}

RULES:
- kpi_1: most impactful % metric (e.g. ${closedPct}% closed rate). detail[] = up to 4 supporting facts.
- kpi_2: most impactful count metric (e.g. OEMs, tickets, NFs). detail[] = list the actual names/items when applicable.
- what_stands_out: the single most impressive insight from the period. badge_value = the key number. headline = context sentence. sub_label = period snapshot label. secondary_stat = supporting data point in italic. footnote = caveat if needed.
- chart_insight: one-sentence "so what" for the Network Functions chart.
- achievements: top 3. Icon must be a relevant emoji. Text max 15 words, executive tone, "So What" test applied.
- challenges: 1-2 active blockers/risks. Concise. Relevant emoji icon.
- next_steps: 2-3 forward-looking actions. Concise. Relevant emoji icon.
- call_to_action: specific ask to management/partners.
- ALL text in English.
- Return ONLY the JSON object, no markdown, no code fences.`;
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${day}, ${y}`;
}

const DEFAULT_QBR_METHODOLOGY = `# QBR Methodology — César Villagra

## 1. Fundamental Principle: The Absence Test
Before including any item: "What breaks, stalls, or delays if César is not here?"
If the answer is "nothing" → exclude it.

## 2. Voice & Tone: Always "Owner", never "Contributor"
Never use: Helped, Supported, Assisted, Participated
Always use: Led, Drove, Owned, Ensured, Enabled, Established, Prevented, Secured, Delivered

## 3. Achievement Structure (mandatory)
1. IMPACT / OUTCOME → What changed?
2. WHAT I DID → How did I make it possible?
3. SUPPORTING DATA → What number validates the scale?

## 4. QBR Structure
### Section 1 — Platform Execution & Readiness
### Section 2 — OEM Enablement & Integration Management
### Section 3 — Subscriber & Transition Management
### Section 4 — Challenges & Risks
Format: Problem → Impact → Mitigation → Forward plan
### Section 5 — Forward Momentum

## 5. The "So What" Test
After every bullet: ask "So what?" — if no clear answer, rewrite it.

## 6. Metrics
Numbers support the story — they never lead it.
Always pair: scale + context + impact in the same sentence.`;

module.exports = router;
