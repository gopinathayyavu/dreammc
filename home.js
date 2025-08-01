import { db } from './firebase-init.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';

const timeSlots = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

const machineCol = document.getElementById('machine-column');
const resultCol = document.getElementById('result-column');

function formatDateForPath(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const date = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function parseSlotTime(slot) {
  const [time, period] = slot.split(' ');
  let [hour, minute] = time.split(':').map(Number);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
}

function createCard(slot, type) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<h3>${slot}</h3><div class="number-boxes" id="${type}-${slot}"></div>`;
  return card;
}

function displayBoxes(container, text) {
  container.innerHTML = '';
  [...text].forEach(char => {
    const box = document.createElement('div');
    box.className = 'number-box';
    box.textContent = char;
    container.appendChild(box);
  });
}

function renderTodayCards() {
  const today = new Date();
  const todayPath = formatDateForPath(today);

  timeSlots.forEach(slot => {
    const slotTime = parseSlotTime(slot);
    const now = new Date();
    const machineTime = new Date(slotTime);
    machineTime.setHours(machineTime.getHours() - 1);

    const mcCard = createCard(slot, 'mc');
    const rsCard = createCard(slot, 'rs');

    machineCol.appendChild(mcCard);
    resultCol.appendChild(rsCard);

    const refPath = ref(db, `lottery/${todayPath}/${slot}`);
    onValue(refPath, snapshot => {
      try {
        const data = snapshot.val() || {};
        const mcBox = document.getElementById(`mc-${slot}`);
        const rsBox = document.getElementById(`rs-${slot}`);
        if (!mcBox || !rsBox) return;

        const mcText = (now >= machineTime && data.machine) ? data.machine : '-----';
        const rsText = (now >= slotTime && data.result) ? data.result : '-----';

        displayBoxes(mcBox, mcText);
        displayBoxes(rsBox, rsText);
      } catch (error) {
        console.error(`Error reading data for ${slot}:`, error);
      }
    }, error => {
      console.error(`Firebase read error for slot ${slot}:`, error);
    });
  });
}

renderTodayCards();
