/**
 * 밥먹었냥 - Main App JavaScript Logic
 * Cozy Meadow Design System, Google Sign-In & Supabase Realtime DB Integration
 */

const SUPABASE_URL = 'https://huaoxysnywpmsqiystiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1YW94eXNueXdwbXNxaXlzdGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NDI2MTMsImV4cCI6MjEwNDQxODYxM30.fTO3xG2tkCJbUKONHuAQ5aWx7YwdLEqhi8sehJuAQVk';

let supabaseClient = null;
try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase Realtime Client Initialized! 🐾');
  }
} catch (e) {
  console.warn('Supabase client init failed:', e);
}

const STORAGE_KEY_RECORDS = 'BATMEOKGOTNYANG_RECORDS';
const STORAGE_KEY_USER = 'BATMEOKGOTNYANG_GOOGLE_USER';

// State Variables
let records = [];
let currentUser = {
  name: '치즈돌봄이',
  email: '',
  picture: ''
};
let currentFilter = 'all'; // 'all', 'feeding', 'sighting'
let currentRecordTab = 'feeding'; // 'feeding', 'sighting'
let selectedPhotoBase64 = null;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  initRecords();
  initFormDateTime();
  initGoogleAuth();
  renderApp();
});

/* ==========================================================================
   1. User & Storage Initialization
   ========================================================================== */

function initUser() {
  const saved = localStorage.getItem(STORAGE_KEY_USER);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        currentUser = parsed;
      } else if (typeof parsed === 'string') {
        currentUser = { name: parsed, email: '', picture: '' };
      }
    } catch (e) {
      currentUser = { name: saved, email: '', picture: '' };
    }
  } else {
    currentUser = { name: '치즈돌봄이', email: '', picture: '' };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
  }
  renderUserUI();
}

function renderUserUI() {
  const nameEl = document.getElementById('header-user-name');
  const avatarEl = document.getElementById('header-user-avatar');
  const modalNameEl = document.getElementById('modal-user-name');
  const modalEmailEl = document.getElementById('modal-user-email');
  const modalAvatarEl = document.getElementById('modal-user-avatar');

  const cardNameEl = document.getElementById('modal-card-name');
  const cardEmailEl = document.getElementById('modal-card-email');
  const cardAvatarEl = document.getElementById('modal-card-avatar');
  const logoutBtn = document.getElementById('google-logout-btn');

  const displayName = currentUser && currentUser.name ? currentUser.name : 'Google 로그인';
  const displayEmail = currentUser && currentUser.email ? currentUser.email : (currentUser && currentUser.name ? 'Google 계정 로그인됨' : '로그인이 필요합니다');

  if (nameEl) nameEl.textContent = displayName.length > 7 ? displayName.slice(0, 6) + '..' : displayName;
  
  const googleLogoSVG = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>`;

  const avatarHTML = (currentUser && currentUser.picture)
    ? `<img src="${currentUser.picture}" class="w-full h-full object-cover">`
    : (currentUser && currentUser.name ? `<span class="font-bold text-xs">${currentUser.name.charAt(0)}</span>` : googleLogoSVG);

  if (avatarEl) avatarEl.innerHTML = avatarHTML;
  if (modalNameEl) modalNameEl.textContent = currentUser && currentUser.name ? `${currentUser.name}님` : 'Google 로그인 필요';
  if (modalEmailEl) modalEmailEl.textContent = displayEmail;
  if (modalAvatarEl) modalAvatarEl.innerHTML = avatarHTML;

  if (cardNameEl) cardNameEl.textContent = currentUser && currentUser.name ? `${currentUser.name}님` : '로그인 안 됨';
  if (cardEmailEl) cardEmailEl.textContent = displayEmail;
  if (cardAvatarEl) cardAvatarEl.innerHTML = (currentUser && currentUser.picture) ? `<img src="${currentUser.picture}" class="w-full h-full object-cover">` : (currentUser && currentUser.name ? currentUser.name.charAt(0) : 'G');

  if (logoutBtn) {
    if (currentUser && currentUser.name && currentUser.name !== '치즈돌봄이') {
      logoutBtn.classList.remove('hidden');
    } else {
      logoutBtn.classList.add('hidden');
    }
  }
}

async function initRecords() {
  // 1. Load from local cache for instant offline rendering
  const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
  if (saved) {
    try {
      records = JSON.parse(saved);
      records.forEach(r => {
        const photoKey = STORAGE_KEY_RECORDS + '_photo_' + r.id;
        const savedPhoto = localStorage.getItem(photoKey);
        if (savedPhoto) r.photo = savedPhoto;
      });
    } catch (e) {
      records = [];
    }
  }

  if (!records || records.length === 0) {
    records = generateDemoRecords();
    saveLocalCache();
  }
  renderApp();

  // 2. Sync from Supabase Cloud DB
  if (supabaseClient) {
    await fetchCloudRecords();
    subscribeToRealtime();
  } else {
    updateSyncBadge('local');
  }
}

function updateSyncBadge(status) {
  const badge = document.getElementById('cloud-sync-badge');
  if (!badge) return;
  if (status === 'connected') {
    badge.className = 'inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-300 shadow-xs';
    badge.textContent = '☁️ 실시간';
  } else if (status === 'loading') {
    badge.className = 'inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-xs animate-pulse';
    badge.textContent = '☁️ 동기화 중';
  } else {
    badge.className = 'inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-xs';
    badge.textContent = '💾 로컬 저장';
  }
}

function dbRowToRecord(row) {
  return {
    id: String(row.id),
    type: row.type,
    author: row.author,
    time: row.time,
    foodType: row.food_type || '사료',
    foodTypes: row.food_type ? row.food_type.split(', ') : ['사료'],
    catSeen: row.cat_seen !== false,
    sightingStatus: row.sighting_status || '건강해 보여요',
    memo: row.memo || '',
    photo: row.photo || null,
    createdAt: row.created_at || row.time
  };
}

function recordToDbRow(rec) {
  return {
    id: String(rec.id),
    type: rec.type,
    author: rec.author || '치즈돌봄이',
    time: rec.time,
    food_type: rec.foodType || (rec.foodTypes ? rec.foodTypes.join(', ') : '사료'),
    cat_seen: rec.catSeen !== false,
    sighting_status: rec.sightingStatus || '건강해 보여요',
    memo: rec.memo || '',
    photo: rec.photo || null,
    created_at: rec.createdAt || rec.time
  };
}

async function fetchCloudRecords() {
  if (!supabaseClient) return;
  try {
    updateSyncBadge('loading');
    const { data, error } = await supabaseClient
      .from('records')
      .select('*')
      .order('time', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error (테이블 생성 확인 필요):', error.message);
      updateSyncBadge('local');
      return;
    }

    if (data && data.length > 0) {
      records = data.map(dbRowToRecord);
      saveLocalCache();
      renderApp();
      updateSyncBadge('connected');
    } else {
      updateSyncBadge('connected');
    }
  } catch (err) {
    console.error('Supabase fetch failed:', err);
    updateSyncBadge('local');
  }
}

function subscribeToRealtime() {
  if (!supabaseClient) return;
  try {
    supabaseClient
      .channel('public:records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, payload => {
        console.log('Realtime event received:', payload);
        if (payload.eventType === 'INSERT') {
          const newRec = dbRowToRecord(payload.new);
          if (!records.some(r => r.id === newRec.id)) {
            records.unshift(newRec);
            saveLocalCache();
            renderApp();
            triggerParticles('✨');
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedId = String(payload.old.id);
          records = records.filter(r => String(r.id) !== deletedId);
          saveLocalCache();
          renderApp();
        } else if (payload.eventType === 'UPDATE') {
          const updatedRec = dbRowToRecord(payload.new);
          const idx = records.findIndex(r => String(r.id) === String(updatedRec.id));
          if (idx !== -1) {
            records[idx] = updatedRec;
            saveLocalCache();
            renderApp();
          }
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime subscription warning:', err);
  }
}

function saveLocalCache() {
  const recordsWithoutPhotos = records.map(r => {
    const { photo, ...rest } = r;
    return rest;
  });

  try {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(recordsWithoutPhotos));
  } catch (e) {
    console.warn('Local storage cache warning:', e);
  }

  records.forEach(r => {
    const photoKey = STORAGE_KEY_RECORDS + '_photo_' + r.id;
    if (r.photo) {
      try {
        localStorage.setItem(photoKey, r.photo);
      } catch (e) {
        cleanOldPhotos(r.id);
        try {
          localStorage.setItem(photoKey, r.photo);
        } catch (e2) {}
      }
    } else {
      localStorage.removeItem(photoKey);
    }
  });
}

function saveRecords() {
  saveLocalCache();
}

function cleanOldPhotos(exceptId) {
  const currentIds = new Set(records.map(r => String(r.id)));
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_RECORDS + '_photo_')) {
      const recordId = key.replace(STORAGE_KEY_RECORDS + '_photo_', '');
      if (!currentIds.has(recordId)) {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(k => localStorage.removeItem(k));

  if (keysToRemove.length === 0) {
    const oldest = [...records]
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .find(r => String(r.id) !== String(exceptId) && r.photo);
    if (oldest) {
      localStorage.removeItem(STORAGE_KEY_RECORDS + '_photo_' + oldest.id);
    }
  }
}

function generateDemoRecords() {
  const now = new Date();
  
  // 3 hours ago
  const t1 = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  // Yesterday 18:30
  const t2 = new Date(now.getTime() - 20 * 60 * 60 * 1000);
  // Yesterday 08:15
  const t3 = new Date(now.getTime() - 30 * 60 * 60 * 1000);

  return [
    {
      id: 'demo-1',
      type: 'feeding',
      author: '태리',
      time: t1.toISOString(),
      foodType: '사료',
      catSeen: true,
      memo: '맛있게 허겁지겁 다 먹고 그루밍했어요 🐾',
      photo: null,
      createdAt: t1.toISOString()
    },
    {
      id: 'demo-2',
      type: 'sighting',
      author: '캐롤',
      time: t2.toISOString(),
      sightingStatus: '건강해 보여요',
      memo: '화단 아래 따뜻한 햇살에서 느긋하게 자고 있는 것 발견!',
      photo: null,
      createdAt: t2.toISOString()
    },
    {
      id: 'demo-3',
      type: 'feeding',
      author: '차차',
      time: t3.toISOString(),
      foodType: '습식',
      catSeen: false,
      memo: '깨끗한 물 채워두고 습식 캔 하나 두고 왔습니다.',
      photo: null,
      createdAt: t3.toISOString()
    }
  ];
}

function initFormDateTime() {
  const input = document.getElementById('input-datetime');
  if (input) {
    const now = new Date();
    // Format to YYYY-MM-DDTHH:mm
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    input.value = localISOTime;
  }
}

/* ==========================================================================
   2. Core Rendering Logic & Status Calculation
   ========================================================================== */

function renderApp() {
  const sorted = [...records].sort((a, b) => new Date(b.time) - new Date(a.time));
  
  const lastFeeding = sorted.find(r => r.type === 'feeding');
  const lastSighting = sorted.find(r => r.type === 'sighting');

  updateCatStage(lastFeeding, lastSighting);
  updateBentoCards(lastFeeding, lastSighting);
  updateHistoryList(sorted);
}

function updateCatStage(lastFeeding, lastSighting) {
  const now = new Date();
  const speechEmojiEl = document.getElementById('speech-emoji');
  const speechTextEl = document.getElementById('speech-text');
  const catIllustrationContainer = document.getElementById('cat-illustration-container');

  let hoursSinceFeeding = Infinity;
  if (lastFeeding) {
    hoursSinceFeeding = (now.getTime() - new Date(lastFeeding.time).getTime()) / (1000 * 60 * 60);
  }

  // Check if cat was seen today (calendar date or last 16h)
  const isSeenToday = Boolean(
    (lastSighting && (now.getTime() - new Date(lastSighting.time).getTime()) < 18 * 60 * 60 * 1000) ||
    (lastFeeding && lastFeeding.catSeen && hoursSinceFeeding < 18)
  );

  let state = 'NORMAL'; // 'NORMAL', 'FED_NOT_SEEN', 'WARNING'

  if (hoursSinceFeeding >= 24 || !lastFeeding) {
    state = 'WARNING';
  } else if (isSeenToday) {
    state = 'NORMAL';
  } else {
    state = 'FED_NOT_SEEN';
  }

  if (state === 'NORMAL') {
    speechEmojiEl.textContent = '💚';
    speechTextEl.textContent = '오늘도 잘 지내고 있어요!';
    catIllustrationContainer.innerHTML = getCheeseCatSVG('happy');
  } else if (state === 'FED_NOT_SEEN') {
    speechEmojiEl.textContent = '💛';
    speechTextEl.textContent = '밥은 챙겨졌지만 오늘 치즈를 아직 보지 못했어요.';
    catIllustrationContainer.innerHTML = getCheeseCatSVG('calm');
  } else { // WARNING
    speechEmojiEl.textContent = '🚨';
    speechTextEl.textContent = '마지막 급식 기록 후 24시간이 지났어요.';
    catIllustrationContainer.innerHTML = getCheeseCatSVG('hungry');
  }
}

function updateBentoCards(lastFeeding, lastSighting) {
  // Last Fed Card
  const fedTimeEl = document.getElementById('last-fed-time');
  const fedAvatarEl = document.getElementById('last-fed-avatar');
  const fedDetailEl = document.getElementById('last-fed-detail');
  const fedIconEl = document.getElementById('last-fed-icon');

  if (lastFeeding) {
    fedTimeEl.textContent = formatRelativeTime(lastFeeding.time);
    fedAvatarEl.textContent = lastFeeding.author ? lastFeeding.author.charAt(0) : '?';
    const seenText = lastFeeding.catSeen ? '😺 봤어요' : '🥣 못 봤어요';
    fedDetailEl.textContent = `${lastFeeding.author || '익명'} · ${lastFeeding.foodType} · ${seenText}`;
    fedIconEl.textContent = lastFeeding.catSeen ? '😺' : '🥣';
  } else {
    fedTimeEl.textContent = '기록 없음';
    fedAvatarEl.textContent = '?';
    fedDetailEl.textContent = '급식 기록 대기 중';
    fedIconEl.textContent = '🥣';
  }

  // Last Seen Card
  const seenTimeEl = document.getElementById('last-seen-time');
  const seenAvatarEl = document.getElementById('last-seen-avatar');
  const seenDetailEl = document.getElementById('last-seen-detail');
  const seenStatusIconEl = document.getElementById('last-seen-status-icon');

  if (lastSighting) {
    seenTimeEl.textContent = formatRelativeTime(lastSighting.time);
    seenAvatarEl.textContent = lastSighting.author ? lastSighting.author.charAt(0) : '?';
    seenDetailEl.textContent = `${lastSighting.author || '익명'} · ${lastSighting.sightingStatus}`;
    seenStatusIconEl.textContent = getSightingEmoji(lastSighting.sightingStatus);
  } else {
    seenTimeEl.textContent = '기록 없음';
    seenAvatarEl.textContent = '?';
    seenDetailEl.textContent = '목격 기록 대기 중';
    seenStatusIconEl.textContent = '🔍';
  }
}

function updateHistoryList(sortedRecords) {
  const listEl = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');

  let filtered = sortedRecords;
  if (currentFilter === 'feeding') {
    filtered = sortedRecords.filter(r => r.type === 'feeding');
  } else if (currentFilter === 'sighting') {
    filtered = sortedRecords.filter(r => r.type === 'sighting');
  }

  countEl.textContent = `${filtered.length}건`;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-10 text-on-surface-variant/70 text-xs">
        등록된 기록이 없습니다. <br>하단 [기록 등록] 버튼을 눌러 소식을 전해 주세요! 🐾
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const isFeeding = item.type === 'feeding';
    const mainIcon = isFeeding ? '🍚' : '👀';
    const authorInitial = item.author ? item.author.charAt(0) : '?';
    const formattedDate = formatFullDateTime(item.time);

    let contentText = '';
    if (isFeeding) {
      const seenText = item.catSeen ? '😺 봤어요' : '🥣 못 봤어요';
      contentText = `<strong class="font-bold text-primary">${item.foodType}</strong> 급식 · ${seenText}`;
    } else {
      const statusEmoji = getSightingEmoji(item.sightingStatus);
      contentText = `<strong class="font-bold text-secondary">치즈 발견</strong> · ${statusEmoji} ${item.sightingStatus}`;
    }

    const photoHTML = item.photo
      ? `<div class="mt-2 relative w-16 h-16 rounded-xl overflow-hidden border border-outline-variant cursor-pointer hover:opacity-90 transition-opacity" onclick="openPhotoZoom('${item.photo}')">
           <img src="${item.photo}" class="w-full h-full object-cover">
         </div>`
      : '';

    const memoHTML = item.memo
      ? `<p class="mt-1 text-xs text-on-surface-variant bg-surface-container/60 p-2 rounded-xl border border-surface-container-high">${escapeHTML(item.memo)}</p>`
      : '';

    return `
      <div class="bg-surface-bright/95 border-2 border-surface-container-highest rounded-2xl p-3.5 flex gap-3 shadow-xs hover:border-outline-variant transition-all">
        <div class="w-10 h-10 rounded-full bg-surface-container border-2 border-dashed border-outline-variant flex items-center justify-center text-xl flex-shrink-0">
          ${mainIcon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5 truncate">
              <div class="w-4 h-4 rounded-full bg-amber-200 text-amber-950 flex items-center justify-center font-bold text-[9px]">
                ${authorInitial}
              </div>
              <span class="text-xs font-bold text-on-surface truncate">${escapeHTML(item.author)}님</span>
              <span class="text-[11px] text-on-surface-variant font-medium">• ${formattedDate}</span>
            </div>
            <button onclick="deleteRecord('${item.id}')" class="text-on-surface-variant/40 hover:text-red-600 text-xs px-1">
              ✕
            </button>
          </div>
          <p class="text-xs text-on-surface font-medium">${contentText}</p>
          ${memoHTML}
          ${photoHTML}
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   3. Cheese Cat Character Renderer (User Uploaded Images)
   ========================================================================== */

function getCheeseCatSVG(expression) {
  const happySrc = (typeof CAT_HAPPY_IMG !== 'undefined' && CAT_HAPPY_IMG) ? CAT_HAPPY_IMG : 'assets/cat_happy.jpg';
  const sadSrc = (typeof CAT_SAD_IMG !== 'undefined' && CAT_SAD_IMG) ? CAT_SAD_IMG : 'assets/cat_sad.jpg';

  if (expression === 'hungry') {
    return `
      <div class="relative w-full h-full flex items-center justify-center">
        <img src="${sadSrc}" alt="슬픈 치즈 고양이" class="w-full h-full object-contain drop-shadow-lg rounded-3xl cat-sad transition-all duration-500 hover:scale-105">
        <div class="absolute top-2 right-2 text-2xl animate-bounce drop-shadow-sm opacity-90 select-none pointer-events-none">💧</div>
      </div>
    `;
  } else if (expression === 'calm') {
    return `
      <div class="relative w-full h-full flex items-center justify-center">
        <img src="${happySrc}" alt="치즈 고양이" class="w-full h-full object-contain drop-shadow-lg rounded-3xl transition-all duration-500 hover:scale-105">
        <div class="absolute top-2 right-2 text-2xl animate-pulse drop-shadow-sm opacity-90 select-none pointer-events-none">🍃</div>
      </div>
    `;
  } else { // happy
    return `
      <div class="relative w-full h-full flex items-center justify-center">
        <img src="${happySrc}" alt="웃는 치즈 고양이" class="w-full h-full object-contain drop-shadow-lg rounded-3xl cat-happy animate-bounce-slow transition-all duration-500 hover:scale-105">
        <div class="absolute top-2 right-2 text-2xl animate-bounce drop-shadow-sm opacity-90 select-none pointer-events-none">✨</div>
      </div>
    `;
  }
}

/* ==========================================================================
   4. Modal Actions & Form Handlers
   ========================================================================== */

function openRecordModal() {
  renderUserUI();
  initFormDateTime();
  document.getElementById('record-modal').classList.remove('hidden');
}

function closeRecordModal() {
  document.getElementById('record-modal').classList.add('hidden');
  document.getElementById('record-form').reset();
  removePhoto();
}

function switchRecordTab(tab) {
  currentRecordTab = tab;
  const tabFeeding = document.getElementById('tab-feeding');
  const tabSighting = document.getElementById('tab-sighting');
  const feedingFields = document.getElementById('feeding-fields');
  const sightingFields = document.getElementById('sighting-fields');

  if (tab === 'feeding') {
    tabFeeding.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all bg-surface text-primary shadow-xs';
    tabSighting.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all text-on-surface-variant hover:text-on-surface';
    feedingFields.classList.remove('hidden');
    sightingFields.classList.add('hidden');
  } else {
    tabSighting.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all bg-surface text-secondary shadow-xs';
    tabFeeding.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all text-on-surface-variant hover:text-on-surface';
    sightingFields.classList.remove('hidden');
    feedingFields.classList.add('hidden');
  }
}

function handlePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    selectedPhotoBase64 = e.target.result;
    document.getElementById('photo-preview-img').src = selectedPhotoBase64;
    document.getElementById('photo-preview-container').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  selectedPhotoBase64 = null;
  document.getElementById('input-photo').value = '';
  document.getElementById('photo-preview-container').classList.add('hidden');
  document.getElementById('photo-preview-img').src = '';
}

async function handleRecordSubmit(event) {
  event.preventDefault();

  const datetimeInput = document.getElementById('input-datetime').value;
  const recordTime = datetimeInput ? new Date(datetimeInput).toISOString() : new Date().toISOString();
  const memo = document.getElementById('input-memo').value.trim();

  const authorName = (currentUser && currentUser.name) ? currentUser.name : '치즈돌봄이';

  const newRecord = {
    id: 'rec-' + Date.now(),
    type: currentRecordTab,
    author: authorName,
    time: recordTime,
    memo: memo,
    photo: selectedPhotoBase64,
    createdAt: new Date().toISOString()
  };

  if (currentRecordTab === 'feeding') {
    const checkedFoodEls = document.querySelectorAll('input[name="foodType"]:checked');
    if (checkedFoodEls.length === 0) {
      alert('음식 종류를 최소 1개 이상 선택해주세요! (사료, 습식, 닭가슴살 등)');
      return;
    }
    const foodTypes = Array.from(checkedFoodEls).map(el => el.value);
    newRecord.foodType = foodTypes.join(', ');
    newRecord.foodTypes = foodTypes;
    
    const catSeenEl = document.querySelector('input[name="catSeen"]:checked');
    newRecord.catSeen = catSeenEl ? (catSeenEl.value === 'true') : true;
  } else {
    const sightingStatusEl = document.querySelector('input[name="sightingStatus"]:checked');
    newRecord.sightingStatus = sightingStatusEl ? sightingStatusEl.value : '건강해 보여요';
  }

  // 1. Optimistic UI update
  records.unshift(newRecord);
  saveLocalCache();
  closeRecordModal();
  renderApp();
  triggerParticles('❤️');

  // 2. Sync to Supabase Cloud
  if (supabaseClient) {
    try {
      updateSyncBadge('loading');
      const dbRow = recordToDbRow(newRecord);
      const { error } = await supabaseClient.from('records').insert([dbRow]);
      if (error) {
        console.warn('Supabase insert warning:', error.message);
        updateSyncBadge('local');
      } else {
        updateSyncBadge('connected');
      }
    } catch (err) {
      console.error('Supabase insert failed:', err);
      updateSyncBadge('local');
    }
  }
}

async function deleteRecord(id) {
  if (confirm('이 기록을 삭제하시겠습니까?')) {
    records = records.filter(r => String(r.id) !== String(id));
    saveLocalCache();
    renderApp();

    if (supabaseClient) {
      try {
        updateSyncBadge('loading');
        const { error } = await supabaseClient.from('records').delete().eq('id', String(id));
        if (!error) {
          updateSyncBadge('connected');
        }
      } catch (err) {
        console.error('Cloud delete failed:', err);
      }
    }
  }
}

function setFilter(filter) {
  currentFilter = filter;
  ['all', 'feeding', 'sighting'].forEach(f => {
    const btn = document.getElementById(`filter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl transition-all bg-surface shadow-xs text-primary';
      } else {
        btn.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl transition-all text-on-surface-variant hover:text-on-surface';
      }
    }
  });
  renderApp();
}

/* ==========================================================================
   5. Google Sign-In & Account Management
   ========================================================================== */

function initGoogleAuth() {
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    try {
      google.accounts.id.initialize({
        client_id: '1000000000000-dummyclientid.apps.googleusercontent.com',
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });
      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 250
        });
      }
    } catch (err) {
      console.log('Google Sign-In initialized in quick standalone mode');
    }
  }
}

function handleGoogleCredentialResponse(response) {
  try {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const payload = JSON.parse(jsonPayload);

    currentUser = {
      name: payload.name || payload.given_name || 'Google 사용자',
      email: payload.email || '',
      picture: payload.picture || ''
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
    renderUserUI();
    closeGoogleLoginModal();
    alert(`환영합니다, ${currentUser.name}님! Google 계정으로 로그인되었습니다. 🐾`);
  } catch (e) {
    console.error('Google token decode failed:', e);
  }
}

function openGoogleLoginModal() {
  renderUserUI();
  document.getElementById('google-modal').classList.remove('hidden');
}

function closeGoogleLoginModal() {
  document.getElementById('google-modal').classList.add('hidden');
}

function selectGoogleCustom() {
  const nameInput = document.getElementById('custom-google-name');
  const emailInput = document.getElementById('custom-google-email');
  const nameVal = nameInput ? nameInput.value.trim() : '';
  const emailVal = emailInput ? emailInput.value.trim() : '';

  if (!nameVal) {
    alert('이름 또는 닉네임을 입력해주세요!');
    return;
  }

  currentUser = {
    name: nameVal,
    email: emailVal || `${nameVal}@gmail.com`,
    picture: ''
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
  renderUserUI();
  if (nameInput) nameInput.value = '';
  if (emailInput) emailInput.value = '';
  closeGoogleLoginModal();
  alert(`${currentUser.name}님으로 로그인되었습니다! 🐾`);
}

function logoutGoogle() {
  if (confirm('로그아웃 하시겠습니까?')) {
    currentUser = { name: '치즈돌봄이', email: '', picture: '' };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
    renderUserUI();
    closeGoogleLoginModal();
    alert('로그아웃 되었습니다.');
  }
}

// Backward compatibility aliases
function openKakaoLoginModal() { openGoogleLoginModal(); }
function closeKakaoLoginModal() { closeGoogleLoginModal(); }

/* ==========================================================================
   6. Interactive Cat Click Particles & Photo Zoom
   ========================================================================== */

function onCatClick(e) {
  const particles = ['💖', '🐟', '✨', '🐾', '🍗'];
  const p = particles[Math.floor(Math.random() * particles.length)];
  triggerParticles(p, e);
}

function triggerParticles(emoji, clickEvent) {
  const container = document.getElementById('cat-particle-container');
  if (!container) return;

  const particle = document.createElement('div');
  particle.className = 'particle';
  particle.textContent = emoji;

  if (clickEvent) {
    const rect = container.getBoundingClientRect();
    particle.style.left = (clickEvent.clientX - rect.left - 10) + 'px';
    particle.style.top = (clickEvent.clientY - rect.top - 10) + 'px';
  } else {
    particle.style.left = (40 + Math.random() * 50) + '%';
    particle.style.top = '40%';
  }

  container.appendChild(particle);
  setTimeout(() => particle.remove(), 1000);
}

function openPhotoZoom(src) {
  document.getElementById('photo-zoom-img').src = src;
  document.getElementById('photo-zoom-modal').classList.remove('hidden');
}

function closePhotoZoom() {
  document.getElementById('photo-zoom-modal').classList.add('hidden');
}

/* ==========================================================================
   7. Demo Helpers (24h Simulation & Reset)
   ========================================================================== */

function toggleDemoDrawer() {
  document.getElementById('demo-drawer').classList.toggle('hidden');
}

function simulate24hPassed() {
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  records.forEach(r => {
    if (r.type === 'feeding') {
      r.time = twentyFiveHoursAgo;
    }
  });
  saveRecords();
  renderApp();
  alert('마지막 급식 시간을 25시간 전으로 변경했습니다. 🚨 경고 상태를 확인하세요!');
}

function simulateResetDemoData() {
  records = generateDemoRecords();
  saveRecords();
  renderApp();
  alert('시연용 초기 데이터로 복구되었습니다!');
}

/* ==========================================================================
   8. Utility Helpers
   ========================================================================== */

function formatRelativeTime(isoString) {
  if (!isoString) return '기록 없음';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHours < 24) {
    if (date.getDate() === now.getDate()) {
      return `오늘 ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
    }
    return `어제 ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
  }
  if (diffDays === 1) return `어제 ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatFullDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());

  if (isToday) {
    return `오늘 ${hours}:${minutes}`;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `어제 ${hours}:${minutes}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

function getSightingEmoji(status) {
  if (status === '건강해 보여요') return '😊';
  if (status === '조금 이상해 보여요') return '😿';
  if (status === '다친 것 같아요') return '🚨';
  return '👀';
}

function padZero(num) {
  return num < 10 ? '0' + num : num;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
