const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

const QBR_METHODOLOGY = `
You are an expert TPM assistant for César Villagra. Your job is to take partial JIRA ticket information and produce a complete, structured ticket following this exact methodology:

TASK STRUCTURE (fill ALL fields):
- task_id: will be assigned by the system
- jira_id: extract from input if present
- date_created: extract from input (YYYY-MM-DD format) — use the OPENING date
- category: classify the ticket
- environment: extract or infer
- status: Open | In Progress | Closed
- description: Expand to include: observed behavior, expected behavior, technical context, affected flow
- current_situation: Executive status, troubleshooting status, RCA evolution
- impact: Detect automatically if it: blocks testing, affects charging, breaks observability, impacts OEMs, affects E2E, affects release certification. Use labels like: Critical Testing Blocker, Visibility Loss, Policy Routing Issue, Infrastructure Connectivity Failure
- value_added: Translate to executive value. Examples: "isolated root cause", "accelerated troubleshooting", "enabled cross-domain coordination", "prevented unnecessary escalation"
- next_steps: Infer what needs validation, which team must intervene, what testing follows
- governance: ownership details — led_by (César Villagra or Tier 1), tier1_involvement
- strategic_relevance: Translate to: architecture impact, observability, resiliency, release readiness, OEM onboarding, cross-domain stabilization
- key_technical_insight: Detect which NF failed, which path worked, which layer was broken, what was "working as designed"
- problem_type: application | infrastructure | observability | configuration | replication | failover | working_as_designed | transient
- network_functions: array of NFs involved (CHF, PCF, SMF, UPF, UDM, BSF, SBC, ACC, Kafka, HSS, CNRO, Infrastructure, etc.)
- led_by: "César Villagra" or "Tier 1"
- tier1_involvement: true/false

IMPORTANT RULES:
- Never leave fields empty — always complete with context and inference
- Transform raw technical input into executive narrative
- The RCA should evolve based on findings mentioned in the input
- Wording must be Director-Level, not operational

Respond ONLY with a valid JSON object with all the fields above. No markdown, no explanation.
`;

async function autoCompleteTicket(rawInput) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `${QBR_METHODOLOGY}\n\nHere is the partial ticket information:\n\n${rawInput}\n\nReturn the completed ticket as JSON.`
    }]
  });
  const text = message.content[0].text;
  return JSON.parse(text);
}

async function getNextTaskId(date) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('UPDATE task_id_counter SET last_seq = last_seq + 1 RETURNING last_seq');
    const seq = res.rows[0].last_seq;
    await client.query('COMMIT');
    const padded = String(seq).padStart(4, '0');
    return `${date}-${padded}`;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/tickets?project_id=X
router.get('/', authMiddleware, async (req, res) => {
  const { project_id } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM tickets WHERE user_id=$1 AND project_id=$2 AND deleted=false ORDER BY date_created DESC`,
      [req.user.id, project_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/tickets/preview — auto-complete via Claude (no save)
router.post('/preview', authMiddleware, async (req, res) => {
  const { raw_input } = req.body;
  if (!raw_input) return res.status(400).json({ error: 'Ingresá información del ticket' });
  try {
    const completed = await autoCompleteTicket(raw_input);
    res.json(completed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar con Claude. Verificá la API key.' });
  }
});

// POST /api/tickets — save ticket
router.post('/', authMiddleware, async (req, res) => {
  const t = req.body;
  try {
    const task_id = await getNextTaskId(t.date_created);
    const result = await pool.query(
      `INSERT INTO tickets (user_id, project_id, task_id, jira_id, date_created, date_closed,
        category, environment, status, description, current_situation, impact, value_added,
        next_steps, governance, strategic_relevance, key_technical_insight, led_by,
        tier1_involvement, problem_type, network_functions, raw_input)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [req.user.id, t.project_id, task_id, t.jira_id, t.date_created, t.date_closed || null,
       t.category, t.environment, t.status || 'Open', t.description, t.current_situation,
       t.impact, t.value_added, t.next_steps, t.governance, t.strategic_relevance,
       t.key_technical_insight, t.led_by, t.tier1_involvement || false,
       t.problem_type, t.network_functions || [], t.raw_input || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar ticket' });
  }
});

// PUT /api/tickets/:id — update ticket
router.put('/:id', authMiddleware, async (req, res) => {
  const t = req.body;
  try {
    await pool.query(
      `UPDATE tickets SET jira_id=$1, date_closed=$2, category=$3, environment=$4, status=$5,
        description=$6, current_situation=$7, impact=$8, value_added=$9, next_steps=$10,
        governance=$11, strategic_relevance=$12, key_technical_insight=$13, led_by=$14,
        tier1_involvement=$15, problem_type=$16, network_functions=$17, updated_at=NOW()
       WHERE id=$18 AND user_id=$19`,
      [t.jira_id, t.date_closed || null, t.category, t.environment, t.status,
       t.description, t.current_situation, t.impact, t.value_added, t.next_steps,
       t.governance, t.strategic_relevance, t.key_technical_insight, t.led_by,
       t.tier1_involvement, t.problem_type, t.network_functions, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
});

// DELETE /api/tickets/:id — soft delete
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE tickets SET deleted=true, updated_at=NOW() WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar ticket' });
  }
});

module.exports = router;
