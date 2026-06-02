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
         AND date_created >= $3 AND date_created <= ($4::date + interval '1 day') AND deleted=false
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
    const PINK='F40085', WHITE='FFFFFF', DARK='2D2D2D', MUTED='888888';
    const CYAN='3B82F6', GREEN='00A878', ORANGE='E07000', PURPLE='8B5CF6';
    const GREEN_BG='E8F5EF', ORANGE_BG='FFF3E0', CYAN_BG='E8F0FE';
    const PINK_LIGHT='FDE8F3', YELLOW_BG='FFFDE7', GRAY_LINE='DDDDDD';
    const BAR_COLORS=[PINK,CYAN,GREEN,ORANGE,PURPLE,'14B8A6','F59E0B','EC4899'];

    const norm = (items) => (items||[]).map(i=>typeof i==='string'?{icon:'•',text:i}:i);
    // Tight box height: title(0.26) + items * itemH(0.3 with larger icons) + padding(0.2)
    const boxH = (items) => 0.26 + items.length * 0.3 + 0.2;

    const sd = slide_data||{};
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };

    // ── NO HEADER — slide starts directly with content ───────────────────────
    const START_Y = 0.2; // content starts near top without header

    // ── VERTICAL DIVIDER ─────────────────────────────────────────────────────
    slide.addShape(pptx.ShapeType.rect,{x:6.48,y:START_Y,w:0.012,h:7.1,fill:{color:GRAY_LINE},line:{color:GRAY_LINE,pt:0}});

    // ── LEFT COLUMN ──────────────────────────────────────────────────────────
    const LX=0.18, LW=6.12;
    const LCX = LX + LW/2; // horizontal center of left column
    const ws=sd.what_stands_out||{};

    // "What Stands Out" panel — 3 sections with separators
    // Section 1: badge + headline
    // Section 2: sub-label + secondary_stat + footnote
    // Section 3: 2 pie charts
    const WS_TEXT_H = 2.3;  // sections 1+2 with separators
    const PIE_H     = 1.55;
    const WS_H      = WS_TEXT_H + 0.1 + PIE_H;

    slide.addShape(pptx.ShapeType.roundRect,{x:LX,y:START_Y,w:LW,h:WS_H,fill:{color:YELLOW_BG},line:{color:GRAY_LINE,pt:1},rectRadius:0.07});

    // ── Section 1: Title + Badge + Headline ──────────────────────────────────
    slide.addText('What Stands Out',{x:LX+0.12,y:START_Y+0.07,w:LW-0.24,h:0.26,fontSize:11,bold:true,color:DARK,fontFace:'Calibri',align:'center'});

    // Badge + hardcoded 🎯 emoji — always fixed, never from AI
    const BADGE_W=1.7, EMOJI_W=0.4, BADGE_EMOJI_GAP=0.06;
    const BADGE_TOTAL=BADGE_W+BADGE_EMOJI_GAP+EMOJI_W;
    const BADGE_X=LCX-BADGE_TOTAL/2;
    const BADGE_Y=START_Y+0.4;
    const badgeColor=ws.badge_color==='green'?GREEN:ws.badge_color==='cyan'?CYAN:PINK;
    slide.addShape(pptx.ShapeType.roundRect,{x:BADGE_X,y:BADGE_Y,w:BADGE_W,h:0.5,fill:{color:badgeColor},line:{color:badgeColor,pt:0},rectRadius:0.06});
    slide.addText(ws.badge_value||(charts?.totalTickets?`${charts.totalTickets}`:'–'),{x:BADGE_X,y:BADGE_Y,w:BADGE_W,h:0.5,fontSize:22,bold:true,color:WHITE,fontFace:'Calibri',align:'center',valign:'middle'});
    slide.addText('🎯',{x:BADGE_X+BADGE_W+BADGE_EMOJI_GAP,y:BADGE_Y,w:EMOJI_W,h:0.5,fontSize:20,fontFace:'Segoe UI Emoji',align:'left',valign:'middle'});

    // Headline (includes absolute count — generated by AI)
    if(ws.headline) slide.addText(ws.headline,{x:LX+0.15,y:START_Y+0.98,w:LW-0.3,h:0.3,fontSize:9,color:DARK,fontFace:'Calibri',align:'center',wrap:true});

    // Separator line 1
    slide.addShape(pptx.ShapeType.rect,{x:LX+0.2,y:START_Y+1.35,w:LW-0.4,h:0.008,fill:{color:'E0E0E0'},line:{color:'E0E0E0',pt:0}});

    // ── Section 2: Sub-label + secondary_stat + footnote ─────────────────────
    if(ws.sub_label){
      slide.addShape(pptx.ShapeType.roundRect,{x:LCX-1.25,y:START_Y+1.46,w:2.5,h:0.24,fill:{color:GREEN},line:{color:GREEN,pt:0},rectRadius:0.04});
      slide.addText(ws.sub_label,{x:LCX-1.25,y:START_Y+1.46,w:2.5,h:0.24,fontSize:8.5,bold:true,color:WHITE,fontFace:'Calibri',align:'center',valign:'middle'});
    }

    // Secondary stat (no JIRA IDs, full descriptive sentence)
    if(ws.secondary_stat) slide.addText(ws.secondary_stat,{x:LX+0.15,y:START_Y+1.78,w:LW-0.3,h:0.32,fontSize:8,color:PINK,fontFace:'Calibri',align:'center',bold:true,italic:true,wrap:true});

    // Footnote
    if(ws.footnote) slide.addText(ws.footnote,{x:LX+0.15,y:START_Y+2.12,w:LW-0.3,h:0.16,fontSize:7.5,color:MUTED,fontFace:'Calibri',align:'center',italic:true});

    // Separator line 2
    slide.addShape(pptx.ShapeType.rect,{x:LX+0.2,y:START_Y+2.32,w:LW-0.4,h:0.008,fill:{color:'E0E0E0'},line:{color:'E0E0E0',pt:0}});

    // ── Section 3: 2 pie charts ───────────────────────────────────────────────
    const PIE_Y = START_Y + WS_TEXT_H + 0.04;
    const pieW  = (LW - 0.1) / 2;

    // Pie label helper: 2-line for large slices (>=8%), 1-line for small
    const pieLabel = (name, value, total) => {
      const pct = Math.round(value / total * 100);
      return pct >= 8
        ? `${name}:\n${value} (${pct}%)`   // 2 lines for large slices
        : `${name}: ${value} (${pct}%)`;    // 1 line for small slices
    };

    const ownership=(charts?.byOwnership||[]).filter(d=>d.value>0);
    if(ownership.length>0){
      const ownerTotal=ownership.reduce((s,d)=>s+d.value,0);
      slide.addChart(pptx.ChartType.pie,[{
        name:'Ownership',
        labels:ownership.map(d=>{
          const lbl=d.label==='TPM-led (César)'?'TPM Led':'Tier 1 Led';
          return pieLabel(lbl, d.value, ownerTotal);
        }),
        values:ownership.map(d=>d.value),
      }],{
        x:LX, y:PIE_Y, w:pieW, h:PIE_H,
        chartColors:[PINK,'7AD0E2'],
        showLegend:true, legendPos:'b', legendFontSize:7,
        showLabel:true, showValue:false, showPercent:false,
        dataLabelPosition:'bestFit',
        dataLabelFontSize:7, dataLabelColor:DARK, dataLabelFontBold:true,
        showTitle:true, title:'TPM-led vs Tier 1-led', titleFontSize:8, titleColor:DARK, titleBold:true,
      });
    }

    // Pie 2: Tickets by Status
    const byStatus=(charts?.byStatus||[]).filter(d=>d.value>0);
    if(byStatus.length>0){
      const statusTotal=byStatus.reduce((s,d)=>s+d.value,0);
      slide.addChart(pptx.ChartType.pie,[{
        name:'Status',
        labels:byStatus.map(d=>pieLabel(d.label, d.value, statusTotal)),
        values:byStatus.map(d=>d.value),
      }],{
        x:LX+pieW+0.1, y:PIE_Y, w:pieW, h:PIE_H,
        chartColors:[PINK,CYAN,GREEN,ORANGE,PURPLE,'14B8A6'],
        showLegend:true, legendPos:'b', legendFontSize:7,
        showLabel:true, showValue:false, showPercent:false,
        dataLabelPosition:'bestFit',
        dataLabelFontSize:7, dataLabelColor:DARK, dataLabelFontBold:true,
        showTitle:true, title:'Tickets by Status', titleFontSize:8, titleColor:DARK, titleBold:true,
      });
    }

    // ── NF BAR CHART (vertical, wider bars, data labels) ─────────────────────
    const nfData=(charts?.byNF||[]).filter(d=>d.label&&d.label!=='Unknown'&&d.label!=='null'&&d.value>0).sort((a,b)=>b.value-a.value).slice(0,8);
    const CHART_Y=START_Y+WS_H+0.1;
    const CHART_H=6.55-CHART_Y;

    if(nfData.length>0 && CHART_H>0.5){
      slide.addChart(pptx.ChartType.bar,[{
        name:'Network Functions',
        labels:nfData.map(d=>d.label),
        values:nfData.map(d=>d.value),
      }],{
        x:LX, y:CHART_Y, w:LW, h:CHART_H,
        barDir:'col',
        barGapWidthPct:50,
        chartColors:nfData.map((_,i)=>BAR_COLORS[i%BAR_COLORS.length]),
        showLegend:false,
        showValue:true,
        dataLabelPosition:'outEnd', dataLabelFontSize:8, dataLabelColor:DARK,
        catAxisLabelFontSize:8, catAxisLabelColor:DARK,
        valAxisLabelFontSize:8, valAxisMinVal:0,
        plotAreaBorderColor:'F0F0F0', plotAreaBorderPt:0.3,
        valGridLine:{color:'EEEEEE',pt:0.3,style:'solid'},
        showTitle:true, title:'Issues by Network Function', titleFontSize:9, titleColor:DARK, titleBold:true,
      });
    }

    // Chart insight
    if(sd.chart_insight) slide.addText(sd.chart_insight,{x:LX,y:6.6,w:LW,h:0.34,fontSize:8,color:DARK,fontFace:'Calibri',align:'center',italic:true,wrap:true});

    // ── RIGHT COLUMN ─────────────────────────────────────────────────────────
    const RX=6.62, COL_W=6.53;
    // Center helper: centers a box of width w within the right column
    const cx = (w) => RX + (COL_W - w) / 2;
    let curY=START_Y;

    // KPI boxes — centered as a unit, content-sized widths
    const kpi1=sd.kpi_1||{}, kpi2=sd.kpi_2||{};
    const KPI1_W=2.9;
    const kpi2MaxLen=Math.max(...(kpi2.detail||['OEMs']).map(d=>d.length),(kpi2.label||'').length);
    const KPI2_W=Math.min(Math.max(kpi2MaxLen*0.072+0.5, 2.2), 3.2);
    const KPI1_H=0.55+Math.min((kpi1.detail||[]).length,5)*0.2;
    const KPI2_H=0.55+Math.min((kpi2.detail||[]).length,5)*0.2;
    const KPI_H=Math.max(KPI1_H,KPI2_H);

    // Center both KPI boxes as a unit
    const TOTAL_KPI_W=KPI1_W+0.12+KPI2_W;
    const KPI_START_X=cx(TOTAL_KPI_W);

    // KPI 1 (PINK)
    slide.addShape(pptx.ShapeType.roundRect,{x:KPI_START_X,y:curY,w:KPI1_W,h:KPI_H,fill:{color:PINK},line:{color:PINK,pt:0},rectRadius:0.07});
    const k1=[]; if(kpi1.emoji)k1.push({text:kpi1.emoji+' ',options:{fontSize:14,fontFace:'Segoe UI Emoji',color:WHITE}});
    k1.push({text:(kpi1.value||'–')+'\n',options:{fontSize:20,bold:true,color:WHITE,fontFace:'Calibri'}});
    k1.push({text:(kpi1.label||'')+'\n',options:{fontSize:9,color:WHITE,fontFace:'Calibri'}});
    (kpi1.detail||[]).slice(0,5).forEach(d=>k1.push({text:'• '+d+'\n',options:{fontSize:9,color:WHITE,fontFace:'Calibri'}}));
    slide.addText(k1,{x:KPI_START_X+0.1,y:curY+0.08,w:KPI1_W-0.2,h:KPI_H-0.1,fontFace:'Calibri',align:'center',valign:'top',wrap:true});

    // KPI 2 (GREEN)
    const KPI2_X=KPI_START_X+KPI1_W+0.12;
    slide.addShape(pptx.ShapeType.roundRect,{x:KPI2_X,y:curY,w:KPI2_W,h:KPI_H,fill:{color:GREEN},line:{color:GREEN,pt:0},rectRadius:0.07});
    const k2=[]; if(kpi2.emoji)k2.push({text:kpi2.emoji+' ',options:{fontSize:14,fontFace:'Segoe UI Emoji',color:WHITE}});
    k2.push({text:(kpi2.value||'–')+'\n',options:{fontSize:20,bold:true,color:WHITE,fontFace:'Calibri'}});
    k2.push({text:(kpi2.label||'')+'\n',options:{fontSize:9,color:WHITE,fontFace:'Calibri'}});
    (kpi2.detail||[]).slice(0,5).forEach(d=>k2.push({text:'• '+d+'\n',options:{fontSize:9,color:WHITE,fontFace:'Calibri'}}));
    slide.addText(k2,{x:KPI2_X+0.1,y:curY+0.08,w:KPI2_W-0.2,h:KPI_H-0.1,fontFace:'Calibri',align:'center',valign:'top',wrap:true});
    curY+=KPI_H+0.12;

    // Asymmetric box widths — centered horizontally in right column
    const W_ACH=6.0, W_CHAL=5.2, W_NS=5.6, W_CTA=6.3;
    const ICON_COL=0.28, BOX_PAD=0.12, ITEM_H=0.32, TITLE_H=0.32;

    // Helper: render content box with hanging indent (two-column per item)
    const addHangBox = (bx, by, bw, titleText, titleColor, bgColor, borderColor, items) => {
      const totalH = BOX_PAD + TITLE_H + items.length * ITEM_H + BOX_PAD;
      const textW  = bw - BOX_PAD - ICON_COL - BOX_PAD;
      slide.addShape(pptx.ShapeType.roundRect,{x:bx,y:by,w:bw,h:totalH,fill:{color:bgColor},line:{color:borderColor,pt:1.5},rectRadius:0.07});
      slide.addText(titleText,{x:bx+BOX_PAD,y:by+BOX_PAD,w:bw-BOX_PAD*2,h:TITLE_H,fontSize:13,bold:true,color:titleColor,fontFace:'Calibri',valign:'middle'});
      let iy = by + BOX_PAD + TITLE_H + 0.02;
      items.forEach(item => {
        // Icon column (fixed width, top-aligned)
        slide.addText(item.icon||'•',{x:bx+BOX_PAD,y:iy,w:ICON_COL,h:ITEM_H,fontSize:11,fontFace:'Segoe UI Emoji',valign:'top',align:'left'});
        // Text column (remaining width, wraps independently — hanging indent)
        slide.addText(item.text||'',{x:bx+BOX_PAD+ICON_COL,y:iy,w:textW,h:ITEM_H,fontSize:9,color:DARK,fontFace:'Calibri',valign:'top',wrap:true});
        iy += ITEM_H;
      });
      return totalH;
    };

    // Achievements (green) — centered
    const achievements=norm(sd.achievements);
    const ACH_X=cx(W_ACH);
    const ACH_H=addHangBox(ACH_X,curY,W_ACH,[{text:'✅  Key Achievements',options:{fontSize:13,bold:true,color:GREEN,fontFace:'Calibri'}}],GREEN,GREEN_BG,GREEN,achievements);
    curY+=ACH_H+0.1;

    // Challenges (orange) — centered
    const challenges=norm(sd.challenges);
    const CHAL_X=cx(W_CHAL);
    const CHAL_H=addHangBox(CHAL_X,curY,W_CHAL,[{text:'⚠️  Challenges',options:{fontSize:13,bold:true,color:ORANGE,fontFace:'Segoe UI Emoji'}}],ORANGE,ORANGE_BG,ORANGE,challenges);
    curY+=CHAL_H+0.1;

    // Next Steps (cyan) — centered
    const nextSteps=norm(sd.next_steps);
    const NS_X=cx(W_NS);
    const NS_H=addHangBox(NS_X,curY,W_NS,[{text:'🎯  Next Steps & Targets',options:{fontSize:13,bold:true,color:CYAN,fontFace:'Segoe UI Emoji'}}],CYAN,CYAN_BG,CYAN,nextSteps);
    curY+=NS_H+0.1;

    // Call to Action (pink light, PINK border) — centered
    const CTA_H=0.44;
    const CTA_X=cx(W_CTA);
    slide.addShape(pptx.ShapeType.roundRect,{x:CTA_X,y:curY,w:W_CTA,h:CTA_H,fill:{color:PINK_LIGHT},line:{color:PINK,pt:2},rectRadius:0.07});
    slide.addText([
      {text:'📢  ',options:{fontSize:12,fontFace:'Segoe UI Emoji'}},
      {text:'Call to Action: ',options:{fontSize:10,bold:true,color:PINK,fontFace:'Calibri'}},
      {text:sd.call_to_action||'',options:{fontSize:9.5,color:DARK,fontFace:'Calibri'}},
    ],{x:CTA_X+0.12,y:curY+0.06,w:W_CTA-0.24,h:CTA_H-0.1,fontFace:'Calibri',valign:'middle',wrap:true});

    const buffer=await pptx.write({outputType:'nodebuffer'});
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition',`attachment; filename="QBR_${date_from}_${date_to}.pptx"`);
    res.send(buffer);

  } catch(err) {
    console.error(err);
    res.status(500).json({error:'Error al generar PowerPoint: '+err.message});
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
    "headline": "79% (25 of 32 tickets) driven directly by TPM — no Tier 1 dependency",
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
- OEM DEFINITION: OEM = device/equipment manufacturer (Honda, Rivian, Ford, Subaru, Samsung, Ericsson, Nokia, etc.). Polaris is a satellite access system — NOT an OEM. Never include Polaris in the OEM list or count. Exclude it silently.
- CRITICAL — NO JIRA IDs ANYWHERE: Never include ticket IDs (CTAP-XXXXX or any similar format) in ANY field. Management does not know ticket numbers. Remove them completely from all text fields.
- what_stands_out.headline: MUST include the absolute count alongside the percentage. Format: "52% (17 of 33 tickets) driven directly by TPM — no Tier 1 dependency". Never just a percentage alone.
- what_stands_out.sub_label: Always use full 4-digit year: "Q2-2026 Snapshot", "Q1-2026 Snapshot" (NEVER "Q2-26" or "Q1-26").
- what_stands_out.secondary_stat: MUST be a concrete, complete, executive-level sentence. Extract from impact/value_added/rca fields. No JIRA IDs. Not telegraphic — write in full sentences with context. Example correct: "Root cause was confirmed in 22 of 26 closed tickets — the majority traced to infrastructure credential mismanagement and recurring CHF-PCF connectivity instability, both preventable with proper governance."
- chart_insight: one-sentence "so what" for the Network Functions chart. Specific NFs, no JIRA IDs.
- achievements/challenges/next_steps icons: EVERY icon must be unique. Different from the section title icon (✅ achievements, ⚠️ challenges, 🎯 next steps). Different from each other within the same section.
- achievements: top 3. Executive tone, "So What" test. Max 15 words each. No JIRA IDs.
- challenges: 1-2 active blockers/risks. Concise. Max 15 words. No JIRA IDs.
- next_steps: 2-3 forward-looking actions. Concise. Max 12 words. No JIRA IDs.
- call_to_action: specific ask to management/partners. Max 20 words. No JIRA IDs.
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
