/**
 * Device Audit - Authentication & Session Handler
 */

const STORAGE_USERS_KEY = 'da_users_v2';
const STORAGE_SESSION_KEY = 'da_session_v2';

const DEMO_USERS = [
  {
    id: 'usr-001',
    nama: 'Muhammad Azmi',
    email: 'demo@deviceaudit.id',
    sandi: '123456'
  }
];

function initAuthDatabase() {
  if (!localStorage.getItem(STORAGE_USERS_KEY)) {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEMO_USERS));
  }
}
initAuthDatabase();

function getActiveUser() {
  const session = localStorage.getItem(STORAGE_SESSION_KEY);
  return session ? JSON.parse(session) : null;
}

function isLoggedIn() {
  return getActiveUser() !== null;
}

function loginUser(email, sandi) {
  const users = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '[]');
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.sandi === sandi);

  if (user) {
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(user));
    return { success: true, user: user };
  }
  return { success: false, message: 'Email atau kata sandi tidak sesuai.' };
}

function registerUser(dataBaru) {
  const users = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '[]');
  if (users.some(u => u.email.toLowerCase() === dataBaru.email.toLowerCase())) {
    return { success: false, message: 'Email tersebut sudah terdaftar.' };
  }

  const akunBaru = {
    id: 'usr-' + Date.now(),
    nama: dataBaru.nama,
    email: dataBaru.email,
    sandi: dataBaru.sandi
  };

  users.push(akunBaru);
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(akunBaru));
  return { success: true, user: akunBaru };
}

function logoutUser() {
  localStorage.removeItem(STORAGE_SESSION_KEY);
  window.location.href = 'index.html';
}

function guardLoginPage() {
  if (isLoggedIn()) {
    window.location.href = 'index.html';
  }
}