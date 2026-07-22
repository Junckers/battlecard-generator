const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLICKUP_SPACE_ID = process.env.CLICKUP_SPACE_ID;

if (!CLICKUP_API_TOKEN || !CLAUDE_API_KEY) {
  console.error('Missing environment variables: CLICKUP_API_TOKEN or CLAUDE_API_KEY');
  process.exit(1);
}

// Serve static files (HTML)
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get competitors from ClickUp Space (all lists)
app.get('/api/competitors', async (req, res) => {
  try {
    if (!CLICKUP_SPACE_ID) {
      return res.status(400).json({ error: 'CLICKUP_SPACE_ID not configured' });
    }

    const response = await axios.get(
      `https://api.clickup.com/api/v2/space/${CLICKUP_SPACE_ID}/task`,
      {
        headers: {
          'Authorization': CLICKUP_API_TOKEN,
          'Content-Type': 'application/json'
        },
        params: {
          include_subtasks: false,
          limit: 100
        }
      }
    );

    const competitors = response.data.tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      custom_fields: task.custom_fields || []
    }));

    res.json({ competitors });
  } catch (error) {
    console.error('ClickUp API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch competitors from space',
      details: error.response?.data?.err || error.message
    });
  }
});

// Render battlecard JSON as beautiful HTML
function renderBattlecard(card, market, sport, projectType) {
  const threatClass = {
    'HIGH': 'threat-high',
    'MEDIUM': 'threat-medium',
    'LOW': 'threat-low'
  }[card.threat] || 'threat-medium';

  const specsHTML = (card.specs || []).map(s => `
    <div class="bc-spec-row">
      <div class="bc-spec-lbl">${s.label}</div>
      <div class="bc-spec-j">${s.junckers}</div>
      <div class="bc-spec-c${s.junckers_wins ? ' win-for-us' : ''}">${s.competitor}</div>
    </div>
  `).join('');

  const winsHTML = (card.wins || []).map(w => `
    <div class="bc-win">
      <div class="bc-win-icon">✓</div>
      <div class="bc-win-body"><strong>${w.title}</strong><br>${w.body}</div>
    </div>
  `).join('');

  const objHTML = (card.objections || []).map(o => `
    <div class="bc-obj">
      <div class="bc-obj-q"><span class="bc-obj-tag">They say</span>${o.q}</div>
      <div class="bc-obj-a">${o.a}</div>
    </div>
  `).join('');

  const certHTML = (card.certs || []).map(c => `
    <div class="bc-cert">
      <div class="bc-cert-name">${c.name}</div>
      <div class="bc-cert-row">
        <span class="bc-cert-j ${c.junckers ? 'cert-yes-j' : 'cert-no-j'}">${c.junckers ? '● Junckers' : '○ Junckers'}</span>
        <span class="bc-cert-c ${c.competitor ? 'cert-yes-c' : 'cert-no-c'}">${c.competitor ? '● Competitor' : '○ Competitor'}</span>
      </div>
    </div>
  `).join('');

  const proofHTML = (card.proof_points || []).map(p => `<span class="bc-proof">${p}</span>`).join('');

  const now = new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  return `
    <div class="bc-header">
      <div class="bc-header-inner">
        <div class="bc-eyebrow">Competitive Battlecard · ${sport} · ${market}</div>
        <div class="bc-vs">
          <span class="bc-brand-j">Junckers</span>
          <span class="bc-vs-div">VS</span>
          <span class="bc-brand-c">${card.competitor}</span>
        </div>
        <div class="bc-tagline">"${card.tagline}"</div>
        <div class="bc-meta">
          <div class="bc-meta-item"><span class="bc-meta-label">HQ</span><span class="bc-meta-val">${card.hq}</span></div>
          <div class="bc-meta-item"><span class="bc-meta-label">Key market</span><span class="bc-meta-val">${card.market}</span></div>
          <div class="bc-meta-item"><span class="bc-meta-label">Products tracked</span><span class="bc-meta-val">${card.products}</span></div>
          <div class="bc-meta-item"><span class="bc-meta-label">Threat level</span><span class="threat-pill ${threatClass}">● ${card.threat}</span></div>
        </div>
      </div>
    </div>

    <div class="bc-specs">
      <div class="bc-spec-hdr">
        <div class="bc-spec-hdr-cell"></div>
        <div class="bc-spec-hdr-cell j">Junckers</div>
        <div class="bc-spec-hdr-cell c">${card.competitor.split(' ')[0]}</div>
      </div>
      ${specsHTML}
    </div>

    <div class="bc-body">
      <div class="bc-col bc-col-left">
        <div class="bc-col-title" style="color:var(--green)">
          <span class="bc-col-dot" style="background:var(--green)"></span>
          Our Advantages
        </div>
        <div class="bc-win-list">${winsHTML}</div>
      </div>
      <div class="bc-col">
        <div class="bc-col-title" style="color:var(--gold)">
          <span class="bc-col-dot" style="background:var(--gold)"></span>
          Handle These Objections
        </div>
        <div class="bc-obj-list">${objHTML}</div>
      </div>

      <div class="bc-certs">
        <div class="bc-certs-title">Certification comparison</div>
        <div class="bc-cert-grid">${certHTML}</div>
      </div>

      <div class="bc-close">
        <div>
          <div class="bc-close-label">Closing argument</div>
          <div class="bc-close-text">${card.close}</div>
        </div>
        <div class="bc-proof-pills">${proofHTML}</div>
      </div>

      <div class="bc-footer">
        <span class="bc-footer-note">Generated ${now} · Junckers CI Database · ${projectType}</span>
        <span class="bc-footer-note">Junckers Industrier A/S · Confidential</span>
      </div>
    </div>
  `;
}

// Generate battlecard via Claude API
app.post('/api/generate-battlecard', async (req, res) => {
  try {
    const { competitor, market, sport, projectType, situation } = req.body;

    if (!competitor) {
      return res.status(400).json({ error: 'Competitor name required' });
    }

    const prompt = `You are a competitive intelligence assistant for Junckers Industrier A/S, a Danish premium hardwood sport flooring manufacturer. Generate a detailed, accurate battlecard for sales.

Context:
- Competitor: ${competitor}
- Market: ${market || 'Global'}
- Sport: ${sport || 'Basketball'}
- Project Type: ${projectType || 'new arena'}
${situation ? `- Situation: ${situation}` : ''}

You MUST respond with ONLY valid JSON (no markdown, no code blocks, no extra text) in this exact structure:
{
  "competitor": "Full competitor name",
  "tagline": "One-line sales pitch (max 140 chars) - a direct quote salespeople can use",
  "threat": "HIGH|MEDIUM|LOW",
  "hq": "Headquarters location",
  "market": "Primary market/geographic focus",
  "products": "E.g. '7 systems' or '3 products'",
  "specs": [
    {"label": "Spec name (max 20 chars)", "junckers": "Our spec", "competitor": "Their spec", "junckers_wins": boolean},
    ... exactly 5-6 items, choose most relevant for context
  ],
  "wins": [
    {"title": "Advantage title", "body": "Why we win (use <strong> tags for key phrases)"},
    ... exactly 4 items
  ],
  "objections": [
    {"q": "Objection they might raise", "a": "How we respond (use <strong> tags for key phrases)"},
    ... exactly 3 items, most likely for this context
  ],
  "certs": [
    {"name": "Cert name (max 14 chars)", "junckers": boolean, "competitor": boolean},
    ... exactly 5-6 items, most relevant for sport/market
  ],
  "close": "Closing argument sentence (use <strong> tags for key phrase)",
  "proof_points": ["Proof 1", "Proof 2", "Proof 3", "Proof 4"]
}

CRITICAL: All content must be factual, specific, and grounded. Customize for the context. Return JSON ONLY.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1800,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const content = response.data.content[0].text;

    // Parse JSON with error handling
    let battlecard;
    try {
      battlecard = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from response
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const matches = cleanContent.match(/\{[\s\S]*\}/g);

      if (!matches || matches.length === 0) {
        throw new Error('No valid JSON in response');
      }

      let jsonStr = matches.reduce((a, b) => a.length > b.length ? a : b);
      jsonStr = jsonStr.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');

      battlecard = JSON.parse(jsonStr);
    }

    // Render as HTML and send
    const html = renderBattlecard(battlecard, market || 'Global', sport || 'Basketball', projectType || 'new arena');
    res.header('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    console.error('Claude API error:', error.response?.data || error.message);
    res.status(500).send(`
      <div style="padding:40px;font-family:sans-serif;color:#c00;">
        <h2>Error generating battlecard</h2>
        <p>${error.message}</p>
      </div>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Battlecard server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
