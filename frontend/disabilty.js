// frontend/script.js

// Live region and last message for repeat
const statusEl = document.getElementById('status');
const extractedText = document.getElementById('extractedText');
const summaryBlock = document.getElementById('summaryBlock');
const summaryText = document.getElementById('summaryText');
const brailleBlock = document.getElementById('brailleBlock');
const brailleText = document.getElementById('brailleText');

let lastSpoken = '';
function speak(msg, opts={}) {
  lastSpoken = msg;
  // Use SpeechSynthesis for TalkBack feedback
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // cancel previous speech
    const ut = new SpeechSynthesisUtterance(msg);
    ut.rate = opts.rate || 1;
    ut.pitch = opts.pitch || 1;
    ut.lang = opts.lang || 'en-US';
    window.speechSynthesis.speak(ut);
  }
  // Also update accessible status region
  statusEl.innerText = msg;
}

// On load — welcome & show shortcuts
window.addEventListener('load', () => {
  setTimeout(()=> {
    speak('Welcome to the Accessible PDF converter. I will read the available shortcuts now.');
    setTimeout(()=> shortcutGuide(), 1500);
  }, 500);
});

// Shortcut guide readout
function shortcutGuide() {
  speak('Shortcuts: Shift plus U to upload and extract. Shift plus R to read aloud. Shift plus S to simplify text for learners. Shift plus B to convert to braille. Shift plus H to hear this help again. Shift plus P to toggle high contrast. Shift plus L to toggle large text. Shift plus Q to repeat the last message.');
}

// Focus-tracking to give talkback feedback when tabbing
const focusables = document.querySelectorAll('button, input, textarea, [tabindex]');
focusables.forEach(el => {
  el.addEventListener('focus', () => {
    const label = el.getAttribute('aria-label') || el.innerText || el.placeholder || el.id;
    if (label) speak(label);
  });
});

// file upload handling
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', async () => {
  if (!fileInput.files || !fileInput.files[0]) {
    speak('No file chosen');
    return;
  }
  speak('File chosen. You can press Shift plus U to extract text or click Extract.');
});

// ----- Buttons -----
document.getElementById('btnUpload').addEventListener('click', () => runUpload());
document.getElementById('btnRead').addEventListener('click', () => readAloud());
document.getElementById('btnSimplify').addEventListener('click', () => simplifyText());
document.getElementById('btnBraille').addEventListener('click', () => convertBraille());
document.getElementById('btnDownload').addEventListener('click', () => downloadText());
document.getElementById('btnHelp').addEventListener('click', () => shortcutGuide());

async function runUpload() {
  const f = fileInput.files[0];
  if (!f) { speak('Please choose a PDF file first.'); return; }

  speak('Uploading and extracting text. This may take a few seconds.');

  const form = new FormData();
  form.append('pdf', f);
  try {
    const resp = await fetch('http://localhost:5000/upload', { method: 'POST', body: form });
    const j = await resp.json();
    if (j && j.text !== undefined) {
      extractedText.value = j.text.trim();
      speak('Extraction complete. Press Shift plus R to read aloud or Shift plus S to simplify.');
    } else {
      speak('Extraction returned no text.');
    }
  } catch (err) {
    console.error(err);
    speak('Server error while extracting PDF. Check backend is running.');
  }
}

function readAloud() {
  const t = extractedText.value.trim();
  if (!t) { speak('No extracted text. Please upload a PDF first.'); return; }
  speak('Starting reading aloud. Use keyboard to stop or pause speech if needed.');
  // Read in shorter chunks (sentences) for improved comprehension
  const sentences = t.split(/(?<=[.!?])\s+/);
  let i = 0;
  function speakNext() {
    if (i >= sentences.length) return speak('Finished reading.');
    speak(sentences[i]);
    i++;
    // space between sentences
    setTimeout(speakNext, 1200);
  }
  speakNext();
}

async function simplifyText() {
  const t = extractedText.value.trim();
  if (!t) { speak('No text available to simplify.'); return; }
  speak('Requesting simplified text. If OpenAI key is configured on the server, a high quality simplification will be used. Otherwise a short local summary will be produced.');

  try {
    const resp = await fetch('http://localhost:5000/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t })
    });
    const j = await resp.json();
    const simple = j.simplified || j.simple || j.simplify || j;
    summaryText.innerText = simple;
    summaryBlock.style.display = 'block';
    speak('Simplified text ready. You can press shift R to repeat the summary or read it now.');
  } catch (err) {
    console.error(err);
    speak('Failed to get simplified text from server.');
  }
}

async function convertBraille() {
  const t = extractedText.value.trim();
  if (!t) { speak('No text available to convert to braille.'); return; }
  speak('Converting text to braille output.');
  try {
    const resp = await fetch('http://localhost:5000/braille', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t })
    });
    const j = await resp.json();
    brailleText.innerText = j.braille || '';
    brailleBlock.style.display = 'block';
    speak('Braille conversion complete. Braille text displayed in the braille block.');
  } catch (err) {
    console.error(err);
    speak('Braille conversion failed.');
  }
}

// download extracted text as .txt via server
async function downloadText() {
  const t = extractedText.value || '';
  if (!t) { speak('No text to download.'); return; }
  speak('Preparing text file for download.');
  try {
    const resp = await fetch('http://localhost:5000/download-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t, filename: 'extracted.txt' })
    });
    // Response will be a file download, browser will prompt automatically
    if (resp.ok) speak('Download should begin automatically.');
    else speak('Download failed.');
  } catch (err) {
    console.error(err);
    speak('Download request failed.');
  }
}

// High contrast / large text toggles
document.getElementById('contrastToggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('high-contrast');
  const pressed = document.getElementById('contrastToggle').getAttribute('aria-pressed') !== 'true';
  document.getElementById('contrastToggle').setAttribute('aria-pressed', pressed);
  speak(pressed ? 'High contrast mode on' : 'High contrast mode off');
});
document.getElementById('largeTextToggle').addEventListener('click', () => {
  document.body.classList.toggle('large-text');
  const pressed = document.getElementById('largeTextToggle').getAttribute('aria-pressed') !== 'true';
  document.getElementById('largeTextToggle').setAttribute('aria-pressed', pressed);
  speak(pressed ? 'Large text mode on' : 'Large text mode off');
});

// Keyboard shortcuts handler
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'U' || e.key === 'u')) runUploadShortcut();
  if (e.shiftKey && (e.key === 'R' || e.key === 'r')) readAloud();
  if (e.shiftKey && (e.key === 'S' || e.key === 's')) simplifyText();
  if (e.shiftKey && (e.key === 'B' || e.key === 'b')) convertBraille();
  if (e.shiftKey && (e.key === 'H' || e.key === 'h')) shortcutGuide();
  if (e.shiftKey && (e.key === 'P' || e.key === 'p')) document.getElementById('contrastToggle').click();
  if (e.shiftKey && (e.key === 'L' || e.key === 'l')) document.getElementById('largeTextToggle').click();
  if (e.shiftKey && (e.key === 'Q' || e.key === 'q')) speak(lastSpoken);
  if (e.shiftKey && (e.key === 'D' || e.key === 'd')) downloadText();
});

function runUploadShortcut() {
  // If there's a selected file, run upload; otherwise open file dialog
  if (fileInput.files && fileInput.files[0]) runUploadProcess();
  else {
    fileInput.focus();
    speak('Please select a file using the file input.');
  }
}

async function runUploadProcess() {
  // same as runUpload (to avoid duplication)
  runUpload();
}

// Small helper: find elements (older browsers)
function $(id){return document.getElementById(id);}
