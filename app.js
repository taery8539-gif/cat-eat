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
// State Variables
let records = [];
let currentUser = { name: '', email: '', picture: '' };
let activeUserId = null;      // 로그인 + 허용 확인이 끝난 사용자 id
let authMessage = '';         // 로그인 화면에 보여줄 안내/오류 문구
let realtimeChannel = null;
let currentFilter = 'all'; // 'all', 'feeding', 'sighting'
let currentRecordTab = 'feeding'; // 'feeding', 'sighting'
let selectedPhotoBase64 = null;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  initFormDateTime();
  renderUserUI();
  lockApp();      // 로그인 확인이 끝나기 전에는 항상 잠금 상태로 시작
  initAuth();
  initScene();
});

/* ==========================================================================
   0. Auth (Supabase Auth + Google). 허용 이메일 검사는 DB(is_allowed)가 담당
   ========================================================================== */

function showAuthMessage(msg) {
  authMessage = msg || '';
  const el = document.getElementById('auth-message');
  if (!el) return;
  el.textContent = authMessage;
  el.classList.toggle('hidden', !authMessage);
}

function initAuth() {
  if (!supabaseClient) {
    showAuthMessage('서버에 연결할 수 없어요. 인터넷 연결을 확인하고 새로고침해 주세요.');
    return;
  }
  // 콜백 안에서 바로 supabase 호출을 기다리면 멈출 수 있어서 setTimeout으로 한 틱 미룬다
  supabaseClient.auth.onAuthStateChange((event, session) => {
    setTimeout(() => handleSession(session), 0);
  });
}

let handlingUserId = null;   // 지금 허용 여부를 확인 중인 사용자 (같은 사용자의 중복 확인 방지)

async function handleSession(session) {
  if (!session || !session.user) {
    handlingUserId = null;
    if (activeUserId) stopCloudData();
    activeUserId = null;
    currentUser = { name: '', email: '', picture: '' };
    renderUserUI();
    lockApp();
    return;
  }
  const uid = session.user.id;
  if (uid === activeUserId || uid === handlingUserId) return; // 이미 확인했거나 확인 중

  handlingUserId = uid;
  const email = session.user.email || '';
  const result = await checkAllowedWithRetry();
  if (handlingUserId !== uid) return;   // 확인하는 사이 로그아웃된 경우
  handlingUserId = null;

  if (result === 'error') {
    // 확인 자체가 실패한 것: 멤버가 아니라는 뜻이 아니므로 로그아웃시키지 않는다
    showAuthMessage('로그인 확인 중 문제가 생겼어요. 잠시 뒤 페이지를 새로고침해 주세요.');
    lockApp();
    return;
  }
  if (result === 'denied') {
    await supabaseClient.auth.signOut();
    showAuthMessage(`${email} 계정은 등록된 멤버가 아니에요. 등록된 구글 계정으로 로그인해 주세요.`);
    return;
  }

  const meta = session.user.user_metadata || {};
  activeUserId = uid;
  currentUser = {
    name: meta.full_name || meta.name || email.split('@')[0] || '치즈돌봄이',
    email: email,
    picture: meta.avatar_url || meta.picture || ''
  };
  showAuthMessage('');
  renderUserUI();
  unlockApp();
  startCloudData();
}

// DB의 is_allowed()로 허용 여부 확인. 로그인 직후에는 첫 확인이 실패하거나 false로 나올 수 있어 몇 번 다시 확인한다.
// 반환: 'allowed' | 'denied'(여러 번 확인해도 목록에 없음) | 'error'(확인 자체가 계속 실패)
async function checkAllowedWithRetry() {
  const delays = [0, 700, 1500];
  let sawFalse = false;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(r => setTimeout(r, delays[i]));
    try {
      const { data, error } = await supabaseClient.rpc('is_allowed');
      if (error) {
        console.warn(`is_allowed check ${i + 1} failed:`, error.message);
        continue;
      }
      if (data === true) return 'allowed';
      sawFalse = true;
      console.warn(`is_allowed check ${i + 1}: not allowed yet (data=${data})`);
    } catch (e) {
      console.warn(`is_allowed check ${i + 1} threw:`, e);
    }
  }
  return sawFalse ? 'denied' : 'error';
}

async function signInWithGoogle() {
  if (!supabaseClient) return;
  showAuthMessage('');
  // 현재 주소에서 ?와 #를 떼고, index.html도 떼어서 Supabase에 등록한 주소와 맞춘다
  const redirectTo = location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } }
  });
  if (error) showAuthMessage('로그인을 시작하지 못했어요: ' + error.message);
}

// Hides the whole app behind the login modal and prevents it from being dismissed
function lockApp() {
  const wrapper = document.getElementById('app-wrapper');
  if (wrapper) wrapper.classList.add('auth-locked');

  const closeBtn = document.getElementById('google-modal-close-btn');
  if (closeBtn) closeBtn.classList.add('hidden');
  const gateNote = document.getElementById('google-modal-gate-note');
  if (gateNote) gateNote.classList.remove('hidden');

  showAuthMessage(authMessage);
  const modal = document.getElementById('google-modal');
  if (modal) modal.classList.remove('hidden');
}

// Reveals the app and restores normal (dismissable) modal behavior
function unlockApp() {
  const wrapper = document.getElementById('app-wrapper');
  if (wrapper) wrapper.classList.remove('auth-locked');

  const closeBtn = document.getElementById('google-modal-close-btn');
  if (closeBtn) closeBtn.classList.remove('hidden');
  const gateNote = document.getElementById('google-modal-gate-note');
  if (gateNote) gateNote.classList.add('hidden');

  const modal = document.getElementById('google-modal');
  if (modal) modal.classList.add('hidden');
}

/* ==========================================================================
   1. User & Storage Initialization
   ========================================================================== */

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
  const displayEmail = currentUser && currentUser.email ? currentUser.email : '로그인이 필요합니다';

  if (nameEl) nameEl.textContent = displayName.length > 7 ? displayName.slice(0, 6) + '..' : displayName;
  
  const googleLogoSVG = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/></svg>`;

  const avatarHTML = (currentUser && currentUser.picture)
    ? `<img src="${escapeHTML(currentUser.picture)}" referrerpolicy="no-referrer" class="w-full h-full object-cover">`
    : (currentUser && currentUser.name ? `<span class="font-bold text-xs">${escapeHTML(currentUser.name.charAt(0))}</span>` : googleLogoSVG);

  if (avatarEl) avatarEl.innerHTML = avatarHTML;
  if (modalNameEl) modalNameEl.textContent = currentUser && currentUser.name ? `${currentUser.name}님` : 'Google 로그인 필요';
  if (modalEmailEl) modalEmailEl.textContent = displayEmail;
  if (modalAvatarEl) modalAvatarEl.innerHTML = avatarHTML;

  if (cardNameEl) cardNameEl.textContent = currentUser && currentUser.name ? `${currentUser.name}님` : '로그인 안 됨';
  if (cardEmailEl) cardEmailEl.textContent = displayEmail;
  if (cardAvatarEl) cardAvatarEl.innerHTML = (currentUser && currentUser.picture) ? `<img src="${escapeHTML(currentUser.picture)}" referrerpolicy="no-referrer" class="w-full h-full object-cover">` : (currentUser && currentUser.name ? currentUser.name.charAt(0) : 'G');

  const accountCard = document.getElementById('google-current-user-card');
  if (accountCard) accountCard.classList.toggle('hidden', !activeUserId);
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !activeUserId);
  const loginArea = document.getElementById('google-login-area');
  if (loginArea) loginArea.classList.toggle('hidden', !!activeUserId);
}

async function startCloudData() {
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

function stopCloudData() {
  try {
    if (realtimeChannel && supabaseClient) supabaseClient.removeChannel(realtimeChannel);
  } catch (e) { /* ignore */ }
  realtimeChannel = null;
  records = [];
  renderApp();
}

function subscribeToRealtime() {
  if (!supabaseClient || realtimeChannel) return;
  try {
    realtimeChannel = supabaseClient
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
  if (!activeUserId) { alert('로그인이 필요해요.'); return; }

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
  showCatToast(newRecord.type, newRecord);

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
   5. Account Modal (login / logout)
   ========================================================================== */

function openGoogleLoginModal() {
  renderUserUI();
  document.getElementById('google-modal').classList.remove('hidden');
}

function closeGoogleLoginModal() {
  // 로그인 전에는 닫을 수 없다
  if (!activeUserId) return;
  document.getElementById('google-modal').classList.add('hidden');
}

async function logoutGoogle() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  await supabaseClient.auth.signOut();   // onAuthStateChange가 잠금 화면으로 되돌린다
}

// Backward compatibility aliases
function openKakaoLoginModal() { openGoogleLoginModal(); }
function closeKakaoLoginModal() { closeGoogleLoginModal(); }

/* ==========================================================================
   5-1. Cat Toast (기록 등록 후 고양이가 반응하는 안내)
   ========================================================================== */

let catToastTimer = null;

function ensureCatToastStyle() {
  if (document.getElementById('cat-toast-style')) return;
  const style = document.createElement('style');
  style.id = 'cat-toast-style';
  style.textContent = `
    .ct-toast{
      position:fixed; left:50%; bottom:104px; z-index:60;
      width:min(330px, calc(100vw - 32px));
      display:flex; align-items:center; gap:12px;
      padding:10px 18px 10px 10px;
      background:var(--color-surface,#fcfaed);
      border:3px dashed var(--color-outline-variant,#c3c9b7);
      border-bottom:5px solid var(--color-outline-variant,#c3c9b7);
      border-radius:28px;
      box-shadow:0 10px 24px rgba(93,64,55,.18);
      transform:translate(-50%, 24px) scale(.92); opacity:0;
      transition:transform .35s cubic-bezier(.34,1.56,.64,1), opacity .25s ease;
      cursor:pointer; user-select:none;
    }
    .ct-toast.ct-show{ transform:translate(-50%, 0) scale(1); opacity:1; }
    .ct-toast.ct-hide{ transform:translate(-50%, 16px) scale(.96); opacity:0; }
    .ct-icon{
      flex:0 0 72px; width:72px; height:72px; border-radius:50%;
      background:#E3EFD2;
      overflow:hidden; display:flex; align-items:flex-end; justify-content:center;
    }
    .ct-icon svg{ width:72px; height:72px; display:block; }
    .ct-title{
      font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:17px; line-height:1.3;
      color:var(--color-primary,#416916);
    }
    .ct-sub{ margin-top:2px; font-size:12px; line-height:1.4; color:var(--color-on-surface-variant,#43493b); }

    .ct-wave{ transform-box:fill-box; transform-origin:50% 100%; animation:ct-wave .7s ease-in-out .25s 3; }
    @keyframes ct-wave{ 0%,100%{ transform:rotate(0deg) } 25%{ transform:rotate(-16deg) } 75%{ transform:rotate(16deg) } }
    .ct-peek{ animation:ct-peek .45s cubic-bezier(.34,1.56,.64,1) both; }
    @keyframes ct-peek{ from{ transform:translateY(34px) } to{ transform:translateY(0) } }
    .ct-pupil{ animation:ct-look 1.6s ease-in-out .5s infinite; }
    @keyframes ct-look{ 0%,100%{ transform:translateX(0) } 30%{ transform:translateX(-3.5px) } 70%{ transform:translateX(3.5px) } }

    @media (prefers-reduced-motion: reduce){
      .ct-toast{ transition:opacity .2s ease; transform:translate(-50%,0); }
      .ct-toast.ct-hide{ transform:translate(-50%,0); }
      .ct-wave,.ct-peek,.ct-pupil{ animation:none; }
    }
  `;
  document.head.appendChild(style);
}

// 치즈 색: 흰 털(#FFFEF8) + 연한 황갈색 무늬(#E2C9A0), 분홍 귀·코·발바닥, 초록 눈
// 급식: 인사하는 치즈의 앞발
const CAT_PAW_SVG = `
<svg viewBox="0 0 80 80" aria-hidden="true">
  <g class="ct-wave" stroke="#D9C7AE" stroke-width="1.8" stroke-linejoin="round">
    <rect x="26" y="40" width="28" height="48" rx="14" fill="#FFFEF8"/>
    <path d="M26.5 62h9M26.5 72h6M53.5 62h-9M53.5 72h-6" stroke="#E2C9A0" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="40" cy="36" rx="23" ry="22" fill="#FFFEF8"/>
    <path d="M32 21 Q40 17 48 21" stroke="#E2C9A0" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M33 30 Q40 27 47 30" stroke="#EADFCB" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <g stroke="none">
      <ellipse cx="40" cy="43" rx="9.5" ry="8" fill="#F4A9A4"/>
      <circle cx="25.5" cy="31" r="4.6" fill="#F4A9A4"/>
      <circle cx="34.5" cy="20.5" r="4.6" fill="#F4A9A4"/>
      <circle cx="45.5" cy="20.5" r="4.6" fill="#F4A9A4"/>
      <circle cx="54.5" cy="31" r="4.6" fill="#F4A9A4"/>
    </g>
  </g>
</svg>`;

// 목격: 빼꼼 쳐다보는 치즈의 얼굴
const CAT_PEEK_SVG = `
<svg viewBox="0 0 80 80" aria-hidden="true">
  <g class="ct-peek" stroke-linejoin="round">
  <g transform="translate(5.6 9) scale(0.86)">
    <path d="M10 33 L10 8 L34 20 Z" fill="#FFFEF8" stroke="#D9C7AE" stroke-width="1.8"/>
    <path d="M70 33 L70 8 L46 20 Z" fill="#FFFEF8" stroke="#D9C7AE" stroke-width="1.8"/>
    <path d="M15 27 L15 15 L27 21 Z" fill="#F4A9A4"/>
    <path d="M65 27 L65 15 L53 21 Z" fill="#F4A9A4"/>
    <path d="M5 92 L5 47 Q5 17 40 17 Q75 17 75 47 L75 92 Z" fill="#FFFEF8" stroke="#D9C7AE" stroke-width="1.8"/>
    <g stroke="#E2C9A0" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M35.5 21.5 L35.5 28"/><path d="M40 20.5 L40 29"/><path d="M44.5 21.5 L44.5 28"/>
    </g>
    <ellipse cx="26" cy="35" rx="4.5" ry="1.7" fill="#E2C9A0"/>
    <ellipse cx="54" cy="35" rx="4.5" ry="1.7" fill="#E2C9A0"/>
    <ellipse cx="14" cy="56" rx="5.5" ry="3.6" fill="#F8C9C4" opacity=".75"/>
    <ellipse cx="66" cy="56" rx="5.5" ry="3.6" fill="#F8C9C4" opacity=".75"/>
    <ellipse cx="26" cy="47" rx="9.6" ry="10.6" fill="#7DBA5A"/>
    <ellipse cx="54" cy="47" rx="9.6" ry="10.6" fill="#7DBA5A"/>
    <path d="M16.6 44 Q26 33 35.4 44" fill="none" stroke="#4A3324" stroke-width="2" stroke-linecap="round"/>
    <path d="M44.6 44 Q54 33 63.4 44" fill="none" stroke="#4A3324" stroke-width="2" stroke-linecap="round"/>
    <g class="ct-pupil">
      <ellipse cx="26" cy="48" rx="5" ry="7.6" fill="#1F2A14"/>
      <ellipse cx="54" cy="48" rx="5" ry="7.6" fill="#1F2A14"/>
      <circle cx="23.6" cy="44.4" r="2.5" fill="#fff"/>
      <circle cx="51.6" cy="44.4" r="2.5" fill="#fff"/>
      <circle cx="28.4" cy="51.6" r="1.2" fill="#fff"/>
      <circle cx="56.4" cy="51.6" r="1.2" fill="#fff"/>
    </g>
    <path d="M37 59.5 L43 59.5 L40 63 Z" fill="#F0A3A3"/>
    <path d="M40 63 L40 65 M40 65 Q37 68.4 33.6 66 M40 65 Q43 68.4 46.4 66" fill="none" stroke="#B7857A" stroke-width="1.4" stroke-linecap="round"/>
    <g stroke="#DCCFBB" stroke-width="1.1" stroke-linecap="round">
      <path d="M12 61 L3 59.5"/><path d="M12 64 L3 65.5"/><path d="M68 61 L77 59.5"/><path d="M68 64 L77 65.5"/>
    </g>
  </g>
  </g>
</svg>`;

function showCatToast(type, record) {
  ensureCatToastStyle();

  let title, sub, icon;
  if (type === 'feeding') {
    title = '잘 먹겠습니다냥!';
    sub = '밥 챙겨줘서 고마워요 🐾';
    icon = CAT_PAW_SVG;
  } else {
    title = '나를 지켜보고있냥!';
    const status = record && record.sightingStatus;
    sub = (status && status !== '건강해 보여요')
      ? '걱정되면 메모와 사진을 남겨주세요'
      : '치즈를 봐줘서 고마워요 👀';
    icon = CAT_PEEK_SVG;
  }

  const old = document.getElementById('cat-toast');
  if (old) old.remove();
  clearTimeout(catToastTimer);

  const el = document.createElement('div');
  el.id = 'cat-toast';
  el.className = 'ct-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="ct-icon">${icon}</div>
    <div>
      <div class="ct-title">${title}</div>
      <div class="ct-sub">${sub}</div>
    </div>`;
  document.body.appendChild(el);

  const dismiss = () => {
    clearTimeout(catToastTimer);
    el.classList.add('ct-hide');
    el.classList.remove('ct-show');
    setTimeout(() => el.remove(), 350);
  };
  el.addEventListener('click', dismiss);

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('ct-show')));
  catToastTimer = setTimeout(dismiss, 2800);
}

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

/* ==========================================================================
   9. Scene Background (계절 × 낮/밤)
   - 계절: 봄 3~5월, 여름 6~8월, 가을 9~11월, 겨울 12~2월
   - 낮: 06:00~17:59, 밤: 18:00~05:59 (기기의 현재 시각 기준)
   ========================================================================== */

let sceneKey = '';
let sceneObserver = null;

function getSceneState() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const h = now.getHours();
  let season = (m >= 3 && m <= 5) ? 'spring' : (m >= 6 && m <= 8) ? 'summer' : (m >= 9 && m <= 11) ? 'autumn' : 'winter';
  let tod = (h >= 6 && h < 18) ? 'day' : 'night';
  const params = new URLSearchParams(location.search);
  const q = params.get('scene');            // 예: ?scene=winter-night
  if (q) {
    const [qs, qt] = q.split('-');
    if (['spring', 'summer', 'autumn', 'winter'].includes(qs)) season = qs;
    if (['day', 'night'].includes(qt)) tod = qt;
  }
  return { season, tod };
}

function sceneRand(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return function () {                       // mulberry32
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureSceneStyle() {
  if (document.getElementById('scene-style')) return;
  const st = document.createElement('style');
  st.id = 'scene-style';
  st.textContent = `
    #cat-stage{ isolation:isolate; }
    #cat-stage .grid{ margin-top:30px; }
    .sc-root{
      position:absolute; left:0; right:0; top:0; z-index:-1;
      height:var(--scene-h, 300px);
      border-radius:32px; overflow:hidden;
      border:3px dashed var(--color-outline-variant,#c3c9b7);
      background:linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 100%);
      pointer-events:none;
      --h:var(--scene-h, 300px);
    }
    .sc-spring.sc-day   { --sky-top:#BDE7F5; --sky-bottom:#F8F6E2; --g1:#BFE07F; --g2:#A2CD63; --sun:#FFD45E; }
    .sc-spring.sc-night { --sky-top:#1F2B55; --sky-bottom:#51619A; --g1:#46634F; --g2:#375640; }
    .sc-summer.sc-day   { --sky-top:#7CCDF1; --sky-bottom:#DCF3FA; --g1:#82C150; --g2:#62A83C; --sun:#FFC93C; }
    .sc-summer.sc-night { --sky-top:#14234A; --sky-bottom:#3B4F88; --g1:#2F5638; --g2:#25472D; }
    .sc-autumn.sc-day   { --sky-top:#F8D6A6; --sky-bottom:#FFF2DE; --g1:#DDB85C; --g2:#C79F42; --sun:#FFB86B; }
    .sc-autumn.sc-night { --sky-top:#2B2450; --sky-bottom:#6C5C88; --g1:#5C4B34; --g2:#483A2A; }
    .sc-winter.sc-day   { --sky-top:#BAD5E8; --sky-bottom:#EEF5FA; --g1:#F6F9FC; --g2:#E0EBF4; --sun:#FFF1B8; }
    .sc-winter.sc-night { --sky-top:#1B2748; --sky-bottom:#586D9E; --g1:#92A6C8; --g2:#7A91B8; }

    .sc-celestial{ position:absolute; top:12px; right:12px; width:52px; height:52px; filter:drop-shadow(0 0 10px rgba(255,236,160,.75)); }
    .sc-night .sc-celestial{ filter:drop-shadow(0 0 12px rgba(255,244,200,.6)); }
    .sc-rays{ transform-origin:26px 26px; animation:sc-spin 80s linear infinite; }
    @keyframes sc-spin{ to{ transform:rotate(360deg); } }

    .sc-cloud{
      position:absolute; top:var(--y); left:-100px; width:64px; height:20px; border-radius:20px;
      background:#fff; opacity:.92;
      animation:sc-drift var(--d) linear var(--delay) infinite;
    }
    .sc-cloud::before,.sc-cloud::after{ content:''; position:absolute; background:#fff; border-radius:50%; }
    .sc-cloud::before{ width:30px; height:30px; top:-15px; left:9px; }
    .sc-cloud::after{ width:22px; height:22px; top:-9px; left:32px; }
    .sc-autumn .sc-cloud{ background:#FFF7EA; } .sc-autumn .sc-cloud::before,.sc-autumn .sc-cloud::after{ background:#FFF7EA; }
    .sc-night .sc-cloud{ display:none; }
    @keyframes sc-drift{ from{ transform:translateX(0); } to{ transform:translateX(calc(var(--w, 400px) + 200px)); } }

    .sc-star{
      position:absolute; left:var(--x); top:var(--y); width:var(--s); height:var(--s); border-radius:50%;
      background:#fff; animation:sc-twinkle var(--d) ease-in-out var(--delay) infinite;
    }
    @keyframes sc-twinkle{ 0%,100%{ opacity:.25; transform:scale(.8); } 50%{ opacity:1; transform:scale(1.15); } }

    .sc-p{
      position:absolute; top:-24px; left:var(--x); width:var(--s); height:var(--s);
      animation:sc-fall var(--d) linear var(--delay) infinite; will-change:transform;
    }
    .sc-p svg{ width:100%; height:100%; display:block; }
    .sc-snow{ border-radius:50%; background:#fff; box-shadow:0 0 4px rgba(255,255,255,.9); }
    .sc-night .sc-p{ filter:brightness(.82); }
    @keyframes sc-fall{
      0%   { transform:translate3d(0,0,0) rotate(0deg); opacity:0; }
      8%   { opacity:1; }
      33%  { transform:translate3d(calc(var(--dx) * .6 + 14px), calc(var(--h) * .33), 0) rotate(calc(var(--rot) * .33)); }
      66%  { transform:translate3d(calc(var(--dx) * .9 - 14px), calc(var(--h) * .66), 0) rotate(calc(var(--rot) * .66)); }
      100% { transform:translate3d(var(--dx), calc(var(--h) - 20px), 0) rotate(var(--rot)); opacity:.9; }
    }

    .sc-fly{
      position:absolute; left:var(--x); top:var(--y); width:6px; height:6px; border-radius:50%;
      background:#F7F58A; box-shadow:0 0 8px 3px rgba(247,245,138,.75);
      animation:sc-fly var(--d) ease-in-out var(--delay) infinite, sc-blink 2.6s ease-in-out var(--delay) infinite;
    }
    @keyframes sc-fly{ 0%,100%{ transform:translate(0,0); } 25%{ transform:translate(12px,-8px); } 50%{ transform:translate(-8px,-16px); } 75%{ transform:translate(-14px,-4px); } }
    @keyframes sc-blink{ 0%,100%{ opacity:.2; } 50%{ opacity:1; } }

    .sc-ground{ position:absolute; left:0; bottom:0; width:100%; height:84px; display:block; }
    .sc-prop{ position:absolute; bottom:12px; display:block; }
    .sc-prop-l{ left:8px; } .sc-prop-r{ right:8px; }
    .sc-night .sc-prop{ filter:brightness(.66) saturate(.85); }

    @media (prefers-reduced-motion: reduce){
      .sc-root *{ animation:none !important; }
      .sc-p{ display:none; }
      .sc-cloud{ left:18%; }
    }
  `;
  document.head.appendChild(st);
}

/* ---- 그림 조각들 ---- */
function scSunSVG(tod, season) {
  if (tod === 'night') {
    if (season === 'autumn') {   // 보름달
      return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="20" fill="#FFD9A0"/><ellipse cx="21" cy="22" rx="5" ry="4" fill="#F5C78E"/><ellipse cx="34" cy="33" rx="6" ry="4.5" fill="#F5C78E"/><circle cx="31" cy="19" r="2.5" fill="#F5C78E"/></svg>`;
    }
    return `<svg viewBox="0 0 56 56"><defs><mask id="scm"><rect width="56" height="56" fill="#fff"/><circle cx="38" cy="22" r="15" fill="#000"/></mask></defs><circle cx="26" cy="30" r="19" fill="#FFF3C4" mask="url(#scm)"/></svg>`;
  }
  const rays = season === 'winter' ? '' : Array.from({ length: 8 }, (_, i) =>
    `<line x1="26" y1="3" x2="26" y2="9" stroke="var(--sun)" stroke-width="3" stroke-linecap="round" transform="rotate(${i * 45} 26 26)"/>`).join('');
  return `<svg viewBox="0 0 52 52"><g class="sc-rays">${rays}</g><circle cx="26" cy="26" r="${season === 'winter' ? 11 : 13}" fill="var(--sun)"/></svg>`;
}

function scGroundSVG() {
  return `<svg class="sc-ground" viewBox="0 0 400 84" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 34 Q70 6 150 26 T320 20 T400 30 L400 84 L0 84 Z" fill="var(--g2)"/>
    <path d="M0 52 Q100 30 200 46 T400 40 L400 84 L0 84 Z" fill="var(--g1)"/>
  </svg>`;
}

function scSunflower(h) {
  const petals = Array.from({ length: 12 }, (_, i) =>
    `<ellipse cx="22" cy="9" rx="3.6" ry="7" fill="#FFC93C" transform="rotate(${i * 30} 22 20)"/>`).join('');
  return `<svg class="sc-prop" width="44" height="${h}" viewBox="0 0 44 ${h}" aria-hidden="true">
    <path d="M22 ${h} L22 22" stroke="#5E9E3A" stroke-width="4" stroke-linecap="round"/>
    <path d="M22 ${h - 16} Q8 ${h - 24} 6 ${h - 38} Q20 ${h - 36} 22 ${h - 16}Z" fill="#6DB043"/>
    <path d="M22 ${h - 26} Q36 ${h - 32} 38 ${h - 44} Q24 ${h - 44} 22 ${h - 26}Z" fill="#79BC4D"/>
    ${petals}<circle cx="22" cy="20" r="7" fill="#8B5A2B"/><circle cx="20" cy="18" r="1.6" fill="#A8743A"/><circle cx="24" cy="22" r="1.6" fill="#A8743A"/>
  </svg>`;
}

function scPropsHTML(season) {
  const L = (svg) => svg.replace('class="sc-prop"', 'class="sc-prop sc-prop-l"');
  const R = (svg) => svg.replace('class="sc-prop"', 'class="sc-prop sc-prop-r"');
  if (season === 'spring') {
    const tree = `<svg class="sc-prop" width="66" height="82" viewBox="0 0 66 82" aria-hidden="true">
      <path d="M32 82 L32 48 M32 58 Q40 52 44 46 M32 52 Q25 47 21 42" stroke="#8B5E3C" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="33" cy="27" r="21" fill="#F9C6D4"/><circle cx="17" cy="37" r="13" fill="#F5AEC3"/><circle cx="50" cy="35" r="14" fill="#F5AEC3"/><circle cx="31" cy="20" r="11" fill="#FCDDE6"/>
      <circle cx="22" cy="29" r="2.2" fill="#fff" opacity=".85"/><circle cx="42" cy="22" r="2" fill="#fff" opacity=".85"/><circle cx="38" cy="38" r="2" fill="#fff" opacity=".8"/>
    </svg>`;
    const daisy = (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M0 0 L0 22" stroke="#6DB043" stroke-width="2.4" stroke-linecap="round"/>${[0, 72, 144, 216, 288].map(a => `<circle cx="0" cy="-5" r="3.6" fill="${c}" transform="rotate(${a})"/>`).join('')}<circle r="3" fill="#FFD166"/></g>`;
    const flowers = `<svg class="sc-prop" width="62" height="40" viewBox="0 0 62 40" aria-hidden="true">${daisy(12, 10, '#fff')}${daisy(30, 14, '#FFD6E2')}${daisy(48, 9, '#fff')}</svg>`;
    return L(flowers) + R(tree);
  }
  if (season === 'summer') {
    return L(scSunflower(74)) + R(scSunflower(58));
  }
  if (season === 'autumn') {
    const tree = `<svg class="sc-prop" width="66" height="82" viewBox="0 0 66 82" aria-hidden="true">
      <path d="M33 82 L33 46 M33 60 Q42 54 46 48 M33 54 Q25 48 21 43" stroke="#7A5232" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="33" cy="26" r="21" fill="#F29A3A"/><circle cx="17" cy="36" r="13" fill="#E8742F"/><circle cx="50" cy="35" r="14" fill="#F6C142"/><circle cx="31" cy="19" r="10" fill="#F7B04C"/>
    </svg>`;
    const pumpkin = `<svg class="sc-prop" width="46" height="38" viewBox="0 0 46 38" aria-hidden="true">
      <ellipse cx="15" cy="23" rx="12" ry="12" fill="#EE8A2B"/><ellipse cx="31" cy="23" rx="12" ry="12" fill="#EE8A2B"/><ellipse cx="23" cy="23" rx="10" ry="13" fill="#F6A03F"/>
      <path d="M23 11 Q22 5 26 2" stroke="#5E8E3A" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M23 12 Q16 9 15 14 Q20 15 23 12Z" fill="#6DB043"/>
    </svg>`;
    return L(tree) + R(pumpkin);
  }
  // winter
  const fir = `<svg class="sc-prop" width="58" height="82" viewBox="0 0 58 82" aria-hidden="true">
    <rect x="26" y="66" width="7" height="16" fill="#7A5232"/>
    <path d="M29 4 L48 34 L10 34 Z" fill="#3F8F5B"/><path d="M29 22 L52 56 L6 56 Z" fill="#3F8F5B"/><path d="M29 40 L56 72 L2 72 Z" fill="#357C4D"/>
    <path d="M29 4 L36 15 Q29 18 22 15 Z" fill="#fff"/><path d="M29 22 L38 35 Q29 39 20 35 Z" fill="#fff"/><path d="M29 40 L41 55 Q29 60 17 55 Z" fill="#fff"/>
  </svg>`;
  const snowman = `<svg class="sc-prop" width="44" height="64" viewBox="0 0 44 64" aria-hidden="true">
    <circle cx="22" cy="46" r="15" fill="#fff" stroke="#D5E3EF" stroke-width="1.5"/><circle cx="22" cy="23" r="11" fill="#fff" stroke="#D5E3EF" stroke-width="1.5"/>
    <circle cx="18.5" cy="21" r="1.5" fill="#2B2B2B"/><circle cx="25.5" cy="21" r="1.5" fill="#2B2B2B"/><path d="M22 24 L30 26 L22 27Z" fill="#F29A3A"/>
    <circle cx="22" cy="42" r="1.4" fill="#2B2B2B"/><circle cx="22" cy="48" r="1.4" fill="#2B2B2B"/>
    <path d="M12 15 L32 15 L29 4 L15 4Z" fill="#D64B5C"/><rect x="11" y="14" width="22" height="3.5" rx="1.7" fill="#B53A4A"/>
    <path d="M10 33 Q22 38 34 33" stroke="#5FA4D8" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
  return L(snowman) + R(fir);
}

function buildScene(state) {
  const { season, tod } = state;
  const rnd = sceneRand(season + '-' + tod);
  const r = (a, b) => a + rnd() * (b - a);
  let html = '';

  // 하늘: 해/달, 구름, 별
  html += `<div class="sc-celestial">${scSunSVG(tod, season)}</div>`;
  if (tod === 'day') {
    for (let i = 0; i < 3; i++) {
      html += `<div class="sc-cloud" style="--y:${Math.round(r(14, 70))}px; --d:${Math.round(r(70, 110))}s; --delay:-${Math.round(r(0, 90))}s; transform:scale(${r(.8, 1.2).toFixed(2)})"></div>`;
    }
  } else {
    for (let i = 0; i < 22; i++) {
      const s = r(1.5, 3.2).toFixed(1);
      html += `<div class="sc-star" style="--x:${r(3, 80).toFixed(1)}%; --y:${Math.round(r(8, 120))}px; --s:${s}px; --d:${r(2.2, 4.6).toFixed(1)}s; --delay:-${r(0, 4).toFixed(1)}s"></div>`;
    }
  }

  // 떨어지는 것들 / 반딧불
  const petal = (c) => `<svg viewBox="0 0 10 12"><path d="M5 0 C9 3 9 9 5 12 C1 9 1 3 5 0Z" fill="${c}"/></svg>`;
  const leaf = (c) => `<svg viewBox="0 0 12 12"><path d="M6 0 L7.5 3.5 L11 3 L8.5 6 L10 9.5 L6.5 8.5 L6 12 L5.5 8.5 L2 9.5 L3.5 6 L1 3 L4.5 3.5Z" fill="${c}"/></svg>`;
  const fall = (inner, cls, n, sMin, sMax) => {
    for (let i = 0; i < n; i++) {
      const s = r(sMin, sMax).toFixed(1);
      html += `<div class="sc-p ${cls}" style="--x:${r(0, 96).toFixed(1)}%; --s:${s}px; --d:${r(9, 16).toFixed(1)}s; --delay:-${r(0, 16).toFixed(1)}s; --dx:${Math.round(r(-40, 40))}px; --rot:${Math.round(r(-260, 260))}deg">${typeof inner === 'function' ? inner() : inner}</div>`;
    }
  };
  if (season === 'spring') { const cs = ['#F7A3BD', '#F9BFD0', '#F08CAB']; fall(() => petal(cs[Math.floor(rnd() * cs.length)]), '', 14, 10, 15); }
  if (season === 'autumn') { const cs = ['#E8742F', '#F29A3A', '#D64B2B', '#F6C142']; fall(() => leaf(cs[Math.floor(rnd() * cs.length)]), '', 12, 14, 20); }
  if (season === 'winter') { fall('', 'sc-snow', 26, 3, 6); }
  if (season === 'summer' && tod === 'night') {
    for (let i = 0; i < 12; i++) {
      html += `<div class="sc-fly" style="--x:${r(4, 92).toFixed(1)}%; --y:${Math.round(r(90, 230))}px; --d:${r(5, 9).toFixed(1)}s; --delay:-${r(0, 8).toFixed(1)}s"></div>`;
    }
  }

  // 땅 + 소품
  html += scGroundSVG() + scPropsHTML(season);
  return html;
}

function applyScene(force) {
  const stage = document.getElementById('cat-stage');
  if (!stage) return;
  const state = getSceneState();
  const key = state.season + '-' + state.tod;
  if (!force && key === sceneKey && document.getElementById('scene-bg')) return;
  sceneKey = key;

  ensureSceneStyle();
  let el = document.getElementById('scene-bg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'scene-bg';
    el.setAttribute('aria-hidden', 'true');
    stage.insertBefore(el, stage.firstChild);
  }
  el.className = `sc-root sc-${state.season} sc-${state.tod}`;
  el.innerHTML = buildScene(state);
  sizeScene();
}

// 장면 높이 = 고양이 그림 바닥까지(+땅 여유)
function sizeScene() {
  const stage = document.getElementById('cat-stage');
  const el = document.getElementById('scene-bg');
  const cat = document.getElementById('cat-illustration-container');
  if (!stage || !el || !cat || !cat.parentElement) return;
  const holder = cat.parentElement;
  if (!holder.offsetHeight) return;           // 로그인 전(숨김 상태)에는 측정 불가
  const h = holder.offsetTop + holder.offsetHeight + 30;
  el.style.setProperty('--scene-h', h + 'px');
  el.style.setProperty('--w', stage.clientWidth + 'px');
}

function initScene() {
  applyScene(true);
  const stage = document.getElementById('cat-stage');
  if (stage && 'ResizeObserver' in window) {
    sceneObserver = new ResizeObserver(() => sizeScene());
    sceneObserver.observe(stage);
  }
  window.addEventListener('resize', sizeScene);
  setInterval(() => applyScene(false), 60 * 1000);      // 06:00 / 18:00 / 계절이 바뀌는 순간 반영
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyScene(false); });
}
