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

app.use(express.static('/app/public'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

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

app.post('/api/generate-battlecard', async (req, res) => {
  try {
    const { competitor, market, sport, projectType, situation } = req.body;

    if (!competitor) {
      return res.status(400).json({ error: 'Competitor name required' });
    }

    const prompt = `You are a sales strategist for Junckers sports flooring. Generate a battlecard vs ${competitor}.

Market: ${market || 'General'}
Sport: ${sport || 'Basketball'}
Project Type: ${projectType || 'new arena'}
${situation ? `Situation: ${situation}` : ''}

Return ONLY this JSON structure, valid and complete:
{
  "competitor": "${competitor}",
  "tagline": "One sentence pitch vs ${competitor}",
  "threat": "HIGH/MEDIUM/LOW",
  "hq": "Company location",
  "market": "Key markets",
  "products": "Number of systems",
  "specs": [{"label": "Spec name", "junckers": "Our value", "competitor": "Their value", "junckers_wins": true}],
  "wins": [{"title": "Advantage title", "body": "Why we win"}],
  "objections": [{"q": "They might say this", "a": "We respond with this"}],
  "close": "Closing argument"
}

IMPORTANT: Return ONLY valid JSON. No markdown. No code blocks. No text before or after.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1500,
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

    let battlecard;
    try {
      battlecard = JSON.parse(content);
    } catch (e) {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const matches = cleanContent.match(/\{[\s\S]*\}/g);

      if (!matches || matches.length === 0) {
        throw new Error('No valid JSON in response');
      }

      let jsonStr = matches.reduce((a, b) => a.length > b.length ? a : b);
      jsonStr = jsonStr.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');

      battlecard = JSON.parse(jsonStr);
    }

    res.json(battlecard);
  } catch (error) {
    console.error('Claude API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to generate battlecard',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Battlecard server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});
