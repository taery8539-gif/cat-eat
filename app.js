/**
 * 밥먹었냥 - Main App JavaScript Logic
 * Cozy Meadow Design System & Kakao Integration
 */

const STORAGE_KEY_RECORDS = 'BATMEOKGOTNYANG_RECORDS';
const STORAGE_KEY_USER = 'BATMEOKGOTNYANG_USER';

// State Variables
let records = [];
let currentKakaoUser = '태리';
let currentFilter = 'all'; // 'all', 'feeding', 'sighting'
let currentRecordTab = 'feeding'; // 'feeding', 'sighting'
let selectedPhotoBase64 = null;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  initRecords();
  initFormDateTime();
  renderApp();
});

/* ==========================================================================
   1. User & Storage Initialization
   ========================================================================== */

function initUser() {
  const savedUser = localStorage.getItem(STORAGE_KEY_USER);
  if (savedUser) {
    currentKakaoUser = savedUser;
  } else {
    currentKakaoUser = '태리';
    localStorage.setItem(STORAGE_KEY_USER, currentKakaoUser);
  }
  renderUserUI();
}

function renderUserUI() {
  const nameEl = document.getElementById('header-user-name');
  const avatarEl = document.getElementById('header-user-avatar');
  const modalNameEl = document.getElementById('modal-user-name');
  const modalAvatarEl = document.getElementById('modal-user-avatar');

  if (nameEl) nameEl.textContent = `${currentKakaoUser}님`;
  if (avatarEl) avatarEl.textContent = currentKakaoUser.charAt(0);
  if (modalNameEl) modalNameEl.textContent = `${currentKakaoUser}님`;
  if (modalAvatarEl) modalAvatarEl.textContent = currentKakaoUser.charAt(0);
}

function initRecords() {
  const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
  if (saved) {
    try {
      records = JSON.parse(saved);
    } catch (e) {
      records = [];
    }
  }

  // Seed default demo records if empty
  if (!records || records.length === 0) {
    records = generateDemoRecords();
    saveRecords();
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
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
      author: '민수',
      time: t2.toISOString(),
      sightingStatus: '건강해 보여요',
      memo: '화단 아래 따뜻한 햇살에서 느긋하게 자고 있는 것 발견!',
      photo: null,
      createdAt: t2.toISOString()
    },
    {
      id: 'demo-3',
      type: 'feeding',
      author: '지은',
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

function handleRecordSubmit(event) {
  event.preventDefault();

  const datetimeInput = document.getElementById('input-datetime').value;
  const recordTime = datetimeInput ? new Date(datetimeInput).toISOString() : new Date().toISOString();
  const memo = document.getElementById('input-memo').value.trim();

  const newRecord = {
    id: 'rec-' + Date.now(),
    type: currentRecordTab,
    author: currentKakaoUser,
    time: recordTime,
    memo: memo,
    photo: selectedPhotoBase64,
    createdAt: new Date().toISOString()
  };

  if (currentRecordTab === 'feeding') {
    const foodTypeEl = document.querySelector('input[name="foodType"]:checked');
    const catSeenEl = document.querySelector('input[name="catSeen"]:checked');
    newRecord.foodType = foodTypeEl ? foodTypeEl.value : '사료';
    newRecord.catSeen = catSeenEl ? (catSeenEl.value === 'true') : true;
  } else {
    const sightingStatusEl = document.querySelector('input[name="sightingStatus"]:checked');
    newRecord.sightingStatus = sightingStatusEl ? sightingStatusEl.value : '건강해 보여요';
  }

  records.unshift(newRecord);
  saveRecords();
  closeRecordModal();
  renderApp();

  // Trigger celebratory particle animation on cat
  triggerParticles('❤️');
}

function deleteRecord(id) {
  if (confirm('이 기록을 삭제하시겠습니까?')) {
    records = records.filter(r => r.id !== id);
    saveRecords();
    renderApp();
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
   5. Kakao Login Modal & Account Switcher
   ========================================================================== */

function openKakaoLoginModal() {
  document.getElementById('kakao-modal').classList.remove('hidden');
}

function closeKakaoLoginModal() {
  document.getElementById('kakao-modal').classList.add('hidden');
}

function selectKakaoPreset(name) {
  currentKakaoUser = name;
  localStorage.setItem(STORAGE_KEY_USER, currentKakaoUser);
  renderUserUI();
  closeKakaoLoginModal();
}

function selectKakaoCustom() {
  const input = document.getElementById('custom-kakao-name');
  const val = input.value.trim();
  if (val) {
    currentKakaoUser = val;
    localStorage.setItem(STORAGE_KEY_USER, currentKakaoUser);
    renderUserUI();
    input.value = '';
    closeKakaoLoginModal();
  }
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
