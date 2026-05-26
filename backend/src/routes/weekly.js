const express   = require('express');
const pool      = require('../db/pool');
const Anthropic = require('@anthropic-ai/sdk');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const WEEKLY_PROMPT = `
You are an expert TPM assistant for César Villagra at AT&T IoT. Your job is to transform a list of JIRA tickets into a polished, executive-level Weekly Status Report.

═══════════════════════════════════════════
INPUT:
═══════════════════════════════════════════
You will receive two groups of tickets:
1. PERIOD TICKETS: tickets created or updated during the report period
2. CARRY-OVER TICKETS: older tickets that are still open/in-progress and relevant

═══════════════════════════════════════════
OUTPUT FORMAT (strict JSON):
═══════════════════════════════════════════
{
  "period_label": "May 21 – May 28, 2026",
  "overall_status": "Green" | "Yellow" | "Orange" | "Red",
  "overall_summary": "2-3 sentence executive summary of the week",
  "initiatives": [
    {
      "icon": "alert" | "pin" | "warning" | "bell" | "normal",
      "jiras": ["CTAP-XXXXX", "CTAP-YYYYY"],
      "milestone": "Short executive title of the initiative (not a ticket title)",
      "status_color": "blue" | "green" | "orange" | "red",
      "status_text": "Status narrative with embedded **BOLD** markers for key terms",
      "next_steps": "Concrete next steps, who needs to act, what is pending"
    }
  ]
}

═══════════════════════════════════════════
ICON RULES:
═══════════════════════════════════════════
- alert: High-risk item, showstopper, critical escalation
- pin: Key item, highlighted task, César-led initiative
- warning: Risk or sensitive topic, requires attention
- bell: Follow-up needed, dependency pending, management awareness
- normal: Informational, routine progress

═══════════════════════════════════════════
STATUS COLOR RULES (apply to status_text):
═══════════════════════════════════════════
- blue: COMPLETED — task closed, milestone reached
- green: ON TRACK — in progress, no blockers, on schedule
- orange: BLOCKED — requires management help, dependency, no ETA
- red: CRITICAL — showstopper, urgent management intervention needed

═══════════════════════════════════════════
TRANSFORMATION RULES:
═══════════════════════════════════════════
1. GROUP related tickets into a single initiative (e.g., 3 CHF tickets → one initiative)
2. PRIORITIZE César-led initiatives over Tier 1-led
3. ELIMINATE noise — transient issues, working-as-designed with no impact
4. TRANSFORM tasks into milestones:
   ❌ "CTAP-78097 open" → ✅ "IoT SUPIs: Tech Dev 26.06 Upgrade — connectivity validation pending"
5. Executive wording — Director-level, not operational
6. status_text must embed **BOLD** around key status words and critical items
7. overall_status reflects the most critical color across all initiatives

Respond ONLY with valid JSON. No markdown, no code blocks, no explanation.
`;

// GET /api/weekly/tickets?project_id=X&date_from=Y&date_to=Z
router.get('/tickets', authMiddleware, async (req, res) => {
  const { project_id, date_from, date_to } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id requerido' });

  try {
    // Period tickets — created during the selected period
    const periodResult = await pool.query(
      `SELECT * FROM tickets
       WHERE user_id=$1 AND project_id=$2 AND deleted=false
         AND exclude_from_weekly=false
         AND created_at >= $3::date
         AND created_at <= ($4::date + interval '1 day')
       ORDER BY created_at DESC`,
      [req.user.id, project_id, date_from, date_to]
    );

    // Carry-over tickets — older open/in-progress tickets
    const carryoverResult = await pool.query(
      `SELECT * FROM tickets
       WHERE user_id=$1 AND project_id=$2 AND deleted=false
         AND exclude_from_weekly=false
         AND status NOT IN ('Closed')
         AND created_at < $3::date
       ORDER BY created_at DESC`,
      [req.user.id, project_id, date_from]
    );

    res.json({
      period: periodResult.rows,
      carryover: carryoverResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/weekly/exclude/:id — toggle exclude_from_weekly
router.put('/exclude/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE tickets SET exclude_from_weekly = NOT exclude_from_weekly
       WHERE id=$1 AND user_id=$2 RETURNING exclude_from_weekly`,
      [req.params.id, req.user.id]
    );
    res.json({ exclude_from_weekly: result.rows[0].exclude_from_weekly });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/weekly/generate — generate weekly report via Claude
router.post('/generate', authMiddleware, async (req, res) => {
  const { period_tickets, carryover_tickets, date_from, date_to, lang } = req.body;

  if (!period_tickets?.length && !carryover_tickets?.length) {
    return res.status(400).json({ error: 'No hay tickets para generar el reporte' });
  }

  const formatTickets = (tickets) => tickets.map(t =>
    `- JIRA: ${t.jira_id || 'N/A'} | Task: ${t.task_id} | Status: ${t.status} | Led by: ${t.led_by || 'N/A'}
     Description: ${t.description?.slice(0, 300) || ''}
     Current Situation: ${t.current_situation?.slice(0, 200) || ''}
     Impact: ${t.impact?.slice(0, 150) || ''}
     Next Steps: ${t.next_steps?.slice(0, 150) || ''}
     Problem Type: ${t.problem_type || ''} | NFs: ${(t.network_functions || []).join(', ')}`
  ).join('\n\n');

  const input = `
REPORT PERIOD: ${date_from} to ${date_to}

=== PERIOD TICKETS (new/updated this week) ===
${period_tickets.length ? formatTickets(period_tickets) : 'None'}

=== CARRY-OVER TICKETS (open from previous weeks) ===
${carryover_tickets.length ? formatTickets(carryover_tickets) : 'None'}
`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const langInstruction = lang === 'en' ? '' :
      '\n\nIMPORTANT: Write all text fields in English for executive presentation.';

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `${WEEKLY_PROMPT}${langInstruction}\n\n${input}\n\nGenerate the weekly report JSON.`
      }]
    });

    const text = message.content[0].text;
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const report = JSON.parse(cleaned);
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar el reporte: ' + err.message });
  }
});

// POST /api/weekly/export — generate PPTX from report JSON
router.post('/export', authMiddleware, async (req, res) => {
  const { report, project_name } = req.body;
  if (!report) return res.status(400).json({ error: 'No report data' });

  const pptxgen = require('pptxgenjs');

  const BG     = '13131a';
  const BG2    = '1a1a24';
  const ACC    = 'F40085';
  const INK    = 'f0f0f5';
  const MUTED  = '6b6b80';
  const BORDER = '2a2a38';

  const STATUS_COLORS = { blue: '3B82F6', green: '00d084', orange: 'ffb800', red: 'ff4444' };
  const OVERALL_COLORS = { Green: '00d084', Yellow: 'ffb800', Orange: 'FF8C00', Red: 'ff4444' };
  const STATUS_LABELS = { blue: 'COMPLETED', green: 'ON TRACK', orange: 'BLOCKED', red: 'CRITICAL' };
  const ICON_MAP = { alert: '🚨', pin: '📌', warning: '⚠', bell: '🔔', normal: '●' };

  function parseBoldText(text, baseColor, fontSize) {
    const parts = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0, match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex)
        parts.push({ text: text.slice(lastIndex, match.index), options: { color: baseColor, fontSize } });
      parts.push({ text: match[1], options: { bold: true, color: INK, fontSize } });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length)
      parts.push({ text: text.slice(lastIndex), options: { color: baseColor, fontSize } });
    return parts.length ? parts : [{ text, options: { color: baseColor, fontSize } }];
  }

  try {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE'; // 13.3" × 7.5"

    // ── SLIDE 1: Cover ────────────────────────────────────────
    const cover = pres.addSlide();
    cover.background = { color: BG };

    // Left accent stripe
    cover.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.12, h: 7.5,
      fill: { color: ACC }, line: { color: ACC, pt: 0 },
    });
    // Dark overlay band (top strip)
    cover.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 13.3, h: 1.0,
      fill: { color: '0d0d14' }, line: { color: '0d0d14', pt: 0 },
    });

    // AT&T IoT label
    cover.addText('AT&T IoT', {
      x: 0.4, y: 0.22, w: 5, h: 0.45,
      fontSize: 13, color: ACC, fontFace: 'Arial',
      bold: true, margin: 0,
    });

    // Project name
    if (project_name) {
      cover.addText(project_name.toUpperCase(), {
        x: 0.4, y: 0.62, w: 9, h: 0.3,
        fontSize: 9, color: MUTED, fontFace: 'Arial', margin: 0,
      });
    }

    // Main title
    cover.addText('Weekly Status Report', {
      x: 0.4, y: 1.4, w: 10, h: 1.1,
      fontSize: 44, color: INK, fontFace: 'Arial', bold: true, margin: 0,
    });

    // Period label
    cover.addText(report.period_label || '', {
      x: 0.4, y: 2.55, w: 10, h: 0.6,
      fontSize: 22, color: MUTED, fontFace: 'Arial', margin: 0,
    });

    // Overall status badge
    const ocol = OVERALL_COLORS[report.overall_status] || MUTED;
    cover.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: 3.4, w: 2.5, h: 0.52,
      fill: { color: ocol, transparency: 75 },
      line: { color: ocol, pt: 1 },
    });
    cover.addText(`● ${(report.overall_status || 'ON TRACK').toUpperCase()}`, {
      x: 0.4, y: 3.4, w: 2.5, h: 0.52,
      fontSize: 13, color: INK, fontFace: 'Arial',
      bold: true, align: 'center', valign: 'middle', margin: 0,
    });

    // Summary text
    cover.addText(report.overall_summary || '', {
      x: 0.4, y: 4.1, w: 12.5, h: 2.4,
      fontSize: 15, color: 'c8c8d8', fontFace: 'Arial', wrap: true, valign: 'top', margin: 0,
    });

    // ── SLIDES 2+: Initiatives (2 per slide) ─────────────────
    const initiatives = report.initiatives || [];
    const SLIDE_W = 13.3;

    for (let i = 0; i < initiatives.length; i += 2) {
      const slide = pres.addSlide();
      slide.background = { color: BG };

      // Left accent stripe
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 0.08, h: 7.5,
        fill: { color: ACC }, line: { color: ACC, pt: 0 },
      });

      // Header bar
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 13.3, h: 0.55,
        fill: { color: '0d0d14' }, line: { color: '0d0d14', pt: 0 },
      });
      slide.addText(`Weekly Status Report  ·  ${report.period_label || ''}`, {
        x: 0.22, y: 0.1, w: 10, h: 0.35,
        fontSize: 9, color: MUTED, fontFace: 'Arial', margin: 0,
      });
      slide.addText(`${i + 1}–${Math.min(i + 2, initiatives.length)} of ${initiatives.length}`, {
        x: 11.5, y: 0.1, w: 1.6, h: 0.35,
        fontSize: 9, color: MUTED, fontFace: 'Arial', align: 'right', margin: 0,
      });

      const batch = [initiatives[i], initiatives[i + 1]].filter(Boolean);
      const cardH = batch.length === 1 ? 6.6 : 3.25;
      const startY = 0.7;
      const CARD_X = 0.2;
      const CARD_W = SLIDE_W - 0.4;

      batch.forEach((item, idx) => {
        const cardY = startY + idx * (cardH + 0.18);
        const scol = STATUS_COLORS[item.status_color] || MUTED;
        const slabel = STATUS_LABELS[item.status_color] || '';
        const icon = ICON_MAP[item.icon] || '●';

        // Card bg
        slide.addShape(pres.shapes.RECTANGLE, {
          x: CARD_X, y: cardY, w: CARD_W, h: cardH,
          fill: { color: BG2 },
          line: { color: BORDER, pt: 0.5 },
        });
        // Status color bar
        slide.addShape(pres.shapes.RECTANGLE, {
          x: CARD_X, y: cardY, w: 0.1, h: cardH,
          fill: { color: scol }, line: { color: scol, pt: 0 },
        });

        const cx = CARD_X + 0.22;

        // Milestone title
        slide.addText(`${icon}  ${item.milestone || ''}`, {
          x: cx, y: cardY + 0.18, w: CARD_W - 1.0, h: 0.42,
          fontSize: 15, color: INK, fontFace: 'Arial', bold: true, margin: 0,
        });

        // Status pill
        slide.addShape(pres.shapes.RECTANGLE, {
          x: CARD_X + CARD_W - 1.55, y: cardY + 0.2, w: 1.35, h: 0.35,
          fill: { color: scol, transparency: 75 },
          line: { color: scol, pt: 0.5 },
        });
        slide.addText(`● ${slabel}`, {
          x: CARD_X + CARD_W - 1.55, y: cardY + 0.2, w: 1.35, h: 0.35,
          fontSize: 9, color: INK, fontFace: 'Arial',
          bold: true, align: 'center', valign: 'middle', margin: 0,
        });

        // JIRA IDs
        const jiras = (item.jiras || []).join('  ·  ');
        if (jiras) {
          slide.addText(jiras, {
            x: cx, y: cardY + 0.63, w: CARD_W - 0.5, h: 0.26,
            fontSize: 9, color: ACC, fontFace: 'Arial', bold: true, margin: 0,
          });
        }

        // Status text with bold markers
        const statusParts = parseBoldText(item.status_text || '', 'b0b0c8', 11);
        slide.addText(statusParts, {
          x: cx, y: cardY + 0.93, w: CARD_W - 0.5, h: cardH - 2.05,
          fontSize: 11, fontFace: 'Arial', wrap: true, valign: 'top', margin: 0,
        });

        // Next steps section
        const nsY = cardY + cardH - 0.88;
        slide.addShape(pres.shapes.RECTANGLE, {
          x: cx, y: nsY, w: CARD_W - 0.45, h: 0.78,
          fill: { color: '0d0d14' },
          line: { color: BORDER, pt: 0.5 },
        });
        slide.addText('NEXT STEPS', {
          x: cx + 0.08, y: nsY + 0.06, w: 1.5, h: 0.22,
          fontSize: 8, color: ACC, fontFace: 'Arial',
          bold: true, margin: 0,
        });
        slide.addText(item.next_steps || '', {
          x: cx + 0.08, y: nsY + 0.28, w: CARD_W - 0.65, h: 0.44,
          fontSize: 10, color: MUTED, fontFace: 'Arial', wrap: true, margin: 0,
        });
      });
    }

    const pptxBuffer = await pres.write({ outputType: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="Weekly_Report_${Date.now()}.pptx"`);
    res.send(pptxBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar PPTX: ' + err.message });
  }
});

module.exports = router;
