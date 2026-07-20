/**
 * LightDM WebKit Theme - 登录交互逻辑
 * 兼容 lightdm-webkit (WebKit1) 和 lightdm-webkit2-greeter
 */
'use strict';

// ==========================================
// 状态
// ==========================================
const state = {
    users: [],
    currentUser: null,
    currentUserIndex: 0,
    sessions: [],
    currentSession: null,
    isAuthenticating: false,
    isLoggedIn: false,
    _promptReceived: false,
};

// ==========================================
// DOM 引用
// ==========================================
const dom = {
    statusTime:       document.getElementById('status-time'),
    passwordContainer: document.getElementById('password-container'),
    passwordInput:    document.getElementById('password-input'),
    loginBtn:         document.getElementById('login-btn'),
    messageContainer: document.getElementById('message-container'),
    sessionBtn:       document.getElementById('session-btn'),
    sessionName:      document.getElementById('session-name'),
    sessionDropdown:  document.getElementById('session-dropdown'),
    sessionList:      document.getElementById('session-list'),
    restartBtn:       document.getElementById('restart-btn'),
    shutdownBtn:      document.getElementById('shutdown-btn'),
    loadingOverlay:   document.getElementById('loading-overlay'),
    loadingText:      document.getElementById('loading-text'),
    userDropdown:     document.getElementById('user-dropdown'),
    userListDropdown: document.getElementById('user-list-dropdown'),
    userAvatar:       document.getElementById('user-avatar'),
    userAvatarContainer: document.getElementById('user-avatar-container'),
};

// ==========================================
// LightDM 回调绑定（同时设置全局函数 + lightdm 属性，覆盖所有 Greeter 变体）
// ==========================================
(function bindCallbacks() {
    if (typeof lightdm === 'undefined') return;

    const onAuth = function () { onAuthenticationComplete(); };
    const onPrompt = function (text, type) { onShowPrompt(text); };
    const onMsg = function (text, type) { onShowMessage(text, type); };

    // Qt .connect() 信号（部分 greeter 变体）
    if (lightdm.authentication_complete && lightdm.authentication_complete.connect) {
        lightdm.authentication_complete.connect(onAuth);
        lightdm.show_prompt.connect(onPrompt);
        lightdm.show_message.connect(onMsg);
    }

    // 全局函数（WebKit1）
    window.show_prompt = onPrompt;
    window.show_message = onMsg;
    window.authentication_complete = onAuth;
    window.show_error = function (t) { onShowMessage(t, 'error'); };
    window.autologin_timer_expired = function () {};

    // lightdm 属性（WebKit2）
    if (lightdm.authentication_complete && !lightdm.authentication_complete.connect) {
        lightdm.authentication_complete = onAuth;
        lightdm.show_prompt = onPrompt;
        lightdm.show_message = onMsg;
    }
})();

// ==========================================
// 时钟
// ==========================================
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function updateClock() {
    const d = new Date();
    dom.statusTime.textContent =
        `${String(d.getMonth() + 1).padStart(2, '0')}月` +
        `${String(d.getDate()).padStart(2, '0')}日 ` +
        `${WEEKDAYS[d.getDay()]} ` +
        `${String(d.getHours()).padStart(2, '0')}:` +
        `${String(d.getMinutes()).padStart(2, '0')}:` +
        `${String(d.getSeconds()).padStart(2, '0')}`;
}
updateClock();
setInterval(updateClock, 1000);

// ==========================================
// LightDM API 辅助（函数级能力检测）
// ==========================================
let LDM = typeof lightdm !== 'undefined' && lightdm ? lightdm : null;

function ldCall(method, ...args) {
    if (!LDM || typeof LDM[method] !== 'function') return false;
    try { LDM[method](...args); return true; }
    catch (e) { console.error('[LDM]', method, 'failed:', e.message); return false; }
}

// 认证：优先 start_authentication (WebKit1)，回退 authenticate (WebKit2)
function authenticate(username) {
    ldCall('start_authentication', username) || ldCall('authenticate', username);
}

// 密码：优先 provide_secret，回退 respond
function respond(password) {
    ldCall('provide_secret', password) || ldCall('respond', password);
}

// 取消认证
function cancelAuth() { ldCall('cancel_authentication'); }

// 启动会话：优先 login (WebKit1)，回退 start_session (WebKit2)
function startSession() {
    const user = state.currentUser;
    const sk = state.currentSession ? state.currentSession.key
        : (LDM && LDM.sessions && LDM.sessions[0] ? LDM.sessions[0].key : '');
    if (!ldCall('login', user, sk)) {
        ldCall('start_session', sk || (LDM && LDM.default_session));
    }
}

// 用户/会话列表（规范化 WebKit1 name/real_name → WebKit2 username/display_name）
function getUsers() {
    if (!LDM) return [];
    return (LDM.users || []).map(u => ({
        username: u.username || u.name || '',
        display_name: u.display_name || u.real_name || u.name || '',
        image: u.image || '',
    }));
}

function getSessions() { return LDM ? LDM.sessions || [] : []; }

// ==========================================
// 用户选择
// ==========================================
function updateCurrentUser() {
    if (!state.users.length) return;
    state.currentUser = state.users[state.currentUserIndex];
    const u = state.currentUser;
    const fallback = document.getElementById('user-avatar-fallback');
    dom.userAvatar.src = u.image ? 'file://' + u.image : '';
    if (fallback) fallback.textContent = u.image ? '' : (u.display_name || u.username).charAt(0).toUpperCase();
}

function buildUserDropdown() {
    dom.userListDropdown.innerHTML = '';
    state.users.forEach((u, i) => {
        const li = document.createElement('li');
        const init = (u.display_name || u.username).charAt(0).toUpperCase();
        li.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);font-size:13px;flex-shrink:0;">${init}</span>${u.display_name || u.username}`;
        if (i === state.currentUserIndex) li.classList.add('active');
        li.addEventListener('click', () => selectUserFromDropdown(i));
        dom.userListDropdown.appendChild(li);
    });
}

function selectUserFromDropdown(index) {
    if (index === state.currentUserIndex) { hideUserDropdown(); return; }
    state.currentUserIndex = index;
    cancelAuth();
    resetLoginState();
    updateCurrentUser();
    hideUserDropdown();
    setTimeout(startAuthentication, 100);
}

function toggleUserDropdown() {
    if (state.users.length < 2) return;
    buildUserDropdown();
    dom.userDropdown.classList.toggle('hidden');
}
function hideUserDropdown() { dom.userDropdown.classList.add('hidden'); }

// ==========================================
// 会话管理（localStorage 记忆）
// ==========================================
function updateSessions() {
    state.sessions = getSessions();
    let defKey = (LDM && LDM.default_session) || (state.sessions[0] ? state.sessions[0].key : null);

    dom.sessionList.innerHTML = '';
    if (!state.sessions.length) { dom.sessionName.textContent = '无可用的会话'; return; }

    // localStorage 恢复
    if (state.currentUser) {
        const saved = localStorage.getItem('session_' + state.currentUser.username);
        if (saved && state.sessions.some(s => s.key === saved)) defKey = saved;
    }

    // 默认选中第一个，匹配则覆盖
    state.currentSession = state.sessions[0];
    dom.sessionName.textContent = state.sessions[0].name;

    state.sessions.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = s.name;
        li.dataset.index = i;
        if (s.key === defKey) { li.classList.add('active'); state.currentSession = s; dom.sessionName.textContent = s.name; }
        li.addEventListener('click', () => selectSession(i));
        dom.sessionList.appendChild(li);
    });
}

function selectSession(index) {
    const s = state.sessions[index];
    if (!s) return;
    state.currentSession = s;
    dom.sessionName.textContent = s.name;
    if (state.currentUser) localStorage.setItem('session_' + state.currentUser.username, s.key);
    dom.sessionList.querySelectorAll('li').forEach(li => li.classList.remove('active'));
    const items = dom.sessionList.querySelectorAll('li');
    if (items[index]) items[index].classList.add('active');
    hideSessionDropdown();
}

function toggleSessionDropdown() { dom.sessionDropdown.classList.toggle('hidden'); }
function hideSessionDropdown() { dom.sessionDropdown.classList.add('hidden'); }

// ==========================================
// 登录流程
// ==========================================
var _cancelGuard = false;

function resetLoginState() {
    state.isAuthenticating = false;
    state.isLoggedIn = false;
    state._promptReceived = false;
    dom.passwordInput.value = '';
    dom.passwordInput.disabled = true;
    dom.loginBtn.disabled = true;
    dom.messageContainer.textContent = '';
    dom.messageContainer.className = '';
    hideLoading();
}

function showMessage(msg, type) { dom.messageContainer.textContent = msg; dom.messageContainer.className = type || 'info'; }
function showLoading(t) { dom.loadingOverlay.classList.remove('hidden'); dom.loadingText.textContent = t || '正在处理...'; }
function hideLoading() { dom.loadingOverlay.classList.add('hidden'); }

function startAuthentication() {
    if (!state.currentUser) { showMessage('No available user', 'error'); return; }

    _cancelGuard = true;
    cancelAuth();
    _cancelGuard = false;

    state.isAuthenticating = true;
    state._promptReceived = false;
    dom.passwordInput.disabled = false;
    dom.passwordInput.focus();
    dom.loginBtn.disabled = true; // 等待 show_prompt

    setTimeout(() => authenticate(state.currentUser.username), 50);

    clearTimeout(state._authTimer);
    state._authTimer = setTimeout(() => {
        if (state.isAuthenticating && !state.isLoggedIn) {
            state.isAuthenticating = false;
            state._promptReceived = false;
            dom.userAvatarContainer.classList.remove('auth-loading');
            hideLoading();
            dom.passwordInput.disabled = false;
            dom.loginBtn.disabled = true;
        }
    }, 30000);
}

function submitPassword() {
    if (state.isLoggedIn) return;
    if (!state.isAuthenticating) { startAuthentication(); return; }
    if (!state._promptReceived) { showMessage('正在连接认证服务...', 'info'); return; }
    if (!dom.passwordInput.value) return;

    dom.userAvatarContainer.classList.add('auth-loading');
    dom.loginBtn.disabled = true;
    dom.passwordInput.disabled = true;
    respond(dom.passwordInput.value);
}

function onAuthenticationComplete() {
    if (_cancelGuard) return;
    dom.userAvatarContainer.classList.remove('auth-loading');
    hideLoading();
    clearTimeout(state._authTimer);

    if (!LDM) return;

    if (LDM.is_authenticated) {
        state.isLoggedIn = true;
        showMessage('验证成功，正在登录...', 'success');
        showLoading('正在登录...');
        startSession();
    } else {
        state.isAuthenticating = false;
        dom.passwordInput.value = '';
        // 密码错误：密码框红边闪烁 1.5 秒
        dom.passwordContainer.classList.add('error-outline');
        setTimeout(() => dom.passwordContainer.classList.remove('error-outline'), 1500);
        setTimeout(() => { if (!state.isLoggedIn) startAuthentication(); }, 300);
    }
}

function onShowPrompt(text) {
    state._promptReceived = true;

    // 多阶段认证：重新启用输入框
    if (state.isAuthenticating && !state.isLoggedIn && dom.passwordInput.disabled) {
        dom.passwordInput.disabled = false;
        dom.passwordInput.value = '';
        dom.loginBtn.disabled = false;
        dom.passwordInput.focus();
        return;
    }

    if (state.isAuthenticating && !state.isLoggedIn) dom.loginBtn.disabled = false;

    // 用户已输入密码，自动提交
    if (state.isAuthenticating && dom.passwordInput.value && !dom.passwordInput.disabled) {
        submitPassword();
    }
}

function onShowMessage(text, type) {
    if (text) showMessage(text, type === 'error' ? 'error' : 'info');
}

// ==========================================
// 电源管理
// ==========================================
function initPowerControls() {
    if (!LDM) return;
    dom.restartBtn.style.display = LDM.can_restart ? 'flex' : 'none';
    dom.shutdownBtn.style.display = LDM.can_shutdown ? 'flex' : 'none';
}

// ==========================================
// 事件绑定
// ==========================================
dom.userAvatarContainer.addEventListener('click', e => { e.stopPropagation(); toggleUserDropdown(); });
dom.passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitPassword(); } });
dom.loginBtn.addEventListener('click', submitPassword);
dom.sessionBtn.addEventListener('click', e => { e.stopPropagation(); toggleSessionDropdown(); });

document.addEventListener('click', e => {
    if (!dom.sessionBtn.contains(e.target) && !dom.sessionDropdown.contains(e.target)) hideSessionDropdown();
    if (!dom.userAvatarContainer.contains(e.target) && !dom.userDropdown.contains(e.target)) hideUserDropdown();
});

dom.restartBtn.addEventListener('click', () => { if (LDM && LDM.can_restart) { showLoading('正在重启...'); LDM.restart(); } });
dom.shutdownBtn.addEventListener('click', () => { if (LDM && LDM.can_shutdown) { showLoading('正在关机...'); LDM.shutdown(); } });

// ==========================================
// 初始化
// ==========================================
var _initDone = false;

function initTheme() {
    if (_initDone) return;
    _initDone = true;

    try {
        state.users = getUsers();
        if (!state.users.length) {
            dom.passwordInput.disabled = true;
            dom.loginBtn.disabled = true;
            showMessage('No available user accounts', 'error');
            return;
        }
        state.currentUserIndex = 0;
        updateCurrentUser();
        updateSessions();
        initPowerControls();
        startAuthentication();
    } catch (e) {
        console.error('[LDM] Init failed:', e);
        showMessage('Theme initialization failed', 'error');
    }
}

window.greeter_ready = initTheme;
if (LDM) setTimeout(initTheme, 100);

// ==========================================
// 开发模式 Mock
// ==========================================
if (!LDM) {
    window.lightdm = {
        users: [
            { username: 'alice', display_name: 'Alice', image: '' },
            { username: 'bob', display_name: 'Bob', image: '' },
            { username: 'charlie', display_name: 'Charlie', image: '' },
        ],
        sessions: [
            { key: 'gnome', name: 'GNOME' },
            { key: 'plasma', name: 'KDE Plasma' },
            { key: 'xfce', name: 'Xfce Session' },
            { key: 'i3', name: 'i3' },
        ],
        default_session: 'gnome',
        is_authenticated: false,
        can_restart: true,
        can_shutdown: true,

        authenticate(username) {
            setTimeout(() => {
                (window.show_prompt || this.show_prompt)('Password:', 'password');
            }, 200);
        },
        respond(secret) {
            setTimeout(() => {
                this.is_authenticated = (secret === 'password');
                if (this.authentication_complete) this.authentication_complete();
            }, 300);
        },
        cancel_authentication() {},
        start_session(key) {
            alert('[Dev] Mock start session: ' + key);
            hideLoading();
            state.isLoggedIn = false;
            state.isAuthenticating = false;
            dom.passwordInput.disabled = false;
            dom.loginBtn.disabled = false;
            dom.passwordInput.value = '';
            dom.passwordInput.focus();
        },
        restart() { alert('[Dev] Mock restart'); },
        shutdown() { alert('[Dev] Mock shutdown'); },
    };
    LDM = window.lightdm;
    initTheme();
}
