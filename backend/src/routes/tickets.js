const express = require('express');
const pool    = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

const QBR_METHODOLOGY = `
You are an expert TPM assistant for César Villagra. Your job is to take partial or full JIRA ticket information and produce a complete, structured ticket following this exact methodology. You NEVER leave fields empty — you always complete with context, inference, and executive narrative.

═══════════════════════════════════════════
TASK STRUCTURE — fill ALL fields:
═══════════════════════════════════════════
- task_id: if the input contains a Task ID (e.g. "Task ID: 2026-05-14-00036"), extract and return it exactly as-is. If no Task ID is present in the input, return null and the system will assign one automatically.
- jira_id: extract from input if present (format: CTAP-XXXXX or similar)
- date_created: USE TODAY'S DATE (provided below) by default. ONLY override if the user explicitly writes something like "fecha de creación: XX/XX/XX" or "date created: XX/XX/XX" in the input text. NEVER extract a date from the JIRA ticket body or description — only use an explicitly instructed date override.
- date_closed: Extract from input if present. Look for fields labeled "Date Closed:", "Fecha Cierre:", "Closed:", or similar. Convert to YYYY-MM-DD format. MANDATORY for closed tickets (status = Closed) — if the ticket is Closed but no date_closed is found in the input, use TODAY'S DATE. For open/in-progress tickets, return null.
- category: classify the ticket
- environment: extract or infer (e.g., CHF, Lab, Production, Pre-prod)
- status: Open | In Progress | On Hold | Escalated | Blocked | Closed
- description: see rules below
- current_situation: see rules below
- impact: see rules below
- value_added: see rules below
- next_steps: see rules below
- governance: see rules below
- strategic_relevance: see rules below
- key_technical_insight: see rules below
- rca: Root Cause Analysis — MANDATORY for closed tickets (status = Closed). For open/in-progress tickets, populate if root cause is already confirmed or strongly evidenced, otherwise leave as empty string. When populated, write a concise executive-level RCA (1-3 sentences max). Extract RCA information from the input — look for fields labeled "RCA", "Root Cause", "Root Cause Analysis", or any section describing the confirmed cause and resolution. Example: "Root cause confirmed: missing MT CHF routes on FEXN caused by misconfigured interface on redwa100gfw01 FW. Issue resolved after FW team corrected the routing configuration."
- problem_type: application | infrastructure | observability | configuration | replication | failover | working_as_designed | transient
- network_functions: array of NFs involved — auto-detect from input. Known NFs: CHF, PCF, SMF, UPF, UDM, BSF, SBC, ACC, Kafka, Cookies, HSS, CNRO, Infrastructure, FEXN, GLS, ISBUS
- led_by: "César Villagra" or "Tier 1"
- tier1_involvement: true/false

═══════════════════════════════════════════
FIELD CONSTRUCTION RULES:
═══════════════════════════════════════════

DESCRIPTION:
From the symptom provided, build:
- Observed behavior (what is actually happening)
- Expected behavior (what should happen)
- Technical context (which NFs, paths, flows involved)
- Affected flow (E2E path impacted)
Transform "ACC no muestra usage" → "Charging visibility disruption in CHF → ACC reporting chain"
Transform "503 desde CHF" → "Infrastructure connectivity issue impacting PCF ↔ Cookies ↔ CHF path"

CURRENT SITUATION:
Transform raw findings into:
- Executive status summary
- Troubleshooting progress and scope
- RCA evolution (what was ruled out, what was narrowed down)
- Key findings (e.g., "transactions successful through Group ID 59, issue isolated to path 58")

IMPACT:
Auto-detect if the problem:
- Blocks testing → "Critical Testing Blocker"
- Affects charging → "Charging Impact"
- Breaks observability → "Visibility Loss"
- Impacts OEM onboarding → "OEM Enablement Risk"
- Affects E2E flows → "E2E Flow Disruption"
- Affects release certification → "Release Certification Risk"
- Breaks infrastructure → "Infrastructure Connectivity Failure"
- Routing issue → "Policy Routing Issue"

VALUE ADDED (most important field):
NEVER use: "seguimiento", "coordinar", "monitorear"
ALWAYS translate to executive value:
- "isolated root cause"
- "accelerated troubleshooting by narrowing investigation scope"
- "enabled cross-domain coordination between NF teams"
- "prevented unnecessary escalation through proactive RCA"
- "restored platform stability"
- "validated working-as-designed behavior avoiding misclassification"

NEXT STEPS:
Infer concretely:
- What validation is still pending
- Which team must intervene (CHF team, PCF team, Infra team, etc.)
- What testing follows
- What dependency must be resolved first

GOVERNANCE:
Ownership rules:
- "LIDERO YO" or "César" or "TPM-led" → led_by: "César Villagra", tier1_involvement: false
  governance text: "Led by: César Villagra | Tier 1 Involvement: No"
- "Lo lidera Tier 1" → led_by: "Tier 1", tier1_involvement: true
  governance text: "Led by: Tier 1 | TPM Role: César Villagra – Project Management Support"
- "Tier 1 con mi ayuda" → led_by: "Tier 1", tier1_involvement: true
  governance text: "Tier 1-led with coordination and escalation support by César Villagra"
- If unclear, infer from context (who is doing the troubleshooting, who is escalating)

STRATEGIC RELEVANCE:
Translate ticket to strategic impact for QBR. Choose from:
- Architecture impact
- Observability readiness
- Platform resiliency
- Release certification readiness
- OEM onboarding enablement
- Cross-domain stabilization
- Infrastructure stabilization
- Charging platform integrity

KEY TECHNICAL INSIGHT (most important field for QBR):
Detect and articulate:
- Which NF failed and why
- Which path worked vs which path failed
- Which layer was broken (application / infrastructure / config / observability)
- What was "working as designed" vs what was a genuine defect
- What the root cause hypothesis is at this point in time

═══════════════════════════════════════════
RCA EVOLUTION RULES:
═══════════════════════════════════════════
The RCA is NEVER fixed. It evolves with new findings:
- If input says "ping OK, telnet NO" → update to connectivity layer issue
- If input says "Group ID 59 works, 58 fails" → update to path-specific issue
- If input says "FEXN sin rutas" → update to infrastructure/routing
- If input says "retest successful" → classify as transient/non-reproducible
Always reflect the CURRENT state of the RCA based on ALL information provided.

═══════════════════════════════════════════
PROBLEM TYPE CLASSIFICATION:
═══════════════════════════════════════════
- application: PCF logic, CHF logic, NF software behavior
- infrastructure: FEXN, routing, FW, connectivity, network paths
- observability: Kafka, ACC, ISBUS, monitoring gaps
- configuration: GLS missing, Offline vs Online, misconfiguration
- replication: CHF replication mismatch, data sync issues
- failover: BSF → alternate PCF, HA behavior
- working_as_designed: SID behavior, design-compliant response
- transient: non-reproducible, retest successful

═══════════════════════════════════════════
EXECUTIVE NARRATIVE TRANSFORMATION:
═══════════════════════════════════════════
NEVER manage "tickets" — manage "platform initiatives":
❌ "ACC no muestra usage" → ✅ "Charging visibility disruption in CHF → ACC reporting chain"
❌ "503 desde CHF" → ✅ "Infrastructure connectivity issue impacting PCF ↔ Cookies ↔ CHF path"
❌ "PCF equivocado" → ✅ "BSF-driven failover behavior validated as working as designed"
All wording must be Director-Level, not operational.

Respond ONLY with a valid JSON object with all the fields listed in TASK STRUCTURE. No markdown, no explanation, no code blocks.
`;

async function getTicketGuide(userId, projectId) {
  try {
    const result = await pool.query(
      'SELECT content FROM ticket_guide WHERE user_id=$1 AND project_id=$2',
      [userId, projectId]
    );
    return result.rows.length > 0 ? result.rows[0].content : '';
  } catch {
    return '';
  }
}

async function autoCompleteTicket(rawInput, lang, userId, projectId) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);

  // Load user's ticket guide from DB
  const guide = await getTicketGuide(userId, projectId);
  const guideSection = guide?.trim()
    ? `\n\n═══════════════════════════════════════════\nUSER-DEFINED PROCESSING GUIDE (apply these rules with highest priority):\n═══════════════════════════════════════════\nNOTE: These instructions are written as a dialogue where "YO" = the user (César) and "VOS" = Claude. Read them as directives and apply them as rules. Do NOT reproduce this dialogue format in your output — the output must always be clean, professional, executive-level content.\n\n${guide}\n`
    : '';

  const langInstruction = lang === 'en'
    ? '\n\nIMPORTANT: All text fields in the JSON output MUST be written in English. If the input is in Spanish or any other language, translate everything to English.'
    : '';

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `${QBR_METHODOLOGY}${guideSection}${langInstruction}\n\nTODAY'S DATE: ${today} — use this as the default value for date_created unless the input explicitly overrides it.\n\nHere is the partial ticket information:\n\n${rawInput}\n\nReturn the completed ticket as JSON.`
    }]
  });
  const text = message.content[0].text;
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON parse error. Claude response was:', text.slice(0, 500));
    throw new Error(`Claude devolvió JSON inválido (respuesta cortada). Intentá de nuevo.`);
  }
}

async function getNextTaskId(date) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('UPDATE task_id_counter SET last_seq = last_seq + 1 RETURNING last_seq');
    const seq = res.rows[0].last_seq;
    await client.query('COMMIT');
    const padded = String(seq).padStart(5, '0');
    return `${date}-${padded}`;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/tickets?project_id=X&date_from=&date_to=&status=&jira_id=
router.get('/', authMiddleware, async (req, res) => {
  const { project_id, date_from, date_to, status, jira_id } = req.query;
  try {
    let conditions = ['user_id=$1', 'project_id=$2', 'deleted=false'];
    let params = [req.user.id, project_id];
    let idx = 3;

    if (date_from) { conditions.push(`date_created >= $${idx}::date`); params.push(date_from); idx++; }
    if (date_to)   { conditions.push(`date_created <= ($${idx}::date + interval '1 day')`); params.push(date_to); idx++; }
    if (status)    { conditions.push(`status = $${idx}`); params.push(status); idx++; }
    if (jira_id)   { conditions.push(`LOWER(jira_id) LIKE LOWER($${idx})`); params.push(`%${jira_id}%`); idx++; }

    const result = await pool.query(
      `SELECT *,
        CASE WHEN date_closed IS NOT NULL AND date_created IS NOT NULL
             THEN (date_closed - date_created)
             ELSE NULL
        END AS days_open
       FROM tickets WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/tickets/preview — auto-complete via Claude (no save)
router.post('/preview', authMiddleware, async (req, res) => {
  const { raw_input, lang, project_id } = req.body;
  if (!raw_input) return res.status(400).json({ error: 'Ingresá información del ticket' });
  try {
    const completed = await autoCompleteTicket(raw_input, lang || 'es', req.user.id, project_id);
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
    const task_id = (t.task_id && t.task_id.trim()) ? t.task_id.trim() : await getNextTaskId(t.date_created);
    const result = await pool.query(
      `INSERT INTO tickets (user_id, project_id, task_id, jira_id, date_created, date_closed,
        category, environment, status, description, current_situation, impact, value_added,
        next_steps, governance, strategic_relevance, key_technical_insight, rca, led_by,
        tier1_involvement, problem_type, network_functions, raw_input)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING *`,
      [req.user.id, t.project_id, task_id, t.jira_id, t.date_created, t.date_closed || null,
       t.category, t.environment, t.status || 'Open', t.description, t.current_situation,
       t.impact, t.value_added, t.next_steps, t.governance, t.strategic_relevance,
       t.key_technical_insight, t.rca || '', t.led_by, t.tier1_involvement || false,
       t.problem_type, t.network_functions || [], t.raw_input || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar ticket' });
  }
});

// POST /api/tickets/update-from-text — find ticket by JIRA ID, update via Claude
router.post('/update-from-text', authMiddleware, async (req, res) => {
  const { raw_update, project_id, lang } = req.body;
  if (!raw_update || !project_id) return res.status(400).json({ error: 'Falta raw_update o project_id' });

  // Extract JIRA ID from text (e.g. CTAP-78097)
  const jiraMatch = raw_update.match(/\b([A-Z]+-\d+)\b/);
  if (!jiraMatch) return res.status(400).json({ error: 'No se encontró un JIRA ID en el texto (ej: CTAP-78097)' });
  const jiraId = jiraMatch[1];

  try {
    // Find existing ticket by JIRA ID
    const ticketRes = await pool.query(
      `SELECT * FROM tickets WHERE user_id=$1 AND project_id=$2 AND LOWER(jira_id)=LOWER($3) AND deleted=false ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, project_id, jiraId]
    );
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: `No se encontró el ticket ${jiraId} en este proyecto` });
    }
    const current = ticketRes.rows[0];

    // Load ticket guide
    const guide = await getTicketGuide(req.user.id, project_id);
    const guideSection = guide?.trim()
      ? `\n\n═══════════════════════════════════════════\nUSER-DEFINED PROCESSING GUIDE (apply these rules with highest priority):\n═══════════════════════════════════════════\nNOTE: These instructions are written as a dialogue where "YO" = the user (César) and "VOS" = Claude. Read them as directives and apply them as rules. Do NOT reproduce this dialogue format in your output — the output must always be clean, professional, executive-level content.\n\n${guide}\n`
      : '';

    const langInstruction = lang === 'en'
      ? '\n\nIMPORTANT: All text fields in the JSON output MUST be written in English.'
      : '';

    const today = new Date().toISOString().slice(0, 10);

    const currentState = JSON.stringify({
      task_id: current.task_id,
      jira_id: current.jira_id,
      date_created: current.date_created,
      date_closed: current.date_closed,
      category: current.category,
      environment: current.environment,
      status: current.status,
      description: current.description,
      current_situation: current.current_situation,
      impact: current.impact,
      value_added: current.value_added,
      next_steps: current.next_steps,
      governance: current.governance,
      strategic_relevance: current.strategic_relevance,
      key_technical_insight: current.key_technical_insight,
      rca: current.rca,
      led_by: current.led_by,
      tier1_involvement: current.tier1_involvement,
      problem_type: current.problem_type,
      network_functions: current.network_functions,
    }, null, 2);

    const UPDATE_PROMPT = `${QBR_METHODOLOGY}${guideSection}${langInstruction}

TODAY'S DATE: ${today}

You are updating an EXISTING ticket. Below is its current state as JSON, followed by a free-text update from the user.

Your job:
1. Read the current ticket state carefully.
2. Apply the update described in the free text.
3. Update ALL relevant fields: status, current_situation, next_steps, value_added, key_technical_insight, rca, date_closed, etc.
4. If the update implies the ticket is CLOSED (e.g., "se cerró", "está cerrado", "resolved", "fixed", "closed"):
   - Set status = "Closed"
   - Set date_closed = "${today}" (unless explicitly stated otherwise)
   - RCA is MANDATORY — extract or synthesize from the update text
5. Keep fields that are NOT affected by the update unchanged from the current state.
6. task_id must remain exactly: "${current.task_id}"
7. jira_id must remain exactly: "${current.jira_id}"
8. date_created must remain exactly: "${current.date_created ? current.date_created.toISOString ? current.date_created.toISOString().slice(0,10) : current.date_created : today}"

CURRENT TICKET STATE:
${currentState}

FREE TEXT UPDATE FROM USER:
${raw_update}

Return ONLY the updated ticket as a valid JSON object with ALL fields from the task structure. No markdown, no explanation.`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: UPDATE_PROMPT }]
    });

    const text = message.content[0].text;
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    let updated;
    try {
      updated = JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON parse error in update-from-text:', text.slice(0, 500));
      throw new Error('Claude devolvió JSON inválido. Intentá de nuevo.');
    }

    res.json({ ticket_db_id: current.id, jira_id: jiraId, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al procesar la actualización' });
  }
});

// PUT /api/tickets/:id — update ticket
router.put('/:id', authMiddleware, async (req, res) => {
  const t = req.body;
  try {
    await pool.query(
      `UPDATE tickets SET jira_id=$1, date_created=$2, date_closed=$3, category=$4, environment=$5, status=$6,
        description=$7, current_situation=$8, impact=$9, value_added=$10, next_steps=$11,
        governance=$12, strategic_relevance=$13, key_technical_insight=$14, rca=$15, led_by=$16,
        tier1_involvement=$17, problem_type=$18, network_functions=$19, updated_at=NOW()
       WHERE id=$20 AND user_id=$21`,
      [t.jira_id, t.date_created || null, t.date_closed || null, t.category, t.environment, t.status,
       t.description, t.current_situation, t.impact, t.value_added, t.next_steps,
       t.governance, t.strategic_relevance, t.key_technical_insight, t.rca || '',  t.led_by,
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
