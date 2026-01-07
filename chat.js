// Chat Module - Fixed Version
import { auth, database, supabase } from './firebase-config.js';
import { showNotification } from './auth.js';
import {
  ref,
  push,
  set,
  get,
  query,
  orderByChild,
  limitToLast,
  onValue,
  off,
  serverTimestamp,
  update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const usersList = document.getElementById('usersList');
const privateList = document.getElementById('privateList');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const searchUsers = document.getElementById('searchUsers');
const chatUserName = document.getElementById('chatUserName');
const chatAvatar = document.getElementById('chatAvatar');
const chatUserStatus = document.getElementById('chatUserStatus');
const contactAdminBtn = document.getElementById('contactAdminBtn');
const createPrivateBtn = document.getElementById('createPrivateBtn');
const joinPrivateBtn = document.getElementById('joinPrivateBtn');
const chatInfoBtn = document.getElementById('chatInfoBtn');

// Tab management
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Global state
let currentChatId = null;
let currentChatType = 'user';
let messagesListener = null;
let messagesQuery = null;
let typingTimeout = null;
let usersListener = null;
let privateChatsListener = null;

// Initialize Chat
function initChat() {
  setupChatEventListeners();
  loadUsers();
  loadPrivateChats();
}

// Setup Event Listeners
function setupChatEventListeners() {
  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      const tabContent = document.getElementById(`${tabName}Tab`);
      if (tabContent) {
        tabContent.classList.add('active');
      }
    });
  });

  // Message sending
  sendBtn?.addEventListener('click', sendMessage);
  messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Typing indicator
  messageInput?.addEventListener('input', handleTyping);

  // Search users
  searchUsers?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterUsers(searchTerm);
  });

  // Private chat actions
  createPrivateBtn?.addEventListener('click', createPrivateChat);
  joinPrivateBtn?.addEventListener('click', showJoinPrivateModal);
  
  // Contact admin
  contactAdminBtn?.addEventListener('click', contactAdmin);
  
  // Chat info
  chatInfoBtn?.addEventListener('click', showChatInfo);
}

// Load Users
function loadUsers() {
  try {
    const usersRef = ref(database, 'users');
    
    // Remove existing listener
    if (usersListener) {
      off(usersRef, 'value', usersListener);
    }
    
    usersListener = onValue(usersRef, (snapshot) => {
      const users = [];
      snapshot.forEach((childSnapshot) => {
        const user = { ...childSnapshot.val(), uid: childSnapshot.key };
        if (user.uid !== auth.currentUser?.uid && !user.blocked) {
          users.push(user);
        }
      });

      // Sort by online status and name
      users.sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      displayUsers(users);
      window.appState.users = new Map(users.map(u => [u.uid, u]));
    }, (error) => {
      console.error('Load users error:', error);
      showNotification('Foydalanuvchilarni yuklashda xatolik', 'error');
    });
  } catch (error) {
    console.error('Load users error:', error);
    showNotification('Foydalanuvchilarni yuklashda xatolik', 'error');
  }
}

// Display Users
function displayUsers(users) {
  if (!usersList) return;

  if (users.length === 0) {
    usersList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
        <p>Foydalanuvchilar topilmadi</p>
      </div>
    `;
    return;
  }

  usersList.innerHTML = users.map(user => `
    <div class="user-item" data-uid="${user.uid}" onclick="window.selectChat('${user.uid}', 'user')">
      <div class="user-item-avatar">${user.avatar || user.name?.charAt(0) || 'U'}</div>
      <div class="user-item-info">
        <div class="user-item-name">${escapeHtml(user.name || 'Foydalanuvchi')}</div>
        <div class="user-item-message">
          <span class="status-dot ${user.online ? 'online' : 'offline'}"></span>
          ${user.online ? 'Online' : 'Offline'}
        </div>
      </div>
    </div>
  `).join('');
}

// Filter Users
function filterUsers(searchTerm) {
  const userItems = usersList?.querySelectorAll('.user-item');
  userItems?.forEach(item => {
    const name = item.querySelector('.user-item-name')?.textContent?.toLowerCase() || '';
    item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
  });
}

// Select Chat
window.selectChat = async function(chatId, type = 'user') {
  try {
    currentChatId = chatId;
    currentChatType = type;

    // Remove active class from all items
    document.querySelectorAll('.user-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-uid="${chatId}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
    }

    // Update chat header
    if (type === 'user') {
      const user = window.appState.users.get(chatId);
      if (user) {
        chatUserName.textContent = user.name || 'Foydalanuvchi';
        chatAvatar.textContent = user.avatar || 'U';
        chatUserStatus.textContent = user.online ? 'Online' : 'Offline';
        chatUserStatus.style.color = user.online ? 'var(--success)' : 'var(--text-secondary)';
      }
    } else if (type === 'private') {
      const chat = window.appState.privateChats.get(chatId);
      if (chat) {
        chatUserName.textContent = 'Shaxsiy chat';
        chatAvatar.textContent = '🔒';
        chatUserStatus.textContent = `${Object.keys(chat.members || {}).length} a'zo`;
      }
    } else if (type === 'admin') {
      chatUserName.textContent = 'Admin Qo\'llab-quvvatlash';
      chatAvatar.textContent = '👨‍💼';
      chatUserStatus.textContent = 'Mavjud';
    }

    // Load messages
    await loadMessages(chatId, type);

  } catch (error) {
    console.error('Select chat error:', error);
    showNotification('Chatni yuklashda xatolik', 'error');
  }
};

// Load Messages
async function loadMessages(chatId, type) {
  try {
    // Clear previous listener
    if (messagesQuery) {
      try { 
        off(messagesQuery); 
      } catch (err) { 
        console.warn('Could not detach previous listener:', err); 
      }
      messagesQuery = null;
      messagesListener = null;
    }

    // Clear messages container
    if (messagesContainer) {
      messagesContainer.innerHTML = '<div class="loading-messages">Xabarlar yuklanmoqda...</div>';
    }

    // Determine message path
    let messagesPath;
    if (type === 'user') {
      if (!auth.currentUser) {
        showNotification('Chatni ko\'rish uchun tizimga kiring', 'error');
        return;
      }
      const userId1 = auth.currentUser.uid;
      const userId2 = chatId;
      const chatPath = [userId1, userId2].sort().join('_');
      messagesPath = `chats/${chatPath}/messages`;
    } else if (type === 'private') {
      messagesPath = `privateChats/${chatId}/messages`;
    } else if (type === 'admin') {
      if (!auth.currentUser) {
        showNotification('Admin bilan bog\'lanish uchun tizimga kiring', 'error');
        return;
      }
      messagesPath = `support/${auth.currentUser.uid}/messages`;
    }

    messagesQuery = query(
      ref(database, messagesPath),
      orderByChild('timestamp'),
      limitToLast(50)
    );

    // Listen for messages
    messagesListener = onValue(messagesQuery, (snapshot) => {
      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });

      // Sort by timestamp
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      displayMessages(messages);
    }, (error) => {
      console.error('Messages listener error:', error);
      if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="no-messages">Xabarlarni yuklashda xatolik</div>';
      }
    });

  } catch (error) {
    console.error('Load messages error:', error);
    showNotification('Xabarlarni yuklashda xatolik', 'error');
  }
}

// Display Messages
function displayMessages(messages) {
  if (!messagesContainer) return;

  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">💬</div>
        <h2>Suhbatni boshlang</h2>
        <p>Xabar yuboring</p>
      </div>
    `;
    return;
  }

  const currentUserId = auth.currentUser?.uid;

  messagesContainer.innerHTML = messages.map(msg => {
    const isOwn = msg.senderId === currentUserId;
    const messageClass = isOwn ? 'message sent' : 'message received';
    
    return `
      <div class="${messageClass}">
        ${!isOwn ? `<div class="message-sender">${escapeHtml(msg.senderName || 'Foydalanuvchi')}</div>` : ''}
        <div class="message-content">${escapeHtml(msg.text || '')}</div>
        <div class="message-time" data-timestamp="${msg.timestamp || ''}">${formatTime(msg.timestamp)}</div>
      </div>
    `;
  }).join('');

  scrollToBottom();
}

// Send Message
async function sendMessage() {
  const text = messageInput?.value?.trim();

  if (!text) {
    return;
  }

  if (!auth.currentUser) {
    showNotification('Xabar yuborish uchun tizimga kiring', 'error');
    return;
  }

  if (!currentChatId) {
    showNotification('Avval chatni tanlang', 'error');
    return;
  }

  try {
    // Determine message path
    let messagesPath;
    if (currentChatType === 'user') {
      const userId1 = auth.currentUser.uid;
      const userId2 = currentChatId;
      const chatPath = [userId1, userId2].sort().join('_');
      messagesPath = `chats/${chatPath}/messages`;
    } else if (currentChatType === 'private') {
      messagesPath = `privateChats/${currentChatId}/messages`;
    } else if (currentChatType === 'admin') {
      messagesPath = `support/${auth.currentUser.uid}/messages`;

      // Create support ticket if doesn't exist
      const supportRef = ref(database, `support/${auth.currentUser.uid}`);
      const supportSnapshot = await get(supportRef);
      
      if (!supportSnapshot.exists()) {
        await set(supportRef, {
          userId: auth.currentUser.uid,
          userName: window.appState.currentUser?.name || 'Foydalanuvchi',
          userEmail: auth.currentUser.email,
          status: 'open',
          createdAt: serverTimestamp()
        });
      }
    }

    // Create message
    const message = {
      text: text,
      senderId: auth.currentUser.uid,
      senderName: window.appState.currentUser?.name || 'Foydalanuvchi',
      timestamp: Date.now()
    };

    // Push message
    await push(ref(database, messagesPath), message);

    // Clear input
    messageInput.value = '';

    // Clear typing indicator
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }

  } catch (error) {
    console.error('Send message error:', error);
    showNotification('Xabar yuborishda xatolik', 'error');
  }
}

// Handle Typing
function handleTyping() {
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  typingTimeout = setTimeout(() => {
    // Typing stopped
  }, 2000);
}

// Create Private Chat
async function createPrivateChat() {
  try {
    if (!auth.currentUser) {
      showNotification('Shaxsiy chat yaratish uchun tizimga kiring', 'error');
      return;
    }

    // Generate 8-digit code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Create private chat
    const chatData = {
      code: code,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      members: {
        [auth.currentUser.uid]: {
          name: window.appState.currentUser?.name || 'Foydalanuvchi',
          joinedAt: serverTimestamp()
        }
      }
    };

    await set(ref(database, `privateChats/${code}`), chatData);

    // Show code in modal
    const modal = document.getElementById('createPrivateModal');
    const overlay = document.getElementById('modalOverlay');
    const privateCode = document.getElementById('privateCode');

    if (modal && overlay && privateCode) {
      privateCode.textContent = code;
      overlay.classList.add('active');
      modal.classList.add('active');

      // Copy code button
      const copyBtn = document.getElementById('copyCodeBtn');
      copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(code).then(() => {
          showNotification('Kod nusxalandi!', 'success');
        }).catch(() => {
          showNotification('Nusxalashda xatolik', 'error');
        });
      });

      // Close modal handlers
      setupModalClose(modal, overlay);
    }

    showNotification('Shaxsiy chat yaratildi!', 'success');
    await loadPrivateChats();

  } catch (error) {
    console.error('Create private chat error:', error);
    showNotification('Chat yaratishda xatolik', 'error');
  }
}

// Show Join Private Modal
function showJoinPrivateModal() {
  const modal = document.getElementById('joinPrivateModal');
  const overlay = document.getElementById('modalOverlay');
  const joinCodeInput = document.getElementById('joinCode');
  const joinCodeBtn = document.getElementById('joinCodeBtn');

  if (!modal || !overlay) return;

  overlay.classList.add('active');
  modal.classList.add('active');

  // Join handler
  const handleJoin = async () => {
    const code = joinCodeInput?.value?.trim().toUpperCase();
    if (code && code.length >= 6) {
      await joinPrivateChat(code);
      modal.classList.remove('active');
      overlay.classList.remove('active');
      if (joinCodeInput) joinCodeInput.value = '';
    } else {
      showNotification('Iltimos, to\'g\'ri kod kiriting', 'error');
    }
  };

  joinCodeBtn?.addEventListener('click', handleJoin, { once: true });
  joinCodeInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleJoin();
  }, { once: true });

  setupModalClose(modal, overlay);
}

// Join Private Chat
async function joinPrivateChat(code) {
  try {
    if (!auth.currentUser) {
      showNotification('Chatga qo\'shilish uchun tizimga kiring', 'error');
      return;
    }

    const chatRef = ref(database, `privateChats/${code}`);
    const snapshot = await get(chatRef);

    if (!snapshot.exists()) {
      showNotification('Chat topilmadi', 'error');
      return;
    }

    const chatData = snapshot.val();
    const memberCount = Object.keys(chatData.members || {}).length;

    if (memberCount >= 15) {
      showNotification('Chat to\'la (maksimum 15 a\'zo)', 'error');
      return;
    }

    if (chatData.members && chatData.members[auth.currentUser.uid]) {
      showNotification('Siz allaqachon bu chatda borsiz', 'info');
      return;
    }

    // Add member
    await update(ref(database, `privateChats/${code}/members/${auth.currentUser.uid}`), {
      name: window.appState.currentUser?.name || 'Foydalanuvchi',
      joinedAt: serverTimestamp()
    });

    showNotification('Shaxsiy chatga qo\'shildingiz!', 'success');
    await loadPrivateChats();

  } catch (error) {
    console.error('Join private chat error:', error);
    showNotification('Chatga qo\'shilishda xatolik', 'error');
  }
}

// Load Private Chats
function loadPrivateChats() {
  try {
    const chatsRef = ref(database, 'privateChats');
    
    // Remove existing listener
    if (privateChatsListener) {
      off(chatsRef, 'value', privateChatsListener);
    }
    
    privateChatsListener = onValue(chatsRef, (snapshot) => {
      const chats = [];
      snapshot.forEach((childSnapshot) => {
        const chat = { code: childSnapshot.key, ...childSnapshot.val() };
        
        // Only show chats where user is a member
        if (chat.members && chat.members[auth.currentUser?.uid]) {
          chats.push(chat);
        }
      });

      displayPrivateChats(chats);
      window.appState.privateChats = new Map(chats.map(c => [c.code, c]));
    }, (error) => {
      console.error('Load private chats error:', error);
    });
  } catch (error) {
    console.error('Load private chats error:', error);
  }
}

// Display Private Chats
function displayPrivateChats(chats) {
  if (!privateList) return;

  if (chats.length === 0) {
    privateList.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
        <p>Shaxsiy chatlar yo'q</p>
        <p style="font-size: 12px; margin-top: 10px;">Yangi chat yarating yoki qo'shiling</p>
      </div>
    `;
    return;
  }

  privateList.innerHTML = chats.map(chat => {
    const memberCount = Object.keys(chat.members || {}).length;
    return `
      <div class="user-item" data-uid="${chat.code}" onclick="window.selectChat('${chat.code}', 'private')">
        <div class="user-item-avatar">🔒</div>
        <div class="user-item-info">
          <div class="user-item-name">Shaxsiy Chat</div>
          <div class="user-item-message">
            Kod: ${chat.code} • ${memberCount}/15 a'zo
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Contact Admin
function contactAdmin() {
  window.selectChat('admin_support', 'admin');
  showNotification('Adminga xabar yuborishingiz mumkin', 'info');
}

// Show Chat Info
async function showChatInfo() {
  const modal = document.getElementById('chatInfoModal');
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('chatInfoContent');

  if (!currentChatId || !modal || !overlay || !content) return;

  let infoHTML = '';

  if (currentChatType === 'user') {
    const user = window.appState.users.get(currentChatId);
    if (user) {
      infoHTML = `
        <div style="text-align: center;">
          <div style="width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 50%; 
                      background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
                      display: flex; align-items: center; justify-content: center;
                      font-size: 32px; font-weight: 700;">
            ${user.avatar || 'U'}
          </div>
          <h3 style="margin-bottom: 5px;">${escapeHtml(user.name || 'Foydalanuvchi')}</h3>
          <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 20px;">
            ${escapeHtml(user.email || 'Email yo\'q')}
          </p>
          <div style="padding: 15px; background: rgba(0, 243, 255, 0.05); border-radius: 10px; 
                      border: 1px solid var(--border-color); text-align: left;">
            <p style="margin-bottom: 10px;"><strong>Holat:</strong> 
              <span style="color: ${user.online ? 'var(--success)' : 'var(--text-secondary)'};">
                ${user.online ? 'Online' : 'Offline'}
              </span>
            </p>
            <p style="margin-bottom: 10px;"><strong>Telefon:</strong> ${user.phone || 'Ko\'rsatilmagan'}</p>
            <p><strong>Ro'yxatdan o'tgan:</strong> ${user.createdAt ? formatDate(user.createdAt) : 'Noma\'lum'}</p>
          </div>
        </div>
      `;
    }
  } else if (currentChatType === 'private') {
    const chat = window.appState.privateChats.get(currentChatId);
    if (chat) {
      const members = Object.entries(chat.members || {});
      infoHTML = `
        <div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 50%; 
                        background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink));
                        display: flex; align-items: center; justify-content: center; font-size: 32px;">
              🔒
            </div>
            <h3>Shaxsiy Chat</h3>
            <p style="color: var(--text-secondary); margin: 10px 0;">Kod: <strong>${chat.code}</strong></p>
            <p style="color: var(--text-secondary); font-size: 14px;">${members.length}/15 a'zo</p>
          </div>
          <div style="padding: 15px; background: rgba(157, 0, 255, 0.05); border-radius: 10px; 
                      border: 1px solid var(--border-color);">
            <h4 style="margin-bottom: 15px;">A'zolar</h4>
            ${members.map(([uid, data]) => `
              <div style="padding: 10px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.02);
                          border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                <div style="width: 35px; height: 35px; border-radius: 50%;
                            background: linear-gradient(135deg, var(--neon-blue), var(--neon-green));
                            display: flex; align-items: center; justify-content: center; font-weight: 600;">
                  ${data.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style="font-weight: 600;">${escapeHtml(data.name || 'Foydalanuvchi')}</div>
                  <div style="font-size: 12px; color: var(--text-secondary);">
                    Qo'shilgan: ${data.joinedAt ? formatDate(data.joinedAt) : 'yaqinda'}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  content.innerHTML = infoHTML;
  overlay.classList.add('active');
  modal.classList.add('active');

  setupModalClose(modal, overlay);
}

// Setup Modal Close
function setupModalClose(modal, overlay) {
  const closeButtons = modal.querySelectorAll('.close-modal');
  closeButtons.forEach(btn => {
    btn.onclick = () => {
      modal.classList.remove('active');
      overlay.classList.remove('active');
    };
  });

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
      overlay.classList.remove('active');
    }
  };
}

// Utility Functions
function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function formatTime(timestamp) {
  if (!timestamp) return 'Hozir';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Hozir';
  if (diffMins < 60) return `${diffMins} daqiqa oldin`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} soat oldin`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} kun oldin`;

  return date.toLocaleDateString('uz-UZ');
}

function formatDate(timestamp) {
  if (!timestamp) return 'Noma\'lum';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Export loadChatData function
window.loadChatData = function() {
  initChat();
};

// Create a local binding for selectChat
const selectChat = window.selectChat;

export {
  initChat,
  sendMessage,
  selectChat,
  createPrivateChat,
  joinPrivateChat,
  loadUsers,
  loadPrivateChats,
  formatTime,
  formatDate
};
