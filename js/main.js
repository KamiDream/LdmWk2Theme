/**
 * LightDM WebKit Theme — 登录交互逻辑（兼容 WebKit1 / WebKit2）
 */
'use strict';

// ==========================================
// 状态 & DOM 引用
// ==========================================
const state = {
    users: [], sessions: [], currentUser: null, currentSession: null,
    currentUserIndex: 0, isAuthenticating: false, isLoggedIn: false,
    _promptReceived: false,
};

const dom = {
    statusTime: document.getElementById('status-time'),
    passwordContainer: document.getElementById('password-container'),
    passwordInput: document.getElementById('password-input'),
    loginBtn: document.getElementById('login-btn'),
    messageContainer: document.getElementById('message-container'),
    sessionBtn: document.getElementById('session-btn'),
    sessionName: document.getElementById('session-name'),
    sessionDropdown: document.getElementById('session-dropdown'),
    sessionList: document.getElementById('session-list'),
    restartBtn: document.getElementById('restart-btn'),
    shutdownBtn: document.getElementById('shutdown-btn'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    userDropdown: document.getElementById('user-dropdown'),
    userListDropdown: document.getElementById('user-list-dropdown'),
    userAvatar: document.getElementById('user-avatar'),
    userAvatarContainer: document.getElementById('user-avatar-container'),
    userAvatarFallback: document.getElementById('user-avatar-fallback'),
};

// ==========================================
// LightDM 回调绑定（同时设全局函数 + lightdm 属性 + Qt .connect 三保险）
// ==========================================
(function bind() {
    if (typeof lightdm === 'undefined') return;

    const hasConnect = lightdm.authentication_complete && typeof lightdm.authentication_complete.connect === 'function';

    // 全局函数（WebKit1 必须）
    window.show_prompt = function (t) { state._promptReceived = true; onPrompt(t); };
    window.authentication_complete = onAuthComplete;
    window.show_message = function (t, type) { if (t) showMsg(t, type === 'error' ? 'error' : 'info'); };
    window.show_error = function (t) { showMsg(t, 'error'); };
    window.autologin_timer_expired = function () {};

    if (hasConnect) {
        lightdm.authentication_complete.connect(onAuthComplete);
        lightdm.show_prompt.connect(function (t) { state._promptReceived = true; onPrompt(t); });
        lightdm.show_message.connect(function (t, type) { if (t) showMsg(t, type === 'error' ? 'error' : 'info'); });
    } else {
        lightdm.authentication_complete = onAuthComplete;
        lightdm.show_prompt = function (t) { state._promptReceived = true; onPrompt(t); };
        lightdm.show_message = function (t, type) { if (t) showMsg(t, type === 'error' ? 'error' : 'info'); };
    }
})();

// ==========================================
// 时钟
// ==========================================
(function () {
    const D = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    function tick() {
        const d = new Date();
        dom.statusTime.textContent =
            `${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 ${D[d.getDay()]} ` +
            `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    }
    tick(); setInterval(tick, 1000);
})();

// ==========================================
// LightDM API 辅助（函数级能力检测）
// ==========================================
let LDM = typeof lightdm !== 'undefined' && lightdm ? lightdm : null;

function ldCall(method, ...args) {
    if (!LDM || typeof LDM[method] !== 'function') return false;
    try { LDM[method](...args); return true; }
    catch (e) { console.error('[LDM]', method, 'failed:', e.message); return false; }
}

const auth   = u => ldCall('start_authentication', u) || ldCall('authenticate', u);
const respond = p => ldCall('provide_secret', p) || ldCall('respond', p);
const cxl    = () => ldCall('cancel_authentication');

function startSession() {
    const user = state.currentUser;
    const sk = state.currentSession ? state.currentSession.key
        : (LDM && LDM.sessions && LDM.sessions[0] ? LDM.sessions[0].key : '');
    ldCall('login', user, sk) || ldCall('start_session', sk || (LDM && LDM.default_session));
}

function getUsers() {
    return LDM ? (LDM.users || []).map(u => ({
        username: u.username || u.name || '',
        display_name: u.display_name || u.real_name || u.name || '',
        image: u.image || '',
    })) : [];
}
const getSessions = () => LDM ? LDM.sessions || [] : [];

// ==========================================
// 用户选择
// ==========================================
function updateCurrentUser() {
    if (!state.users.length) return;
    state.currentUser = state.users[state.currentUserIndex];
    dom.userAvatar.src = state.currentUser.image ? 'file://' + state.currentUser.image : '';
    dom.userAvatarFallback.textContent = state.currentUser.image ? ''
        : (state.currentUser.display_name || state.currentUser.username).charAt(0).toUpperCase();
}

function buildUserDropdown() {
    dom.userListDropdown.innerHTML = '';
    state.users.forEach((u, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="drop-avatar">${(u.display_name||u.username).charAt(0).toUpperCase()}</span>${u.display_name||u.username}`;
        if (i === state.currentUserIndex) li.classList.add('active');
        li.addEventListener('click', () => {
            if (i === state.currentUserIndex) { dom.userDropdown.classList.add('hidden'); return; }
            state.currentUserIndex = i;
            cxl(); resetLoginState(); updateCurrentUser();
            dom.userDropdown.classList.add('hidden');
            setTimeout(startAuth, 100);
        });
        dom.userListDropdown.appendChild(li);
    });
}

// ==========================================
// 会话管理（localStorage 记忆）
// ==========================================
function updateSessions() {
    state.sessions = getSessions();
    let defKey = (LDM && LDM.default_session) || (state.sessions[0] && state.sessions[0].key);
    dom.sessionList.innerHTML = '';
    if (!state.sessions.length) { dom.sessionName.textContent = '无可用的会话'; return; }

    if (state.currentUser) {
        const saved = localStorage.getItem('s_' + state.currentUser.username);
        if (saved && state.sessions.some(s => s.key === saved)) defKey = saved;
    }

    state.currentSession = state.sessions[0];
    dom.sessionName.textContent = state.sessions[0].name;

    state.sessions.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = s.name; li.dataset.index = i;
        if (s.key === defKey) { li.classList.add('active'); state.currentSession = s; dom.sessionName.textContent = s.name; }
        li.addEventListener('click', () => {
            state.currentSession = s; dom.sessionName.textContent = s.name;
            if (state.currentUser) localStorage.setItem('s_' + state.currentUser.username, s.key);
            dom.sessionList.querySelector('.active') && dom.sessionList.querySelector('.active').classList.remove('active');
            li.classList.add('active');
            dom.sessionDropdown.classList.add('hidden');
        });
        dom.sessionList.appendChild(li);
    });
}

// ==========================================
// 登录流程
// ==========================================
var _cancelGuard = false;

function showMsg(m, t) { dom.messageContainer.textContent = m; dom.messageContainer.className = t || 'info'; }
function showLoad(t) { dom.loadingOverlay.classList.remove('hidden'); dom.loadingText.textContent = t || '正在处理...'; }
function hideLoad() { dom.loadingOverlay.classList.add('hidden'); }

function resetLoginState() {
    state.isAuthenticating = false; state.isLoggedIn = false; state._promptReceived = false;
    dom.passwordInput.value = ''; dom.passwordInput.disabled = true; dom.loginBtn.disabled = true;
    dom.messageContainer.textContent = ''; dom.messageContainer.className = '';
    hideLoad();
}

function startAuth() {
    if (!state.currentUser) { showMsg('No available user', 'error'); return; }
    _cancelGuard = true; cxl(); _cancelGuard = false;

    state.isAuthenticating = true; state._promptReceived = false;
    dom.passwordInput.disabled = false; dom.passwordInput.focus(); dom.loginBtn.disabled = true;

    setTimeout(() => auth(state.currentUser.username), 50);

    clearTimeout(state._authTimer);
    state._authTimer = setTimeout(() => {
        if (state.isAuthenticating && !state.isLoggedIn) {
            state.isAuthenticating = false; state._promptReceived = false;
            dom.userAvatarContainer.classList.remove('auth-loading');
            hideLoad(); dom.passwordInput.disabled = false; dom.loginBtn.disabled = true;
        }
    }, 30000);
}

function submitPassword() {
    if (state.isLoggedIn) return;
    if (!state.isAuthenticating) { startAuth(); return; }
    if (!state._promptReceived) { return; }
    if (!dom.passwordInput.value) return;

    dom.userAvatarContainer.classList.add('auth-loading');
    dom.loginBtn.disabled = true; dom.passwordInput.disabled = true;
    respond(dom.passwordInput.value);
}

function onAuthComplete() {
    if (_cancelGuard) return;
    dom.userAvatarContainer.classList.remove('auth-loading');
    hideLoad(); clearTimeout(state._authTimer);
    if (!LDM) return;

    if (LDM.is_authenticated) {
        state.isLoggedIn = true;
        showMsg('验证成功，正在登录...', 'success');
        showLoad('正在登录...');
        startSession();
    } else {
        state.isAuthenticating = false;
        dom.passwordInput.value = '';
        dom.passwordContainer.classList.add('error-outline');
        setTimeout(() => dom.passwordContainer.classList.remove('error-outline'), 1500);
        setTimeout(() => { if (!state.isLoggedIn) startAuth(); }, 300);
    }
}

function onPrompt(text) {
    if (state.isAuthenticating && !state.isLoggedIn && dom.passwordInput.disabled) {
        dom.passwordInput.disabled = false; dom.passwordInput.value = '';
        dom.loginBtn.disabled = false; dom.passwordInput.focus();
        return;
    }
    if (state.isAuthenticating && !state.isLoggedIn) dom.loginBtn.disabled = false;
    if (state.isAuthenticating && dom.passwordInput.value && !dom.passwordInput.disabled) submitPassword();
}

// ==========================================
// 电源管理
// ==========================================
function initPower() {
    if (!LDM) return;
    dom.restartBtn.style.display = LDM.can_restart ? 'flex' : 'none';
    dom.shutdownBtn.style.display = LDM.can_shutdown ? 'flex' : 'none';
}

// ==========================================
// 自适应缩放（基于 1920×1080 参考分辨率）
// ==========================================
const SCALE_REF_W = 1920;
const SCALE_REF_H = 1080;

function applyScale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / SCALE_REF_W, h / SCALE_REF_H);
    // 限制缩放范围，防止极端值
    const clamped = Math.max(0.4, Math.min(scale, 3));
    document.documentElement.style.setProperty('--scale', clamped);
}

/**
 * 创建 #scale-wrap 包装器，将需要缩放的 DOM 包裹其中。
 * #background / #loading-overlay 保留在包装器外，避免缩放影响其 fixed 定位。
 */
function initScaleWrap() {
    if (document.getElementById('scale-wrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'scale-wrap';

    // 不需要包装的 fixed 元素选择器列表
    const exclude = new Set(['#background', '#loading-overlay']);
    const children = Array.from(document.body.children);
    for (const child of children) {
        if (!exclude.has('#' + child.id)) {
            wrap.appendChild(child);
        }
    }
    document.body.appendChild(wrap);
}

// ==========================================
// 事件绑定
// ==========================================
dom.userAvatarContainer.addEventListener('click', e => { e.stopPropagation(); if (state.users.length > 1) { buildUserDropdown(); dom.userDropdown.classList.toggle('hidden'); } });
dom.passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitPassword(); } });
dom.loginBtn.addEventListener('click', submitPassword);
dom.sessionBtn.addEventListener('click', e => { e.stopPropagation(); dom.sessionDropdown.classList.toggle('hidden'); });

document.addEventListener('click', e => {
    if (!dom.sessionBtn.contains(e.target) && !dom.sessionDropdown.contains(e.target)) dom.sessionDropdown.classList.add('hidden');
    if (!dom.userAvatarContainer.contains(e.target) && !dom.userDropdown.contains(e.target)) dom.userDropdown.classList.add('hidden');
});

dom.restartBtn.addEventListener('click', () => { if (LDM && LDM.can_restart) { showLoad('正在重启...'); LDM.restart(); } });
dom.shutdownBtn.addEventListener('click', () => { if (LDM && LDM.can_shutdown) { showLoad('正在关机...'); LDM.shutdown(); } });

// ==========================================
// 初始化
// ==========================================
var _initDone = false;

function initTheme() {
    if (_initDone) return;
    _initDone = true;
    try {
        // 缩放初始化
        initScaleWrap();
        applyScale();
        window.addEventListener('resize', applyScale);

        state.users = getUsers();
        if (!state.users.length) { dom.passwordInput.disabled = true; dom.loginBtn.disabled = true; showMsg('No available user accounts', 'error'); return; }
        state.currentUserIndex = 0; updateCurrentUser(); updateSessions(); initPower();
        startAuth();
    } catch (e) { console.error('[LDM] Init failed:', e); showMsg('Theme initialization failed', 'error'); }
}

window.greeter_ready = initTheme;
if (LDM) setTimeout(initTheme, 100);

// ==========================================
// 开发模式 Mock
// ==========================================
if (!LDM) {
    window.lightdm = {
        users: [
            { username: 'alice', display_name: 'Alice' },
            { username: 'bob', display_name: 'Bob' },
            { username: 'charlie', display_name: 'Charlie' },
        ],
        sessions: [
            { key: 'gnome', name: 'GNOME' }, { key: 'plasma', name: 'KDE Plasma' },
            { key: 'xfce', name: 'Xfce Session' }, { key: 'i3', name: 'i3' },
        ],
        default_session: 'gnome', is_authenticated: false, can_restart: true, can_shutdown: true,
        authenticate(u) { setTimeout(() => (window.show_prompt||this.show_prompt)('Password:'), 200); },
        respond(s) { setTimeout(() => { this.is_authenticated = s === 'password'; if (this.authentication_complete) this.authentication_complete(); }, 300); },
        cancel_authentication() {},
        start_session(k) { alert('[Dev] Mock start session: ' + k); state.isLoggedIn = false; state.isAuthenticating = false; dom.passwordInput.disabled = false; dom.loginBtn.disabled = false; dom.passwordInput.value = ''; dom.passwordInput.focus(); hideLoad(); },
        restart() { alert('[Dev] Mock restart'); },
        shutdown() { alert('[Dev] Mock shutdown'); },
    };
    LDM = window.lightdm;
    initTheme();
}
