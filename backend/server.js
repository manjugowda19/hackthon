// backend/server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({ dest: UPLOAD_DIR });

// ---------- Upload + Extract PDF text ----------
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const buffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(buffer);
    // remove file after extraction
    fs.unlinkSync(req.file.path);
    res.json({ success: true, text: data.text || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to process PDF' });
  }
});

// ---------- Simplify (AI optional) ----------
app.post('/simplify', async (req, res) => {
  const text = (req.body && req.body.text) || '';
  if (!text) return res.status(400).json({ error: 'No text supplied' });

  // If there's an OpenAI API key in env, use it (optional)
  const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
  if (OPENAI_KEY) {
    try {
      // Using OpenAI ChatCompletions (model name may change). This code uses the REST v1 chat completions.
      // Note: update endpoint / payload if using a different provider.
      const prompt = `Simplify the following text for a student who needs plain, short sentences and easy words. Keep meaning intact.\n\nText:\n${text}\n\nSimplified:`;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // replace with an available model if needed
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.3
        })
      });
      const j = await resp.json();
      const simplified = j?.choices?.[0]?.message?.content || '';
      return res.json({ success: true, simplified: simplified.trim() });
    } catch (err) {
      console.error('OpenAI error', err);
      // fall through to local fallback
    }
  }

  // FALLBACK simple summarizer for cognitive-friendly users (safe, local)
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/[.?!]\s+/)
    .filter(s => s.trim().length > 20);
  const simplified = sentences.slice(0, Math.min(6, sentences.length)).map(s => s.trim() + '.').join(' ');
  res.json({ success: true, simplified });
});

// ---------- Braille conversion (Grade-1 Unicode mapping) ----------
const brailleMap = {
  "a":"⠁","b":"⠃","c":"⠉","d":"⠙","e":"⠑","f":"⠋","g":"⠛","h":"⠓","i":"⠊","j":"⠚",
  "k":"⠅","l":"⠇","m":"⠍","n":"⠝","o":"⠕","p":"⠏","q":"⠟","r":"⠗","s":"⠎","t":"⠞",
  "u":"⠥","v":"⠧","w":"⠺","x":"⠭","y":"⠽","z":"⠵",
  "0":"⠚","1":"⠁","2":"⠃","3":"⠉","4":"⠙","5":"⠑","6":"⠋","7":"⠛","8":"⠓","9":"⠊",
  " ":" ",",":"⠂",".":"⠲","?":"⠦","!":"⠖","'":"⠄","-":"⠤"
};

app.post('/braille', (req, res) => {
  const text = (req.body && req.body.text) || '';
  if (!text) return res.status(400).json({ error: 'No text' });
  const out = text.toLowerCase().split('').map(ch => brailleMap[ch] || '').join('');
  res.json({ success: true, braille: out });
});

// ---------- Optional: download simple text file (frontend may request) ----------
app.post('/download-text', (req, res) => {
  const { text, filename } = req.body || {};
  if (!text) return res.status(400).json({ error: 'No text supplied' });
  const name = (filename && filename.replace(/[^a-zA-Z0-9.-_]/g, '')) || 'extracted.txt';
  const tmpPath = path.join(UPLOAD_DIR, `${Date.now()}-${name}`);
  fs.writeFileSync(tmpPath, text, 'utf8');
  res.download(tmpPath, name, (err) => {
    fs.unlinkSync(tmpPath);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Accessible PDF backend running on http://localhost:${PORT}`);
});
