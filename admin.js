// Admin Panel Module - Fixed Version
import { database, supabase } from './firebase-config.js';
import { showNotification } from './auth.js';
import {
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  push,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// DOM Elements
const adminMenuItems = document.querySelectorAll('.admin-menu-item');
const adminSections = document.querySelectorAll('.admin-section');
const adminUsersList = document.getElementById('adminUsersList');
const adminSearchUsers = document.getElementById('adminSearchUsers');
const supportMessagesList = document.getElementById('supportMessagesList');
const adminPrivateList = document.getElementById('adminPrivateList');
const recentActivity = document.getElementById('recentActivity');

// Stats elements
const totalUsersEl = document.getElementById('totalUsers');
const totalMessagesEl = document.getElementById('totalMessages');
const onlineUsersEl = document.getElementById('onlineUsers');
const privateChatsEl = document.getElementById('privateChats');

// Settings
const maintenanceMode = document.getElementById('maintenanceMode');
const allowRegistrations = document.getElementById('allowRegistrations');
const autoDeleteDays = document.getElementById('autoDeleteDays');

// Global state
let allUsers = [];
let allSupportMessages = [];
let allPrivateChats = [];

// Initialize Admin Panel
function initAdmin() {
  setupAdminEventListeners();
}

// Setup Event Listeners
function setupAdminEventListeners() {
  // Menu navigation
  adminMenuItems?.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      
      adminMenuItems.forEach(i => i.classList.remove('active'));
      adminSections.forEach(s => s.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(`${section}Section`)?.classList.add('active');
      
      // Load section data
      if (section === 'dashboard') {
        loadDashboardStats();
        loadRecentActivity();
      }
      if (section === 'users') loadAdminUsers();
      if (section === 'messages') loadSupportMessages();
      if (section === 'private') loadAdminPrivateChats();
    });
  });

  // Search users
  adminSearchUsers?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterAdminUsers(searchTerm);
  });

  // Settings
  maintenanceMode?.addEventListener('change', saveMaintenance);
  allowRegistrations?.addEventListener('change', saveRegistrationSettings);
  autoDeleteDays?.addEventListener('change', saveAutoDelete);
}

// Load Admin Data - called when admin logs in
window.loadAdminData = async function() {
  try {
    console.log('Loading admin data...');
    await Promise.all([
      loadDashboardStats(),
      loadRecentActivity(),
      loadAdminUsers()
    ]);
    console.log('Admin data loaded successfully');
  } catch (error) {
    console.error('Load admin data error:', error);
    showNotification('Admin ma\'lumotlarini yuklashda xatolik', 'error');
  }
};

// Load Dashboard Stats
async function loadDashboardStats() {
  try {
    // Load users
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    const users = [];
    let onlineCount = 0;
    
    usersSnapshot.forEach((child) => {
      const user = child.val();
      users.push(user);
      if (user.online) onlineCount++;
    });

    if (totalUsersEl) totalUsersEl.textContent = users.length;
    if (onlineUsersEl) onlineUsersEl.textContent = onlineCount;

    // Load messages count (today)
    const chatsRef = ref(database, 'chats');
    const chatsSnapshot = await get(chatsRef);
    let messageCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    chatsSnapshot.forEach((chatChild) => {
      const chatData = chatChild.val();
      if (chatData && chatData.messages) {
        Object.values(chatData.messages).forEach(msg => {
          if (msg.timestamp && msg.timestamp >= todayTimestamp) {
            messageCount++;
          }
        });
      }
    });

    if (totalMessagesEl) totalMessagesEl.textContent = messageCount;

    // Load private chats count
    const privateRef = ref(database, 'privateChats');
    const privateSnapshot = await get(privateRef);
    let privateChatCount = 0;
    privateSnapshot.forEach(() => privateChatCount++);

    if (privateChatsEl) privateChatsEl.textContent = privateChatCount;

  } catch (error) {
    console.error('Load stats error:', error);
  }
}

// Load Recent Activity
async function loadRecentActivity() {
  try {
    const activities = [];

    // Get recent user registrations
    const usersRef = ref(database, 'users');
    const usersSnapshot = await get(usersRef);
    
    usersSnapshot.forEach((child) => {
      const user = child.val();
      if (user.createdAt) {
        activities.push({
          type: 'registration',
          icon: '👤',
          text: `${user.name || 'Foydalanuvchi'} ro'yxatdan o'tdi`,
          timestamp: user.createdAt
        });
      }
    });

    // Get recent support messages
    const supportRef = ref(database, 'support');
    const supportSnapshot = await get(supportRef);
    
    supportSnapshot.forEach((child) => {
      const ticket = child.val();
      if (ticket.createdAt) {
        activities.push({
          type: 'support',
          icon: '💬',
          text: `${ticket.userName || 'Foydalanuvchi'} qo'llab-quvvatlashga murojaat qildi`,
          timestamp: ticket.createdAt
        });
      }
    });

    // Sort by timestamp and get last 10
    activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const recentActivities = activities.slice(0, 10);

    displayRecentActivity(recentActivities);

  } catch (error) {
    console.error('Load activity error:', error);
  }
}

// Display Recent Activity
function displayRecentActivity(activities) {
  if (!recentActivity) return;

  if (activities.length === 0) {
    recentActivity.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">Faoliyat yo\'q</p>';
    return;
  }

  recentActivity.innerHTML = activities.map(activity => `
    <div class="activity-item" style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">${activity.icon}</span>
        <p style="margin: 0;">${activity.text}</p>
      </div>
      <span class="activity-time" style="font-size: 12px; color: var(--text-secondary);">${formatTimeAgo(activity.timestamp)}</span>
    </div>
  `).join('');
}

// Load Admin Users
async function loadAdminUsers() {
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    allUsers = [];
    snapshot.forEach((child) => {
      allUsers.push({ ...child.val(), uid: child.key });
    });

    // Sort by createdAt (newest first)
    allUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    displayAdminUsers(allUsers);

  } catch (error) {
    console.error('Load admin users error:', error);
    showNotification('Foydalanuvchilarni yuklashda xatolik', 'error');
  }
}

// Display Admin Users
function displayAdminUsers(users) {
  if (!adminUsersList) return;

  if (users.length === 0) {
    adminUsersList.innerHTML = '<p style="padding: 40px; text-align: center; color: var(--text-secondary);">Foydalanuvchilar topilmadi</p>';
    return;
  }

  adminUsersList.innerHTML = users.map(user => `
    <div class="admin-user-item" style="padding: 15px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div class="admin-user-info" style="display: flex; align-items: center; gap: 15px;">
        <div class="admin-user-avatar" style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px;">
          ${user.avatar || user.name?.charAt(0) || 'U'}
        </div>
        <div class="admin-user-details">
          <h4 style="margin: 0 0 5px 0; display: flex; align-items: center; gap: 8px;">
            ${user.name || 'Foydalanuvchi'}
            ${user.online ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--success); display: inline-block;"></span>' : ''}
            ${user.blocked ? '<span style="color: var(--danger); font-size: 12px;">(Bloklangan)</span>' : ''}
          </h4>
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">${user.email || 'Email yo\'q'}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: var(--text-secondary);">
            📱 ${user.phone || 'Telefon yo\'q'} • 
            📅 ${formatDate(user.createdAt)} • 
            ⏰ ${formatTimeAgo(user.lastSeen)}
          </p>
        </div>
      </div>
      <div class="admin-user-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="admin-action-btn" onclick="window.viewUserDetails('${user.uid}')" 
                style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0, 243, 255, 0.1); color: var(--neon-blue); cursor: pointer; font-weight: 600; transition: all 0.3s;">
          👁️ Ko'rish
        </button>
        <button class="admin-action-btn ${user.blocked ? 'unblock' : 'block'}" 
                onclick="window.toggleBlockUser('${user.uid}', ${!user.blocked})"
                style="padding: 8px 16px; border-radius: 8px; border: 1px solid ${user.blocked ? 'var(--success)' : 'var(--warning)'}; background: ${user.blocked ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 165, 2, 0.1)'}; color: ${user.blocked ? 'var(--success)' : 'var(--warning)'}; cursor: pointer; font-weight: 600; transition: all 0.3s;">
          ${user.blocked ? '✅ Blokdan chiqarish' : '🚫 Bloklash'}
        </button>
        <button class="admin-action-btn danger" onclick="window.deleteUser('${user.uid}')"
                style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--danger); background: rgba(255, 71, 87, 0.1); color: var(--danger); cursor: pointer; font-weight: 600; transition: all 0.3s;">
          🗑️ O'chirish
        </button>
      </div>
    </div>
  `).join('');
}

// Filter Admin Users
function filterAdminUsers(searchTerm) {
  const filtered = allUsers.filter(user => {
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const phone = (user.phone || '').toLowerCase();
    return name.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm);
  });
  displayAdminUsers(filtered);
}

// Toggle Block User
window.toggleBlockUser = async function(uid, block) {
  try {
    await update(ref(database, `users/${uid}`), {
      blocked: block
    });

    // Update in Supabase
    await supabase.update('users', uid, { blocked: block });

    showNotification(`Foydalanuvchi ${block ? 'bloklandi' : 'blokdan chiqarildi'}`, 'success');
    await loadAdminUsers();
    await loadDashboardStats();

  } catch (error) {
    console.error('Toggle block error:', error);
    showNotification('Foydalanuvchi holatini o\'zgartirishda xatolik', 'error');
  }
};

// Delete User
window.deleteUser = async function(uid) {
  if (!confirm('Haqiqatan ham bu foydalanuvchini o\'chirmoqchimisiz? Bu amalni ortga qaytarib bo\'lmaydi.')) {
    return;
  }

  try {
    // Delete from Firebase
    await remove(ref(database, `users/${uid}`));

    // Delete from Supabase
    await supabase.delete('users', uid);

    showNotification('Foydalanuvchi o\'chirildi', 'success');
    await loadAdminUsers();
    await loadDashboardStats();

  } catch (error) {
    console.error('Delete user error:', error);
    showNotification('Foydalanuvchini o\'chirishda xatolik', 'error');
  }
};

// View User Details
window.viewUserDetails = async function(uid) {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      showNotification('Foydalanuvchi topilmadi', 'error');
      return;
    }

    const user = snapshot.val();
    const modal = document.getElementById('userDetailsModal');
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('userDetailsContent');

    if (!modal || !overlay || !content) return;

    content.innerHTML = `
      <div style="text-align: center;">
        <div style="width: 100px; height: 100px; margin: 0 auto 20px; border-radius: 50%;
                    background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple));
                    display: flex; align-items: center; justify-content: center;
                    font-size: 40px; font-weight: 700;">
          ${user.avatar || user.name?.charAt(0) || 'U'}
        </div>
        <h3 style="margin-bottom: 10px;">${user.name || 'Foydalanuvchi'}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 25px;">${user.email || 'Email yo\'q'}</p>
      </div>
      
      <div style="background: rgba(0, 243, 255, 0.05); border-radius: 12px; padding: 20px;
                  border: 1px solid var(--border-color); margin-bottom: 15px;">
        <h4 style="margin-bottom: 15px;">Foydalanuvchi ma'lumotlari</h4>
        <div style="display: grid; gap: 12px;">
          <div><strong>ID:</strong> <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 12px;">${user.uid || uid}</code></div>
          <div><strong>Telefon:</strong> ${user.phone || 'Kiritilmagan'} ${user.phoneVerified ? '✅' : '❌'}</div>
          <div><strong>Holat:</strong> 
            <span style="color: ${user.online ? 'var(--success)' : 'var(--text-secondary)'};">
              ${user.online ? '🟢 Online' : '⚪ Offline'}
            </span>
          </div>
          <div><strong>Hisob holati:</strong> 
            <span style="color: ${user.blocked ? 'var(--danger)' : 'var(--success)'};">
              ${user.blocked ? '🚫 Bloklangan' : '✅ Faol'}
            </span>
          </div>
          <div><strong>Ro'yxatdan o'tgan:</strong> ${formatDate(user.createdAt)}</div>
          <div><strong>Oxirgi faollik:</strong> ${formatTimeAgo(user.lastSeen)}</div>
          <div><strong>Provider:</strong> ${user.provider || 'Email/Parol'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="neon-button" style="flex: 1; min-width: 120px;" onclick="window.messageUser('${uid}')">
          💬 Xabar yuborish
        </button>
        <button style="flex: 1; min-width: 120px; padding: 12px; border-radius: 12px; border: 1px solid ${user.blocked ? 'var(--success)' : 'var(--danger)'}; background: ${user.blocked ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 71, 87, 0.1)'}; color: ${user.blocked ? 'var(--success)' : 'var(--danger)'}; cursor: pointer; font-weight: 600;" 
                onclick="window.toggleBlockUser('${uid}', ${!user.blocked}); document.getElementById('userDetailsModal').classList.remove('active'); document.getElementById('modalOverlay').classList.remove('active');">
          ${user.blocked ? '✅ Blokdan chiqarish' : '🚫 Bloklash'}
        </button>
      </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    // Close handlers
    setupModalClose(modal, overlay);

  } catch (error) {
    console.error('View user details error:', error);
    showNotification('Foydalanuvchi ma\'lumotlarini yuklashda xatolik', 'error');
  }
};

// Message User (from admin)
window.messageUser = function(uid) {
  showNotification('Bu xususiyat tez orada qo\'shiladi', 'info');
};

// Load Support Messages
async function loadSupportMessages() {
  try {
    const supportRef = ref(database, 'support');
    const snapshot = await get(supportRef);
    
    allSupportMessages = [];
    snapshot.forEach((child) => {
      const ticket = { id: child.key, ...child.val() };
      allSupportMessages.push(ticket);
    });

    // Sort by newest first
    allSupportMessages.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    displaySupportMessages(allSupportMessages);

  } catch (error) {
    console.error('Load support messages error:', error);
    showNotification('Qo\'llab-quvvatlash xabarlarini yuklashda xatolik', 'error');
  }
}

// Display Support Messages
function displaySupportMessages(messages) {
  if (!supportMessagesList) return;

  if (messages.length === 0) {
    supportMessagesList.innerHTML = `
      <p style="padding: 40px; text-align: center; color: var(--text-secondary);">
        Qo'llab-quvvatlash xabarlari yo'q
      </p>
    `;
    return;
  }

  supportMessagesList.innerHTML = messages.map(ticket => {
    const latestMessage = ticket.messages ? Object.values(ticket.messages).pop() : null;
    const messageCount = ticket.messages ? Object.keys(ticket.messages).length : 0;
    
    return `
      <div class="support-message-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 15px;">
        <div class="support-message-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div class="support-message-user" style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-purple), var(--neon-pink)); display: flex; align-items: center; justify-content: center; font-weight: 700;">
              ${ticket.userName?.charAt(0) || 'U'}
            </div>
            <div>
              <h4 style="margin: 0 0 5px 0;">${ticket.userName || 'Foydalanuvchi'}</h4>
              <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">${ticket.userEmail || ''}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 12px; color: var(--text-secondary);">${messageCount} xabar</span>
            <span style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
                         background: ${ticket.status === 'open' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(160, 174, 192, 0.1)'};
                         color: ${ticket.status === 'open' ? 'var(--success)' : 'var(--text-secondary)'};">
              ${ticket.status === 'open' ? '🟢 Ochiq' : '⚪ Yopiq'}
            </span>
          </div>
        </div>
        
        ${latestMessage ? `
          <div class="support-message-text" style="background: rgba(0, 0, 0, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <strong>${latestMessage.senderName || 'Foydalanuvchi'}:</strong> ${latestMessage.text || ''}
          </div>
        ` : '<p style="color: var(--text-secondary); margin-bottom: 15px;">Xabar yo\'q</p>'}
        
        <div class="support-message-reply" style="display: flex; gap: 10px; margin-bottom: 15px;">
          <input type="text" 
                 id="reply-${ticket.id}" 
                 placeholder="Javob yozing..." 
                 class="neon-input"
                 style="flex: 1;">
          <button class="neon-button" style="width: auto; padding: 12px 24px;"
                  onclick="window.replyToSupport('${ticket.id}')">
            Yuborish
          </button>
        </div>
        
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="admin-action-btn" onclick="window.viewSupportMessages('${ticket.id}')"
                  style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0, 243, 255, 0.1); color: var(--neon-blue); cursor: pointer; font-weight: 600;">
            📋 Barcha xabarlar
          </button>
          <button class="admin-action-btn" onclick="window.closeSupportTicket('${ticket.id}')"
                  style="padding: 8px 16px; border-radius: 8px; border: 1px solid ${ticket.status === 'open' ? 'var(--warning)' : 'var(--success)'}; background: ${ticket.status === 'open' ? 'rgba(255, 165, 2, 0.1)' : 'rgba(0, 255, 136, 0.1)'}; color: ${ticket.status === 'open' ? 'var(--warning)' : 'var(--success)'}; cursor: pointer; font-weight: 600;">
            ${ticket.status === 'open' ? '🔒 Yopish' : '🔓 Qayta ochish'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Reply to Support
window.replyToSupport = async function(ticketId) {
  const input = document.getElementById(`reply-${ticketId}`);
  const text = input?.value.trim();

  if (!text) {
    showNotification('Iltimos, xabar yozing', 'error');
    return;
  }

  try {
    const message = {
      text: text,
      senderId: 'admin',
      senderName: 'Administrator',
      timestamp: Date.now()
    };

    await push(ref(database, `support/${ticketId}/messages`), message);
    
    if (input) input.value = '';
    showNotification('Javob yuborildi!', 'success');
    await loadSupportMessages();

  } catch (error) {
    console.error('Reply error:', error);
    showNotification('Javob yuborishda xatolik', 'error');
  }
};

// View Support Messages
window.viewSupportMessages = async function(ticketId) {
  try {
    const ticketRef = ref(database, `support/${ticketId}`);
    const snapshot = await get(ticketRef);
    
    if (!snapshot.exists()) {
      showNotification('Ticket topilmadi', 'error');
      return;
    }

    const ticket = snapshot.val();
    const messages = ticket.messages ? Object.values(ticket.messages) : [];
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const modal = document.getElementById('chatInfoModal');
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('chatInfoContent');

    if (!modal || !overlay || !content) return;

    content.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h4>Foydalanuvchi: ${ticket.userName || 'Noma\'lum'}</h4>
        <p style="color: var(--text-secondary);">Email: ${ticket.userEmail || 'Noma\'lum'}</p>
      </div>
      <div style="max-height: 400px; overflow-y: auto;">
        ${messages.length === 0 ? '<p style="color: var(--text-secondary);">Xabarlar yo\'q</p>' : 
          messages.map(msg => `
            <div style="padding: 12px; margin-bottom: 10px; border-radius: 12px; background: ${msg.senderId === 'admin' ? 'rgba(0, 243, 255, 0.1)' : 'rgba(157, 0, 255, 0.1)'}; ${msg.senderId === 'admin' ? 'margin-left: 20px;' : 'margin-right: 20px;'}">
              <div style="font-weight: 600; margin-bottom: 5px; color: ${msg.senderId === 'admin' ? 'var(--neon-blue)' : 'var(--neon-purple)'};">
                ${msg.senderName || 'Foydalanuvchi'}
              </div>
              <div>${msg.text || ''}</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px; text-align: right;">
                ${formatTimeAgo(msg.timestamp)}
              </div>
            </div>
          `).join('')
        }
      </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    setupModalClose(modal, overlay);

  } catch (error) {
    console.error('View support messages error:', error);
    showNotification('Xabarlarni yuklashda xatolik', 'error');
  }
};

// Close Support Ticket
window.closeSupportTicket = async function(ticketId) {
  try {
    const ticketRef = ref(database, `support/${ticketId}`);
    const snapshot = await get(ticketRef);
    
    if (snapshot.exists()) {
      const currentStatus = snapshot.val().status;
      const newStatus = currentStatus === 'open' ? 'closed' : 'open';
      
      await update(ticketRef, { status: newStatus });
      showNotification(`Ticket ${newStatus === 'open' ? 'ochildi' : 'yopildi'}`, 'success');
      await loadSupportMessages();
    }

  } catch (error) {
    console.error('Close ticket error:', error);
    showNotification('Ticket holatini o\'zgartirishda xatolik', 'error');
  }
};

// Load Admin Private Chats
async function loadAdminPrivateChats() {
  try {
    const chatsRef = ref(database, 'privateChats');
    const snapshot = await get(chatsRef);
    
    allPrivateChats = [];
    snapshot.forEach((child) => {
      allPrivateChats.push({ code: child.key, ...child.val() });
    });

    displayAdminPrivateChats(allPrivateChats);

  } catch (error) {
    console.error('Load private chats error:', error);
    showNotification('Shaxsiy chatlarni yuklashda xatolik', 'error');
  }
}

// Display Admin Private Chats
function displayAdminPrivateChats(chats) {
  if (!adminPrivateList) return;

  if (chats.length === 0) {
    adminPrivateList.innerHTML = `
      <p style="padding: 40px; text-align: center; color: var(--text-secondary);">
        Shaxsiy chatlar yo'q
      </p>
    `;
    return;
  }

  adminPrivateList.innerHTML = chats.map(chat => {
    const memberCount = chat.members ? Object.keys(chat.members).length : 0;
    const creatorName = chat.members && chat.createdBy ? 
                        chat.members[chat.createdBy]?.name || 'Noma\'lum' : 'Noma\'lum';
    
    return `
      <div class="private-chat-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div class="private-chat-code" style="font-size: 24px; font-weight: 700; color: var(--neon-blue); font-family: monospace; letter-spacing: 2px;">
            🔒 ${chat.code}
          </div>
          <span style="font-size: 14px; color: var(--text-secondary);">${memberCount}/15 a'zo</span>
        </div>
        <div class="private-chat-info" style="margin-bottom: 15px; color: var(--text-secondary);">
          <p style="margin: 5px 0;"><strong>Yaratuvchi:</strong> ${creatorName}</p>
          <p style="margin: 5px 0;"><strong>Yaratilgan:</strong> ${formatDate(chat.createdAt)}</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="admin-action-btn" onclick="window.viewPrivateChatMembers('${chat.code}')"
                  style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0, 243, 255, 0.1); color: var(--neon-blue); cursor: pointer; font-weight: 600;">
            👥 A'zolar
          </button>
          <button class="admin-action-btn danger" onclick="window.deletePrivateChat('${chat.code}')"
                  style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--danger); background: rgba(255, 71, 87, 0.1); color: var(--danger); cursor: pointer; font-weight: 600;">
            🗑️ O'chirish
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// View Private Chat Members
window.viewPrivateChatMembers = function(code) {
  const chat = allPrivateChats.find(c => c.code === code);
  if (!chat || !chat.members) {
    showNotification('A\'zolar topilmadi', 'error');
    return;
  }

  const modal = document.getElementById('chatInfoModal');
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('chatInfoContent');

  if (!modal || !overlay || !content) return;

  const members = Object.entries(chat.members);
  
  content.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 40px; margin-bottom: 10px;">🔒</div>
      <h3>Shaxsiy Chat</h3>
      <p style="color: var(--neon-blue); font-family: monospace; font-size: 20px; margin: 10px 0;">${code}</p>
      <p style="color: var(--text-secondary);">${members.length}/15 a'zo</p>
    </div>
    <div style="max-height: 300px; overflow-y: auto;">
      ${members.map(([uid, data]) => `
        <div style="padding: 12px; margin-bottom: 8px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-blue), var(--neon-green)); display: flex; align-items: center; justify-content: center; font-weight: 700;">
            ${data.name?.charAt(0) || 'U'}
          </div>
          <div>
            <div style="font-weight: 600;">${data.name || 'Foydalanuvchi'}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Qo'shilgan: ${formatDate(data.joinedAt)}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  overlay.classList.add('active');
  modal.classList.add('active');

  setupModalClose(modal, overlay);
};

// Delete Private Chat
window.deletePrivateChat = async function(code) {
  if (!confirm('Bu shaxsiy chatni o\'chirmoqchimisiz? Barcha xabarlar yo\'qoladi.')) {
    return;
  }

  try {
    await remove(ref(database, `privateChats/${code}`));
    
    showNotification('Shaxsiy chat o\'chirildi', 'success');
    await loadAdminPrivateChats();
    await loadDashboardStats();

  } catch (error) {
    console.error('Delete private chat error:', error);
    showNotification('Chatni o\'chirishda xatolik', 'error');
  }
};

// Settings functions
async function saveMaintenance() {
  try {
    const enabled = maintenanceMode?.checked || false;
    await set(ref(database, 'settings/maintenance'), enabled);
    showNotification('Texnik xizmat rejimi yangilandi', 'success');
  } catch (error) {
    console.error('Save maintenance error:', error);
    showNotification('Sozlamalarni saqlashda xatolik', 'error');
  }
}

async function saveRegistrationSettings() {
  try {
    const enabled = allowRegistrations?.checked || false;
    await set(ref(database, 'settings/allowRegistrations'), enabled);
    showNotification('Ro\'yxatdan o\'tish sozlamalari yangilandi', 'success');
  } catch (error) {
    console.error('Save registration error:', error);
    showNotification('Sozlamalarni saqlashda xatolik', 'error');
  }
}

async function saveAutoDelete() {
  try {
    const days = parseInt(autoDeleteDays?.value) || 30;
    await set(ref(database, 'settings/autoDeleteDays'), days);
    showNotification('Avtomatik o\'chirish sozlamalari yangilandi', 'success');
  } catch (error) {
    console.error('Save auto-delete error:', error);
    showNotification('Sozlamalarni saqlashda xatolik', 'error');
  }
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
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Noma\'lum';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Hozirgina';
  if (diffMins < 60) return `${diffMins} daqiqa oldin`;
  if (diffHours < 24) return `${diffHours} soat oldin`;
  if (diffDays < 7) return `${diffDays} kun oldin`;
  
  return formatDate(timestamp);
}

function formatDate(timestamp) {
  if (!timestamp) return 'Noma\'lum';
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Initialize admin panel when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

export { initAdmin, loadAdminUsers, loadSupportMessages, loadAdminPrivateChats };
