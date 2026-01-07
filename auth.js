// Authentication Module - Complete Fixed Version
import { 
  auth, 
  database, 
  googleProvider,
  supabase,
  ADMIN_USERNAME,
  ADMIN_PASSWORD 
} from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  ref,
  set,
  get,
  update,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const authContainer = document.getElementById('authContainer');
const chatContainer = document.getElementById('chatContainer');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const phoneVerification = document.getElementById('phoneVerification');
const adminLoginForm = document.getElementById('adminLoginForm');

// Auth Buttons
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const verifyBtn = document.getElementById('verifyBtn');
const resendCode = document.getElementById('resendCode');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

// Auth Inputs
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const rememberMe = document.getElementById('rememberMe');
const registerName = document.getElementById('registerName');
const registerEmail = document.getElementById('registerEmail');
const registerPhone = document.getElementById('registerPhone');
const registerPassword = document.getElementById('registerPassword');
const verificationCode = document.getElementById('verificationCode');
const adminUsername = document.getElementById('adminUsername');
const adminPassword = document.getElementById('adminPassword');

// Switch Links
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const showAdminLogin = document.getElementById('showAdminLogin');
const backToLogin = document.getElementById('backToLogin');

// Global variables
let confirmationResult = null;
let recaptchaVerifier = null;
let pendingUserData = null;
let recaptchaWidgetId = null;

// Notification function
function showNotification(message, type = 'info') {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(n => n.remove());

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px 20px',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    zIndex: '10000',
    animation: 'slideIn 0.3s ease',
    boxShadow: '0 5px 20px rgba(0, 0, 0, 0.3)',
    maxWidth: '350px'
  });

  if (type === 'success') {
    notification.style.background = 'linear-gradient(135deg, #00ff88, #00d4ff)';
  } else if (type === 'error') {
    notification.style.background = 'linear-gradient(135deg, #ff4757, #ff6348)';
  } else {
    notification.style.background = 'linear-gradient(135deg, #00f3ff, #9d00ff)';
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Loading functions
function showLoading(button) {
  if (!button) return;
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.innerHTML = '<span class="loading"></span>';
}

function hideLoading(button, text) {
  if (!button) return;
  button.disabled = false;
  button.textContent = text || button.dataset.originalText || 'Submit';
}

// Email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Phone validation - flexible format
function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}

// Format phone number
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('998')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 9) {
      cleaned = '+998' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

// Initialize Authentication
function initAuth() {
  setupEventListeners();
  setupAuthStateListener();
  // Handle possible redirect result (Google sign-in fallback)
  handleRedirectResult();
  loadRemembered();
  addNotificationStyles();
  console.log('Auth module initialized');
}

// Prefill remembered fields
function loadRemembered() {
  try {
    const remEmail = localStorage.getItem('remember_email');
    const remPhone = localStorage.getItem('remember_phone');
    if (remEmail && loginEmail) loginEmail.value = remEmail;
    if (remPhone && registerPhone) registerPhone.value = remPhone;
  } catch (e) {
    console.warn('Could not load remembered fields', e);
  }
}

// Add notification styles
function addNotificationStyles() {
  if (document.getElementById('auth-notification-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'auth-notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// Setup Event Listeners
function setupEventListeners() {
  // Form switches
  showRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    phoneVerification.style.display = 'none';
    adminLoginForm.style.display = 'none';
  });

  showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    phoneVerification.style.display = 'none';
    adminLoginForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  showAdminLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    phoneVerification.style.display = 'none';
    adminLoginForm.style.display = 'block';
  });

  backToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    adminLoginForm.style.display = 'none';
    registerForm.style.display = 'none';
    phoneVerification.style.display = 'none';
    loginForm.style.display = 'block';
  });

  // Auth actions
  loginBtn?.addEventListener('click', handleLogin);
  registerBtn?.addEventListener('click', handleRegister);
  googleLoginBtn?.addEventListener('click', handleGoogleLogin);
  verifyBtn?.addEventListener('click', handlePhoneVerification);
  resendCode?.addEventListener('click', resendVerificationCode);
  adminLoginBtn?.addEventListener('click', handleAdminLogin);
  logoutBtn?.addEventListener('click', handleLogout);
  adminLogoutBtn?.addEventListener('click', handleLogout);

  // Enter key handlers
  loginEmail?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginPassword?.focus();
  });
  loginPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  registerPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
  verificationCode?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handlePhoneVerification();
  });
  adminPassword?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });

  // Verification code input - only numbers
  verificationCode?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
  });
}

// Handle Login
async function handleLogin() {
  const email = loginEmail?.value?.trim();
  const password = loginPassword?.value?.trim();
  const remember = rememberMe?.checked;

  if (!email || !password) {
    showNotification('Iltimos, barcha maydonlarni to\'ldiring', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showNotification('Iltimos, to\'g\'ri email manzil kiriting', 'error');
    return;
  }

  try {
    showLoading(loginBtn);
    // Set persistence based on Remember me
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    } catch (pErr) {
      console.warn('Persistence set failed:', pErr);
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if user is blocked
    const userRef = ref(database, `users/${userCredential.user.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists() && snapshot.val().blocked) {
      await signOut(auth);
      showNotification('Sizning hisobingiz bloklangan. Admin bilan bog\'laning.', 'error');
      return;
    }

    // Update user status
    await updateUserStatus(userCredential.user.uid, true);
    showNotification('Muvaffaqiyatli kirdingiz!', 'success');

    // Remember email/phone if requested
    try {
      if (remember) {
        localStorage.setItem('remember_email', email);
      } else {
        localStorage.removeItem('remember_email');
      }
    } catch (e) { console.warn('Remember save failed', e); }

  } catch (error) {
    console.error('Login error:', error);
    let message = 'Kirish muvaffaqiyatsiz';
    
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'Foydalanuvchi topilmadi';
        break;
      case 'auth/wrong-password':
        message = 'Parol noto\'g\'ri';
        break;
      case 'auth/invalid-email':
        message = 'Email noto\'g\'ri';
        break;
      case 'auth/invalid-credential':
        message = 'Email yoki parol noto\'g\'ri';
        break;
      case 'auth/too-many-requests':
        message = 'Juda ko\'p urinish. Biroz kutib turing';
        break;
      case 'auth/network-request-failed':
        message = 'Internet aloqasi yo\'q';
        break;
    }
    showNotification(message, 'error');
  } finally {
    hideLoading(loginBtn, 'Kirish');
  }
}

// Handle Register
async function handleRegister() {
  const name = registerName?.value?.trim();
  const email = registerEmail?.value?.trim();
  const phone = registerPhone?.value?.trim();
  const password = registerPassword?.value?.trim();
  const remember = rememberMe?.checked;

  if (!name || !email || !phone || !password) {
    showNotification('Iltimos, barcha maydonlarni to\'ldiring', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showNotification('Iltimos, to\'g\'ri email manzil kiriting', 'error');
    return;
  }

  if (password.length < 6) {
    showNotification('Parol kamida 6 ta belgidan iborat bo\'lishi kerak', 'error');
    return;
  }

  if (!isValidPhone(phone)) {
    showNotification('Telefon raqami noto\'g\'ri formatda', 'error');
    return;
  }

  try {
    showLoading(registerBtn);
    // Set persistence according to remember checkbox
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    } catch (pErr) {
      console.warn('Persistence set failed (register):', pErr);
    }
    
    const formattedPhone = formatPhoneNumber(phone);
    
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user data to Firebase
    const userData = {
      uid: user.uid,
      name: name,
      email: email,
      phone: formattedPhone,
      avatar: name.charAt(0).toUpperCase(),
      createdAt: Date.now(),
      lastSeen: Date.now(),
      online: true,
      blocked: false,
      phoneVerified: false
    };

    await set(ref(database, `users/${user.uid}`), userData);

    // Save to Supabase (non-blocking)
    supabase.insert('users', {
      uid: user.uid,
      name: name,
      email: email,
      phone: formattedPhone,
      avatar: name.charAt(0).toUpperCase(),
      created_at: new Date().toISOString(),
      blocked: false
    }).catch(err => console.warn('Supabase insert warning:', err));

    // Store pending user data for phone verification
    pendingUserData = { uid: user.uid, phone: formattedPhone };

    showNotification('Hisob yaratildi! Telefon raqamini tasdiqlang', 'success');
    
    // Show phone verification
    registerForm.style.display = 'none';
    phoneVerification.style.display = 'block';
    
    // Initialize phone verification
    await initPhoneVerification(formattedPhone);

    // Save remembered phone/email if requested
    try {
      if (remember) {
        localStorage.setItem('remember_email', email);
        localStorage.setItem('remember_phone', formattedPhone);
      } else {
        localStorage.removeItem('remember_email');
        localStorage.removeItem('remember_phone');
      }
    } catch (e) { console.warn('Remember save failed', e); }

  } catch (error) {
    console.error('Registration error:', error);
    let message = 'Ro\'yxatdan o\'tish muvaffaqiyatsiz';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        message = 'Bu email allaqachon ro\'yxatdan o\'tgan';
        break;
      case 'auth/weak-password':
        message = 'Parol juda oddiy';
        break;
      case 'auth/invalid-email':
        message = 'Email noto\'g\'ri';
        break;
      case 'auth/network-request-failed':
        message = 'Internet aloqasi yo\'q';
        break;
    }
    showNotification(message, 'error');
  } finally {
    hideLoading(registerBtn, 'Hisob yaratish');
  }
}

// Handle Google Login
async function handleGoogleLogin() {
  try {
    showLoading(googleLoginBtn);
    
    // Try popup first; fall back to redirect if popup blocked
    let result = null;
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (popupErr) {
      console.warn('signInWithPopup failed, attempting redirect fallback:', popupErr);
      if (popupErr && (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request' || popupErr.code === 'auth/popup-closed-by-user')) {
        try {
          // Use local persistence for Google sign-ins by default
          try { await setPersistence(auth, browserLocalPersistence); } catch(e){console.warn('setPersistence fallback:', e)}
          await signInWithRedirect(auth, googleProvider);
          // Redirect will navigate away; result handled on page load
          return;
        } catch (redirErr) {
          console.error('Redirect sign-in failed:', redirErr);
          throw redirErr;
        }
      }
      throw popupErr;
    }
    const user = result.user;

    // Check/create user in database
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      // New user - create profile
      const userData = {
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.displayName?.charAt(0).toUpperCase() || 'G',
        photoURL: user.photoURL || '',
        createdAt: Date.now(),
        lastSeen: Date.now(),
        online: true,
        blocked: false,
        provider: 'google',
        phoneVerified: !!user.phoneNumber
      };

      await set(userRef, userData);

      // Save to Supabase (non-blocking)
      supabase.insert('users', {
        uid: user.uid,
        name: user.displayName || 'Google User',
        email: user.email,
        phone: user.phoneNumber || '',
        avatar: user.displayName?.charAt(0).toUpperCase() || 'G',
        photo_url: user.photoURL || '',
        created_at: new Date().toISOString(),
        blocked: false
      }).catch(err => console.warn('Supabase insert warning:', err));

    } else if (snapshot.val().blocked) {
      await signOut(auth);
      showNotification('Sizning hisobingiz bloklangan', 'error');
      return;
    }

    await updateUserStatus(user.uid, true);
    showNotification('Google orqali muvaffaqiyatli kirdingiz!', 'success');

  } catch (error) {
    console.error('Google login error:', error);
    
    if (error.code === 'auth/popup-blocked') {
      showNotification('Popup bloklangan. Brauzer sozlamalarini tekshiring', 'error');
    } else if (error.code === 'auth/popup-closed-by-user') {
      showNotification('Kirish bekor qilindi', 'info');
    } else if (error.code === 'auth/cancelled-popup-request') {
      // Ignore this error
    } else if (error.code === 'auth/network-request-failed') {
      showNotification('Internet aloqasi yo\'q', 'error');
    } else {
      showNotification('Google bilan kirish muvaffaqiyatsiz', 'error');
    }
  } finally {
    hideLoading(googleLoginBtn, 'Google bilan kirish');
  }
}

// Handle redirect result for Google sign-in (called on init)
async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      // Process same as popup success
      const user = result.user;
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
        const userData = {
          uid: user.uid,
          name: user.displayName || 'Google User',
          email: user.email,
          phone: user.phoneNumber || '',
          avatar: user.displayName?.charAt(0).toUpperCase() || 'G',
          photoURL: user.photoURL || '',
          createdAt: Date.now(),
          lastSeen: Date.now(),
          online: true,
          blocked: false,
          provider: 'google',
          phoneVerified: !!user.phoneNumber
        };

        await set(userRef, userData);
        supabase.insert('users', {
          uid: user.uid,
          name: user.displayName || 'Google User',
          email: user.email,
          phone: user.phoneNumber || '',
          avatar: user.displayName?.charAt(0).toUpperCase() || 'G',
          photo_url: user.photoURL || '',
          created_at: new Date().toISOString(),
          blocked: false
        }).catch(err => console.warn('Supabase insert warning:', err));
      } else if (snapshot.val().blocked) {
        await signOut(auth);
        showNotification('Sizning hisobingiz bloklangan', 'error');
        return;
      }

      await updateUserStatus(user.uid, true);
      showNotification('Google orqali muvaffaqiyatli kirdingiz!', 'success');
    }
  } catch (err) {
    // getRedirectResult throws if there was no redirect result or network errors
    if (err && err.code) console.warn('Redirect result error:', err.code, err.message);
  }
}

// Initialize Phone Verification
async function initPhoneVerification(phoneNumber) {
  try {
    // Clear existing recaptcha
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.warn('Could not clear recaptcha:', e);
      }
      recaptchaVerifier = null;
    }

    // Create/clear recaptcha container
    let recaptchaContainer = document.getElementById('recaptcha-container');
    if (!recaptchaContainer) {
      recaptchaContainer = document.createElement('div');
      recaptchaContainer.id = 'recaptcha-container';
      recaptchaContainer.style.cssText = 'position: fixed; bottom: 10px; left: 10px; z-index: 9999;';
      document.body.appendChild(recaptchaContainer);
    }
    recaptchaContainer.innerHTML = '';

    // Initialize RecaptchaVerifier
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: (response) => {
        console.log('reCAPTCHA solved:', response);
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        showNotification('reCAPTCHA muddati tugadi. Qaytadan urinib ko\'ring', 'error');
        recaptchaVerifier = null;
      },
      'error-callback': (error) => {
        console.error('reCAPTCHA error:', error);
        showNotification('reCAPTCHA xatosi', 'error');
      }
    });

    // Render recaptcha
    await recaptchaVerifier.render();

    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log('Sending verification to:', formattedPhone);
    
    // Send verification code
    confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
    showNotification('Tasdiqlash kodi yuborildi!', 'success');

  } catch (error) {
    console.error('Phone verification error:', error);
    
    let message = 'Tasdiqlash kodi yuborishda xatolik';
    
    switch (error.code) {
      case 'auth/invalid-phone-number':
        message = 'Telefon raqami noto\'g\'ri formatda';
        break;
      case 'auth/too-many-requests':
        message = 'Juda ko\'p urinish. Biroz kutib turing';
        break;
      case 'auth/captcha-check-failed':
        message = 'reCAPTCHA tekshiruvi muvaffaqiyatsiz';
        break;
      case 'auth/quota-exceeded':
        message = 'SMS limit tugadi. Keyinroq urinib ko\'ring';
        break;
      case 'auth/missing-phone-number':
        message = 'Telefon raqami kiritilmagan';
        break;
      case 'auth/network-request-failed':
        message = 'Internet aloqasi yo\'q';
        break;
    }
    
    showNotification(message, 'error');
    
    // Reset recaptcha on error
    recaptchaVerifier = null;
  }
}

// Handle Phone Verification
async function handlePhoneVerification() {
  const code = verificationCode?.value?.trim();

  if (!code || code.length !== 6) {
    showNotification('Iltimos, 6 raqamli kodni kiriting', 'error');
    return;
  }

  if (!confirmationResult) {
    showNotification('Avval kodni so\'rang', 'error');
    return;
  }

  try {
    showLoading(verifyBtn);
    
    // Verify the code
    const credential = PhoneAuthProvider.credential(
      confirmationResult.verificationId,
      code
    );

    // Link phone to current user if exists
    if (auth.currentUser) {
      try {
        await linkWithCredential(auth.currentUser, credential);
        console.log('Phone linked successfully');
      } catch (linkError) {
        // If already linked or other error, just verify
        console.warn('Link warning:', linkError.code);
        if (linkError.code !== 'auth/provider-already-linked' && 
            linkError.code !== 'auth/credential-already-in-use') {
          throw linkError;
        }
      }

      // Update phone verified status
      await update(ref(database, `users/${auth.currentUser.uid}`), {
        phoneVerified: true,
        lastSeen: Date.now()
      });

      // Update in Supabase
      supabase.update('users', auth.currentUser.uid, {
        phone_verified: true
      }).catch(err => console.warn('Supabase update warning:', err));

    } else {
      // Confirm the phone sign in
      await confirmationResult.confirm(code);
    }

    showNotification('Telefon muvaffaqiyatli tasdiqlandi!', 'success');
    phoneVerification.style.display = 'none';
    
    // Reset state
    confirmationResult = null;
    pendingUserData = null;
    if (verificationCode) verificationCode.value = '';

  } catch (error) {
    console.error('Verification error:', error);
    
    let message = 'Kod noto\'g\'ri';
    if (error.code === 'auth/invalid-verification-code') {
      message = 'Tasdiqlash kodi noto\'g\'ri';
    } else if (error.code === 'auth/code-expired') {
      message = 'Kod muddati tugagan. Qaytadan so\'rang';
    } else if (error.code === 'auth/session-expired') {
      message = 'Sessiya tugadi. Qaytadan urinib ko\'ring';
    }
    
    showNotification(message, 'error');
  } finally {
    hideLoading(verifyBtn, 'Tasdiqlash');
  }
}

// Resend Verification Code
async function resendVerificationCode() {
  const phone = registerPhone?.value?.trim() || pendingUserData?.phone;
  
  if (!phone) {
    showNotification('Telefon raqamini kiriting', 'error');
    return;
  }

  showNotification('Qayta kod yuborilmoqda...', 'info');
  
  // Reset recaptcha
  recaptchaVerifier = null;
  confirmationResult = null;
  
  await initPhoneVerification(phone);
}

// Skip Phone Verification (for testing)
async function skipPhoneVerification() {
  if (auth.currentUser) {
    await update(ref(database, `users/${auth.currentUser.uid}`), {
      phoneVerified: false
    });
    
    phoneVerification.style.display = 'none';
    showNotification('Telefon tasdiqlash o\'tkazib yuborildi', 'info');
  }
  
  confirmationResult = null;
  pendingUserData = null;
}

// Handle Admin Login
async function handleAdminLogin() {
  const username = adminUsername?.value?.trim();
  const password = adminPassword?.value?.trim();

  if (!username || !password) {
    showNotification('Iltimos, admin ma\'lumotlarini kiriting', 'error');
    return;
  }

  try {
    showLoading(adminLoginBtn);

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      window.appState.isAdmin = true;
      window.appState.currentUser = { 
        uid: 'admin', 
        name: 'Administrator', 
        email: 'admin@neonmessenger.com' 
      };
      
      authContainer.style.display = 'none';
      chatContainer.style.display = 'none';
      adminPanel.style.display = 'flex';
      
      // Load admin data
      if (typeof window.loadAdminData === 'function') {
        await window.loadAdminData();
      }
      
      showNotification('Admin sifatida muvaffaqiyatli kirdingiz!', 'success');
    } else {
      showNotification('Admin ma\'lumotlari noto\'g\'ri', 'error');
    }
  } catch (error) {
    console.error('Admin login error:', error);
    showNotification('Admin kirish muvaffaqiyatsiz', 'error');
  } finally {
    hideLoading(adminLoginBtn, 'Admin kirish');
  }
}

// Handle Logout
async function handleLogout() {
  try {
    if (window.appState.isAdmin) {
      window.appState.isAdmin = false;
      window.appState.currentUser = null;
      adminPanel.style.display = 'none';
      chatContainer.style.display = 'none';
      authContainer.style.display = 'flex';
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      phoneVerification.style.display = 'none';
      adminLoginForm.style.display = 'none';
      
      // Clear admin inputs
      if (adminUsername) adminUsername.value = '';
      if (adminPassword) adminPassword.value = '';
      
      showNotification('Admin chiqdi', 'success');
    } else if (auth.currentUser) {
      await updateUserStatus(auth.currentUser.uid, false);
      await signOut(auth);
      showNotification('Muvaffaqiyatli chiqdingiz', 'success');
    }
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Chiqishda xatolik', 'error');
  }
}

// Update User Status
async function updateUserStatus(uid, online) {
  try {
    const updates = {
      online: online,
      lastSeen: Date.now()
    };
    await update(ref(database, `users/${uid}`), updates);
    
    // Update in Supabase (non-blocking)
    supabase.update('users', uid, {
      online: online,
      last_seen: new Date().toISOString()
    }).catch(err => console.warn('Supabase status update warning:', err));
    
  } catch (error) {
    console.error('Status update error:', error);
  }
}

// Setup Auth State Listener
function setupAuthStateListener() {
  onAuthStateChanged(auth, async (user) => {
    try {
      console.log('Auth state changed:', user?.email || 'No user');

      if (user && !window.appState.isAdmin) {
        // Check if blocked
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists() && snapshot.val().blocked) {
          await signOut(auth);
          showNotification('Sizning hisobingiz bloklangan', 'error');
          return;
        }

        // Load user data
        const userData = snapshot.exists() ? snapshot.val() : {};
        window.appState.currentUser = {
          uid: user.uid,
          email: user.email,
          name: userData.name || user.displayName || 'Foydalanuvchi',
          avatar: userData.avatar || user.displayName?.charAt(0) || 'U',
          phone: userData.phone || user.phoneNumber || '',
          photoURL: userData.photoURL || user.photoURL || '',
          ...userData
        };

        // Update UI
        authContainer.style.display = 'none';
        adminPanel.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        // Update profile display
        const currentUserName = document.getElementById('currentUserName');
        const currentUserAvatar = document.getElementById('currentUserAvatar');
        
        if (currentUserName) {
          currentUserName.textContent = window.appState.currentUser.name;
        }
        if (currentUserAvatar) {
          currentUserAvatar.textContent = window.appState.currentUser.avatar;
        }

        // Load chat data
        if (typeof window.loadChatData === 'function') {
          window.loadChatData();
        }

        // Set user online
        await updateUserStatus(user.uid, true);

        // Handle offline status on page unload
        window.addEventListener('beforeunload', () => {
          if (auth.currentUser) {
            // Use sendBeacon for reliable offline status update
            const data = JSON.stringify({
              online: false,
              lastSeen: Date.now()
            });
            navigator.sendBeacon && navigator.sendBeacon('/offline', data);
          }
        });

        // Handle visibility change
        document.addEventListener('visibilitychange', async () => {
          if (auth.currentUser) {
            const isOnline = document.visibilityState === 'visible';
            await updateUserStatus(auth.currentUser.uid, isOnline);
          }
        });

      } else if (!window.appState.isAdmin) {
        // No user - show auth
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        adminPanel.style.display = 'none';
        
        // Reset forms
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        phoneVerification.style.display = 'none';
        adminLoginForm.style.display = 'none';
        
        // Clear state
        window.appState.currentUser = null;
      }
    } catch (error) {
      console.error('Auth state handler error:', error);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

// Export functions
export { 
  handleLogin, 
  handleLogout, 
  updateUserStatus, 
  showNotification, 
  showLoading, 
  hideLoading,
  skipPhoneVerification
};
