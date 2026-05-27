const express   = require('express');
const pool      = require('../db/pool');
const Anthropic = require('@anthropic-ai/sdk');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

async function beautifyMarkdown(rawContent) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a markdown formatting expert. Your task is to take the following content and reformat it using proper Markdown so it looks clean, organized, and visually appealing when rendered.

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

// GET /api/weekly-guide?project_id=X
router.get('/', authMiddleware, async (req, res) => {
  const { project_id } = req.query;
  try {
    const result = await pool.query(
      'SELECT content FROM weekly_guide WHERE user_id=$1 AND project_id=$2',
      [req.user.id, project_id]
    );
    res.json({ content: result.rows.length > 0 ? result.rows[0].content : '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el formato' });
  }
});

// PUT /api/weekly-guide
router.put('/', authMiddleware, async (req, res) => {
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
      `INSERT INTO weekly_guide (user_id, project_id, content, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, project_id)
       DO UPDATE SET content=$3, updated_at=NOW()`,
      [req.user.id, project_id, formatted]
    );
    res.json({ ok: true, content: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el formato' });
  }
});

module.exports = router;
