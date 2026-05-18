// API Server for FECAPA admin actions
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Trigger GitHub Action
app.post('/api/trigger-scraper', async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const adminEmail = req.body?.adminEmail;
  if (!adminEmail) {
    return res.status(400).json({ error: 'Admin email required' });
  }

  // Validate token format (basic check)
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    return res.status(500).json({ error: 'Invalid token format' });
  }

  try {
    const response = await fetch(
      'https://api.github.com/repos/sergireven/hoquei-fecapa/actions/workflows/scraper.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: 'main' })
      }
    );

    if (response.status === 204) {
      console.log(`✅ Scraper triggered by ${adminEmail}`);
      return res.json({ success: true, message: 'Scraper triggered successfully' });
    } else if (response.status === 401) {
      return res.status(401).json({ error: 'Invalid GitHub token' });
    } else if (response.status === 404) {
      return res.status(404).json({ error: 'Workflow not found' });
    } else {
      const data = await response.json();
      return res.status(response.status).json({ error: data.message || 'GitHub API error' });
    }
  } catch (err) {
    console.error('Error triggering scraper:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Serve static files
app.use(express.static('../public'));

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
