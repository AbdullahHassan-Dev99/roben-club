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
  CALL:     'roben/call',
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

function listenCallAlert(callback) {
  if (!db) return;
  db.ref(PATHS.CALL).on('value', snap => {
    const val = snap.val();
    if (val) callback(val);
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

// ─── Shared Audio System & Sound Playback ─────────────────────
let _ringInterval = null;
let _sharedAudioCtx = null;
let _lastHandledCallNonce = null;

function getAudioContext() {
  if (!_sharedAudioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      _sharedAudioCtx = new AudioCtxClass();
    }
  }
  return _sharedAudioCtx;
}

function getMyStudentId() {
  return localStorage.getItem('myStudentId') || sessionStorage.getItem('myStudentId');
}

function getAlarmAudioElement() {
  let el = document.getElementById('alarmAudio');
  if (!el) {
    el = document.createElement('audio');
    el.id = 'alarmAudio';
    el.preload = 'auto';
    el.loop = true;
    el.setAttribute('playsinline', '');
    document.body.appendChild(el);
  }
  if (!el.src || el.src === window.location.href || el.src === '') {
    if (typeof ALARM_SOUND_B64 !== 'undefined' && ALARM_SOUND_B64) {
      el.src = ALARM_SOUND_B64;
    } else {
      el.src = 'alarm.wav';
    }
  }
  return el;
}

function playPhoneRingtone() {
  stopRingSound();

  // 1. Play HTML5 Audio element (most reliable for mobile devices and background audio)
  try {
    const audioEl = getAlarmAudioElement();
    if (audioEl) {
      audioEl.currentTime = 0;
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('HTML5 audio play blocked/prevented:', e);
        });
      }
    }
  } catch(e) {
    console.warn('HTML5 audio error:', e);
  }

  // 2. Play Web Audio API synthesized tone as concurrent second audio channel
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const alarmBurst = () => {
        try {
          const curCtx = getAudioContext();
          if (!curCtx) return;
          if (curCtx.state === 'suspended') curCtx.resume().catch(() => {});
          const now = curCtx.currentTime;

          // 4 rapid digital beeps
          const beeps = [0, 0.12, 0.24, 0.36];
          beeps.forEach(offset => {
            const t = now + offset;
            const osc = curCtx.createOscillator();
            const osc2 = curCtx.createOscillator();
            const filter = curCtx.createBiquadFilter();
            const gain = curCtx.createGain();

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2600, t);

            osc.type = 'square';
            osc.frequency.setValueAtTime(940, t);

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1880, t);

            osc.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(curCtx.destination);

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.45, t + 0.015);
            gain.gain.setValueAtTime(0.45, t + 0.065);
            gain.gain.linearRampToValueAtTime(0, t + 0.08);

            osc.start(t);
            osc2.start(t);
            osc.stop(t + 0.085);
            osc2.stop(t + 0.085);
          });
        } catch(err) {
          console.warn('Alarm audio burst error:', err);
        }
      };

      alarmBurst();
      _ringInterval = setInterval(alarmBurst, 1100);
    }
  } catch(e) {
    console.warn('Web Audio error:', e);
  }

  // 3. Vibration pattern
  if ('vibrate' in navigator) {
    try { navigator.vibrate([100, 50, 100, 50, 100, 50, 100, 500]); } catch(e) {}
  }

  setTimeout(() => { stopRingSound(); }, 40000);
}

function stopRingSound() {
  if (_ringInterval) {
    clearInterval(_ringInterval);
    _ringInterval = null;
  }
  try {
    const audioEl = document.getElementById('alarmAudio');
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }
  } catch(e) {}
  if ('vibrate' in navigator) {
    try { navigator.vibrate(0); } catch(e) {}
  }
  document.getElementById('callRingModal')?.classList.add('hidden');
}

function testAlarmSound() {
  unlockAudioOnInteraction();
  playPhoneRingtone();
  setTimeout(() => {
    stopRingSound();
  }, 3800); // Play 3 alarm cycles for preview
}

function handleIncomingCall(call) {
  if (!call || !call.studentId) return;
  const myId = getMyStudentId();
  if (myId !== call.studentId) return;

  // Don't trigger if this exact call nonce was already processed
  if (call.nonce && call.nonce === _lastHandledCallNonce) return;
  // Ignore calls older than 3 minutes
  if (call.timestamp && Date.now() - call.timestamp > 180000) return;
  _lastHandledCallNonce = call.nonce;

  // Show alert modal on student's screen
  const modal = document.getElementById('callRingModal');
  const desc = document.getElementById('callModalDesc');
  if (desc) {
    const studentName = call.studentName || localStorage.getItem('myStudentName') || 'Candidate';
    desc.textContent = `${studentName} — The interview committee is calling you now. Please proceed to the interview room!`;
  }
  if (modal) {
    modal.classList.remove('hidden');
  }

  // Play audio alert
  playPhoneRingtone();

  // Send system push notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🚨 Notice: Your Turn for Interview!', {
      body: `${call.studentName || ''} — Please proceed to the interview room now!`,
      icon: 'logo.png',
      requireInteraction: true,
      vibrate: [1000, 500, 1000, 500, 1000]
    });
  }
}

// Unlock audio on mobile interaction
function unlockAudioOnInteraction() {
  const unlock = () => {
    try {
      const audioEl = getAlarmAudioElement();
      if (audioEl) {
        audioEl.play().then(() => {
          audioEl.pause();
          audioEl.currentTime = 0;
        }).catch(() => {});
      }
    } catch(e) {}

    try {
      const ctx = getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch(e) {}
  };
  ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'].forEach(evt => {
    document.addEventListener(evt, unlock, { passive: true });
  });
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
  unlockAudioOnInteraction();

  if (!initFirebase()) {
    showFirebaseError();
    return;
  }

  // Load slots then render
  listenSlots(() => renderSlots());
  listenStudents(() => {
    updateIndexAheadCard();
    checkAlreadyRegistered();
  });
  listenCurrent(() => updateIndexAheadCard());
  listenCallAlert(handleIncomingCall);

  const form = document.getElementById('registerForm');
  if (form) form.addEventListener('submit', handleRegisterSubmit);

  const uIdInput = document.getElementById('universityId');
  if (uIdInput) {
    uIdInput.addEventListener('input', () => {
      const val = uIdInput.value.trim();
      if (val.length >= 4) {
        const found = _students.find(s => s.universityId === val);
        if (found) {
          const nameInput = document.getElementById('studentName');
          const phoneInput = document.getElementById('phoneNumber');
          if (nameInput && !nameInput.value) nameInput.value = found.name;
          if (phoneInput && !phoneInput.value) phoneInput.value = found.phone;

          const banner = document.getElementById('alreadyRegisteredBanner');
          const textEl = document.getElementById('alreadyRegisteredText');
          if (banner && textEl) {
            banner.classList.remove('hidden');
            const slot = getSlotById(found.slotId);
            const slotTime = slot ? ` (previous slot: ${slot.time})` : '';
            if (found.status === 'absent' || found.status === 'done') {
              textEl.innerHTML = `👋 Welcome back, <strong>${escHtml(found.name)}</strong>! Previous status: <strong>${statusLabel(found.status).text}</strong>.<br>✨ You can pick a new available time slot below to re-enter the queue!`;
            } else {
              textEl.innerHTML = `👋 Welcome, <strong>${escHtml(found.name)}</strong>! You are already registered${slotTime}. You can pick a new slot to change your time or click to view your position.`;
            }
          }
        }
      }
    });
  }
}

function checkAlreadyRegistered() {
  const myId = getMyStudentId();
  if (!myId) return;
  const existing = _students.find(s => s.id === myId);
  const banner = document.getElementById('alreadyRegisteredBanner');
  const textEl = document.getElementById('alreadyRegisteredText');
  if (!banner || !existing) return;

  const slot = getSlotById(existing.slotId);
  banner.classList.remove('hidden');
  const slotTime = slot ? ` (slot: ${slot.time})` : '';
  if (existing.status === 'absent' || existing.status === 'done') {
    textEl.innerHTML = `👋 Welcome back, <strong>${escHtml(existing.name)}</strong>! Your previous session ended (Status: <strong>${statusLabel(existing.status).text}</strong>).<br>✨ You can pick a new time slot below to re-enter the queue!`;
  } else {
    textEl.innerHTML = `👋 Welcome back, <strong>${escHtml(existing.name)}</strong>! You are already registered${slotTime}. Current status: <strong>${statusLabel(existing.status).text}</strong>.`;
  }

  // Pre-fill inputs for convenience
  const nameInput = document.getElementById('studentName');
  const idInput = document.getElementById('universityId');
  const phoneInput = document.getElementById('phoneNumber');
  if (nameInput && !nameInput.value) nameInput.value = existing.name;
  if (idInput && !idInput.value) idInput.value = existing.universityId;
  if (phoneInput && !phoneInput.value) phoneInput.value = existing.phone;
}

function resetFormForNewSlot() {
  document.getElementById('alreadyRegisteredBanner')?.classList.add('hidden');
  document.getElementById('registerForm')?.scrollIntoView({ behavior: 'smooth' });
}

function updateIndexAheadCard() {
  const myId = getMyStudentId();
  if (!myId) return;
  const myStudent = _students.find(s => s.id === myId);
  if (!myStudent) return;
  const countEl = document.getElementById('indexAheadCount');
  const titleEl = document.getElementById('indexAheadTitle');
  if (!countEl || !titleEl) return;

  if (myStudent.status === 'interviewing') {
    countEl.textContent = '0';
    titleEl.textContent = '🚨 It\'s Your Turn! Please proceed to the interview room.';
  } else if (myStudent.status === 'waiting') {
    const waitingList = _students
      .filter(s => s.status === 'waiting')
      .sort((a,b) => new Date(a.registeredAt) - new Date(b.registeredAt));
    const myIndex = waitingList.findIndex(s => s.id === myId);
    const ahead = myIndex >= 0 ? myIndex : 0;
    countEl.textContent = ahead;
    titleEl.textContent = ahead === 0 ? 'You are next in line! Please be ready.' : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`;
  } else if (myStudent.status === 'done') {
    countEl.textContent = '✓';
    titleEl.textContent = 'Interview completed successfully!';
  } else if (myStudent.status === 'absent') {
    countEl.textContent = '!';
    titleEl.textContent = 'Marked absent / expired — You can book a new slot below';
  }
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

  const uId = document.getElementById('universityId').value.trim();
  const existing = _students.find(s => s.universityId === uId);

  // If already registered: allow re-registration or slot change!
  if (existing) {
    if (existing.status === 'absent' || existing.status === 'done') {
      const confirmReRegister = confirm(`Welcome back, ${existing.name}!\n\nYour previous interview slot ended or was marked absent.\nWould you like to book the new slot and re-enter the queue?`);
      if (confirmReRegister) {
        existing.slotId = selectedSlotId;
        existing.status = 'waiting';
        existing.registeredAt = new Date().toISOString();
        existing.callCount = 0;
        existing.phone = document.getElementById('phoneNumber').value.trim() || existing.phone;
        existing.name = document.getElementById('studentName').value.trim() || existing.name;
        await updateStudent(existing);
        localStorage.setItem('myStudentId', existing.id);
        localStorage.setItem('myStudentName', existing.name);
        sessionStorage.setItem('myStudentId', existing.id);
        showSuccessCard(existing);
        updateIndexAheadCard();
        alert('✅ Your new time slot has been booked and you have re-entered the queue!');
        return;
      } else {
        if (btn) btn.disabled = false;
        return;
      }
    } else {
      // Student is currently waiting or interviewing
      const confirmChangeSlot = confirm(`Welcome back, ${existing.name}!\n\nYou are already registered in the queue.\n- Click OK to update your registration to the new time slot.\n- Click Cancel to view your current position.`);
      if (confirmChangeSlot) {
        existing.slotId = selectedSlotId;
        existing.phone = document.getElementById('phoneNumber').value.trim() || existing.phone;
        existing.name = document.getElementById('studentName').value.trim() || existing.name;
        await updateStudent(existing);
        localStorage.setItem('myStudentId', existing.id);
        localStorage.setItem('myStudentName', existing.name);
        sessionStorage.setItem('myStudentId', existing.id);
        showSuccessCard(existing);
        updateIndexAheadCard();
        alert('✅ Your interview slot has been updated successfully!');
        return;
      } else {
        localStorage.setItem('myStudentId', existing.id);
        localStorage.setItem('myStudentName', existing.name);
        window.location.href = 'queue.html';
        return;
      }
    }
  }

  const student = {
    id:           uid(),
    name:         document.getElementById('studentName').value.trim(),
    universityId: uId,
    phone:        document.getElementById('phoneNumber').value.trim(),
    slotId:       selectedSlotId,
    status:       'waiting',
    registeredAt: new Date().toISOString(),
    callCount:    0,
  };

  try {
    await addStudent(student);
    localStorage.setItem('myStudentId', student.id);
    localStorage.setItem('myStudentName', student.name);
    sessionStorage.setItem('myStudentId', student.id);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    showSuccessCard(student);
    updateIndexAheadCard();
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
  unlockAudioOnInteraction();
  myStudentId = getMyStudentId();
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

  const recoverInput = document.getElementById('recoverIdInput');
  if (recoverInput) {
    recoverInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        recoverMyQueue();
      }
    });
  }

  // Real-time listeners
  listenSlots(() => renderQueue());
  listenStudents(() => renderQueue());
  listenCurrent(newId => {
    prevCurrentId = newId;
    renderQueue();
  });
  listenCallAlert(handleIncomingCall);
}

function recoverMyQueue() {
  const input = document.getElementById('recoverIdInput');
  const raw = input ? input.value.trim() : '';
  if (!raw) {
    alert('Please enter your University ID or Phone number.');
    return;
  }
  const found = _students.find(s => 
    s.universityId === raw || 
    s.phone === raw || 
    s.universityId.toLowerCase() === raw.toLowerCase()
  );
  if (found) {
    localStorage.setItem('myStudentId', found.id);
    localStorage.setItem('myStudentName', found.name);
    sessionStorage.setItem('myStudentId', found.id);
    myStudentId = found.id;
    unlockAudioOnInteraction();
    renderQueue();
    alert(`✅ Welcome back, ${found.name}!\nYour queue position has been recovered.`);
    document.getElementById('myStatusSection')?.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert('❌ No registration found with this ID.\nPlease verify your University ID or click "New Registration" to register.');
  }
}

function updateSoundToggle() {
  const btn = document.getElementById('soundToggle');
  if (!btn) return;
  btn.textContent = soundMuted ? '🔇' : '🔊';
  btn.classList.toggle('muted', soundMuted);
}

function renderQueue() {
  const myId = getMyStudentId();
  const myStudent = _students.find(s => s.id === myId);

  // 1. Personalized Student Box (#myStatusSection)
  const myStatusSection = document.getElementById('myStatusSection');
  if (myStatusSection) {
    if (myStudent) {
      myStatusSection.classList.remove('hidden');
      const nameEl  = document.getElementById('myStatusName');
      const tagEl   = document.getElementById('myStatusTag');
      const countEl = document.getElementById('aheadCount');
      const titleEl = document.getElementById('aheadTitle');
      const subEl   = document.getElementById('aheadSub');
      const boxEl   = document.getElementById('myStatusBox');

      if (nameEl) nameEl.textContent = `Welcome, ${myStudent.name}`;

      if (myStudent.status === 'interviewing') {
        if (tagEl) tagEl.textContent = '🎤 Your Turn Now!';
        if (countEl) countEl.textContent = '0';
        if (titleEl) titleEl.textContent = '🚨 It\'s Your Turn Now!';
        if (subEl) subEl.textContent = 'Please proceed to the interview room immediately.';
        if (boxEl) boxEl.className = 'my-status-box my-turn-now-box';
      } else if (myStudent.status === 'waiting') {
        // Calculate how many waiting students are before me
        const waitingList = _students
          .filter(s => s.status === 'waiting')
          .sort((a,b) => new Date(a.registeredAt) - new Date(b.registeredAt));
        
        const myIndex = waitingList.findIndex(s => s.id === myId);
        const aheadCount = myIndex >= 0 ? myIndex : 0;

        if (tagEl) tagEl.textContent = '⏳ In Waiting Queue';
        if (countEl) countEl.textContent = aheadCount;
        if (titleEl) {
          titleEl.textContent = aheadCount === 0 
            ? 'You are next in line! Please be ready.' 
            : `${aheadCount} ${aheadCount === 1 ? 'person' : 'people'} ahead of you in the queue`;
        }
        if (subEl) subEl.textContent = 'Please stay nearby and keep this page open.';
        if (boxEl) boxEl.className = 'my-status-box';
      } else if (myStudent.status === 'done') {
        if (tagEl) tagEl.textContent = '✅ Interview Done';
        if (countEl) countEl.textContent = '✓';
        if (titleEl) titleEl.textContent = 'Your interview has been completed!';
        if (subEl) subEl.textContent = 'Best of luck in RobEn Club!';
        if (boxEl) boxEl.className = 'my-status-box';
      } else if (myStudent.status === 'absent') {
        if (tagEl) tagEl.textContent = '❌ Absent / Expired';
        if (countEl) countEl.textContent = '!';
        if (titleEl) titleEl.textContent = 'Your interview time slot has passed or was marked absent';
        if (subEl) subEl.innerHTML = `You can select a new available slot and re-enter the queue:<br><a href="index.html" class="btn btn-sm btn-primary" style="margin-top:10px;display:inline-block;">🔄 Choose a New Slot</a>`;
        if (boxEl) boxEl.className = 'my-status-box';
      }
      document.getElementById('guestBanner')?.classList.add('hidden');
    } else {
      myStatusSection.classList.add('hidden');
      document.getElementById('guestBanner')?.classList.remove('hidden');
    }
  }

  // 2. Currently being interviewed card
  const currentStudent = _students.find(s => s.id === _currentId);
  const nowNameEl   = document.getElementById('nowName');
  const nowSlotEl   = document.getElementById('nowSlot');
  const nowAvatarEl = document.getElementById('nowAvatar');
  const nowCard     = document.getElementById('nowCard');

  if (currentStudent) {
    const isMe = currentStudent.id === myId;
    const slot = getSlotById(currentStudent.slotId);
    nowNameEl.textContent   = isMe ? `${currentStudent.name} (👉 You)` : 'Candidate currently in interview 🎤';
    nowSlotEl.textContent   = slot ? `⏰ ${slot.time}` : '';
    nowAvatarEl.textContent = isMe ? getInitials(currentStudent.name) : '🎤';
    if (nowCard) nowCard.style.borderColor = 'rgba(245,197,24,0.5)';
  } else {
    nowNameEl.textContent   = 'No one currently';
    nowSlotEl.textContent   = '';
    nowAvatarEl.textContent = '—';
    if (nowCard) nowCard.style.borderColor = '';
  }

  // 3. Next banner (Private)
  const waitingList   = _students.filter(s => s.status === 'waiting');
  const nextBanner    = document.getElementById('nextBanner');
  const nextBannerTxt = document.getElementById('nextBannerText');
  if (waitingList.length > 0 && currentStudent) {
    const nextUp = waitingList.sort((a,b) => new Date(a.registeredAt)-new Date(b.registeredAt))[0];
    if (nextBannerTxt) {
      if (nextUp.id === myId) {
        nextBannerTxt.textContent = `🔔 You are next up! Please get ready for your interview.`;
      } else {
        nextBannerTxt.textContent = `🔔 The next candidate is being called...`;
      }
    }
    nextBanner?.classList.remove('hidden');
  } else {
    nextBanner?.classList.add('hidden');
  }

  // 4. Queue list with 100% PRIVACY (No other student names exposed!)
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
    const isMe  = student.id === myId;

    const item = document.createElement('div');
    item.className = `queue-item item-${student.status}`;
    if (isMe) {
      item.style.cssText = 'border-color:rgba(245,197,24,0.7);background:rgba(245,197,24,0.08);box-shadow:0 0 15px rgba(245,197,24,0.15);';
    }

    // Privacy Protection: Obfuscate everyone else's name!
    const displayName = isMe
      ? `${escHtml(student.name)} <span style="color:var(--gold);font-weight:800;font-size:.85rem;">(👉 You)</span>`
      : (student.status === 'interviewing' ? 'Candidate currently in interview 🎤' : `Candidate #${idx + 1}`);

    const displayAvatar = isMe ? getInitials(student.name) : `#${idx + 1}`;

    item.innerHTML = `
      <div class="item-rank">${idx + 1}</div>
      <div class="item-avatar" style="${isMe ? 'background:linear-gradient(135deg,var(--gold),#f39c12);color:var(--navy);' : ''}">${displayAvatar}</div>
      <div class="item-info">
        <div class="item-name">${displayName}</div>
        <div class="item-meta">${slot ? ('⏰ ' + slot.time) : ''}</div>
      </div>
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
    qrUrlEl.innerHTML = `<a href="${url}" target="_blank" style="color:var(--primary);text-decoration:underline;word-break:break-all;font-size:0.95rem;font-weight:600;">${url}</a>`;
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
  if (student.status === 'waiting' && !isCurrent) {
    btns.push(`<button class="action-btn btn-call" onclick="callStudent('${student.id}')">📣 Call</button>`);
  }
  if (isCurrent) {
    const ringTimes = student.callCount || 1;
    btns.push(`<button class="action-btn btn-ring-again" onclick="callStudent('${student.id}')" title="Call candidate again">📣 Call Again (${ringTimes})</button>`);
    btns.push(`<button class="action-btn btn-done"   onclick="markDone('${student.id}')">✅ Done</button>`);
    btns.push(`<button class="action-btn btn-absent" onclick="markAbsent('${student.id}')">❌ Absent</button>`);
  }
  if (student.status === 'done' || student.status === 'absent') {
    btns.push(`<button class="action-btn btn-reset" onclick="resetStudent('${student.id}')">🔄 Reset</button>`);
  }
  btns.push(`<button class="action-btn btn-remove" onclick="removeStudent('${student.id}')">🗑️</button>`);
  return btns.join('');
}

// ─── Student actions ──────────────────────────────────────────
async function callStudent(id) {
  const student = _students.find(s => s.id === id);
  if (!student) return;

  const currentCount = student.callCount || 0;
  const updatedStudent = {
    ...student,
    status: 'interviewing',
    callCount: currentCount + 1,
    lastCalledAt: Date.now()
  };

  await updateStudent(updatedStudent);
  await setCurrentId(id);

  // Send Call signal to Firebase with unique nonce to trigger incoming call alert every time
  await db.ref(PATHS.CALL).set({
    studentId: id,
    studentName: student.name,
    timestamp: Date.now(),
    callCount: currentCount + 1,
    nonce: Math.random().toString(36).slice(2)
  });

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
