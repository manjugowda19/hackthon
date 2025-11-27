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

// multer for file uploads
const upload = multer({ dest: UPLOAD_DIR });

// ---------------- POST /upload
// Accepts a PDF (or image). Uses pdf-parse for text-based PDFs.
// For scanned PDFs/images you can use client-side Tesseract (frontend).
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, error:'No file' });
    const buffer = fs.readFileSync(req.file.path);
    let data = {};
    try {
      data = await pdfParse(buffer);
    } catch (err) {
      // fallback: return empty text if parse fails (frontend will attempt OCR)
      data.text = '';
    }
    // delete temp file
    try { fs.unlinkSync(req.file.path); } catch(e){}
    res.json({ success:true, text: data.text || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error:'Server error' });
  }
});

// ---------------- POST /simplify
// Optional: If OPENAI_API_KEY is set, this uses OpenAI to simplify. Otherwise a local fallback is returned.
app.post('/simplify', async (req, res) => {
  try {
    const text = (req.body && req.body.text) || '';
    if (!text) return res.status(400).json({ success:false, error:'No text' });

    const key = process.env.OPENAI_API_KEY || '';
    if (key) {
      // Use OpenAI Chat Completions (update model name if needed)
      const prompt = `Simplify the following text into short, plain sentences for a student who needs easy words. Keep meaning intact.\n\n${text}`;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 800
        })
      });
      const j = await response.json();
      const simplified = j?.choices?.[0]?.message?.content || '';
      return res.json({ success:true, simplified: simplified.trim() });
    }

    // Local fallback: pick first 6 reasonably long sentences
    const sentences = text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(s => s.trim().length>20);
    const simplified = sentences.slice(0,6).join(' ');
    res.json({ success:true, simplified });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error:'Simplify failed' });
  }
});

// ---------------- POST /braille
// Simple Grade-1 mapping (unicode braille) — basic support
const brailleMap = {
  a:"⠁",b:"⠃",c:"⠉",d:"⠙",e:"⠑",f:"⠋",g:"⠛",h:"⠓",i:"⠊",j:"⠚",
  k:"⠅",l:"⠇",m:"⠍",n:"⠝",o:"⠕",p:"⠏",q:"⠟",r:"⠗",s:"⠎",t:"⠞",
  u:"⠥",v:"⠧",w:"⠺",x:"⠭",y:"⠽",z:"⠵",
  "0":"⠼⠚","1":"⠼⠁","2":"⠼⠃","3":"⠼⠉","4":"⠼⠙","5":"⠼⠑","6":"⠼⠋","7":"⠼⠛","8":"⠼⠓","9":"⠼⠊",
  " ":" ",",":"⠂",".":"⠲","?":"⠦","!":"⠖","'":"⠄","-":"⠤",":":"⠒",";":"⠆"
};
app.post('/braille', (req,res)=>{
  try {
    const text = (req.body && req.body.text) || '';
    if (!text) return res.status(400).json({ success:false, error:'No text' });
    const out = text.toLowerCase().split('').map(ch => brailleMap[ch] || '').join('');
    res.json({ success:true, braille: out });
  } catch (err) {
    res.status(500).json({ success:false, error:'Braille failed' });
  }
});

// ---------------- POST /download-text (returns a temp file)
app.post('/download-text', (req,res)=>{
  const text = (req.body && req.body.text) || '';
  if (!text) return res.status(400).json({ success:false, error:'No text' });
  const filename = `extracted-${Date.now()}.txt`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, text, 'utf8');
  res.download(filepath, filename, (err)=>{
    try { fs.unlinkSync(filepath); } catch(e){}
    if (err) console.error(err);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`Accessible PDF backend running http://localhost:${PORT}`));
