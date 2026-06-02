const express    = require('express');
const pool       = require('../db/pool');
const Anthropic  = require('@anthropic-ai/sdk');
const { authMiddleware } = require('../middleware/auth');
const multer     = require('multer');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── GET /api/speech/guide ────────────────────────────────────────────────────
router.get('/guide', authMiddleware, async (req, res) => {
  const { project_id } = req.query;
  try {
    const result = await pool.query(
      'SELECT content FROM speech_guide WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    res.json({ content: result.rows[0]?.content || '' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ─── PUT /api/speech/guide ────────────────────────────────────────────────────
router.put('/guide', authMiddleware, async (req, res) => {
  const { project_id, content } = req.body;
  try {
    let formatted = content;
    if (content?.trim()) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
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
${content}`
          }]
        });
        formatted = msg.content[0].text.trim();
      } catch (e) {
        console.error('Beautify error:', e.message);
      }
    }
    await pool.query(
      `INSERT INTO speech_guide (user_id, project_id, content)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, project_id) DO UPDATE SET content=$3, updated_at=NOW()`,
      [req.user.id, project_id, formatted]
    );
    res.json({ ok: true, content: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar guía' });
  }
});

// ─── POST /api/speech/generate ────────────────────────────────────────────────
// Receives PPTX file (multipart), extracts text, generates speech JSON
router.post('/generate', authMiddleware, upload.single('pptx'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió el archivo PPTX' });
  const { project_id } = req.body;

  try {
    // Extract text from PPTX using JSZip
    const JSZip = require('jszip');
    const zip   = await JSZip.loadAsync(req.file.buffer);

    // Get all slide XML files
    const slideTexts = [];
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort();

    for (const slideFile of slideFiles) {
      const xml  = await zip.files[slideFile].async('string');
      // Extract all text runs <a:t>...</a:t>
      const runs = [];
      const re   = /<a:t[^>]*>([^<]*)<\/a:t>/g;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const t = m[1].trim();
        if (t) runs.push(t);
      }
      if (runs.length) slideTexts.push(runs.join(' | '));
    }

    const extractedText = slideTexts.join('\n\n--- SLIDE ---\n\n');

    // Load speech guide
    const guideRes = await pool.query(
      'SELECT content FROM speech_guide WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    const guide = guideRes.rows[0]?.content?.trim() || '';

    // Generate speech with Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = buildSpeechPrompt(extractedText, guide);
    const msg    = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw     = msg.content[0].text.trim().replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '');
    const speech  = JSON.parse(raw);
    res.json(speech);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar speech: ' + err.message });
  }
});

// ─── POST /api/speech/export-docx ─────────────────────────────────────────────
router.post('/export-docx', authMiddleware, async (req, res) => {
  const { speech, project_name } = req.body;
  if (!speech?.sections) return res.status(400).json({ error: 'No hay datos de speech' });

  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType } = require('docx');

    const children = [];

    // Title
    children.push(new Paragraph({
      text: `QBR Speech Script — ${project_name || 'Reailize Portal'}`,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }));

    // Sections
    for (const section of speech.sections) {
      // Section title
      children.push(new Paragraph({
        children: [new TextRun({ text: section.title, bold: true, size: 28, color: 'F40085' })],
        spacing: { before: 400, after: 100 },
        border: { bottom: { color: 'F40085', space: 4, size: 6, style: BorderStyle.SINGLE } },
      }));

      // Content preview (key data points)
      if (section.data_points?.length) {
        for (const dp of section.data_points) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '▸ ', bold: true, color: '888888' }),
              new TextRun({ text: dp, size: 18, color: '444444', italics: true }),
            ],
            spacing: { after: 60 },
          }));
        }
      }

      // Speech text
      children.push(new Paragraph({
        children: [new TextRun({ text: '📢 What to say:', bold: true, size: 20, color: '2D2D2D' })],
        spacing: { before: 120, after: 60 },
      }));

      // Split speech into paragraphs
      const paragraphs = section.speech.split('\n').filter(p => p.trim());
      for (const p of paragraphs) {
        children.push(new Paragraph({
          children: [new TextRun({ text: p, size: 22 })],
          spacing: { after: 100 },
          indent: { left: 360 },
        }));
      }

      children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    }

    const doc    = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="QBR_Speech_${Date.now()}.docx"`);
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar Word: ' + err.message });
  }
});

// ─── Helper: build speech prompt ─────────────────────────────────────────────
function buildSpeechPrompt(extractedText, guide) {
  return `You are preparing a QBR presentation speech script for César Villagra, IoT Platform TPM at AT&T.

${guide ? `SPEECH GUIDE (apply strictly — "YO" = César, "VOS" = Claude, read as directives):\n${guide}\n\n` : ''}

QBR CONTENT EXTRACTED FROM PPTX:
${extractedText}

YOUR TASK:
Generate a section-by-section spoken speech script in English. Return ONLY valid JSON — no markdown, no code fences.

JSON structure:
{
  "title": "QBR Speech Script",
  "sections": [
    {
      "id": "what_stands_out",
      "title": "What Stands Out",
      "data_points": ["key facts visible in this section, e.g. '52% TPM-led'", "..."],
      "speech": "Full spoken text César should say when presenting this section. Natural, executive tone. 3-5 sentences."
    },
    {
      "id": "ownership_status",
      "title": "Ownership & Status Overview",
      "data_points": ["TPM-led: X tickets (Y%)", "Closed: N tickets (Z%)"],
      "speech": "..."
    },
    {
      "id": "nf_chart",
      "title": "Issues by Network Function",
      "data_points": ["Top NF: CHF with 16 issues", "chart insight text"],
      "speech": "..."
    },
    {
      "id": "achievements",
      "title": "Key Achievements",
      "data_points": ["Achievement 1", "Achievement 2", "Achievement 3"],
      "speech": "..."
    },
    {
      "id": "challenges",
      "title": "Challenges",
      "data_points": ["Challenge 1", "Challenge 2"],
      "speech": "..."
    },
    {
      "id": "next_steps",
      "title": "Next Steps & Targets",
      "data_points": ["Step 1", "Step 2", "Step 3"],
      "speech": "..."
    },
    {
      "id": "call_to_action",
      "title": "Call to Action",
      "data_points": ["The specific ask to management"],
      "speech": "..."
    }
  ]
}

RULES:
- Speech must be spoken English, natural and executive — not a bullet list read aloud
- Each section speech: 3-6 sentences, flows naturally when spoken
- Apply all speech guide rules if provided
- No JIRA IDs anywhere
- Return ONLY the JSON object`;
}

module.exports = router;
