import { auth, db } from './firebase-init.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import {
  ref,
  onValue,
  update
} from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';

/* === TIME SLOTS === */
const timeSlots = [
  '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM',
  '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM'
];

/* === DOM ELEMENTS === */
const datePicker   = document.getElementById('datePicker');
const logoutBtn    = document.getElementById('logoutBtn');
const rowsWrap     = document.getElementById('rows');
const saveBtn      = document.getElementById('saveChangesBtn');
const resetBtn     = document.getElementById('resetBtn');

/* === STATE === */
let loadedSnapshot = {};
let currentDateKey = '';
let inputsMap = new Map();

/* === AUTH CHECK === */
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'index.html';
});

logoutBtn.addEventListener('click', () => {
  signOut(auth).then(() => (window.location.href = 'index.html'));
});

/* === BUILD INPUT ROWS === */
function buildRows() {
  rowsWrap.innerHTML = '';
  inputsMap.clear();

  timeSlots.forEach(slot => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="slot">${slot}</div>
      <input type="text" inputmode="numeric"
        placeholder="Enter Machine (5 digits)"
        data-slot="${slot}" data-type="machine"
        maxlength="5" pattern="\\d{5}" />
      <input type="text" inputmode="numeric"
        placeholder="Enter Result (5 digits)"
        data-slot="${slot}" data-type="result"
        maxlength="5" pattern="\\d{5}" />
    `;

    const mInp = row.children[1];
    const rInp = row.children[2];

    [mInp, rInp].forEach(inp => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 5);
        markDirtyIfChanged(inp);
      });
      inp.addEventListener('blur', () => {
        if (inp.value && !/^\d{5}$/.test(inp.value)) {
          alert(`${inp.dataset.slot}: Must be exactly 5 digits`);
          inp.focus();
        }
      });
    });

    inputsMap.set(`${slot}::machine`, mInp);
    inputsMap.set(`${slot}::result`, rInp);
    rowsWrap.appendChild(row);
  });
}

/* === AUTO-LOAD ON DATE CHANGE === */
function loadForDate(dateKey) {
  if (!dateKey) return;
  currentDateKey = dateKey;
  buildRows();

  const dateRef = ref(db, `lottery/${dateKey}`);
  onValue(dateRef, (snap) => {
    const data = snap.val() || {};
    loadedSnapshot = data;

    timeSlots.forEach(slot => {
      const mVal = data?.[slot]?.machine ?? '';
      const rVal = data?.[slot]?.result ?? '';
      const mInp = inputsMap.get(`${slot}::machine`);
      const rInp = inputsMap.get(`${slot}::result`);
      mInp.value = mVal;
      rInp.value = rVal;
      mInp.classList.remove('dirty');
      rInp.classList.remove('dirty');
    });
  }, { onlyOnce: true });
}

/* === DIRTY TRACKING === */
function isDifferent(slot, type, val) {
  const prev = loadedSnapshot?.[slot]?.[type] ?? '';
  return String(prev) !== String(val);
}
function markDirtyIfChanged(inp) {
  const slot = inp.dataset.slot, type = inp.dataset.type;
  inp.classList.toggle('dirty', isDifferent(slot, type, inp.value));
}

/* === SAVE CHANGES === */
async function saveChanges() {
  if (!currentDateKey) return alert('Select a date first.');

  for (const [key, el] of inputsMap) {
    if (el.value && !/^\d{5}$/.test(el.value)) {
      alert(`${el.dataset.slot}: Must be exactly 5 digits`);
      el.focus();
      return;
    }
  }

  const updates = {};
  for (const [key, el] of inputsMap) {
    const [slot, type] = key.split('::');
    if (isDifferent(slot, type, el.value)) {
      updates[`lottery/${currentDateKey}/${slot}/${type}`] = el.value || null;
    }
  }

  if (!Object.keys(updates).length)
    return alert('No changes to save.');

  try {
    await update(ref(db), updates);
    alert('Changes saved successfully!');
    Object.entries(updates).forEach(([path, val]) => {
      const parts = path.split('/');
      const slot = parts[2], type = parts[3];
      if (!loadedSnapshot[slot]) loadedSnapshot[slot] = {};
      loadedSnapshot[slot][type] = val ?? '';
    });
    for (const [, el] of inputsMap) markDirtyIfChanged(el);
  } catch (e) {
    console.error(e);
    alert('Failed to save.');
  }
}

/* === RESET === */
function resetToLoaded() {
  if (!currentDateKey) return;
  timeSlots.forEach(slot => {
    const mInp = inputsMap.get(`${slot}::machine`);
    const rInp = inputsMap.get(`${slot}::result`);
    const mVal = loadedSnapshot?.[slot]?.machine ?? '';
    const rVal = loadedSnapshot?.[slot]?.result ?? '';
    mInp.value = mVal;
    rInp.value = rVal;
    mInp.classList.remove('dirty');
    rInp.classList.remove('dirty');
  });
}

/* === EVENTS === */
saveBtn.addEventListener('click', saveChanges);
resetBtn.addEventListener('click', resetToLoaded);

/* === AUTO LOAD WHEN DATE CHANGES === */
datePicker.addEventListener('change', () => loadForDate(datePicker.value));

/* === SET DEFAULT TO TODAY === */
(function setToday(){
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  const today = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  datePicker.value = today;
  loadForDate(today); // auto-load on page open
})();
