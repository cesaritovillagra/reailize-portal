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
    max_tokens: 4000,
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
    const MUTED_C    = '888888';
    const CYAN_C     = '3B82F6';
    const GREEN_C    = '00A878';
    const ORANGE_C   = 'E07000';
    const GREEN_BG   = 'E8F5EF';
    const ORANGE_BG  = 'FFF3E0';
    const CYAN_BG    = 'E8F0FE';
    const PINK_LIGHT = 'FDE8F3';
    const GRAY_DIV   = 'DDDDDD';
    const SLIDE_BG   = 'FFFFFF';

    const slide = pptx.addSlide();
    slide.background = { color: SLIDE_BG };

    // ── HEADER BAR ───────────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.52,
      fill: { color: PINK }, line: { color: PINK, pt: 0 },
    });
    slide.addText(slide_data.slide_title || `${project_name} — QBR`, {
      x: 0.25, y: 0.07, w: 9.8, h: 0.38,
      fontSize: 15, bold: true, color: WHITE, fontFace: 'Calibri', valign: 'middle',
    });
    slide.addText(slide_data.period_label || `${date_from} – ${date_to}`, {
      x: 10.2, y: 0.07, w: 2.9, h: 0.38,
      fontSize: 11, color: WHITE, fontFace: 'Calibri', align: 'right', valign: 'middle',
    });

    // ── VERTICAL DIVIDER ─────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.48, y: 0.63, w: 0.012, h: 4.6,
      fill: { color: GRAY_DIV }, line: { color: GRAY_DIV, pt: 0 },
    });

    // ── LEFT COLUMN: chart + KPI row ─────────────────────────────────────────
    slide.addText('Issues by Category', {
      x: 0.18, y: 0.66, w: 6.1, h: 0.22,
      fontSize: 9, bold: true, color: MUTED_C, fontFace: 'Calibri',
    });

    const chartData = (charts.byProblemType || [])
      .filter(d => d.label && d.label !== 'Unknown' && d.label !== 'null' && d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    if (chartData.length > 0) {
      slide.addChart(pptx.ChartType.bar, [{
        name: 'Issues',
        labels: chartData.map(d => d.label),
        values: chartData.map(d => d.value),
      }], {
        x: 0.18, y: 0.9, w: 6.1, h: 3.28,
        barDir: 'bar',
        chartColors: [PINK],
        showLegend: false,
        dataLabelPosition: 'outEnd',
        dataLabelFontSize: 9,
        dataLabelColor: DARK,
        catAxisLabelFontSize: 9,
        catAxisLabelColor: DARK,
        valAxisLabelFontSize: 8,
        valAxisMinVal: 0,
        plotAreaBorderColor: GRAY_DIV,
      });
    }

    // KPI box 1 — Total tickets (PINK)
    const total = charts.totalTickets || 0;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.18, y: 4.28, w: 2.9, h: 0.98,
      fill: { color: PINK }, line: { color: PINK, pt: 0 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: String(total), options: { fontSize: 24, bold: true, color: WHITE, breakLine: true } },
      { text: 'Tickets Managed', options: { fontSize: 9, color: WHITE } },
    ], { x: 0.18, y: 4.28, w: 2.9, h: 0.98, fontFace: 'Calibri', align: 'center', valign: 'middle' });

    // KPI box 2 — Avg resolution (CYAN)
    const avgLabel = charts.avgDays != null ? `${charts.avgDays}d` : 'N/A';
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 3.26, y: 4.28, w: 3.04, h: 0.98,
      fill: { color: CYAN_C }, line: { color: CYAN_C, pt: 0 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: avgLabel, options: { fontSize: 24, bold: true, color: WHITE, breakLine: true } },
      { text: 'Avg. Resolution', options: { fontSize: 9, color: WHITE } },
    ], { x: 3.26, y: 4.28, w: 3.04, h: 0.98, fontFace: 'Calibri', align: 'center', valign: 'middle' });

    // ── RIGHT COLUMN ─────────────────────────────────────────────────────────
    // "What Stands Out" label
    slide.addText('What Stands Out', {
      x: 6.65, y: 0.66, w: 6.5, h: 0.22,
      fontSize: 9, bold: true, color: MUTED_C, fontFace: 'Calibri',
    });

    // KPI highlight 1 (PINK)
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.65, y: 0.9, w: 3.08, h: 1.1,
      fill: { color: PINK }, line: { color: PINK, pt: 0 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: (slide_data.kpi_1?.value || '–'), options: { fontSize: 26, bold: true, color: WHITE, breakLine: true } },
      { text: (slide_data.kpi_1?.label || ''), options: { fontSize: 9, color: WHITE } },
    ], { x: 6.65, y: 0.9, w: 3.08, h: 1.1, fontFace: 'Calibri', align: 'center', valign: 'middle' });

    // KPI highlight 2 (GREEN)
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 9.87, y: 0.9, w: 3.28, h: 1.1,
      fill: { color: GREEN_C }, line: { color: GREEN_C, pt: 0 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: (slide_data.kpi_2?.value || '–'), options: { fontSize: 26, bold: true, color: WHITE, breakLine: true } },
      { text: (slide_data.kpi_2?.label || ''), options: { fontSize: 9, color: WHITE } },
    ], { x: 9.87, y: 0.9, w: 3.28, h: 1.1, fontFace: 'Calibri', align: 'center', valign: 'middle' });

    // Achievements box (green bg)
    const achievements = slide_data.achievements || [];
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.65, y: 2.12, w: 6.5, h: 1.88,
      fill: { color: GREEN_BG }, line: { color: GREEN_C, pt: 1.5 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '✅  Key Achievements\n', options: { fontSize: 10, bold: true, color: GREEN_C } },
      ...achievements.map(a => ({ text: `• ${a}\n`, options: { fontSize: 9.5, color: DARK } })),
    ], { x: 6.78, y: 2.17, w: 6.24, h: 1.78, fontFace: 'Calibri', valign: 'top', wrap: true });

    // Challenges box (orange bg)
    const challenges = slide_data.challenges || [];
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.65, y: 4.1, w: 6.5, h: 1.15,
      fill: { color: ORANGE_BG }, line: { color: ORANGE_C, pt: 1.5 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '⚠️  Challenges\n', options: { fontSize: 10, bold: true, color: ORANGE_C } },
      ...challenges.map(c => ({ text: `• ${c}\n`, options: { fontSize: 9.5, color: DARK } })),
    ], { x: 6.78, y: 4.15, w: 6.24, h: 1.05, fontFace: 'Calibri', valign: 'top', wrap: true });

    // ── BOTTOM STRIP ─────────────────────────────────────────────────────────
    // Next Steps (cyan bg)
    const nextSteps = slide_data.next_steps || [];
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.18, y: 5.38, w: 6.1, h: 1.9,
      fill: { color: CYAN_BG }, line: { color: CYAN_C, pt: 1.5 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '🎯  Next Steps & Targets\n', options: { fontSize: 10, bold: true, color: CYAN_C } },
      ...nextSteps.map(n => ({ text: `• ${n}\n`, options: { fontSize: 9.5, color: DARK } })),
    ], { x: 0.3, y: 5.44, w: 5.9, h: 1.78, fontFace: 'Calibri', valign: 'top', wrap: true });

    // Call to Action (light pink, PINK border)
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.65, y: 5.38, w: 6.5, h: 1.9,
      fill: { color: PINK_LIGHT }, line: { color: PINK, pt: 2 }, rectRadius: 0.07,
    });
    slide.addText([
      { text: '📢  Call to Action\n', options: { fontSize: 10, bold: true, color: PINK } },
      { text: slide_data.call_to_action || '', options: { fontSize: 10, color: DARK } },
    ], { x: 6.78, y: 5.44, w: 6.24, h: 1.78, fontFace: 'Calibri', valign: 'top', wrap: true });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="QBR_${date_from}_${date_to}.pptx"`);
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar PowerPoint' });
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
  "slide_title": "short title, e.g. 'IoT 5GSA Platform — Q1 2026 QBR'",
  "period_label": "e.g. 'Jan – Mar 2026'",
  "kpi_1": { "value": "XX%", "label": "max 3 words" },
  "kpi_2": { "value": "XX", "label": "max 3 words" },
  "achievements": ["bullet 1 (max 15 words)", "bullet 2 (max 15 words)", "bullet 3 (max 15 words)"],
  "challenges": ["challenge 1 (max 15 words)", "challenge 2 (max 15 words)"],
  "next_steps": ["step 1 (max 12 words)", "step 2 (max 12 words)", "step 3 (max 12 words)"],
  "call_to_action": "one sentence, max 20 words, specific and actionable"
}

RULES:
- kpi_1 and kpi_2: the 2 most impactful numbers from the period (e.g. "${closedPct}% Closed", "${avgDays != null ? avgDays + 'd Avg Resolution' : tier1Pct + '% Tier 1-led'}")
- achievements: top 3 accomplishments. Executive tone. Apply "So What" test. Each is one bullet, no sub-bullets.
- challenges: 1-2 active blockers or risks, very concise
- next_steps: 2-3 forward-looking actions, very concise
- call_to_action: specific action required from management or partners
- ALL text in English
- Return ONLY the JSON object`;
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
