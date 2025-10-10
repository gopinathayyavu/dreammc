// bulk-upload.js
import { app, db } from './firebase-init.js';
import {
  doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const TIME_KEYS = ['10.00','11.00','12.00','1.00','5.00','6.00','7.00','8.00'];

const els = {
  date: document.getElementById('dateInput'),
  dataset: document.getElementById('dataset'),
  file: document.getElementById('imgInput'),
  psm: document.getElementById('psm'),
  ocrBtn: document.getElementById('btnOCR'),
  uploadBtn: document.getElementById('btnUpload'),
  status: document.getElementById('status'),
  gridWrap: document.getElementById('gridWrap'),
  rawBox: document.getElementById('rawBox'),
  rawText: document.getElementById('rawText'),
  toggleRaw: document.getElementById('btnToggleRaw'),
};

let parsed = null; // { rows: {1:{'10.00':'45786',...}, ...} }

function setStatus(text, cls='') {
  els.status.className = `status ${cls}`;
  els.status.textContent = `Status: ${text}`;
}

/* ========================
   1) Image preprocessing
   ======================== */
async function preprocessImage(file) {
  const img = await createImageBitmap(file);
  const scale = Math.max(1, 1600 / img.width); // upscale small images
  const W = Math.floor(img.width * scale);
  const H = Math.floor(img.height * scale);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);

  // Grayscale + contrast + threshold
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    // luminance
    const y = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];
    // local contrast boost
    let v = y * 1.25 - 30; // tweakable
    // threshold to near b/w (helps tables)
    const t = v > 170 ? 255 : (v < 110 ? 0 : v);
    d[i] = d[i+1] = d[i+2] = t;
  }
  ctx.putImageData(imgData, 0, 0);

  const blob = await new Promise(res => c.toBlob(res, 'image/png', 1));
  return blob;
}

/* ========================
   2) OCR
   ======================== */
async function runOCR(file, psmMode) {
  setStatus('Preprocessing image…');
  const proc = await preprocessImage(file);

  setStatus('Running OCR…');
  const worker = await Tesseract.createWorker('eng', 1, {
    // logger: m => console.log(m)  // uncomment to watch progress
  });

  const config = {
    // keep only numeric & scientific notation characters
    tessedit_char_whitelist: '0123456789.E+ ',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    tessedit_pageseg_mode: String(psmMode) // 6 default, 4 alternative
  };

  const { data } = await worker.recognize(proc, config);
  await worker.terminate();
  return data.text || '';
}

/* ========================
   3) Parsing
   ======================== */
function cleanToken(tok) {
  if (!tok) return '';
  tok = tok.trim();

  // Common OCR swaps
  tok = tok.replace(/[OoD]/g, '0')
           .replace(/[lI]/g, '1')
           .replace(/S/g, '5')
           .replace(/B/g, '8')
           .replace(/[^0-9A-Za-z\+\.]/g, '');

  // scientific notation → number
  if (/^\d+E\+\d+$/i.test(tok)) {
    try { tok = String(Number(tok)); } catch {}
  }

  tok = tok.replace(/\D/g, '');
  if (tok.length >= 5) tok = tok.slice(-5);
  else tok = tok.padStart(5, '0');

  return tok;
}

function parseTableText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const rowMap = {};
  for (const line of lines) {
    // Row line starts with 1..31
    const m = line.match(/^(\d{1,2})\s+(.*)$/);
    if (!m) continue;

    const rowIdx = Number(m[1]);
    if (!(rowIdx >= 1 && rowIdx <= 31)) continue;

    let tail = m[2];

    // Split candidates; keep alpha-numeric/E+ tokens
    let tokens = tail.split(/\s+/).filter(Boolean)
      .flatMap(tok => tok.match(/[0-9A-Za-z\+\.]+/g) || []);

    // Clean towards 5-digit slots
    const nums = tokens.map(cleanToken).filter(Boolean);

    if (nums.length < 8) continue; // not enough columns detected

    const take = nums.slice(0, 8);
    const rowObj = {};
    TIME_KEYS.forEach((k, i) => rowObj[k] = take[i]);
    rowMap[String(rowIdx)] = rowObj;
  }

  const rowCount = Object.keys(rowMap).length;
  return { rows: rowMap, rowCount };
}

/* ========================
   4) Editable grid
   ======================== */
function renderGrid(rowsObj) {
  const wrap = els.gridWrap;
  wrap.innerHTML = '';
  wrap.style.display = 'block';

  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const trh = document.createElement('tr');

  const th0 = document.createElement('th'); th0.textContent = '#'; trh.appendChild(th0);
  for (const k of TIME_KEYS) { const th = document.createElement('th'); th.textContent = k; trh.appendChild(th); }
  thead.appendChild(trh); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let r = 1; r <= 31; r++) {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.textContent = r; tr.appendChild(th);

    for (const k of TIME_KEYS) {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.dataset.row = String(r);
      td.dataset.time = k;
      td.textContent = rowsObj[String(r)]?.[k] ?? '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  const hint = document.createElement('div');
  hint.className = 'legend';
  hint.innerHTML = 'Fix any OCR mistakes directly in the grid. Values are stored as 5-digit numbers.';
  wrap.appendChild(hint);
}

function collectGrid() {
  const rows = {};
  const tds = els.gridWrap.querySelectorAll('td[contenteditable="true"]');
  tds.forEach(td => {
    const r = td.dataset.row, t = td.dataset.time;
    rows[r] ??= {};
    rows[r][t] = cleanToken(td.textContent || '');
  });
  return rows;
}

/* ========================
   5) Upload
   ======================== */
async function uploadToFirestore(dateStr, dataset, rows) {
  // Re-index by time: { '10.00': {'1':'12345',...}, ... }
  const byTime = {};
  for (const t of TIME_KEYS) byTime[t] = {};
  for (let r = 1; r <= 31; r++) {
    for (const t of TIME_KEYS) {
      byTime[t][String(r)] = cleanToken(rows[String(r)]?.[t] || '');
    }
  }

  const payload = {
    date: dateStr,
    results: byTime,
    uploadedAt: serverTimestamp(),
    dataset // 'machine' or 'result'
  };

  const coll = dataset === 'machine' ? 'mc_machine_numbers' : 'mc_results';
  await setDoc(doc(db, coll, dateStr), payload, { merge: true });
}

/* ========================
   6) UI wiring
   ======================== */
els.toggleRaw.addEventListener('click', () => {
  const vis = els.rawBox.style.display === 'block';
  els.rawBox.style.display = vis ? 'none' : 'block';
  els.toggleRaw.textContent = vis ? 'Show Raw OCR' : 'Hide Raw OCR';
});

els.ocrBtn.addEventListener('click', async () => {
  const file = els.file.files?.[0];
  if (!file) { setStatus('Please choose an image', 'warn'); return; }

  try {
    els.uploadBtn.disabled = true;
    const text = await runOCR(file, Number(els.psm.value));
    els.rawText.value = text;
    els.rawBox.style.display = 'block'; // show raw so you can verify

    const { rows, rowCount } = parseTableText(text);

    if (rowCount < 20) {
      setStatus(`Parsed only ${rowCount} rows — please fix in the grid (or try the other PSM)`, 'warn');
    } else {
      setStatus(`Parsed ${rowCount} rows — review & Upload when ready`, 'ok');
    }

    parsed = { rows };
    renderGrid(rows);
    els.uploadBtn.disabled = false;
  } catch (e) {
    console.error(e);
    setStatus('OCR failed — see console', 'err');
  }
});

els.uploadBtn.addEventListener('click', async () => {
  const dateStr = els.date.value;
  if (!dateStr) { setStatus('Select a date first', 'warn'); return; }
  if (!parsed) { setStatus('Run OCR first', 'warn'); return; }

  try {
    els.uploadBtn.disabled = true;
    setStatus('Uploading to Firebase…');
    const rows = collectGrid();
    await uploadToFirestore(dateStr, els.dataset.value, rows);
    setStatus(`Upload completed to "${els.dataset.value === 'machine' ? 'mc_machine_numbers' : 'mc_results'}" ✅`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Upload failed — see console', 'err');
  } finally {
    els.uploadBtn.disabled = false;
  }
});
