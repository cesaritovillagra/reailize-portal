const express  = require('express');
const pool     = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const PptxGenJS = require('pptxgenjs');

const router = express.Router();

// GET /api/qbr/config?project_id=X
router.get('/config', authMiddleware, async (req, res) => {
  const { project_id } = req.query;
  try {
    const result = await pool.query(
      'SELECT content FROM qbr_configs WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    if (result.rows.length === 0) {
      // Return default methodology
      res.json({ content: DEFAULT_QBR_METHODOLOGY });
    } else {
      res.json({ content: result.rows[0].content });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

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

// PUT /api/qbr/config
router.put('/config', authMiddleware, async (req, res) => {
  const { project_id, content } = req.body;
  try {
    // Auto-beautify before saving (skip if content is empty)
    let formatted = content;
    if (content && content.trim().length > 0) {
      try {
        formatted = await beautifyMarkdown(content);
      } catch (e) {
        console.error('Beautify error (saving raw):', e.message);
      }
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

// POST /api/qbr/generate — generate QBR content
router.post('/generate', authMiddleware, async (req, res) => {
  const { project_id, date_from, date_to, lang } = req.body;
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
      return res.status(400).json({ error: lang === 'en' ? 'No tickets found in that date range' : 'No hay tickets en ese rango de fechas' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = buildQBRPrompt(tickets, config, date_from, date_to, req.user, lang || 'es');

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const qbrText = message.content[0].text;

    // Build charts data
    const charts = buildChartsData(tickets);

    // Save report
    await pool.query(
      'INSERT INTO qbr_reports (user_id, project_id, date_from, date_to, content) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, project_id, date_from, date_to, qbrText]
    );

    res.json({ content: qbrText, charts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar QBR' });
  }
});

// POST /api/qbr/export-pptx — export to PowerPoint
router.post('/export-pptx', authMiddleware, async (req, res) => {
  const { content, charts, date_from, date_to, project_name } = req.body;

  try {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    // Brand colors
    const PINK    = 'F40085';
    const DARK    = '4D4D4D';
    const LIGHT   = 'AFAEAF';
    const CYAN    = '7AD0E2';
    const BLACK   = '0D0D0D';
    const WHITE   = 'FFFFFF';

    // --- SLIDE 1: Cover ---
    const cover = pptx.addSlide();
    cover.background = { color: BLACK };
    cover.addText('reailize', {
      x: 0.5, y: 1.5, w: 9, h: 1.2,
      fontSize: 54, bold: true, color: WHITE,
      fontFace: 'Arial'
    });
    cover.addText('ai', {
      x: 1.72, y: 1.5, w: 1.1, h: 1.2,
      fontSize: 54, bold: true, color: PINK,
      fontFace: 'Arial'
    });
    cover.addText('Quarterly Business Review', {
      x: 0.5, y: 2.9, w: 9, h: 0.6,
      fontSize: 22, color: LIGHT, fontFace: 'Arial'
    });
    cover.addText(`${formatDate(date_from)} — ${formatDate(date_to)}`, {
      x: 0.5, y: 3.6, w: 9, h: 0.5,
      fontSize: 16, color: CYAN, fontFace: 'Arial'
    });
    cover.addText(project_name || 'Project', {
      x: 0.5, y: 4.2, w: 9, h: 0.5,
      fontSize: 14, color: LIGHT, fontFace: 'Arial'
    });
    cover.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 5.0, w: 2, h: 0.06, fill: { color: PINK }
    });

    // --- SLIDE 2: Charts ---
    const chartSlide = pptx.addSlide();
    chartSlide.background = { color: '13131A' };
    chartSlide.addText('Metrics Overview', {
      x: 0.4, y: 0.2, w: 9, h: 0.6,
      fontSize: 20, bold: true, color: WHITE, fontFace: 'Arial'
    });
    chartSlide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 0.75, w: 1.5, h: 0.05, fill: { color: PINK }
    });

    // Chart 1: By Status
    chartSlide.addChart(pptx.ChartType.doughnut, [{
      name: 'Status',
      labels: charts.byStatus.map(d => d.label),
      values: charts.byStatus.map(d => d.value)
    }], {
      x: 0.3, y: 1.0, w: 4.3, h: 2.8,
      title: 'Tickets by Status',
      titleFontSize: 12, titleColor: WHITE,
      dataLabelColor: WHITE, dataLabelFontSize: 11,
      chartColors: [PINK, CYAN, '00D084'],
      showLegend: true, legendColor: WHITE, legendFontSize: 10
    });

    // Chart 2: TPM vs Tier1
    chartSlide.addChart(pptx.ChartType.doughnut, [{
      name: 'Ownership',
      labels: charts.byOwnership.map(d => d.label),
      values: charts.byOwnership.map(d => d.value)
    }], {
      x: 5.0, y: 1.0, w: 4.3, h: 2.8,
      title: 'TPM-led vs Tier 1-led',
      titleFontSize: 12, titleColor: WHITE,
      dataLabelColor: WHITE, dataLabelFontSize: 11,
      chartColors: [PINK, CYAN],
      showLegend: true, legendColor: WHITE, legendFontSize: 10
    });

    // Chart 3: By Problem Type
    chartSlide.addChart(pptx.ChartType.bar, [{
      name: 'Problem Type',
      labels: charts.byProblemType.map(d => d.label),
      values: charts.byProblemType.map(d => d.value)
    }], {
      x: 0.3, y: 4.0, w: 4.3, h: 2.8,
      title: 'Distribution by Problem Type',
      titleFontSize: 12, titleColor: WHITE,
      dataLabelColor: WHITE, dataLabelFontSize: 10,
      chartColors: [PINK],
      catAxisLabelColor: WHITE, catAxisLabelFontSize: 9,
      valAxisLabelColor: WHITE
    });

    // Chart 4: By Network Function
    chartSlide.addChart(pptx.ChartType.bar, [{
      name: 'Network Functions',
      labels: charts.byNF.map(d => d.label),
      values: charts.byNF.map(d => d.value)
    }], {
      x: 5.0, y: 4.0, w: 4.3, h: 2.8,
      title: 'Network Functions Involved',
      titleFontSize: 12, titleColor: WHITE,
      dataLabelColor: WHITE, dataLabelFontSize: 10,
      chartColors: [CYAN],
      catAxisLabelColor: WHITE, catAxisLabelFontSize: 9,
      valAxisLabelColor: WHITE
    });

    // --- CONTENT SLIDES ---
    const sections = parseQBRSections(content);
    sections.forEach(section => {
      const slide = pptx.addSlide();
      slide.background = { color: '13131A' };
      slide.addText(section.title, {
        x: 0.4, y: 0.2, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: WHITE, fontFace: 'Arial'
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.4, y: 0.75, w: 1.5, h: 0.05, fill: { color: PINK }
      });
      slide.addText(section.content, {
        x: 0.4, y: 1.0, w: 9, h: 5.5,
        fontSize: 13, color: 'D0D0D8', fontFace: 'Arial',
        valign: 'top', wrap: true, bullet: { type: 'bullet', color: PINK }
      });
    });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="QBR_${date_from}_${date_to}.pptx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar PowerPoint' });
  }
});

// ─── Helpers ────────────────────────────────────────────────

function buildChartsData(tickets) {
  const byStatus = countBy(tickets, 'status');
  const byOwnership = [
    { label: 'TPM-led (César)', value: tickets.filter(t => !t.tier1_involvement).length },
    { label: 'Tier 1-led',      value: tickets.filter(t => t.tier1_involvement).length }
  ];
  const byProblemType = countBy(tickets, 'problem_type');
  const nfCount = {};
  tickets.forEach(t => {
    (t.network_functions || []).forEach(nf => {
      nfCount[nf] = (nfCount[nf] || 0) + 1;
    });
  });
  const byNF = Object.entries(nfCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  return { byStatus, byOwnership, byProblemType, byNF };
}

function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = item[key] || 'Unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function parseQBRSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;
  lines.forEach(line => {
    if (line.startsWith('## ') || line.startsWith('# ')) {
      if (current) sections.push(current);
      current = { title: line.replace(/^#{1,2}\s/, ''), content: '' };
    } else if (current) {
      current.content += line + '\n';
    }
  });
  if (current) sections.push(current);
  if (sections.length === 0) sections.push({ title: 'QBR', content });
  return sections;
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${day}, ${y}`;
}

function buildQBRPrompt(tickets, config, date_from, date_to, user, lang) {
  const ticketsSummary = tickets.map(t =>
    `- [${t.task_id}] ${t.jira_id || ''} | ${t.status} | ${t.led_by} | ${t.problem_type}
     Impact: ${t.impact}
     Value: ${t.value_added}
     Strategic: ${t.strategic_relevance}`
  ).join('\n');

  const langInstruction = lang === 'en'
    ? 'Write the entire QBR document in English. Director-Level tone.'
    : 'Escribí todo el documento QBR en español. Tono ejecutivo, nivel Director.';

  return `You are building a QBR (Quarterly Business Review) presentation for ${user.name} ${user.lastname}.

PERIOD: ${date_from} to ${date_to}
TOTAL TICKETS: ${tickets.length}

QBR METHODOLOGY TO FOLLOW:
NOTE: This methodology may be written as a dialogue where "YO" = the user (César) and "VOS" = Claude. Read it as directives and apply them as rules. Do NOT reproduce this dialogue format in the output — the QBR must always be clean, professional, executive-level content.
${config}

TICKET DATA:
${ticketsSummary}

Generate a complete QBR document in Markdown format, using the methodology above.
Structure it with ## headers for each section.
${langInstruction}
Focus on impact, value, leadership, and strategic relevance — not task lists.
Apply the "Absence Test" and "So What Test" to every item.`;
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
