import { auth, db } from './firebase-init.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { ref, set } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js';

const timeSlots = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'];

const machineCol = document.getElementById('machine-column');
const resultCol = document.getElementById('result-column');
const dateInput = document.getElementById('select-date');
const submitBtn = document.getElementById('submit-data-btn');

onAuthStateChanged(auth, user => {
  if (!user) window.location.href = 'index.html';
});

document.getElementById('logout-btn').onclick = () => {
  signOut(auth).then(() => window.location.href = 'index.html');
};

function createCard(slot, type) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h3>${slot}</h3>
    <input type='text' placeholder='Enter ${type}' data-slot='${slot}' class='${type}-input'/>
  `;
  return card;
}

function renderCards() {
  machineCol.innerHTML = '';
  resultCol.innerHTML = '';
  timeSlots.forEach(slot => {
    machineCol.appendChild(createCard(slot, 'machine'));
    resultCol.appendChild(createCard(slot, 'result'));
  });
}

renderCards();

// Handle Submit
submitBtn.addEventListener('click', () => {
  const selectedDate = dateInput.value;
  if (!selectedDate) {
    alert('Please select a date first.');
    return;
  }

  const machineInputs = document.querySelectorAll('.machine-input');
  const resultInputs = document.querySelectorAll('.result-input');

  machineInputs.forEach(input => {
    const slot = input.dataset.slot;
    const value = input.value.trim();
    if (value) {
      set(ref(db, `lottery/${selectedDate}/${slot}/machine`), value);
    }
  });

  resultInputs.forEach(input => {
    const slot = input.dataset.slot;
    const value = input.value.trim();
    if (value) {
      set(ref(db, `lottery/${selectedDate}/${slot}/result`), value);
    }
  });

  alert('Data submitted successfully!');
});
