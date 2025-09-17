// result.js
// Reads your Firebase DB and shows ONLY the active/next slot for the chosen date.
// 5 mins before: show presenter + spin random digits; at time: show admin result + confetti.

import { db } from './firebase-init.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// keep slots aligned to your admin (IST-based hours)
const SLOTS = [
  { label: '10:00 AM', h: 10 }, { label: '11:00 AM', h: 11 },
  { label: '12:00 PM', h: 12 }, { label: '01:00 PM', h: 13 },
  { label: '05:00 PM', h: 17 }, { label: '06:00 PM', h: 18 },
  { label: '07:00 PM', h: 19 }, { label: '08:00 PM', h: 20 },
];

const activeSlotWrap = document.getElementById('active-slot');
const dateInput = document.getElementById('select-date');

// set default date = today (IST)
(function presetDateToTodayIST() {
  const now = new Date();
  // format yyyy-mm-dd local (browser). For India users this is IST already.
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
})();

// UTIL: build Date for given yyyy-mm-dd and hour (local tz)   
function makeLocalDate(dateStr, hour) {
  const [Y, M, D] = dateStr.split('-').map(Number);
  return new Date(Y, M - 1, D, hour, 0, 0, 0); // local time
}

// decide which slot is "active" relative to now
function pickActiveSlot(dateStr) {
  const now = new Date();
  // Build list of slot times as Date objects
  const times = SLOTS.map(s => ({ ...s, when: makeLocalDate(dateStr, s.h) }));

  // If before first slot -> next is first
  if (now < times[0].when) return times[0];
  // If after last slot -> return last (shows final result)
  if (now > times[times.length - 1].when) return times[times.length - 1];

  // Otherwise find the slot whose time >= now, else the last passed slot
  for (let i = 0; i < times.length; i++) {
    if (now <= times[i].when) return times[i];
  }
  return times[times.length - 1];
}

function renderActiveCard(dateStr) {
  activeSlotWrap.innerHTML = '';
  const slot = pickActiveSlot(dateStr);

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="slot-head">
      <div class="slot-time">${slot.label}</div>
      <div class="countdown" id="cd"></div>
    </div>

    <div class="stage-row">
      <div class="presenter">
        <!-- Using a reliable CDN portrait so images always load on GitHub Pages -->
        <video  width="320" height="200"  controls>
  <source src="assets/video.mp4" type="video/mp4">
Your browser does not support the video tag.
</video>
        <div class="hint" id="hint">—</div>
      </div>

      <div class="machine">
        <div class="machine-top">DEARMC RESULT</div>
        <div class="machine-reels" id="reels">
          <div class="digit" data-i="0">-</div>
          <div class="digit" data-i="1">-</div>
          <div class="digit" data-i="2">-</div>
          <div class="digit" data-i="3">-</div>
          <div class="digit" data-i="4">-</div>
        </div>
      </div>
    </div>
  `;
  activeSlotWrap.appendChild(card);

  attachLogic(dateStr, slot);
}

function setReelsText(text) {
  const digits = document.querySelectorAll('.digit');
  const str = (text ?? '').toString().padStart(5, '-').slice(-5);
  digits.forEach((d, idx) => d.textContent = str[idx]);
}

function spinRandom() {
  const n = Math.floor(10000 + Math.random() * 90000);
  setReelsText(String(n));
}

function attachLogic(dateStr, slot) {
  const cd = document.getElementById('cd');
  const hint = document.getElementById('hint');
  const official = document.getElementById('official');
  const testBtn = document.getElementById('testFire');

  // Firebase listener
  const resultRef = ref(db, `lottery/${dateStr}/${slot.label}/result`);
  let currentResult = null;
  onValue(resultRef, snap => { currentResult = snap.val(); });

  const target = makeLocalDate(dateStr, slot.h);
  let spinTimer = null;
  let cdTimer = null;

  function stopSpin() {
    if (spinTimer) { clearInterval(spinTimer); spinTimer = null; }
  }

  function startSpin() {
    if (!spinTimer) {
      spinTimer = setInterval(spinRandom, 120); // smooth reel spin
    }
  }

  function showResult() {
    stopSpin();
    if (currentResult && /^\d{5}$/.test(currentResult)) {
      setReelsText(currentResult);
      official.textContent = currentResult;
      try { window.confetti && window.confetti(); } catch (e) { }
    } else {
      official.textContent = 'Waiting from Admin...';
    }
    hint.textContent = 'Draw complete';
    cd.textContent = '';
  }

  function tick() {
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) {
      clearInterval(cdTimer);
      showResult();
      return;
    }

    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    cd.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // 5 minutes pre-draw: start animation + show presenter hint
    if (diff <= 5 * 60 * 1000) {
      hint.textContent = 'Starting the machine…';
      startSpin();
    } else {
      hint.textContent = 'Awaiting draw time';
      stopSpin();
      setReelsText('-----');
      official.textContent = '— — — — —';
    }
  }

  cdTimer = setInterval(tick, 250);
  tick();

  testBtn.addEventListener('click', () => { window.confetti && window.confetti(); });
}

// events
dateInput.addEventListener('change', () => {
  const date = dateInput.value;
  if (date) renderActiveCard(date);
});

// first render
renderActiveCard(document.getElementById('select-date').value);
