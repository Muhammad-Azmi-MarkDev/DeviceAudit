/**
 * Device Audit - Core Diagnostic Engine (7 Modules + Detailed History Archive)
 */

const STORAGE_HISTORY_KEY = 'da_audit_history_v2';

// State Sesi Audit Saat Ini
let auditState = {
  activeModule: 'display',
  isViewingArchive: false,
  activeReportSnapshot: null, // Menyimpan data laporan yg sedang ditampilkan (aktif atau arsip)
  results: {
    display: { status: 'untested', note: '' },
    keyboard: { status: 'untested', note: '' },
    pointer: { status: 'untested', note: '' },
    audio: { status: 'untested', note: '' },
    camera: { status: 'untested', note: '' },
    system: { status: 'untested', note: '' },
    physical: { status: 'untested', note: '' }
  },
  systemSpecs: { os: '-', cpu: '-', ram: '-', screen: '-', battery: '-' },
  physicalItems: [
    { id: 'phy-1', label: 'Engsel Layar (Kokoh / Tidak Goyang)', status: 'normal' },
    { id: 'phy-2', label: 'Casing & Kelengkapan Baut Bawah', status: 'normal' },
    { id: 'phy-3', label: 'Port USB, HDMI, & Audio Jack', status: 'normal' },
    { id: 'phy-4', label: 'Touchpad Fisik & Klik Kiri/Kanan', status: 'normal' },
    { id: 'phy-5', label: 'Port Charging & Kondisi Adaptor', status: 'normal' }
  ]
};

const MODUL_KEYS = ['display', 'keyboard', 'pointer', 'audio', 'camera', 'system', 'physical'];

// ==========================================
// 1. INISIALISASI & NAVIGASI UTAMA
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  updateNavbarAuth();
  renderKeyboardLayout();
  renderPhysicalChecklist();
  initPointerTester();
  muatDataSistem();
  updateProgressUI();
  updateHistoryBadge();
  gantiTampilanUtama('home'); // Mulai dari Menu Utama agar pengguna tidak kaget
});

function updateNavbarAuth() {
  const user = getActiveUser();
  const menuTamu = document.getElementById('menu-tamu');
  const menuUser = document.getElementById('menu-user');

  if (user) {
    menuTamu.classList.add('hidden');
    menuUser.classList.remove('hidden');
    document.getElementById('user-nama').innerText = user.nama;
    document.getElementById('user-email').innerText = user.email;
    document.getElementById('user-avatar').innerText = user.nama.charAt(0).toUpperCase();
  } else {
    menuTamu.classList.remove('hidden');
    menuUser.classList.add('hidden');
  }
}

function setLabelCepat(teks) {
  document.getElementById('home-audit-label').value = teks;
}

function mulaiAuditDariHome(targetModul) {
  // Sinkronkan input dari Menu Utama ke Workspace
  const devName = document.getElementById('home-device-name').value.trim();
  const devLabel = document.getElementById('home-audit-label').value.trim();
  if (devName) document.getElementById('input-device-name').value = devName;
  if (devLabel) document.getElementById('input-audit-label').value = devLabel;

  auditState.isViewingArchive = false;
  gantiTampilanUtama('workspace');
  bukaModul(targetModul || 'display');
}

function gantiTampilanUtama(view) {
  stopActiveHardwareStreams();
  document.getElementById('view-home').classList.add('hidden');
  document.getElementById('view-workspace').classList.add('hidden');
  document.getElementById('view-history').classList.add('hidden');

  const btnHome = document.getElementById('nav-btn-home');
  const btnWs = document.getElementById('nav-btn-workspace');
  const btnHs = document.getElementById('nav-btn-history');
  const idleCls = "px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5";
  const activeCls = "px-3 py-1.5 rounded-md bg-white text-slate-900 shadow-sm transition flex items-center gap-1.5";

  btnHome.className = idleCls;
  btnWs.className = idleCls;
  btnHs.className = idleCls;

  if (view === 'home') {
    document.getElementById('view-home').classList.remove('hidden');
    btnHome.className = activeCls;
  } else if (view === 'workspace') {
    // Kembalikan sidebar & topbar workspace jika sebelumnya dari mode Arsip
    document.getElementById('workspace-top-bar').classList.remove('hidden');
    document.getElementById('workspace-sidebar').classList.remove('hidden');
    auditState.isViewingArchive = false;
    document.getElementById('view-workspace').classList.remove('hidden');
    btnWs.className = activeCls;
    if (!auditState.activeModule) bukaModul('display');
  } else if (view === 'history') {
    document.getElementById('view-history').classList.remove('hidden');
    btnHs.className = activeCls;
    renderRiwayatAudit();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 2. NAVIGASI MODUL & PENILAIAN STATUS
// ==========================================
function bukaModul(modul) {
  stopActiveHardwareStreams();
  auditState.activeModule = modul;

  document.querySelectorAll('.module-panel').forEach(el => el.classList.add('hidden'));
  document.getElementById(`panel-${modul}`).classList.remove('hidden');

  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.classList.remove('bg-slate-900', 'text-white');
    if (btn.id !== 'step-report') btn.classList.add('text-slate-700', 'hover:bg-slate-100');
  });

  const activeBtn = document.getElementById(`step-${modul}`);
  if (modul !== 'report' && activeBtn) {
    activeBtn.classList.remove('text-slate-700', 'hover:bg-slate-100');
    activeBtn.classList.add('bg-slate-900', 'text-white');
  }

  if (modul === 'pointer') resizePointerCanvas();
  if (modul === 'system') muatDataSistem();
  if (modul === 'report') renderLaporanAktif();
}

function tetapkanStatus(modul, status, nextModul) {
  const noteInput = document.getElementById(`note-${modul}`);
  auditState.results[modul] = {
    status: status,
    note: noteInput ? noteInput.value.trim() : ''
  };
  updateProgressUI();
  if (nextModul) bukaModul(nextModul);
}

function updateProgressUI() {
  let selesai = 0;
  MODUL_KEYS.forEach(m => {
    const st = auditState.results[m].status;
    const badge = document.getElementById(`badge-${m}`);
    if (!badge) return;
    badge.className = 'w-2.5 h-2.5 rounded-full ';
    if (st === 'pass') {
      badge.className += 'bg-emerald-500';
      selesai++;
    } else if (st === 'fail') {
      badge.className += 'bg-rose-500';
      selesai++;
    } else {
      badge.className += 'bg-slate-300';
    }
  });

  document.getElementById('progress-text').innerText = `${selesai} / 7 Modul`;
  document.getElementById('progress-bar').style.width = `${(selesai / 7) * 100}%`;
}

// ==========================================
// 3. MODUL 1: UJI LAYAR & DEAD PIXEL
// ==========================================
const DISPLAY_COLORS = [
  { name: 'HITAM (Backlight Bleed)', bg: '#000000' },
  { name: 'PUTIH (White Spot)', bg: '#FFFFFF' },
  { name: 'MERAH (Sub-Piksel)', bg: '#DC2626' },
  { name: 'HIJAU (Sub-Piksel)', bg: '#16A34A' },
  { name: 'BIRU (Sub-Piksel)', bg: '#2563EB' },
  { name: 'ABU-ABU (Keseragaman)', bg: '#737373' }
];
let currentColorIdx = 0;

function mulaiUjiLayar(startIndex = 0) {
  currentColorIdx = startIndex;
  const overlay = document.getElementById('fullscreen-display-overlay');
  overlay.classList.remove('hidden');
  terapkanWarnaOverlay();
  if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
}

function terapkanWarnaOverlay() {
  const overlay = document.getElementById('fullscreen-display-overlay');
  const item = DISPLAY_COLORS[currentColorIdx];
  overlay.style.backgroundColor = item.bg;
  document.getElementById('overlay-color-name').innerText = item.name;
}

function gantiWarnaLayar() {
  currentColorIdx = (currentColorIdx + 1) % DISPLAY_COLORS.length;
  terapkanWarnaOverlay();
}

function tutupUjiLayar() {
  document.getElementById('fullscreen-display-overlay').classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.getElementById('fullscreen-display-overlay').classList.add('hidden');
});

// ==========================================
// 4. MODUL 2: MATRIKS KEYBOARD
// ==========================================
const KEYBOARD_ROWS = [
  [
    { c: 'Escape', l: 'ESC', w: 'w-11' }, { c: 'F1', l: 'F1' }, { c: 'F2', l: 'F2' }, { c: 'F3', l: 'F3' },
    { c: 'F4', l: 'F4' }, { c: 'F5', l: 'F5' }, { c: 'F6', l: 'F6' }, { c: 'F7', l: 'F7' },
    { c: 'F8', l: 'F8' }, { c: 'F9', l: 'F9' }, { c: 'F10', l: 'F10' }, { c: 'F11', l: 'F11' },
    { c: 'F12', l: 'F12' }, { c: 'Delete', l: 'DEL', w: 'w-12' }
  ],
  [
    { c: 'Backquote', l: '`' }, { c: 'Digit1', l: '1' }, { c: 'Digit2', l: '2' }, { c: 'Digit3', l: '3' },
    { c: 'Digit4', l: '4' }, { c: 'Digit5', l: '5' }, { c: 'Digit6', l: '6' }, { c: 'Digit7', l: '7' },
    { c: 'Digit8', l: '8' }, { c: 'Digit9', l: '9' }, { c: 'Digit0', l: '0' }, { c: 'Minus', l: '-' },
    { c: 'Equal', l: '=' }, { c: 'Backspace', l: 'BKSP', w: 'flex-1' }
  ],
  [
    { c: 'Tab', l: 'TAB', w: 'w-14' }, { c: 'KeyQ', l: 'Q' }, { c: 'KeyW', l: 'W' }, { c: 'KeyE', l: 'E' },
    { c: 'KeyR', l: 'R' }, { c: 'KeyT', l: 'T' }, { c: 'KeyY', l: 'Y' }, { c: 'KeyU', l: 'U' },
    { c: 'KeyI', l: 'I' }, { c: 'KeyO', l: 'O' }, { c: 'KeyP', l: 'P' }, { c: 'BracketLeft', l: '[' },
    { c: 'BracketRight', l: ']' }, { c: 'Backslash', l: '\\', w: 'flex-1' }
  ],
  [
    { c: 'CapsLock', l: 'CAPS', w: 'w-16' }, { c: 'KeyA', l: 'A' }, { c: 'KeyS', l: 'S' }, { c: 'KeyD', l: 'D' },
    { c: 'KeyF', l: 'F' }, { c: 'KeyG', l: 'G' }, { c: 'KeyH', l: 'H' }, { c: 'KeyJ', l: 'J' },
    { c: 'KeyK', l: 'K' }, { c: 'KeyL', l: 'L' }, { c: 'Semicolon', l: ';' }, { c: 'Quote', l: "'" },
    { c: 'Enter', l: 'ENTER', w: 'flex-1' }
  ],
  [
    { c: 'ShiftLeft', l: 'SHIFT', w: 'w-20' }, { c: 'KeyZ', l: 'Z' }, { c: 'KeyX', l: 'X' }, { c: 'KeyC', l: 'C' },
    { c: 'KeyV', l: 'V' }, { c: 'KeyB', l: 'B' }, { c: 'KeyN', l: 'N' }, { c: 'KeyM', l: 'M' },
    { c: 'Comma', l: ',' }, { c: 'Period', l: '.' }, { c: 'Slash', l: '/' }, { c: 'ShiftRight', l: 'SHIFT', w: 'flex-1' }
  ],
  [
    { c: 'ControlLeft', l: 'CTRL', w: 'w-14' }, { c: 'MetaLeft', l: 'WIN', w: 'w-12' }, { c: 'AltLeft', l: 'ALT', w: 'w-12' },
    { c: 'Space', l: 'SPACE', w: 'flex-1' }, { c: 'AltRight', l: 'ALT', w: 'w-12' }, { c: 'ControlRight', l: 'CTRL', w: 'w-14' },
    { c: 'ArrowLeft', l: '←' }, { c: 'ArrowUp', l: '↑' }, { c: 'ArrowDown', l: '↓' }, { c: 'ArrowRight', l: '→' }
  ]
];

let testedKeys = new Set();

function renderKeyboardLayout() {
  document.getElementById('keyboard-layout').innerHTML = KEYBOARD_ROWS.map(row => `
    <div class="flex gap-1.5">
      ${row.map(k => `
        <div id="key-${k.c}" class="${k.w || 'w-10'} h-9 bg-slate-800 border border-slate-700 text-slate-300 rounded-md flex items-center justify-center text-[10px] font-mono-tech font-semibold transition-colors duration-75">${k.l}</div>
      `).join('')}
    </div>
  `).join('');
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (auditState.activeModule !== 'keyboard' || document.getElementById('view-workspace').classList.contains('hidden')) return;

  e.preventDefault();
  document.getElementById('kb-last-key').innerText = e.key === ' ' ? 'Space' : e.key;
  document.getElementById('kb-last-code').innerText = e.code;
  testedKeys.add(e.code);
  document.getElementById('kb-tested-count').innerText = testedKeys.size;

  const keyEl = document.getElementById(`key-${e.code}`);
  if (keyEl) {
    keyEl.className = keyEl.className.replace('bg-slate-800 border-slate-700 text-slate-300', '').replace('bg-emerald-600/30 border-emerald-500 text-emerald-300', '');
    keyEl.classList.add('bg-emerald-500', 'border-emerald-300', 'text-white');
  }
});

window.addEventListener('keyup', (e) => {
  if (auditState.activeModule !== 'keyboard') return;
  const keyEl = document.getElementById(`key-${e.code}`);
  if (keyEl && testedKeys.has(e.code)) {
    keyEl.classList.remove('bg-emerald-500', 'border-emerald-300', 'text-white');
    keyEl.classList.add('bg-emerald-600/30', 'border-emerald-500', 'text-emerald-300');
  }
});

function resetKeyboardTest() {
  testedKeys.clear();
  document.getElementById('kb-last-key').innerText = '-';
  document.getElementById('kb-last-code').innerText = '-';
  document.getElementById('kb-tested-count').innerText = '0';
  renderKeyboardLayout();
}

// ==========================================
// 5. MODUL 3: MOUSE, TOUCHPAD & SCROLL (SEGMENTASI SCROLL ATAS/BAWAH)
// ==========================================
let ptrCounts = { left: 0, mid: 0, right: 0, scrollUp: 0, scrollDown: 0 };
let isDrawing = false;

function tampilkanFeedbackPointer(teks, warnaCls = 'text-emerald-300 bg-emerald-500/20') {
  const el = document.getElementById('ptr-live-feedback');
  if (!el) return;
  el.className = `mt-2.5 px-3 py-1 rounded-full text-[11px] font-mono-tech font-bold transition ${warnaCls}`;
  el.innerText = teks;
}

function initPointerTester() {
  const zone = document.getElementById('pointer-click-zone');
  const canvas = document.getElementById('pointer-canvas');
  const ctx = canvas.getContext('2d');

  zone.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.button === 0) {
      ptrCounts.left++;
      tampilkanFeedbackPointer('KLIK KIRI TERDETEKSI');
    } else if (e.button === 1) {
      ptrCounts.mid++;
      tampilkanFeedbackPointer('KLIK TENGAH TERDETEKSI');
    } else if (e.button === 2) {
      ptrCounts.right++;
      tampilkanFeedbackPointer('KLIK KANAN TERDETEKSI');
    }
    updatePointerStats();
  });

  zone.addEventListener('dblclick', (e) => {
    e.preventDefault();
    tampilkanFeedbackPointer('DOUBLE CLICK TERDETEKSI', 'text-blue-300 bg-blue-500/20');
  });

  zone.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      ptrCounts.scrollUp++;
      tampilkanFeedbackPointer('↑ SCROLL KE ATAS', 'text-blue-300 bg-blue-500/20');
    } else if (e.deltaY > 0) {
      ptrCounts.scrollDown++;
      tampilkanFeedbackPointer('↓ SCROLL KE BAWAH', 'text-amber-300 bg-amber-500/20');
    }
    updatePointerStats();
  }, { passive: false });

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    isDrawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function moveDraw(e) {
    if (!isDrawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function endDraw() { isDrawing = false; }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: true });
  canvas.addEventListener('touchmove', moveDraw, { passive: true });
  window.addEventListener('touchend', endDraw);
}

function resizePointerCanvas() {
  const canvas = document.getElementById('pointer-canvas');
  if (canvas.clientWidth > 0) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
}

function updatePointerStats() {
  const setBox = (id, count, activeBg = 'bg-emerald-50', activeBorder = 'border-emerald-300') => {
    const box = document.getElementById(id);
    if (!box) return;
    box.querySelector('strong').innerText = count;
    if (count > 0) {
      box.classList.remove('bg-slate-50', 'border-slate-200');
      box.classList.add(activeBg, activeBorder);
    }
  };
  setBox('ptr-stat-left', ptrCounts.left);
  setBox('ptr-stat-mid', ptrCounts.mid);
  setBox('ptr-stat-right', ptrCounts.right);
  setBox('ptr-stat-scroll-up', ptrCounts.scrollUp, 'bg-blue-50', 'border-blue-300');
  setBox('ptr-stat-scroll-down', ptrCounts.scrollDown, 'bg-amber-50', 'border-amber-300');
}

function resetPointerTest() {
  ptrCounts = { left: 0, mid: 0, right: 0, scrollUp: 0, scrollDown: 0 };
  ['ptr-stat-left', 'ptr-stat-mid', 'ptr-stat-right'].forEach(id => {
    const box = document.getElementById(id);
    box.querySelector('strong').innerText = '0';
    box.className = 'p-2 rounded-lg bg-slate-50 border border-slate-200 transition';
  });
  ['ptr-stat-scroll-up', 'ptr-stat-scroll-down'].forEach(id => {
    const box = document.getElementById(id);
    box.querySelector('strong').innerText = '0';
    box.className = 'p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between px-3 transition';
  });
  tampilkanFeedbackPointer('Menunggu input...', 'text-slate-300 bg-white/10');
  const canvas = document.getElementById('pointer-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// ==========================================
// 6. MODUL 4: AUDIO STEREO & MIKROFON
// ==========================================
let audioCtx = null;
let micStream = null;
let micAnimationId = null;

function putarNadaUji(panValue, label) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const panner = audioCtx.createStereoPanner();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(panValue === -1 ? 440 : panValue === 1 ? 554.37 : 523.25, audioCtx.currentTime);
  panner.pan.setValueAtTime(panValue, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.05);

  document.getElementById('audio-status-label').innerText = `Memutar nada uji saluran: ${label}`;
}

async function toggleMikrofon() {
  const btn = document.getElementById('btn-toggle-mic');
  const errBox = document.getElementById('mic-error-box');
  errBox.classList.add('hidden');
  if (micStream) { stopMicStream(); return; }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const source = audioCtx.createMediaStreamSource(micStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    btn.innerText = 'Matikan Mic';
    btn.classList.replace('bg-slate-900', 'bg-rose-600');

    function pantauSuara() {
      if (!micStream) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const persen = Math.min(100, Math.round(avg));
      document.getElementById('mic-level-bar').style.width = `${persen}%`;
      document.getElementById('mic-db-value').innerText = `${persen}%`;
      micAnimationId = requestAnimationFrame(pantauSuara);
    }
    pantauSuara();
  } catch (err) {
    errBox.innerText = 'Akses mikrofon ditolak atau tidak ada perangkat mikrofon aktif.';
    errBox.classList.remove('hidden');
  }
}

function stopMicStream() {
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  if (micAnimationId) cancelAnimationFrame(micAnimationId);
  const btn = document.getElementById('btn-toggle-mic');
  if (btn) { btn.innerText = 'Aktifkan Mic'; btn.classList.replace('bg-rose-600', 'bg-slate-900'); }
  const bar = document.getElementById('mic-level-bar');
  if (bar) bar.style.width = '0%';
  const val = document.getElementById('mic-db-value');
  if (val) val.innerText = '0%';
}

// ==========================================
// 7. MODUL 5: UJI WEBCAM
// ==========================================
let camStream = null;

async function toggleKamera() {
  const btn = document.getElementById('btn-toggle-cam');
  const video = document.getElementById('webcam-video');
  const placeholder = document.getElementById('cam-placeholder');
  const badge = document.getElementById('cam-resolution-badge');
  const errBox = document.getElementById('cam-error-box');
  errBox.classList.add('hidden');
  if (camStream) { stopCamStream(); return; }

  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = camStream;
    video.classList.remove('hidden');
    placeholder.classList.add('hidden');
    video.onloadedmetadata = () => {
      badge.innerText = `${video.videoWidth} x ${video.videoHeight} px`;
      badge.classList.remove('hidden');
    };
    btn.innerText = 'Matikan Kamera';
    btn.classList.replace('bg-slate-900', 'bg-rose-600');
  } catch (err) {
    errBox.innerText = 'Akses kamera ditolak atau tidak ada webcam terhubung.';
    errBox.classList.remove('hidden');
  }
}

function stopCamStream() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  const video = document.getElementById('webcam-video');
  if (video) { video.srcObject = null; video.classList.add('hidden'); }
  document.getElementById('cam-placeholder')?.classList.remove('hidden');
  document.getElementById('cam-resolution-badge')?.classList.add('hidden');
  const btn = document.getElementById('btn-toggle-cam');
  if (btn) { btn.innerText = 'Aktifkan Kamera'; btn.classList.replace('bg-rose-600', 'bg-slate-900'); }
}

function stopActiveHardwareStreams() { stopMicStream(); stopCamStream(); }

// ==========================================
// 8. MODUL 6: TELEMETRI SISTEM & BATERAI
// ==========================================
function getCleanGPUName() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'WebGL Tidak Tersedia';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let raw = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    if (!raw) return 'Tidak terdeteksi';

    // Bersihkan pembungkus "ANGLE (...)"
    if (raw.startsWith('ANGLE (')) {
      raw = raw.slice(7, -1);
      const parts = raw.split(',').map(p => p.trim());
      // Jika formatnya "NVIDIA, NVIDIA GeForce GTX 1050...", ambil bagian kedua
      if (parts.length >= 2 && /^(NVIDIA|Intel|AMD|ATI|Qualcomm|Google.*|Apple)$/i.test(parts[0])) {
        raw = parts[1];
      } else {
        raw = parts[0];
      }
    }

    // Hapus kode hex device ID (0x...), Direct3D, OpenGL, Vulkan, vs_5_0, dan /PCIe
    return raw
      .replace(/\(0x[0-9a-fA-F]+\)/gi, '')
      .replace(/Direct3D\d*.*$/i, '')
      .replace(/OpenGL.*$/i, '')
      .replace(/Vulkan.*$/i, '')
      .replace(/\/PCIe.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    return 'Tidak terdeteksi';
  }
}

function ukurRefreshRate() {
  return new Promise(resolve => {
    let frames = 0;
    const start = performance.now();
    function count(now) {
      frames++;
      if (now - start < 500) {
        requestAnimationFrame(count);
      } else {
        const fps = Math.round((frames * 1000) / (now - start));
        // Normalisasi ke standar Hz layar umum jika selisih tipis
        const standards = [60, 75, 90, 120, 144, 165, 240];
        const closest = standards.find(s => Math.abs(s - fps) <= 4) || fps;
        resolve(`${closest} Hz (Terukur ~${fps} FPS)`);
      }
    }
    requestAnimationFrame(count);
  });
}

async function muatDataSistem() {
  // 1. OS & Arsitektur CPU
  let os = navigator.platform || 'Tidak diketahui';
  let archText = 'Arsitektur: Standard x86/ARM';
  let cpuArchShort = '';
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const ua = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platform', 'platformVersion']);
      os = `${ua.platform} ${ua.platformVersion || ''}`.trim();
      cpuArchShort = `${ua.architecture || ''} ${ua.bitness || '64'}-bit`.trim();
      archText = `Arsitektur: ${cpuArchShort}`;
    } catch (e) {}
  }

  // 2. CPU Threads & GPU Bersih (Tanpa RAM)
  const threads = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Threads` : 'Tidak terdeteksi';
  const cpuText = cpuArchShort ? `${threads} (${cpuArchShort})` : threads;
  const gpuName = getCleanGPUName();

  // 3. Layar, Color Depth & Refresh Rate
  const colorDepth = `${window.screen.colorDepth}-bit Color`;
  const screenInfo = `${window.screen.width}x${window.screen.height} (DPI ${window.devicePixelRatio}x • ${colorDepth})`;
  const hzText = await ukurRefreshRate();

  // 4. Jaringan, Storage & Jumlah I/O Media
  const conn = navigator.connection;
  const netText = navigator.onLine
    ? (conn ? `Online (${conn.effectiveType?.toUpperCase()} • ~${conn.downlink} Mbps)` : 'Online (Terhubung)')
    : 'Offline';

  let storageText = 'Storage: -';
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const quotaGB = (est.quota / (1024 ** 3)).toFixed(0);
      storageText = `Kuota Browser: ~${quotaGB} GB`;
    } catch (e) {}
  }

  let ioText = '';
  if (navigator.mediaDevices?.enumerateDevices) {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter(d => d.kind === 'videoinput').length;
      const mics = devs.filter(d => d.kind === 'audioinput').length;
      const spks = devs.filter(d => d.kind === 'audiooutput').length;
      ioText = `${storageText} | I/O: ${cams} Cam, ${mics} Mic, ${spks} Audio`;
    } catch (e) { ioText = storageText; }
  }

  // 5. Baterai Detail
  let batText = 'API Baterai diblokir browser ini';
  let batSub = 'Cek manual lewat Terminal/CMD OS';
  if ('getBattery' in navigator) {
    try {
      const bat = await navigator.getBattery();
      const level = Math.round(bat.level * 100);
      batText = `${level}% — ${bat.charging ? 'Sedang Mengisi (Charging)' : 'Baterai Aktif (Discharging)'}`;
      if (bat.charging && bat.chargingTime !== Infinity) {
        batSub = `Estimasi penuh dalam ${Math.round(bat.chargingTime / 60)} menit`;
      } else if (!bat.charging && bat.dischargingTime !== Infinity) {
        batSub = `Estimasi sisa pemakaian ~${Math.round(bat.dischargingTime / 60)} menit`;
      } else {
        batSub = bat.charging ? 'Terhubung ke adaptor daya' : 'Menghitung estimasi waktu sisa...';
      }
    } catch (e) {}
  }

  // Tampilkan ke UI (Tanpa sys-ram dan sys-gpu-vendor)
  document.getElementById('sys-platform').innerText = os;
  document.getElementById('sys-arch').innerText = archText;
  document.getElementById('sys-cpu').innerText = cpuText;
  document.getElementById('sys-gpu').innerText = gpuName;
  document.getElementById('sys-screen').innerText = screenInfo;
  document.getElementById('sys-hz').innerText = `Refresh Rate: ${hzText}`;
  document.getElementById('sys-battery').innerText = batText;
  document.getElementById('sys-battery-time').innerText = batSub;
  document.getElementById('sys-network').innerText = netText;
  document.getElementById('sys-io-count').innerText = ioText;

  auditState.systemSpecs = { os, cpu: cpuText, gpu: gpuName, screen: `${screenInfo} @ ${hzText}`, battery: batText };
}

// ==========================================
// 9. MODUL 7: INSPEKSI FISIK & PORT
// ==========================================
function renderPhysicalChecklist() {
  document.getElementById('physical-checklist-items').innerHTML = auditState.physicalItems.map((item, idx) => `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
      <span class="font-medium text-slate-800">${item.label}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" onclick="setStatusFisik(${idx}, 'normal')" class="px-3 py-1 rounded-md font-semibold transition ${item.status === 'normal' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border'}">Normal</button>
        <button type="button" onclick="setStatusFisik(${idx}, 'issue')" class="px-3 py-1 rounded-md font-semibold transition ${item.status === 'issue' ? 'bg-rose-600 text-white' : 'bg-white text-slate-500 border'}">Kendala</button>
      </div>
    </div>
  `).join('');
}

function setStatusFisik(index, status) {
  auditState.physicalItems[index].status = status;
  renderPhysicalChecklist();
}

function tambahPoinFisik() {
  const input = document.getElementById('input-physical-custom');
  const teks = input.value.trim();
  if (!teks) return;
  auditState.physicalItems.push({ id: 'phy-' + Date.now(), label: teks, status: 'normal' });
  input.value = '';
  renderPhysicalChecklist();
}

function selesaikanInspeksiFisik() {
  const adaKendala = auditState.physicalItems.some(i => i.status === 'issue');
  tetapkanStatus('physical', adaKendala ? 'fail' : 'pass', 'report');
}

// ==========================================
// 10. LAPORAN AKHIR & RIWAYAT DETAIL
// ==========================================
function hitungSkor(resultsObj) {
  const passed = MODUL_KEYS.filter(k => resultsObj[k]?.status === 'pass').length;
  const tested = MODUL_KEYS.filter(k => resultsObj[k]?.status !== 'untested').length;
  const persen = Math.round((passed / MODUL_KEYS.length) * 100);
  let verdict = 'Belum Lengkap';
  if (tested === MODUL_KEYS.length) {
    if (persen === 100) verdict = 'Sangat Layak (100% Lolos)';
    else if (persen >= 70) verdict = 'Layak dengan Catatan';
    else verdict = 'Perlu Perbaikan Serius';
  }
  return { persen, verdict };
}

function renderLaporanAktif() {
  const user = getActiveUser();
  const skor = hitungSkor(auditState.results);
  const manualCpu = document.getElementById('input-cpu-manual')?.value.trim();
  const specsToSave = { ...auditState.systemSpecs };
  if (manualCpu) {
    specsToSave.cpu = `${manualCpu} (${specsToSave.cpu})`;
  }
  const snapshot = {
    id: null,
    deviceName: document.getElementById('input-device-name').value.trim() || 'Perangkat Tanpa Nama',
    label: document.getElementById('input-audit-label').value.trim() || 'Umum',
    tanggal: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
    auditorName: user ? user.nama : 'Pengguna Tamu',
    score: skor.persen,
    verdict: skor.verdict,
    systemSpecs: auditState.systemSpecs,
    results: JSON.parse(JSON.stringify(auditState.results)),
    physicalItems: JSON.parse(JSON.stringify(auditState.physicalItems))
  };
  tampilkanDataKePanelLaporan(snapshot, false);
}

function tampilkanDataKePanelLaporan(data, isArchive) {
  auditState.activeReportSnapshot = data;

  const archiveBanner = document.getElementById('rep-archive-banner');
  const btnSave = document.getElementById('btn-save-history');
  const leftActions = document.getElementById('rep-left-actions');

  if (isArchive) {
    archiveBanner.classList.remove('hidden');
    document.getElementById('rep-archive-id').innerText = data.id;
    btnSave.classList.add('hidden');
    leftActions.innerHTML = `<button onclick="gantiTampilanUtama('history')" class="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition">&larr; Kembali ke Riwayat</button>`;
  } else {
    archiveBanner.classList.add('hidden');
    btnSave.classList.remove('hidden');
    leftActions.innerHTML = `<button onclick="resetSemuaAudit()" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg transition">Mulai Audit Baru</button>`;
  }

  document.getElementById('rep-device-name').innerText = data.deviceName;
  document.getElementById('rep-label-badge').innerText = data.label;
  document.getElementById('rep-date').innerText = data.tanggal;
  document.getElementById('rep-auditor').innerText = `Auditor: ${data.auditorName}`;

  const scoreEl = document.getElementById('rep-score');
  scoreEl.innerText = `${data.score}%`;
  scoreEl.className = `text-2xl font-bold font-mono-tech ${data.score >= 80 ? 'text-emerald-400' : data.score >= 60 ? 'text-amber-400' : 'text-rose-400'}`;
  document.getElementById('rep-verdict').innerText = data.verdict;

  // Isi Ringkasan Telemetri Sistem
  const sys = data.systemSpecs || {};
  document.getElementById('rep-sys-os').innerText = sys.os || '-';
  document.getElementById('rep-sys-cpu').innerText = sys.cpu || '-';
  document.getElementById('rep-sys-gpu').innerText = sys.gpu || '-';
  document.getElementById('rep-sys-screen').innerText = sys.screen || '-';

  const labels = {
    display: '1. Layar & Dead Pixel',
    keyboard: '2. Matriks Keyboard',
    pointer: '3. Mouse & Touchpad',
    audio: '4. Speaker & Mikrofon',
    camera: '5. Kamera (Webcam)',
    system: '6. Sistem & Baterai',
    physical: '7. Fisik, Engsel & Port'
  };

  document.getElementById('rep-modules-grid').innerHTML = Object.keys(labels).map(k => {
    const res = data.results[k] || { status: 'untested', note: '' };
    const badge = res.status === 'pass'
      ? '<span class="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">LULUS</span>'
      : res.status === 'fail'
        ? '<span class="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold">KENDALA</span>'
        : '<span class="text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold">BELUM DIUJI</span>';
    return `
      <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
        <div class="flex justify-between items-center"><span class="font-bold text-slate-800">${labels[k]}</span>${badge}</div>
        ${res.note ? `<p class="text-slate-500 italic">"${res.note}"</p>` : ''}
      </div>`;
  }).join('');

  document.getElementById('rep-physical-list').innerHTML = (data.physicalItems || []).map(item => `
    <div class="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
      <span class="text-slate-700">${item.label}</span>
      <span class="font-bold ${item.status === 'normal' ? 'text-emerald-600' : 'text-rose-600'}">${item.status === 'normal' ? 'Normal' : 'Kendala'}</span>
    </div>
  `).join('');
}

function salinTeksLaporan() {
  const data = auditState.activeReportSnapshot;
  if (!data) return;
  let teks = `LAPORAN DEVICE AUDIT\nPerangkat: ${data.deviceName}\nLabel: ${data.label}\nTanggal: ${data.tanggal}\nSkor Kelayakan: ${data.score}% (${data.verdict})\n\nHasil Modul:\n`;
  MODUL_KEYS.forEach(k => {
    const st = (data.results[k]?.status || 'untested').toUpperCase();
    const nt = data.results[k]?.note ? ` - Catatan: ${data.results[k].note}` : '';
    teks += `- ${k.toUpperCase()}: ${st}${nt}\n`;
  });
  navigator.clipboard.writeText(teks).then(() => alert('Ringkasan laporan berhasil disalin ke papan klip!'));
}

function simpanKeRiwayat() {
  const user = getActiveUser();
  if (!user) {
    alert('Silakan masuk akun terlebih dahulu untuk menyimpan riwayat audit.');
    window.location.href = 'login.html';
    return;
  }
  const snap = auditState.activeReportSnapshot;
  snap.id = 'AUD-' + Math.floor(1000 + Math.random() * 9000);
  snap.userId = user.id;

  const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
  history.unshift(snap);
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
  updateHistoryBadge();
  alert('Laporan audit lengkap berhasil disimpan ke Riwayat Akun!');
  gantiTampilanUtama('history');
}

function updateHistoryBadge() {
  const user = getActiveUser();
  const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
  const count = user ? history.filter(h => h.userId === user.id).length : 0;
  document.getElementById('badge-history-count').innerText = count;
}

function renderRiwayatAudit() {
  const user = getActiveUser();
  const container = document.getElementById('history-list-container');

  if (!user) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
        <p class="text-xs text-slate-500">Masuk ke akun Anda untuk melihat, menyaring label, dan membuka kembali arsip laporan detail.</p>
        <a href="login.html" class="inline-block px-5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg">Masuk Sekarang</a>
      </div>`;
    return;
  }

  const keyword = (document.getElementById('input-search-history')?.value || '').toLowerCase();
  const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]').filter(h => {
    const milikSaya = h.userId === user.id;
    const cocokCari = h.deviceName.toLowerCase().includes(keyword) || (h.label || '').toLowerCase().includes(keyword);
    return milikSaya && cocokCari;
  });

  if (history.length === 0) {
    container.innerHTML = `<div class="bg-white p-8 rounded-xl border border-dashed text-center text-xs text-slate-400">Tidak ada riwayat audit yang ditemukan.</div>`;
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-bold text-sm text-slate-900">${h.deviceName}</span>
          <span class="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">${h.label || 'Umum'}</span>
          <span class="text-[10px] font-mono-tech bg-slate-100 px-2 py-0.5 rounded text-slate-500">${h.id}</span>
        </div>
        <p class="text-xs text-slate-500">${h.tanggal} • Skor: <strong class="text-slate-700">${h.score}%</strong> (${h.verdict})</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="bukaDetailRiwayat('${h.id}')" class="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition">
          Buka Detail
        </button>
        <button onclick="hapusRiwayat('${h.id}')" class="text-xs text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 transition">
          Hapus
        </button>
      </div>
    </div>
  `).join('');
}

function bukaDetailRiwayat(historyId) {
  const history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
  const record = history.find(h => h.id === historyId);
  if (!record) return;

  // Tampilkan panel laporan dalam Mode Arsip (menyembunyikan sidebar ruang uji sementara)
  document.getElementById('view-history').classList.add('hidden');
  document.getElementById('view-workspace').classList.remove('hidden');
  document.getElementById('workspace-top-bar').classList.add('hidden');
  document.getElementById('workspace-sidebar').classList.add('hidden');

  document.querySelectorAll('.module-panel').forEach(el => el.classList.add('hidden'));
  document.getElementById('panel-report').classList.remove('hidden');

  tampilkanDataKePanelLaporan(record, true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hapusRiwayat(id) {
  if (!confirm('Hapus arsip laporan ini?')) return;
  let history = JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) || '[]');
  history = history.filter(h => h.id !== id);
  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
  updateHistoryBadge();
  renderRiwayatAudit();
}

function resetSemuaAudit() {
  if (!confirm('Atur ulang seluruh hasil pengujian saat ini?')) return;
  MODUL_KEYS.forEach(k => {
    auditState.results[k] = { status: 'untested', note: '' };
    const noteEl = document.getElementById(`note-${k}`);
    if (noteEl) noteEl.value = '';
  });
  resetKeyboardTest();
  resetPointerTest();
  updateProgressUI();
  bukaModul('display');
}