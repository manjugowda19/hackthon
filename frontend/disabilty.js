// frontend/script.js

// Elements
const fileInput = document.getElementById('fileInput');
const extractBtn = document.getElementById('extractBtn');
const readBtn = document.getElementById('readBtn');
const simplifyBtn = document.getElementById('simplifyBtn');
const brailleBtn = document.getElementById('brailleBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const extractedText = document.getElementById('extractedText');
const summaryCard = document.getElementById('summaryCard');
const summaryText = document.getElementById('summaryText');
const brailleCard = document.getElementById('brailleCard');
const brailleText = document.getElementById('brailleText');
const contrastToggle = document.getElementById('contrastToggle');
const largeTextToggle = document.getElementById('largeTextToggle');
const repeatBtn = document.getElementById('repeatBtn');
const helpBtn = document.getElementById('helpBtn');
const voiceBtn = document.getElementById('voiceBtn');
const fileLabel = document.getElementById('fileLabel');

let lastSpoken = '';
let voiceControlActive = false;
let sr = null; // speech recognition object if available

// Speak helper (TalkBack)
function speak(msg, options={}) {
  lastSpoken = msg;
  statusEl.innerText = msg;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = options.lang || 'en-US';
    u.rate = options.rate || 1;
    u.pitch = options.pitch || 1;
    window.speechSynthesis.speak(u);
  }
}

// Focus-speak: when tabbing, speak label/aria-label
function attachFocusSpeak() {
  const focusables = document.querySelectorAll('button, input, textarea, .fileLabel, [tabindex]');
  focusables.forEach(el => {
    el.addEventListener('focus', () => {
      const label = el.getAttribute('aria-label') || el.innerText || el.placeholder || el.id;
      if (label) speak(label);
    });
  });
}

// Shortcut guide
function shortcutGuide() {
  speak('Shortcuts: Shift U upload and extract. Shift R read aloud. Shift S simplify. Shift B braille. Shift D download text. Shift H help again. Shift P contrast. Shift L large text. Shift Q repeat last spoken.');
}

// On load: auto talkback and attach listeners
window.addEventListener('load', () => {
  attachFocusSpeak();
  setTimeout(()=> {
    speak('Welcome to Accessible PDF Converter. I will read the shortcuts now.');
    setTimeout(shortcutGuide, 1200);
  }, 400);
});

// ------------------- File Handling -------------------
fileLabel.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    speak('File selected. Press Extract and Read or press Shift U.');
  }
});

// Upload & Extract -> backend /upload. If server returns empty, try client OCR for images
async function uploadAndExtract() {
  const file = fileInput.files && fileInput.files[0];
  if (!file) { speak('Please select a file first.'); return; }
  speak('Uploading file. Please wait.');

  const fd = new FormData();
  fd.append('pdf', file);

  try {
    const r = await fetch('http://localhost:5000/upload', { method:'POST', body: fd });
    const j = await r.json();
    let text = (j && j.text) ? j.text.trim() : '';
    // If server returned empty and file is image or scanned PDF, try client OCR
    if (!text && file.type && file.type.startsWith('image')) {
      speak('No text found in PDF. Running OCR in the browser. This may take a few moments.');
      text = await runClientOCRImage(file);
    } else if (!text && file.type && file.type === 'application/pdf') {
      // For scanned single-page PDFs: we could extract page image and OCR — keep simple: advise user
      speak('PDF appears to be scanned. For best results use a clear image or enable OCR option.');
    }
    extractedText.value = text || '[No text found]';
    speak('Extraction complete. Use Shift R to read aloud, or press Read Aloud.');
  } catch (err) {
    console.error(err);
    speak('Server error while extracting. Ensure backend is running.');
  }
}

// Client-side OCR for image input using tesseract.js
async function runClientOCRImage(file) {
  try {
    const worker = Tesseract.createWorker({
      logger: m => { /* optional progress logging */ }
    });
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const imgURL = URL.createObjectURL(file);
    const { data: { text } } = await worker.recognize(imgURL);
    await worker.terminate();
    URL.revokeObjectURL(imgURL);
    return text;
  } catch (err) {
    console.error('OCR failed', err);
    return '';
  }
}

// ------------------- Reading (TalkBack) -------------------
function readAloud() {
  const text = extractedText.value.trim();
  if (!text) { speak('No text available to read. Extract first.'); return; }
  speak('Starting reading. Use Shift Q to repeat last message.');
  // read in chunks for comprehension
  const chunks = text.split(/(?<=[.!?])\s+/);
  let i=0;
  function next() {
    if (i>=chunks.length) { speak('Finished reading.'); return; }
    speak(chunks[i++]);
    setTimeout(next, 1200);
  }
  next();
}

// ------------------- Simplify (server-side or fallback) -------------------
async function simplifyText() {
  const text = extractedText.value.trim();
  if (!text) { speak('No text to simplify.'); return; }
  speak('Requesting simplified version. This may take a few seconds.');
  try {
    const resp = await fetch('http://localhost:5000/simplify', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text })
    });
    const j = await resp.json();
    const simplified = j.simplified || j.simple || j;
    summaryText.innerText = simplified;
    summaryCard.style.display = 'block';
    speak('Simplified text is ready. You can press Shift R to read it.');
  } catch (err) {
    console.error(err);
    speak('Failed to simplify text.');
  }
}

// ------------------- Braille -------------------
async function convertBraille() {
  const text = extractedText.value.trim();
  if (!text) { speak('No text to convert.'); return; }
  speak('Converting to braille.');
  try {
    const resp = await fetch('http://localhost:5000/braille', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text })
    });
    const j = await resp.json();
    brailleText.innerText = j.braille || '';
    brailleCard.style.display = 'block';
    speak('Braille conversion ready.');
  } catch (err) {
    console.error(err);
    speak('Braille conversion failed.');
  }
}

// ------------------- Download text -------------------
function downloadText() {
  const text = extractedText.value || '';
  if (!text) { speak('No text to download.'); return; }
  // Download via client-side creation for simplicity
  const blob = new Blob([text], { type:'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'extracted.txt';
  a.click();
  speak('Text file downloaded.');
}

// ------------------- UI toggles -------------------
contrastToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('high-contrast');
  const pressed = document.documentElement.classList.contains('high-contrast');
  contrastToggle.setAttribute('aria-pressed', pressed);
  speak(pressed ? 'High contrast enabled.' : 'High contrast disabled.');
});
largeTextToggle.addEventListener('click', () => {
  document.body.classList.toggle('large-text');
  const pressed = document.body.classList.contains('large-text');
  largeTextToggle.setAttribute('aria-pressed', pressed);
  speak(pressed ? 'Large text enabled.' : 'Large text disabled.');
});

// ------------------- Repeat / Help -------------------
repeatBtn.addEventListener('click', () => {
  speak(lastSpoken);
});
helpBtn.addEventListener('click', () => { shortcutGuide(); });

// Keyboard shortcuts (Shift + key)
document.addEventListener('keydown', (e) => {
  if (!e.shiftKey) return;
  const k = e.key.toLowerCase();
  switch (k) {
    case 'u': uploadAndExtract(); break; // Shift+U
    case 'r': readAloud(); break;        // Shift+R
    case 's': simplifyText(); break;     // Shift+S
    case 'b': convertBraille(); break;   // Shift+B
    case 'd': downloadText(); break;     // Shift+D
    case 'h': shortcutGuide(); break;    // Shift+H
    case 'p': contrastToggle.click(); break;
    case 'l': largeTextToggle.click(); break;
    case 'q': speak(lastSpoken); break;
  }
});

// Button wiring
extractBtn.addEventListener('click', uploadAndExtract);
readBtn.addEventListener('click', readAloud);
simplifyBtn.addEventListener('click', simplifyText);
brailleBtn.addEventListener('click', convertBraille);
downloadBtn.addEventListener('click', downloadText);

// Voice Control (speech recognition)
voiceBtn.addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    speak('Speech recognition not supported in this browser.');
    return;
  }
  if (voiceControlActive) { stopVoiceControl(); return; }
  startVoiceControl();
});

function startVoiceControl() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  sr = new SpeechRecognition();
  sr.lang = 'en-US';
  sr.interimResults = false;
  sr.continuous = false;
  sr.onstart = () => { voiceControlActive = true; speak('Voice control activated. Say upload, read, simplify, braille, download, or help.'); };
  sr.onresult = (e) => {
    const cmd = e.results[0][0].transcript.toLowerCase();
    speak('Command: ' + cmd);
    if (cmd.includes('upload')) fileInput.click();
    else if (cmd.includes('read')) readAloud();
    else if (cmd.includes('simplify') || cmd.includes('summary')) simplifyText();
    else if (cmd.includes('braille')) convertBraille();
    else if (cmd.includes('download')) downloadText();
    else if (cmd.includes('help')) shortcutGuide();
    else speak('Command not recognized. Try again.');
  };
  sr.onerror = (e) => { console.error(e); speak('Voice control error'); };
  sr.onend = () => { voiceControlActive = false; speak('Voice control ended.'); };
  sr.start();
}

function stopVoiceControl() {
  if (sr) sr.stop();
  voiceControlActive = false;
  speak('Voice control disabled.');
}

// Shortcut guide function (also used by help button)
function shortcutGuide() {
  speak('Keyboard shortcuts. Shift plus U to upload and extract. Shift plus R to read aloud. Shift plus S to simplify. Shift plus B to convert to braille. Shift plus D to download. Shift plus H to hear this help. Shift plus P toggles high contrast. Shift plus L toggles large text. Shift plus Q repeats last message.');
}
