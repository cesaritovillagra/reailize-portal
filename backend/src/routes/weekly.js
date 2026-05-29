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
    // All tickets within the selected date range (user-defined window)
    const periodResult = await pool.query(
      `SELECT * FROM tickets
       WHERE user_id=$1 AND project_id=$2 AND deleted=false
         AND date_created >= $3::date
         AND date_created <= ($4::date + interval '1 day')
       ORDER BY date_created DESC`,
      [req.user.id, project_id, date_from, date_to]
    );

    res.json({
      period: periodResult.rows,
      carryover: [],
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
  const { period_tickets, carryover_tickets, date_from, date_to, lang, project_id } = req.body;

  if (!period_tickets?.length && !carryover_tickets?.length) {
    return res.status(400).json({ error: 'No hay tickets para generar el reporte' });
  }

  // Load user's weekly guide from DB
  let weeklyGuideSection = '';
  try {
    const guideRes = await pool.query(
      'SELECT content FROM weekly_guide WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    const guideContent = guideRes.rows[0]?.content?.trim();
    if (guideContent) {
      weeklyGuideSection = `\n\n═══════════════════════════════════════════\nUSER-DEFINED FORMAT GUIDE (apply with highest priority):\n═══════════════════════════════════════════\nNOTE: This guide may be written as a dialogue where "YO" = the user (César) and "VOS" = Claude. Read it as directives and apply them as rules. Do NOT reproduce this dialogue format in the output — the report must always be clean, professional, executive-level content.\n\n${guideContent}\n`;
    }
  } catch (e) {
    console.error('Error loading weekly guide:', e.message);
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
        content: `${WEEKLY_PROMPT}${weeklyGuideSection}${langInstruction}\n\n${input}\n\nGenerate the weekly report JSON.`
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

  // ── Colors ──────────────────────────────────────────────────────────────────
  const ACC       = 'F40085';
  const WHITE     = 'FFFFFF';
  const DARK      = '1A1A1A';
  const MUTED_TXT = '444444';
  const ROW_ODD   = 'FFFFFF';
  const ROW_EVEN  = 'FDE8F4';
  const BORDER_C  = 'E0A0CC';

  const STATUS_COLORS = { blue: '3B82F6', green: '00A878', orange: 'FF8C00', red: 'D32F2F' };
  const STATUS_LABELS = { blue: 'COMPLETED', green: 'ON TRACK', orange: 'BLOCKED', red: 'CRITICAL' };
  const ICON_MAP      = { alert: '🚨', pin: '📌', warning: '⚠️', bell: '🔔', normal: '●' };
  const EMOJI_ICONS   = new Set(['alert', 'pin', 'warning', 'bell']);

  // Parse **bold** and also color "COMPLETED" / "→ COMPLETED" in ACC
  function parseRichText(text, fontSize) {
    const parts = [];
    // Split by **bold** and COMPLETED markers
    const regex = /(\*\*(.*?)\*\*|→\s*COMPLETED\.?|COMPLETED\.?)/g;
    let last = 0, match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last)
        parts.push({ text: text.slice(last, match.index), options: { fontSize, color: MUTED_TXT, fontFace: 'Calibri' } });
      if (match[2]) {
        parts.push({ text: match[2], options: { fontSize, bold: true, color: DARK, fontFace: 'Calibri' } });
      } else {
        parts.push({ text: match[0], options: { fontSize, bold: true, color: ACC, fontFace: 'Calibri' } });
      }
      last = regex.lastIndex;
    }
    if (last < text.length)
      parts.push({ text: text.slice(last), options: { fontSize, color: MUTED_TXT, fontFace: 'Calibri' } });
    return parts.length ? parts : [{ text, options: { fontSize, color: MUTED_TXT, fontFace: 'Calibri' } }];
  }

  try {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE'; // 13.3" × 7.5"

    // ── TABLE SLIDES ─────────────────────────────────────────────────────────
    const initiatives = report.initiatives || [];
    const ROWS_PER_SLIDE = 4;

    for (let start = 0; start < initiatives.length; start += ROWS_PER_SLIDE) {
      const batch = initiatives.slice(start, start + ROWS_PER_SLIDE);
      const slide = pres.addSlide();
      slide.background = { color: WHITE };


      // Slide header
      slide.addText('Weekly Status Report', {
        x: 0.3, y: 0.25, w: 7, h: 0.35,
        fontSize: 10, color: MUTED_TXT, fontFace: 'Calibri', bold: true, margin: 0,
      });
      slide.addText(report.period_label || '', {
        x: 7, y: 0.25, w: 6, h: 0.35,
        fontSize: 10, color: MUTED_TXT, fontFace: 'Calibri', align: 'right', margin: 0,
      });

      // Build table rows
      const LEFT_W  = 4.2;
      const RIGHT_W = 8.6;
      const ROW_H   = batch.length <= 3 ? 1.65 : 1.3;
      const tableY  = 0.72;

      // Header row
      const headerRow = [
        {
          text: 'MILESTONE / ACTIVITY',
          options: { bold: true, fontSize: 11, color: WHITE, fontFace: 'Calibri',
            align: 'center', valign: 'middle', fill: { color: ACC } },
        },
        {
          text: 'STATUS / NEXT STEPS',
          options: { bold: true, fontSize: 11, color: WHITE, fontFace: 'Calibri',
            align: 'center', valign: 'middle', fill: { color: ACC } },
        },
      ];

      const dataRows = batch.map((item, idx) => {
        const icon  = ICON_MAP[item.icon] || '●';
        const scol  = STATUS_COLORS[item.status_color] || '888888';
        const slabel = STATUS_LABELS[item.status_color] || item.status_color?.toUpperCase() || '';
        const fillC = idx % 2 === 0 ? ROW_ODD : ROW_EVEN;
        const jiras = (item.jiras || []).join('  ·  ');

        // Emoji icons render natively in Office with Segoe UI Emoji (no color override needed)
        const isEmoji = EMOJI_ICONS.has(item.icon);
        const iconRun = isEmoji
          ? { text: icon + '  ', options: { fontSize: 13, fontFace: 'Segoe UI Emoji' } }
          : { text: icon + '  ', options: { fontSize: 13, fontFace: 'Calibri', color: DARK } };

        // Left cell: icon + title + JIRA IDs
        const leftParts = [
          iconRun,
          { text: (item.milestone || '') + '\n', options: { fontSize: 11, bold: true, color: DARK, fontFace: 'Calibri' } },
        ];
        if (jiras) {
          leftParts.push({ text: jiras, options: { fontSize: 9, bold: true, color: ACC, fontFace: 'Calibri' } });
        }

        // Right cell: status label + status text + next steps
        const rightParts = [
          { text: `● ${slabel}  `, options: { fontSize: 10, bold: true, color: scol, fontFace: 'Calibri' } },
          { text: '\n', options: { fontSize: 6, fontFace: 'Calibri', color: WHITE } },
          ...parseRichText((item.status_text || ''), 10),
          { text: '\n', options: { fontSize: 5, fontFace: 'Calibri', color: WHITE } },
          { text: 'Next Steps: ', options: { fontSize: 10, bold: true, color: ACC, fontFace: 'Calibri' } },
          { text: item.next_steps || '', options: { fontSize: 10, color: MUTED_TXT, fontFace: 'Calibri' } },
        ];

        return [
          { text: leftParts, options: { fill: { color: fillC }, valign: 'middle', margin: [4, 6, 4, 8] } },
          { text: rightParts, options: { fill: { color: fillC }, valign: 'top',   margin: [6, 8, 4, 8] } },
        ];
      });

      slide.addTable([headerRow, ...dataRows], {
        x: 0.3, y: tableY,
        w: LEFT_W + RIGHT_W,
        colW: [LEFT_W, RIGHT_W],
        rowH: [0.42, ...batch.map(() => ROW_H)],
        border: { color: BORDER_C, pt: 0.5 },
        fontFace: 'Calibri',
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
