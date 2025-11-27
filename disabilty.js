// Basic DOM helpers
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const extracted = document.getElementById('extracted');
const readBtn = document.getElementById('readBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const rateInput = document.getElementById('rate');
const largeTextBtn = document.getElementById('largeTextBtn');
const contrastBtn = document.getElementById('contrastBtn');
const downloadLink = document.getElementById('downloadLink');

let currentText = '';
let utterance = null;

// Helper to update status
function setStatus(msg){
  status.innerText = msg;
}

// OCR processing using Tesseract.js
async function runOCR(file) {
  setStatus('Preparing OCR...');
  extracted.innerText = '';
  currentText = '';

  // For PDFs: this simple MVP expects a PDF that is actually an image or a single-page image PDF.
  const isPdf = file.type === 'application/pdf';
  let url = URL.createObjectURL(file);

  try {
    setStatus('Loading OCR engine...');
    const worker = Tesseract.createWorker({
      logger: m => {
        // show progress: m.progress is 0..1
        if (m.status && m.status === 'recognizing text') {
          setStatus(`Recognizing... ${(Math.round(m.progress * 100))}%`);
        } else {
          setStatus(m.status || 'Working...');
        }
      }
    });
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    setStatus('Running OCR — this may take a little while...');
    const { data: { text } } = await worker.recognize(url);
    currentText = text.trim();
    extracted.innerText = currentText || '[No text found]';
    setStatus(currentText ? 'OCR complete.' : 'OCR finished — no text found.');
    await worker.terminate();

    // prepare download
    const blob = new Blob([currentText], { type: 'text/plain' });
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.hidden = false;
  } catch (err) {
    console.error(err);
    setStatus('OCR failed. Try a clearer image or a different page.');
    extracted.innerText = '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

// TTS functions
function startReading() {
  if (!('speechSynthesis' in window)) {
    setStatus('Text-to-speech not supported in this browser.');
    return;
  }
  if (!currentText) {
    setStatus('No text to read. Run OCR first.');
    return;
  }
  speechSynthesis.cancel();
  utterance = new SpeechSynthesisUtterance(currentText);
  utterance.rate = parseFloat(rateInput.value) || 1;
  utterance.onstart = () => {
    setStatus('Reading...');
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    readBtn.disabled = true;
  };
  utterance.onend = () => {
    setStatus('Finished reading.');
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    readBtn.disabled = false;
  };
  speechSynthesis.speak(utterance);
}

function pauseReading() {
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    setStatus('Paused.');
    pauseBtn.innerText = 'Resume';
  } else if (speechSynthesis.paused) {
    speechSynthesis.resume();
    setStatus('Resumed.');
    pauseBtn.innerText = 'Pause';
  }
}

function stopReading() {
  speechSynthesis.cancel();
  setStatus('Stopped.');
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  readBtn.disabled = false;
  pauseBtn.innerText = 'Pause';
}

// Event listeners
fileInput.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  setStatus('File selected: ' + file.name);
  runOCR(file);
});

readBtn.addEventListener('click', startReading);
pauseBtn.addEventListener('click', pauseReading);
stopBtn.addEventListener('click', stopReading);

// Toggles: large text and high contrast
largeTextBtn.addEventListener('click', () => {
  const root = document.documentElement;
  const pressed = largeTextBtn.getAttribute('aria-pressed') === 'true';
  if (!pressed) {
    document.body.classList.add('large-text');
    largeTextBtn.setAttribute('aria-pressed', 'true');
  } else {
    document.body.classList.remove('large-text');
    largeTextBtn.setAttribute('aria-pressed', 'false');
  }
});

contrastBtn.addEventListener('click', () => {
  const pressed = contrastBtn.getAttribute('aria-pressed') === 'true';
  if (!pressed) {
    document.body.classList.add('high-contrast');
    contrastBtn.setAttribute('aria-pressed', 'true');
  } else {
    document.body.classList.remove('high-contrast');
    contrastBtn.setAttribute('aria-pressed', 'false');
  }
});

// Keyboard note: focus styles are in CSS. Ensure interactive elements are default focusable.
