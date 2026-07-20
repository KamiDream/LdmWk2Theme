/**
 * LightDM WebKit2 Theme - Main JavaScript
 *
 * 使用 LightDM WebKit2 Greeter JavaScript API 进行登录交互
 * API 参考: https://github.com/Antergos/web-greeter/blob/master/docs/lightdm-webkit-greeter.md
 */

'use strict';

// ==========================================
// 状态管理
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
    statusTime: document.getElementById('status-time'),
    statusDate: document.getElementById('status-date'),
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
};

// ==========================================
// LightDM API 版本检测与回调绑定
//
// lightdm-webkit (WebKit1) API:
//   回调: 全局函数 (window.show_prompt, window.authentication_complete, ...)
//   认证: lightdm.start_authentication(username)
//   密码: lightdm.provide_secret(password)
//   会话: lightdm.login(user, session)
//
// lightdm-webkit2-greeter API:
//   回调: lightdm 对象属性 (lightdm.show_prompt = fn, ...)
//   认证: lightdm.authenticate(username)
//   密码: lightdm.respond(password)
//   会话: lightdm.start_session(key)
// ==========================================
var _apiMode = null; // 'webkit1' | 'webkit2'

(function detectAndBindAPI() {
    if (typeof lightdm === 'undefined') return;

    // 检测 callback 连接方式：Qt .connect() vs 属性赋值
    // 某些 Greeter 同时有 authenticate 方法但使用 .connect() 信号机制
    var hasConnect = (typeof lightdm.authentication_complete === 'object' &&
                      lightdm.authentication_complete !== null &&
                      typeof lightdm.authentication_complete.connect === 'function');

    // lightdm-webkit (WebKit1) 的特征: 有 start_authentication，没有 authenticate
    if (typeof lightdm.start_authentication === 'function' &&
        typeof lightdm.authenticate !== 'function') {
        _apiMode = 'webkit1';
    } else if (typeof lightdm.authenticate === 'function') {
        _apiMode = 'webkit2';
    } else {
        // 兜底：检查 provide_secret vs respond
        if (typeof lightdm.provide_secret === 'function') {
            _apiMode = 'webkit1';
        } else if (typeof lightdm.respond === 'function') {
            _apiMode = 'webkit2';
        } else {
            _apiMode = 'webkit2'; // 默认尝试 WebKit2
        }
    }

    console.log('[LightDM Theme] API mode:', _apiMode, ', hasConnect:', hasConnect);

    // 定义回调处理函数
    function onAuthComplete() {
        console.log('[LightDM Theme] Authentication complete');
        onAuthenticationComplete();
    }
    function onPrompt(text, type) {
        console.log('[LightDM Theme] Show prompt:', text, type);
        onShowPrompt(text);
    }
    function onMessage(text, type) {
        console.log('[LightDM Theme] Show message:', text, type);
        onShowMessage(text, type);
    }

    if (hasConnect) {
        // Qt-style signal connection
        lightdm.authentication_complete.connect(onAuthComplete);
        lightdm.show_prompt.connect(onPrompt);
        lightdm.show_message.connect(onMessage);
    } else {
        // 双保险：同时设置全局函数和 lightdm 属性
        // 某些 Greeter 混用 API（如 lightdm.authenticate + 全局回调）
        window.show_prompt = onPrompt;
        window.show_message = onMessage;
        window.authentication_complete = onAuthComplete;
        window.show_error = function (text) {
            console.log('[LightDM Theme] Show error:', text);
            onShowMessage(text, 'error');
        };
        window.autologin_timer_expired = function () {
            console.log('[LightDM Theme] Autologin timer expired');
        };

        lightdm.authentication_complete = onAuthComplete;
        lightdm.show_prompt = onPrompt;
        lightdm.show_message = onMessage;
    }
})();

// ==========================================
// 时钟更新
// ==========================================
const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function updateClock() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekDay = weekDays[now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    dom.statusTime.textContent = `${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`;
}

// 每秒更新时钟
updateClock();
setInterval(updateClock, 1000);

// ==========================================
// LightDM API 辅助函数
// ==========================================

function isLightDMAvailable() {
    return typeof lightdm !== 'undefined' && lightdm !== null;
}

function getUsers() {
    if (!isLightDMAvailable()) return [];
    var users = lightdm.users || [];
    // 规范化用户对象：WebKit1 用 name/real_name，WebKit2 用 username/display_name
    return users.map(function (u) {
        return {
            username: u.username || u.name || '',
            display_name: u.display_name || u.real_name || u.name || '',
            image: u.image || '',
            logged_in: u.logged_in || false,
        };
    });
}

function getSessions() {
    if (!isLightDMAvailable()) return [];
    return lightdm.sessions || [];
}

function authenticate(username) {
    if (!isLightDMAvailable()) return;
    try {
        console.log('[LightDM Theme] Calling authenticate for:', username, '(mode:', _apiMode, ')');
        // 优先使用 start_authentication（WebKit1 及某些混血 Greeter），
        // 因为它在 WebKit1 目录下经实战验证可行
        if (typeof lightdm.start_authentication === 'function') {
            console.log('[LightDM Theme] Using lightdm.start_authentication()');
            lightdm.start_authentication(username);
        } else if (typeof lightdm.authenticate === 'function') {
            console.log('[LightDM Theme] Using lightdm.authenticate()');
            lightdm.authenticate(username);
        } else {
            console.error('[LightDM Theme] No authentication method found on lightdm');
        }
        console.log('[LightDM Theme] authenticate call completed');
    } catch (e) {
        console.error('[LightDM Theme] authenticate() failed:', e.message, e.stack);
    }
}

function respond(password) {
    if (!isLightDMAvailable()) return;
    try {
        // 优先使用 provide_secret（与 start_authentication 配套的 WebKit1 风格），
        // 回退到 respond（WebKit2 风格）
        if (typeof lightdm.provide_secret === 'function') {
            lightdm.provide_secret(password);
        } else if (typeof lightdm.respond === 'function') {
            lightdm.respond(password);
        } else {
            console.error('[LightDM Theme] No password response method found');
        }
    } catch (e) {
        console.error('[LightDM Theme] respond() failed:', e.message);
    }
}

function cancelAuthentication() {
    if (!isLightDMAvailable()) return;
    try {
        // 两个 API 都使用 cancel_authentication()
        lightdm.cancel_authentication();
    } catch (e) {
        console.warn('[LightDM Theme] cancel_authentication() not supported:', e.message);
    }
}

function startSession() {
    if (!isLightDMAvailable()) return;

    // 优先使用 login()（WebKit1 风格），回退到 start_session()（WebKit2 风格）
    if (typeof lightdm.login === 'function') {
        var user = state.currentUser;
        var sessionKey = state.currentSession
            ? state.currentSession.key
            : (lightdm.sessions && lightdm.sessions.length > 0 ? lightdm.sessions[0].key : '');
        if (user && sessionKey) {
            lightdm.login(user, sessionKey);
        } else {
            console.error('[LightDM Theme] Missing user or session for login');
        }
    } else if (typeof lightdm.start_session === 'function') {
        const sessionKey = state.currentSession
            ? state.currentSession.key
            : lightdm.default_session;
        lightdm.start_session(sessionKey);
    } else {
        console.error('[LightDM Theme] No session start method found');
    }
}

// ==========================================
// 用户选择
// ==========================================

function updateCurrentUser() {
    if (!state.users.length) return;
    const user = state.users[state.currentUserIndex];
    state.currentUser = user;

    // 设置头像
    const fallback = document.getElementById('user-avatar-fallback');
    const initial = (user.display_name || user.username).charAt(0).toUpperCase();
    dom.userAvatar.src = user.image ? 'file://' + user.image : '';
    if (fallback) fallback.textContent = user.image ? '' : initial;
}

function buildUserDropdown() {
    dom.userListDropdown.innerHTML = '';
    state.users.forEach((user, index) => {
        const li = document.createElement('li');
        const initial = (user.display_name || user.username).charAt(0).toUpperCase();
        li.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);font-size:13px;flex-shrink:0;">${initial}</span>${user.display_name || user.username}`;
        if (index === state.currentUserIndex) {
            li.classList.add('active');
        }
        li.addEventListener('click', () => selectUserFromDropdown(index));
        dom.userListDropdown.appendChild(li);
    });
}

function selectUserFromDropdown(index) {
    if (index === state.currentUserIndex) {
        hideUserDropdown();
        return;
    }
    state.currentUserIndex = index;
    cancelAuthentication();
    resetLoginState();
    updateCurrentUser();
    hideUserDropdown();
    setTimeout(() => startAuthentication(), 100);
}

function toggleUserDropdown() {
    if (state.users.length < 2) return;
    buildUserDropdown();
    dom.userDropdown.classList.toggle('hidden');
}

function hideUserDropdown() {
    dom.userDropdown.classList.add('hidden');
}

// ==========================================
// 会话管理
// ==========================================

function updateSessions() {
    state.sessions = getSessions();
    var defaultSession = lightdm.default_session
        || (state.sessions.length > 0 ? state.sessions[0].key : null);

    dom.sessionList.innerHTML = '';

    if (state.sessions.length === 0) {
        dom.sessionName.textContent = '无可用的会话';
        return;
    }

    // 如果用户之前选择过桌面环境，从 localStorage 恢复
    if (state.currentUser) {
        var savedSession = localStorage.getItem('session_' + state.currentUser.username);
        if (savedSession) {
            // 确认保存的 session 仍然存在
            var found = state.sessions.some(function (s) { return s.key === savedSession; });
            if (found) {
                defaultSession = savedSession;
            }
        }
    }

    // 始终默认选中第一个会话，防止 defaultSession 不匹配时显示 HTML 占位文本
    state.currentSession = state.sessions[0];
    dom.sessionName.textContent = state.sessions[0].name;

    state.sessions.forEach((session, index) => {
        const li = document.createElement('li');
        li.textContent = session.name;
        li.dataset.index = index;

        if (session.key === defaultSession) {
            li.classList.add('active');
            state.currentSession = session;
            dom.sessionName.textContent = session.name;
        }

        li.addEventListener('click', () => {
            selectSession(index);
        });

        dom.sessionList.appendChild(li);
    });
}

function selectSession(index) {
    const session = state.sessions[index];
    if (!session) return;

    state.currentSession = session;
    dom.sessionName.textContent = session.name;

    // 记住用户选择的桌面环境
    if (state.currentUser) {
        localStorage.setItem('session_' + state.currentUser.username, session.key);
    }

    const items = dom.sessionList.querySelectorAll('li');
    items.forEach((item) => item.classList.remove('active'));
    if (items[index]) {
        items[index].classList.add('active');
    }

    hideSessionDropdown();
}

function toggleSessionDropdown() {
    dom.sessionDropdown.classList.toggle('hidden');
}

function hideSessionDropdown() {
    dom.sessionDropdown.classList.add('hidden');
}

// ==========================================
// 登录流程
// ==========================================

// 用于防止 cancel_authentication 触发的 authentication_complete 回调
// 干扰新的认证流程
var _authCancelInProgress = false;

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

function showMessage(message, type) {
    dom.messageContainer.textContent = message;
    dom.messageContainer.className = type || 'info';
}

function showLoading(text) {
    dom.loadingOverlay.classList.remove('hidden');
    dom.loadingText.textContent = text || '正在处理...';
}

function hideLoading() {
    dom.loadingOverlay.classList.add('hidden');
}

function startAuthentication() {
    const user = state.currentUser;
    if (!user) {
        showMessage('No available user', 'error');
        return;
    }

    // Cancel any existing authentication session first
    if (isLightDMAvailable()) {
        try {
            _authCancelInProgress = true;
            lightdm.cancel_authentication();
        } catch (e) {
            _authCancelInProgress = false;
            // Ignore errors if no active session
        }
    }

    state.isAuthenticating = true;
    state._promptReceived = false;
    // 允许用户输入密码，但在收到 show_prompt 之前禁用登录按钮
    // 否则 respond() 会在 PAM 就绪前被调用，导致响应被忽略、认证卡死
    dom.passwordInput.disabled = false;
    dom.passwordInput.focus();
    dom.loginBtn.disabled = true;

    // Small delay to ensure cancel completes before starting new auth
    setTimeout(function () {
        _authCancelInProgress = false;
        authenticate(user.username);
    }, 50);

    // Auth timeout protection: reset after 30 seconds
    if (state._authTimer) clearTimeout(state._authTimer);
    state._authTimer = setTimeout(function () {
        if (state.isAuthenticating && !state.isLoggedIn) {
            console.warn('[LightDM Theme] Auth timeout, resetting');
            state.isAuthenticating = false;
            state._promptReceived = false;
            hideLoading();
            dom.passwordInput.disabled = false;
            dom.loginBtn.disabled = true;
            showMessage('Authentication timeout, please try again', 'error');
        }
    }, 30000);
}

function submitPassword() {
    if (state.isLoggedIn) return;

    // 如果认证还未开始，先启动认证，让用户再点一次登录
    if (!state.isAuthenticating) {
        console.warn('[LightDM Theme] Auth not started, attempting to start');
        startAuthentication();
        showMessage('请再次点击登录以完成验证', 'info');
        return;
    }

    // 如果 PAM 尚未就绪（show_prompt 未触发），不调用 respond()
    // 等待 onShowPrompt 收到后再自动提交
    if (!state._promptReceived) {
        console.log('[LightDM Theme] Prompt not yet received, waiting...');
        showMessage('正在连接认证服务...', 'info');
        return;
    }

    const password = dom.passwordInput.value;
    if (!password) {
        return;
    }

    showLoading('正在验证...');
    dom.loginBtn.disabled = true;
    dom.passwordInput.disabled = true;

    respond(password);
}

function onAuthenticationComplete() {
    // 如果正在取消认证，忽略此次回调（防止竞态条件）
    if (_authCancelInProgress) {
        console.log('[LightDM Theme] Ignoring auth complete during cancel');
        return;
    }

    hideLoading();

    // 清除认证超时定时器
    if (state._authTimer) {
        clearTimeout(state._authTimer);
        state._authTimer = null;
    }

    if (!isLightDMAvailable()) return;

    if (lightdm.is_authenticated) {
        state.isLoggedIn = true;
        showMessage('验证成功，正在登录...', 'success');
        showLoading('正在登录...');
        startSession();
    } else {
        // 认证失败：重置状态并自动重新开始认证，避免用户需要点击两次
        state.isAuthenticating = false;
        dom.passwordInput.value = '';
        showMessage('密码错误，请重试', 'error');
        // 延迟后自动重启认证流程
        setTimeout(function () {
            if (!state.isLoggedIn) {
                startAuthentication();
            }
        }, 300);
    }
}

function onShowPrompt(text) {
    // 不显示 PAM 的 prompt 文本（如 "Password:"），
    // 密码框占位符已标明用途，显示蓝字反而干扰视觉

    // 标记已收到 prompt，PAM 已就绪可以接收响应
    state._promptReceived = true;

    // 如果 prompt 再次触发（如 PAM 多阶段认证），重新启用输入框
    if (state.isAuthenticating && !state.isLoggedIn && dom.passwordInput.disabled) {
        dom.passwordInput.disabled = false;
        dom.passwordInput.value = '';
        dom.loginBtn.disabled = false;
        dom.passwordInput.focus();
        return;
    }

    // 启用登录按钮（可能在 startAuthentication 中被禁用等待 prompt）
    if (state.isAuthenticating && !state.isLoggedIn) {
        dom.loginBtn.disabled = false;
    }

    // 如果用户已经输入了密码，自动提交
    // 这处理了 show_prompt 在用户点击登录后才触发的情况
    if (state.isAuthenticating && dom.passwordInput.value && !dom.passwordInput.disabled) {
        console.log('[LightDM Theme] show_prompt received, auto-submitting password');
        submitPassword();
    }
}

function onShowMessage(text, type) {
    if (text) {
        const msgType = type === 'error' ? 'error' : 'info';
        showMessage(text, msgType);
    }
}

// ==========================================
// 电源管理
// ==========================================

function initPowerControls() {
    if (!isLightDMAvailable()) return;

    dom.restartBtn.style.display = lightdm.can_restart ? 'flex' : 'none';
    dom.shutdownBtn.style.display = lightdm.can_shutdown ? 'flex' : 'none';
}

// ==========================================
// 事件绑定
// ==========================================

// 点击头像切换用户
dom.userAvatarContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUserDropdown();
});

// 密码输入 - 回车提交
dom.passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitPassword();
    }
});

// 登录按钮
dom.loginBtn.addEventListener('click', submitPassword);

// 会话选择
dom.sessionBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSessionDropdown();
});

// 点击外部关闭下拉菜单
document.addEventListener('click', (e) => {
    // 会话下拉
    const isSessionBtn = dom.sessionBtn.contains(e.target);
    const isSessionDropdown = dom.sessionDropdown.contains(e.target);
    if (!isSessionBtn && !isSessionDropdown) {
        hideSessionDropdown();
    }
    // 用户下拉（点击头像展开）
    const isAvatar = dom.userAvatarContainer.contains(e.target);
    const isUserDropdown = dom.userDropdown.contains(e.target);
    if (!isAvatar && !isUserDropdown) {
        hideUserDropdown();
    }
});

// 电源按钮
dom.restartBtn.addEventListener('click', () => {
    if (isLightDMAvailable() && lightdm.can_restart) {
        showLoading('正在重启...');
        lightdm.restart();
    }
});

dom.shutdownBtn.addEventListener('click', () => {
    if (isLightDMAvailable() && lightdm.can_shutdown) {
        showLoading('正在关机...');
        lightdm.shutdown();
    }
});

// ==========================================
// 主题初始化
// ==========================================

var _themeInitialized = false;

function initTheme() {
    // Prevent duplicate initialization
    if (_themeInitialized) return;
    _themeInitialized = true;

    try {
        // Get user list
        state.users = getUsers();

        if (state.users.length === 0) {
            dom.passwordInput.disabled = true;
            dom.loginBtn.disabled = true;
            showMessage('No available user accounts', 'error');
            return;
        }

        state.currentUserIndex = 0;
        updateCurrentUser();

        // Initialize session list
        updateSessions();

        // Initialize power controls
        initPowerControls();

        // Start authentication
        startAuthentication();
    } catch (e) {
        console.error('[LightDM Theme] Init failed:', e);
        showMessage('Theme initialization failed', 'error');
    }
}

// ==========================================
// LightDM 信号监听
// ==========================================

window.greeter_ready = function () {
    console.log('[LightDM Theme] Greeter ready');
    initTheme();
};

if (typeof lightdm !== 'undefined') {
    // Some greeter versions reset callbacks after the script loads.
    // Wait briefly then set callbacks and initialize to ensure they stick.
    console.log('[LightDM Theme] LightDM available, initializing now');
    setTimeout(function () {
        initTheme();
    }, 100);
}

// ==========================================
// 备用：如果 LightDM API 不可用（开发模式）
// ==========================================

if (!isLightDMAvailable()) {
    console.warn('[LightDM Theme] LightDM API unavailable, using mock data');
    _apiMode = 'webkit2'; // mock 模拟 WebKit2 API

    const mockUsers = [
        { username: 'alice', display_name: 'Alice', image: '' },
        { username: 'bob', display_name: 'Bob', image: '' },
        { username: 'charlie', display_name: 'Charlie', image: '' },
    ];

    const mockSessions = [
        { key: 'gnome', name: 'GNOME' },
        { key: 'plasma', name: 'KDE Plasma' },
        { key: 'xfce', name: 'Xfce Session' },
        { key: 'i3', name: 'i3' },
    ];

    window.lightdm = {
        users: mockUsers,
        sessions: mockSessions,
        default_session: 'gnome',
        is_authenticated: false,
        can_restart: true,
        can_shutdown: true,
        hostname: 'my-computer',
        select_user: function () {},
        authenticate: function (username) {
            console.log('[Mock] Authenticating:', username);
            // 模拟 PAM 流程：延迟触发 show_prompt
            var self = this;
            setTimeout(function () {
                if (self.show_prompt) {
                    self.show_prompt('Password:', 'password');
                } else if (window.show_prompt) {
                    window.show_prompt('Password:', 'password');
                }
            }, 200);
        },
        respond: function (secret) {
            console.log('[Mock] Sending password:', secret);
            var self = this;
            setTimeout(function () {
                if (secret === 'password') {
                    self.is_authenticated = true;
                } else {
                    self.is_authenticated = false;
                }
                if (self.authentication_complete) self.authentication_complete();
            }, 300);
        },
        cancel_authentication: function () {
            console.log('[Mock] Cancel authentication');
        },
        start_session: function (sessionKey) {
            console.log('[Mock] Start session:', sessionKey);
            alert(`[Dev Mode] Mock start session: ${sessionKey}`);
            hideLoading();
            state.isLoggedIn = false;
            state.isAuthenticating = false;
            dom.passwordInput.disabled = false;
            dom.loginBtn.disabled = false;
            dom.passwordInput.value = '';
            dom.passwordInput.focus();
        },
        suspend: function () {
            alert('[Dev Mode] Mock system suspend');
        },
        restart: function () {
            alert('[Dev Mode] Mock system restart');
        },
        shutdown: function () {
            alert('[Dev Mode] Mock system shutdown');
        },
    };

    initTheme();
}
