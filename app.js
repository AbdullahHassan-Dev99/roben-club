/* =========================================
   ROBEN CLUB — app.js  (Firebase version)
   Real-time sync across ALL devices
   ========================================= */

// ─── Firebase init ────────────────────────────────────────────
let db = null; // Firebase database reference

const DEFAULT_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAdAYE_L0422cRxSwqmOc-7Z7UQvhN-rMk",
  authDomain:        "roben-club.firebaseapp.com",
  databaseURL:       "https://roben-club-default-rtdb.firebaseio.com",
  projectId:         "roben-club",
  storageBucket:     "roben-club.firebasestorage.app",
  messagingSenderId: "168278287462",
  appId:             "1:168278287462:web:e9ff6199ef2f5c42cff9a7",
};

function getFirebaseConfig() {
  if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "PASTE_YOUR_apiKey_HERE") {
    return FIREBASE_CONFIG;
  }
  return DEFAULT_FIREBASE_CONFIG;
}

function initFirebase() {
  if (db) return true;
  try {
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK not loaded');
      return false;
    }
    const config = getFirebaseConfig();
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(config);
    }
    db = firebase.database();
    console.log('✅ Firebase connected');
    return true;
  } catch (e) {
    console.error('❌ Firebase init failed:', e);
    return false;
  }
}

// ─── DB paths ─────────────────────────────────────────────────
const PATHS = {
  STUDENTS: 'roben/students',
  SLOTS:    'roben/slots',
  CURRENT:  'roben/current',
};

// ─── Default time slots ───────────────────────────────────────
const DEFAULT_SLOTS = [
  { id: 's1', time: '10:00', capacity: 5 },
  { id: 's2', time: '10:30', capacity: 5 },
  { id: 's3', time: '11:00', capacity: 5 },
  { id: 's4', time: '11:30', capacity: 5 },
  { id: 's5', time: '12:00', capacity: 5 },
  { id: 's6', time: '12:30', capacity: 5 },
];

// Admin password
const ADMIN_PASSWORD = 'roben2025';

// ─── State (cached locally for UI) ────────────────────────────
let _students = [];
let _slots    = DEFAULT_SLOTS;
let _currentId = null;

// ─── Firebase listeners ───────────────────────────────────────
function listenStudents(callback) {
  db.ref(PATHS.STUDENTS).on('value', snap => {
    const raw = snap.val() || {};
    _students = Object.values(raw);
    callback(_students);
  });
}

function listenSlots(callback) {
  db.ref(PATHS.SLOTS).on('value', snap => {
    const raw = snap.val();
    if (raw) {
      _slots = Object.values(raw);
      _slots.sort((a, b) => a.time.localeCompare(b.time));
    } else {
      // First run — push defaults
      _slots = DEFAULT_SLOTS;
      saveSlots(DEFAULT_SLOTS);
    }
    callback(_slots);
  });
}

function listenCurrent(callback) {
  db.ref(PATHS.CURRENT).on('value', snap => {
    _currentId = snap.val() || null;
    callback(_currentId);
  });
}

// ─── Write helpers ─────────────────────────────────────────────
function saveStudents(students) {
  const obj = {};
  students.forEach(s => { obj[s.id] = s; });
  return db.ref(PATHS.STUDENTS).set(obj);
}

function addStudent(student) {
  return db.ref(PATHS.STUDENTS + '/' + student.id).set(student);
}

function updateStudent(student) {
  return db.ref(PATHS.STUDENTS + '/' + student.id).update(student);
}

function deleteStudent(id) {
  return db.ref(PATHS.STUDENTS + '/' + id).remove();
}

function saveSlots(slots) {
  const obj = {};
  slots.forEach(s => { obj[s.id] = s; });
  return db.ref(PATHS.SLOTS).set(obj);
}

function setCurrentId(id) {
  _currentId = id;
  return db.ref(PATHS.CURRENT).set(id || null);
}

// ─── Helpers ──────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getSlotById(slotId) {
  return _slots.find(s => s.id === slotId);
}

function countStudentsInSlot(slotId) {
  return _students.filter(s => s.slotId === slotId).length;
}

function statusLabel(status) {
  const map = {
    waiting:      { text: 'Waiting',    cls: 'status-waiting'      },
    interviewing: { text: 'Now 🎤',     cls: 'status-interviewing' },
    done:         { text: 'Done ✅',    cls: 'status-done'         },
    absent:       { text: 'Absent ❌',  cls: 'status-absent'       },
  };
  return map[status] || map.waiting;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isSoundOn() {
  return localStorage.getItem('roben_sound') !== 'off';
}

function setSoundPref(on) {
  localStorage.setItem('roben_sound', on ? 'on' : 'off');
}

// ─── Sound ────────────────────────────────────────────────────
function playNotificationSound() {
  if (!isSoundOn()) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    let time = ctx.currentTime;
    notes.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.35, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.start(time); osc.stop(time + 0.45);
      time += 0.22;
    });
  } catch(e) {}
}

// ─── Particles ────────────────────────────────────────────────
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  const colors = ['#f5c518','#2e86de','#ffffff','#ffd740'];
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${Math.random()*20+15}s;
      animation-delay:${Math.random()*-20}s;
    `;
    container.appendChild(p);
  }
}

// =========================================
// REGISTER PAGE
// =========================================
function initRegisterPage() {
  initParticles();

  if (!initFirebase()) {
    showFirebaseError();
    return;
  }

  // Load slots then render
  listenSlots(() => renderSlots());

  const form = document.getElementById('registerForm');
  if (form) form.addEventListener('submit', handleRegisterSubmit);
}

function showFirebaseError() {
  const card = document.getElementById('registerCard');
  if (card) {
    card.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">⚙️</div>
        <h2 style="color:var(--gold);margin-bottom:12px;">Setup Required</h2>
        <p style="color:var(--text-secondary);font-size:.9rem;line-height:1.7;">
          Firebase is not configured yet.<br>
          Please ask the admin to set up the system.
        </p>
      </div>`;
  }
}

let selectedSlotId = null;

function renderSlots() {
  const grid = document.getElementById('slotsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (_slots.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem;">No time slots available yet.</p>';
    return;
  }

  _slots.forEach(slot => {
    const count = countStudentsInSlot(slot.id);
    const isFull = count >= slot.capacity;
    const chip = document.createElement('div');
    chip.className = 'slot-chip' + (isFull ? ' slot-full' : '');
    chip.dataset.slotId = slot.id;
    chip.innerHTML = `
      <span class="slot-time">⏰ ${slot.time}</span>
      <span class="slot-cap">${count}/${slot.capacity} registered</span>
      ${isFull ? '<span class="slot-full-label">Full</span>' : ''}
    `;
    if (!isFull) chip.addEventListener('click', () => selectSlot(slot.id));
    grid.appendChild(chip);
  });

  // Re-mark selected
  if (selectedSlotId) {
    const chip = document.querySelector(`.slot-chip[data-slot-id="${selectedSlotId}"]`);
    if (chip && !chip.classList.contains('slot-full')) chip.classList.add('selected');
  }
}

function selectSlot(slotId) {
  selectedSlotId = slotId;
  document.querySelectorAll('.slot-chip').forEach(c => c.classList.remove('selected'));
  const chip = document.querySelector(`.slot-chip[data-slot-id="${slotId}"]`);
  if (chip) chip.classList.add('selected');
  clearError('slotError');
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  if (!validateRegisterForm()) return;

  const btn = document.getElementById('submitBtn');
  if (btn) btn.disabled = true;

  // Check duplicate university ID
  const uId = document.getElementById('universityId').value.trim();
  if (_students.find(s => s.universityId === uId)) {
    showError('idError', 'This University ID is already registered!');
    if (btn) btn.disabled = false;
    return;
  }

  const student = {
    id:           uid(),
    name:         document.getElementById('studentName').value.trim(),
    universityId: uId,
    phone:        document.getElementById('phoneNumber').value.trim(),
    slotId:       selectedSlotId,
    status:       'waiting',
    registeredAt: new Date().toISOString(),
  };

  try {
    await addStudent(student);
    sessionStorage.setItem('myStudentId', student.id);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    showSuccessCard(student);
  } catch(err) {
    alert('❌ Error saving data. Check internet connection.');
    console.error(err);
    if (btn) btn.disabled = false;
  }
}

function showSuccessCard(student) {
  const slot = getSlotById(student.slotId);
  document.getElementById('registerCard').classList.add('hidden');
  const info = document.getElementById('successInfo');
  info.innerHTML = `
    <div class="info-row"><span class="info-label">Name</span><span class="info-val">${escHtml(student.name)}</span></div>
    <div class="info-row"><span class="info-label">University ID</span><span class="info-val">${escHtml(student.universityId)}</span></div>
    <div class="info-row"><span class="info-label">Phone</span><span class="info-val">${escHtml(student.phone)}</span></div>
    <div class="info-row"><span class="info-label">Time Slot</span><span class="info-val">${slot ? slot.time : '—'}</span></div>
  `;
  document.getElementById('successCard').classList.remove('hidden');
}

function validateRegisterForm() {
  let valid = true;
  const name = document.getElementById('studentName').value.trim();
  if (!name || name.length < 3) { showError('nameError','Please enter your full name (at least 3 characters).'); valid=false; }
  else clearError('nameError');

  const uId = document.getElementById('universityId').value.trim();
  if (!uId || uId.length < 4) { showError('idError','Please enter a valid University ID.'); valid=false; }
  else clearError('idError');

  const phone = document.getElementById('phoneNumber').value.trim();
  if (!phone || !/^0[0-9]{9,10}$/.test(phone)) { showError('phoneError','Enter a valid phone number (e.g. 01012345678).'); valid=false; }
  else clearError('phoneError');

  if (!selectedSlotId) { showError('slotError','Please select an interview time slot.'); valid=false; }
  else clearError('slotError');

  return valid;
}

function showError(id, msg) {
  const el = document.getElementById(id); if (el) el.textContent = msg;
}
function clearError(id) {
  const el = document.getElementById(id); if (el) el.textContent = '';
}

// =========================================
// QUEUE PAGE
// =========================================
let prevCurrentId = null;
let myStudentId   = null;
let soundMuted    = false;

function initQueuePage() {
  initParticles();
  myStudentId = sessionStorage.getItem('myStudentId');
  soundMuted  = !isSoundOn();
  updateSoundToggle();

  if (!initFirebase()) {
    document.getElementById('queueList').innerHTML = `
      <div class="empty-state"><div class="empty-icon">⚙️</div><p>Firebase not configured.</p></div>`;
    return;
  }

  const soundBtn = document.getElementById('soundToggle');
  if (soundBtn) soundBtn.addEventListener('click', () => {
    soundMuted = !soundMuted;
    setSoundPref(!soundMuted);
    updateSoundToggle();
  });

  if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('notifBanner')?.classList.remove('hidden');
  }

  document.getElementById('enableNotifBtn')?.addEventListener('click', () => {
    Notification.requestPermission().then(() => {
      document.getElementById('notifBanner')?.classList.add('hidden');
    });
  });
  document.getElementById('dismissNotifBtn')?.addEventListener('click', () => {
    document.getElementById('notifBanner')?.classList.add('hidden');
  });

  // Real-time listeners
  listenSlots(() => renderQueue());
  listenStudents(() => renderQueue());
  listenCurrent(newId => {
    if (myStudentId && newId !== prevCurrentId && newId === myStudentId) {
      triggerMyTurnAlert(_students.find(s => s.id === myStudentId));
    }
    prevCurrentId = newId;
    renderQueue();
  });
}

function updateSoundToggle() {
  const btn = document.getElementById('soundToggle');
  if (!btn) return;
  btn.textContent = soundMuted ? '🔇' : '🔊';
  btn.classList.toggle('muted', soundMuted);
}

function renderQueue() {
  // Now card
  const currentStudent = _students.find(s => s.id === _currentId);
  const nowNameEl   = document.getElementById('nowName');
  const nowSlotEl   = document.getElementById('nowSlot');
  const nowAvatarEl = document.getElementById('nowAvatar');
  const nowCard     = document.getElementById('nowCard');

  if (currentStudent) {
    const slot = getSlotById(currentStudent.slotId);
    nowNameEl.textContent   = currentStudent.name;
    nowSlotEl.textContent   = slot ? `⏰ ${slot.time}` : '';
    nowAvatarEl.textContent = getInitials(currentStudent.name);
    if (nowCard) nowCard.style.borderColor = 'rgba(245,197,24,0.5)';
  } else {
    nowNameEl.textContent   = 'No one currently';
    nowSlotEl.textContent   = '';
    nowAvatarEl.textContent = '—';
    if (nowCard) nowCard.style.borderColor = '';
  }

  // Next banner
  const waitingList   = _students.filter(s => s.status === 'waiting');
  const nextBanner    = document.getElementById('nextBanner');
  const nextBannerTxt = document.getElementById('nextBannerText');
  if (waitingList.length > 0 && currentStudent) {
    const nextUp = waitingList.sort((a,b) => new Date(a.registeredAt)-new Date(b.registeredAt))[0];
    if (nextBannerTxt) nextBannerTxt.textContent = `Up Next: ${nextUp.name} — ${getSlotById(nextUp.slotId)?.time || ''}`;
    nextBanner?.classList.remove('hidden');
  } else {
    nextBanner?.classList.add('hidden');
  }

  // Queue list
  const listEl = document.getElementById('queueList');
  if (!listEl) return;

  const sorted = [..._students].sort((a,b) => new Date(a.registeredAt)-new Date(b.registeredAt));

  if (sorted.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🕐</div><p>No students in the queue yet.</p></div>`;
    updateQueueStats();
    return;
  }

  listEl.innerHTML = '';
  sorted.forEach((student, idx) => {
    const slot  = getSlotById(student.slotId);
    const sl    = statusLabel(student.status);
    const isMe  = student.id === myStudentId;
    const isCur = student.id === _currentId;

    const item = document.createElement('div');
    item.className = `queue-item item-${student.status}`;
    if (isMe) item.style.cssText = 'border-color:rgba(245,197,24,0.6);background:rgba(245,197,24,0.06);';

    item.innerHTML = `
      <div class="item-rank">${idx + 1}</div>
      <div class="item-avatar">${getInitials(student.name)}</div>
      <div class="item-info">
        <div class="item-name">${escHtml(student.name)}${isMe ? ' <span style="color:var(--gold);font-size:.75rem;">← You</span>' : ''}</div>
        <div class="item-meta">${escHtml(student.universityId)}</div>
      </div>
      <div class="item-slot-badge">${slot ? slot.time : '—'}</div>
      <div class="item-status ${sl.cls}">${sl.text}</div>
    `;
    listEl.appendChild(item);
  });

  updateQueueStats();
}

function updateQueueStats() {
  const el = document.getElementById('queueStats');
  if (!el) return;
  const waiting = _students.filter(s => s.status === 'waiting').length;
  el.textContent = `${waiting} waiting • ${_students.length} total`;
}

function triggerMyTurnAlert(student) {
  playNotificationSound();
  playNotificationSound();

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🎤 It\'s Your Turn!', {
      body: `${student?.name || ''} — Please come in for your interview now!`,
      icon: 'logo.png',
      vibrate: [200, 100, 200],
    });
  }

  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed;inset:0;background:rgba(245,197,24,0.15);
    z-index:9999;pointer-events:none;
    animation:flashScreen 1.5s ease forwards;
  `;
  document.head.insertAdjacentHTML('beforeend',`
    <style>@keyframes flashScreen{0%,100%{opacity:0}30%,70%{opacity:1}}</style>`);
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1500);
}

// =========================================
// ADMIN PAGE
// =========================================
let adminFilter = 'all';

function initAdminPage() {
  initParticles();
  if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    if (!initFirebase()) { alert('Firebase not configured!'); return; }
    showAdminDashboard();
  }
  document.getElementById('adminPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });
}

function adminLogin() {
  const pw = document.getElementById('adminPassword').value;
  const errorEl = document.getElementById('loginError');
  if (pw === ADMIN_PASSWORD) {
    if (!initFirebase()) { if(errorEl) errorEl.textContent = '❌ Firebase not configured!'; return; }
    sessionStorage.setItem('adminLoggedIn', 'true');
    showAdminDashboard();
  } else {
    if (errorEl) {
      errorEl.textContent = '❌ Incorrect password!';
      setTimeout(() => { errorEl.textContent = ''; }, 3000);
    }
  }
}

function adminLogout() {
  sessionStorage.removeItem('adminLoggedIn');
  document.getElementById('adminDashboard').classList.add('hidden');
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('adminPassword').value = '';
}

function showAdminDashboard() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');

  generateQRCode();

  listenSlots(() => { renderAdminSlots(); });
  listenStudents(() => { renderStudentsTable(); updateAdminStats(); });
  listenCurrent(() => { renderStudentsTable(); });
}

// ─── Slots ────────────────────────────────────────────────────
function renderAdminSlots() {
  const container = document.getElementById('slotsAdminList');
  if (!container) return;
  container.innerHTML = '';

  if (_slots.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem;">No slots yet — add one above.</p>';
    return;
  }

  _slots.forEach(slot => {
    const count = countStudentsInSlot(slot.id);
    const chip = document.createElement('div');
    chip.className = 'slot-admin-chip';
    chip.innerHTML = `
      <span class="slot-admin-time">⏰ ${slot.time}</span>
      <span class="slot-admin-count">${count}/${slot.capacity} students</span>
      <button class="slot-delete-btn" onclick="deleteSlot('${slot.id}')" title="Delete slot">✕</button>
    `;
    container.appendChild(chip);
  });
}

function showSlotModal()  { document.getElementById('slotModal').classList.remove('hidden'); }
function closeSlotModal() {
  document.getElementById('slotModal').classList.add('hidden');
  document.getElementById('newSlotTime').value = '';
  document.getElementById('newSlotCapacity').value = '5';
}

async function addSlot() {
  const time = document.getElementById('newSlotTime').value;
  const cap  = parseInt(document.getElementById('newSlotCapacity').value) || 5;
  if (!time) { alert('Please select a time first.'); return; }
  if (_slots.find(s => s.time === time)) { alert('This time slot already exists.'); return; }

  const newSlots = [..._slots, { id: 's' + uid(), time, capacity: cap }];
  newSlots.sort((a,b) => a.time.localeCompare(b.time));
  await saveSlots(newSlots);
  closeSlotModal();
}

async function deleteSlot(slotId) {
  if (!confirm('Delete this time slot?')) return;
  const newSlots = _slots.filter(s => s.id !== slotId);
  await saveSlots(newSlots);
}

// ─── QR ───────────────────────────────────────────────────────
const OFFICIAL_REGISTER_URL = 'https://abdullahhassan-dev99.github.io/roben-club/index.html';

function getRegisterUrl() {
  return OFFICIAL_REGISTER_URL;
}

function generateQRCode() {
  const qrBox   = document.getElementById('qrcode');
  const qrUrlEl = document.getElementById('qrUrl');
  if (!qrBox) return;

  const url = OFFICIAL_REGISTER_URL;
  if (qrUrlEl) {
    qrUrlEl.innerHTML = `<a href="${url}" target="_blank" style="color:var(--primary);text-decoration:underline;word-break:break-all;">${url}</a>`;
  }

  qrBox.innerHTML = '';
  try {
    new QRCode(qrBox, {
      text: url, width: 200, height: 200,
      colorDark: '#0d1b2a', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch(e) {
    qrBox.innerHTML = `<p style="color:var(--danger);font-size:.8rem;">QR Error</p>`;
  }
}

function regenerateQR() { generateQRCode(); }

function copyRegisterLink() {
  const url = getRegisterUrl();
  navigator.clipboard.writeText(url).then(() => {
    alert('✅ Link copied!\n\n' + url);
  }).catch(() => { prompt('Copy this link:', url); });
}

// ─── Stats ────────────────────────────────────────────────────
function updateAdminStats() {
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set('statTotal',   _students.length);
  set('statWaiting', _students.filter(s => s.status==='waiting').length);
  set('statDone',    _students.filter(s => s.status==='done').length);
  set('statAbsent',  _students.filter(s => s.status==='absent').length);
}

// ─── Filter ───────────────────────────────────────────────────
function filterStudents(btn, filter) {
  adminFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStudentsTable();
}

// ─── Students Table ───────────────────────────────────────────
function renderStudentsTable() {
  const body = document.getElementById('studentsBody');
  if (!body) return;

  let filtered = _students;
  if (adminFilter === 'interviewing') {
    filtered = _students.filter(s => s.id === _currentId);
  } else if (adminFilter !== 'all') {
    filtered = _students.filter(s => s.status === adminFilter);
  }

  const sorted = [...filtered].sort((a,b) => new Date(a.registeredAt)-new Date(b.registeredAt));

  if (sorted.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-secondary);">No data found.</td></tr>`;
    return;
  }

  body.innerHTML = '';
  sorted.forEach((student, idx) => {
    const slot    = getSlotById(student.slotId);
    const sl      = statusLabel(student.status);
    const isCurrent = student.id === _currentId;

    const tr = document.createElement('tr');
    if (isCurrent) tr.style.background = 'rgba(245,197,24,0.06)';

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escHtml(student.name)}</strong></td>
      <td>${escHtml(student.universityId)}</td>
      <td dir="ltr">${escHtml(student.phone)}</td>
      <td>${slot ? slot.time : '—'}</td>
      <td><span class="item-status ${sl.cls}">${sl.text}</span></td>
      <td class="actions-cell">${buildActionButtons(student, isCurrent)}</td>
    `;
    body.appendChild(tr);
  });
}

function buildActionButtons(student, isCurrent) {
  const btns = [];
  if (student.status === 'waiting' && !isCurrent)
    btns.push(`<button class="action-btn btn-call" onclick="callStudent('${student.id}')">📣 Call</button>`);
  if (isCurrent) {
    btns.push(`<button class="action-btn btn-done"   onclick="markDone('${student.id}')">✅ Done</button>`);
    btns.push(`<button class="action-btn btn-absent" onclick="markAbsent('${student.id}')">❌ Absent</button>`);
  }
  if (student.status === 'done' || student.status === 'absent')
    btns.push(`<button class="action-btn btn-reset" onclick="resetStudent('${student.id}')">🔄 Reset</button>`);
  btns.push(`<button class="action-btn btn-remove" onclick="removeStudent('${student.id}')">🗑️</button>`);
  return btns.join('');
}

// ─── Student actions ──────────────────────────────────────────
async function callStudent(id) {
  const student = _students.find(s => s.id === id);
  if (!student) return;
  await updateStudent({ ...student, status: 'interviewing' });
  await setCurrentId(id);
  playNotificationSound();
}

async function markDone(id) {
  const student = _students.find(s => s.id === id);
  if (!student) return;
  await updateStudent({ ...student, status: 'done' });
  await setCurrentId(null);
}

async function markAbsent(id) {
  const student = _students.find(s => s.id === id);
  if (!student) return;
  await updateStudent({ ...student, status: 'absent' });
  await setCurrentId(null);
}

async function resetStudent(id) {
  const student = _students.find(s => s.id === id);
  if (!student) return;
  await updateStudent({ ...student, status: 'waiting' });
}

async function removeStudent(id) {
  if (!confirm('Remove this student from the queue?')) return;
  if (_currentId === id) await setCurrentId(null);
  await deleteStudent(id);
}

async function clearAll() {
  if (!confirm('Clear ALL students from the queue? This cannot be undone!')) return;
  await db.ref(PATHS.STUDENTS).remove();
  await setCurrentId(null);
}
