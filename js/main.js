/**
 * LdmWk2Theme — LightDM WebKit2 登录主题
 * 仅兼容 lightdm-webkit2-greeter（WebKit2 API）。
 */
'use strict';

// ==========================================
// 状态 & DOM 引用
// ==========================================
const state = {
    users: [], sessions: [], currentUser: null, currentSession: null,
    currentUserIndex: 0, isAuthenticating: false, isLoggedIn: false,
    isSubmitting: false, _pendingSubmit: false, _promptReceived: false,
    _authTimer: null,
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
// 时钟
// ==========================================
(function () {
    const D = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    function tick() {
        const d = new Date();
        dom.statusTime.textContent =
            `${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${D[d.getDay()]} ` +
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
    tick(); setInterval(tick, 1000);
})();

// ==========================================
// LightDM 桥接（lightdm-webkit2-greeter）
// ==========================================
let LDM = (typeof lightdm !== 'undefined' && lightdm) ? lightdm : null;
let _bound = false;
let _cancelGuard = false;

function ldCall(method, ...args) {
    if (!LDM || typeof LDM[method] !== 'function') return false;
    try { LDM[method](...args); return true; }
    catch (e) { console.error('[LDM]', method, 'failed:', e.message); return false; }
}

const auth    = u => ldCall('authenticate', u);
const respond = p => ldCall('respond', p);
const cxl     = () => ldCall('cancel_authentication');

/**
 * 绑定 greeter 回调。lightdm-webkit2-greeter 的通知机制在不同版本间有差异，
 * 因此同时支持两种方式（互不冲突，按能力检测逐个启用）：
 *  1. 全局函数：greeter 直接调用 window.show_prompt / window.authentication_complete 等；
 *  2. Qt 信号：lightdm.* 上的 .connect() 订阅。
 */
function bindSignals() {
    if (_bound || !LDM) return;
    _bound = true;

    // 方式一：全局函数（部分 greeter 版本通过调用全局函数通知主题）
    window.show_prompt = function (t) { onPrompt(t); };
    window.authentication_complete = onAuthComplete;
    window.show_message = function (t, type) { if (t) showMsg(t, type === 'error' ? 'error' : 'info'); };
    window.show_error = function (t) { showMsg(t, 'error'); };
    window.autologin_timer_expired = function () {};

    // 方式二：Qt 信号 .connect()（逐个检测，避免单个信号缺失导致整体失败）
    const signals = [
        ['authentication_complete', onAuthComplete],
        ['show_prompt', onPrompt],
        ['show_message', function (t, type) { if (t) showMsg(t, type === 'error' ? 'error' : 'info'); }],
    ];
    signals.forEach(function (pair) {
        const sig = LDM[pair[0]];
        if (sig && typeof sig.connect === 'function') {
            try { sig.connect(pair[1]); }
            catch (e) { console.error('[LDM] connect', pair[0], 'failed:', e); }
        }
    });
}

// ==========================================
// 工具：用户/会话数据
// ==========================================
function getUsers() {
    return LDM ? (LDM.users || []).map(u => ({
        username: u.username || u.name || '',
        display_name: u.display_name || u.real_name || u.username || u.name || '',
        image: u.image || '',
    })) : [];
}

const getSessions = () => LDM ? LDM.sessions || [] : [];

/**
 * 将用户头像路径转为可加载的 URL。
 * 若已是 URL/scheme 则原样返回；否则按 file:// 前缀并编码路径（空格/中文等）。
 */
function avatarSrc(image) {
    if (!image) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(image)) return image;
    return 'file://' + image.split('/').map(encodeURIComponent).join('/');
}

// ==========================================
// 用户选择
// ==========================================
function updateCurrentUser() {
    if (!state.users.length) return;
    state.currentUser = state.users[state.currentUserIndex];
    const name = state.currentUser.display_name || state.currentUser.username || '';
    dom.userAvatarFallback.textContent = (name.charAt(0) || '?').toUpperCase();

    const src = avatarSrc(state.currentUser.image);
    // 加载失败时回退到占位字母
    dom.userAvatar.onerror = function () { dom.userAvatar.removeAttribute('src'); };
    if (src) dom.userAvatar.src = src;
    else dom.userAvatar.removeAttribute('src');
}

function buildUserDropdown() {
    dom.userListDropdown.innerHTML = '';
    state.users.forEach((u, i) => {
        const li = document.createElement('li');
        const name = u.display_name || u.username || '';

        const span = document.createElement('span');
        span.className = 'drop-avatar';
        span.textContent = (name.charAt(0) || '?').toUpperCase();

        const label = document.createElement('span');
        label.textContent = name;

        li.appendChild(span);
        li.appendChild(label);

        if (i === state.currentUserIndex) li.classList.add('active');

        li.addEventListener('click', () => {
            if (i === state.currentUserIndex) { dom.userDropdown.classList.add('hidden'); return; }
            state.currentUserIndex = i;
            updateCurrentUser();
            dom.userDropdown.classList.add('hidden');
            // startAuth 内部会 cancel 旧认证并复位状态，避免重复 cancel 造成幽灵回调竞态
            startAuth();
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
            const active = dom.sessionList.querySelector('.active');
            if (active) active.classList.remove('active');
            li.classList.add('active');
            dom.sessionDropdown.classList.add('hidden');
        });
        dom.sessionList.appendChild(li);
    });
}

// ==========================================
// 登录流程
// ==========================================
function showMsg(m, t) { dom.messageContainer.textContent = m; dom.messageContainer.className = t || 'info'; }
function showLoad(t) { dom.loadingOverlay.classList.remove('hidden'); dom.loadingText.textContent = t || '正在处理...'; }
function hideLoad() { dom.loadingOverlay.classList.add('hidden'); }

/**
 * 复位到“可重试”状态：停止认证、清空输入、恢复输入框可用并聚焦。
 * 用户再次回车时将重新启动认证（见 submitPassword）。
 */
function resetToRetryable() {
    state.isAuthenticating = false; state.isLoggedIn = false;
    state.isSubmitting = false; state._pendingSubmit = false; state._promptReceived = false;
    dom.userAvatarContainer.classList.remove('auth-loading');
    dom.passwordContainer.classList.remove('error-outline');
    dom.passwordInput.value = '';
    dom.passwordInput.disabled = false; dom.loginBtn.disabled = false;
    dom.passwordInput.focus();
    clearTimeout(state._authTimer);
    hideLoad();
}

function startAuth() {
    if (!state.currentUser) { showMsg('没有可用用户', 'error'); return; }
    // 取消旧认证。cancel_authentication 会触发一次“幽灵” authentication_complete，
    // 由 _cancelGuard 在 onAuthComplete 中吞掉，避免误判为认证结果。
    _cancelGuard = true;
    cxl();

    state.isAuthenticating = true; state._promptReceived = false;
    state.isSubmitting = false; state._pendingSubmit = false;
    // 认证代数：用于让旧的延迟回调（authenticate / 超时）在新一轮认证启动后自动失效，
    // 防止快速切换用户等场景下重复调用 authenticate。
    state._authGeneration = (state._authGeneration || 0) + 1;
    const gen = state._authGeneration;
    dom.userAvatarContainer.classList.remove('auth-loading');
    dom.passwordContainer.classList.remove('error-outline');
    dom.passwordInput.value = '';
    dom.passwordInput.disabled = true; dom.loginBtn.disabled = true;
    dom.messageContainer.textContent = ''; dom.messageContainer.className = '';

    clearTimeout(state._authTimer);
    state._authTimer = setTimeout(() => {
        if (gen !== state._authGeneration) return;
        // 仅在认证“卡死”时提示超时并复位：
        //   - 提示始终未到达（认证未正常启动），或
        //   - 已提交密码但结果迟迟未返回（isSubmitting 一直为真）。
        // 若提示已正常到达且用户只是空闲等待输入（未提交），不做任何处理，避免打扰用户。
        if (state.isAuthenticating && !state.isLoggedIn && (!state._promptReceived || state.isSubmitting)) {
            showMsg('认证超时，请重新输入密码', 'error');
            resetToRetryable();
        }
    }, 30000);

    setTimeout(() => {
        if (gen !== state._authGeneration || state.isLoggedIn) return;
        if (!auth(state.currentUser.username)) {
            showMsg('无法启动认证，请重试', 'error');
            resetToRetryable();
        }
    }, 50);
}

function submitPassword() {
    if (state.isLoggedIn) return;
    if (state.isSubmitting) return;              // 防重入：按键连发/重复点击只提交一次
    if (!dom.passwordInput.value) return;

    if (!state.isAuthenticating) {
        // 空闲/超时后的重试：先重新启动认证。startAuth 同步置 isAuthenticating，
        // 因此后续 key-repeat 不会触发第二次启动。
        // startAuth 会清空输入框，故先保存密码、重启后再写回，避免密码被吞掉。
        const pw = dom.passwordInput.value;
        startAuth();
        dom.passwordInput.value = pw;
    }
    if (!state._promptReceived) {
        // 提示尚未到达：仅记录提交意图，由 onPrompt 在提示到达时自动提交
        state._pendingSubmit = true;
        return;
    }

    state.isSubmitting = true; state._pendingSubmit = false;
    dom.userAvatarContainer.classList.add('auth-loading');
    dom.loginBtn.disabled = true; dom.passwordInput.disabled = true;

    if (!respond(dom.passwordInput.value)) {
        state.isSubmitting = false;
        dom.userAvatarContainer.classList.remove('auth-loading');
        showMsg('无法提交密码，请重试', 'error');
        resetToRetryable();
    }
}

function onAuthComplete() {
    // 吞掉取消认证产生的“幽灵”回调，并复位守卫
    if (_cancelGuard) { _cancelGuard = false; return; }
    dom.userAvatarContainer.classList.remove('auth-loading');
    hideLoad();
    clearTimeout(state._authTimer);
    state.isSubmitting = false; state._pendingSubmit = false;
    if (!LDM) return;

    if (LDM.is_authenticated) {
        state.isLoggedIn = true; state.isAuthenticating = false;
        showMsg('验证成功，正在登录...', 'success');
        showLoad('正在登录...');
        startSession();
    } else {
        state.isAuthenticating = false; state._promptReceived = false;
        dom.passwordInput.value = '';
        // 保留 greeter 通过 show_message 给出的具体提示；无提示时才补充通用文案
        if (!dom.messageContainer.textContent) showMsg('认证失败，请重试', 'error');
        // 错误描边显示期间禁止输入，描边结束后再恢复输入以便重试
        dom.passwordInput.disabled = true; dom.loginBtn.disabled = true;
        dom.passwordContainer.classList.remove('error-outline');
        dom.passwordContainer.classList.add('error-outline');
        setTimeout(() => {
            dom.passwordContainer.classList.remove('error-outline');
            dom.passwordInput.disabled = false; dom.loginBtn.disabled = false;
            dom.passwordInput.focus();
        }, 1500);
    }
}

function onPrompt(text) {
    _cancelGuard = false;
    // 提交后认证结果尚未返回（isSubmitting）时，忽略 greeter 的后续 show_prompt，
    // 避免输入框被重新启用（等待结果期间不应再允许输入）。
    if (state.isSubmitting || state.isLoggedIn) return;
    if (!state.isAuthenticating) return;
    state._promptReceived = true;

    if (dom.passwordInput.disabled) {
        dom.passwordInput.disabled = false;
        dom.loginBtn.disabled = false;
        dom.passwordInput.focus();
    } else {
        dom.loginBtn.disabled = false;
    }
    // 仅当用户在提示到达前已按回车（_pendingSubmit）且已输入密码时才自动提交
    if (state._pendingSubmit && dom.passwordInput.value && !dom.passwordInput.disabled) {
        submitPassword();
    }
}

function startSession() {
    if (!LDM) return;
    const sk = (state.currentSession && state.currentSession.key) || LDM.default_session || '';
    if (!sk) {
        hideLoad();
        showMsg('无可用会话，请选择会话后重试', 'error');
        resetToRetryable();
        return;
    }
    try {
        if (typeof LDM.start_session === 'function' && LDM.start_session(sk) === false) {
            throw new Error('start_session returned false');
        }
    } catch (e) {
        console.error('[LDM] start_session failed:', e);
        hideLoad();
        showMsg('会话启动失败，请重试', 'error');
        resetToRetryable();
    }
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
    const scale = Math.min(w / SCALE_REF_W, h / SCALE_REF_H) * 1.12;
    // 限制缩放范围，防止极端值
    const clamped = Math.max(0.4, Math.min(scale, 4));
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
// 初始化（greeter_ready 触发 + 就绪轮询兜底）
// lightdm 对象及其数据（users/sessions）在部分 greeter 版本中是异步注入的，
// 因此在数据就绪前以固定间隔重试，避免“过早初始化导致无用户且无法恢复”。
// ==========================================
let _initDone = false;
let _greeterReadyFired = false;
let _initRetries = 0;
const INIT_RETRY_DELAY = 200;
const INIT_MAX_RETRIES = 60;   // 约 12 秒后仍未就绪则给出错误提示

function initTheme() {
    if (_initDone) return;

    const hasLDM = typeof lightdm !== 'undefined' && lightdm;
    const hasUsers = hasLDM && lightdm.users && lightdm.users.length;

    if (!hasUsers) {
        // 数据尚未就绪：稍后重试
        _initRetries++;
        if (_initRetries > INIT_MAX_RETRIES) {
            _initDone = true;
            showMsg(hasLDM ? '没有可用用户账户' : '此主题需在 lightdm-webkit2-greeter 环境中运行', 'error');
            return;
        }
        setTimeout(initTheme, INIT_RETRY_DELAY);
        return;
    }

    _initDone = true;
    LDM = lightdm;

    try {
        bindSignals();
        initScaleWrap();
        applyScale();
        window.addEventListener('resize', applyScale);

        state.users = getUsers();
        state.currentUserIndex = 0;
        updateCurrentUser(); updateSessions(); initPower();
        startAuth();
    } catch (e) {
        console.error('[LDM] Init failed:', e);
        showMsg('主题初始化失败', 'error');
    }
}

window.greeter_ready = function () { _greeterReadyFired = true; initTheme(); };

// 兜底：若 greeter 未在设定时间内调用 greeter_ready（部分版本注入时机不同），
// 自行启动就绪轮询，确保主题能完成初始化。
setTimeout(function () {
    if (!_initDone && !_greeterReadyFired) initTheme();
}, 500);
