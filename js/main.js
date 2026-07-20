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
    return lightdm.users || [];
}

function getSessions() {
    if (!isLightDMAvailable()) return [];
    return lightdm.sessions || [];
}

function authenticate(username) {
    if (!isLightDMAvailable()) return;
    lightdm.authenticate(username);
}

function respond(password) {
    if (!isLightDMAvailable()) return;
    lightdm.respond(password);
}

function cancelAuthentication() {
    if (!isLightDMAvailable()) return;
    lightdm.cancel_authentication();
}

function startSession() {
    if (!isLightDMAvailable()) return;
    const sessionKey = state.currentSession
        ? state.currentSession.key
        : lightdm.default_session;
    lightdm.start_session(sessionKey);
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
    const defaultSession = lightdm.default_session;

    dom.sessionList.innerHTML = '';

    if (state.sessions.length === 0) {
        dom.sessionName.textContent = '无可用的会话';
        return;
    }

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

function resetLoginState() {
    state.isAuthenticating = false;
    state.isLoggedIn = false;
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
        showMessage('没有可用用户', 'error');
        return;
    }

    state.isAuthenticating = true;
    dom.passwordInput.disabled = false;
    dom.passwordInput.focus();
    dom.loginBtn.disabled = false;

    authenticate(user.username);

    // 认证超时保护：如果 15 秒后仍未完成认证，重置状态
    if (state._authTimer) clearTimeout(state._authTimer);
    state._authTimer = setTimeout(function () {
        if (state.isAuthenticating && !state.isLoggedIn) {
            console.warn('[LightDM 主题] 认证超时，重置');
            state.isAuthenticating = false;
            hideLoading();
            dom.passwordInput.disabled = false;
            dom.loginBtn.disabled = false;
            showMessage('认证超时，请重试', 'error');
        }
    }, 15000);
}

function submitPassword() {
    if (state.isLoggedIn) return;

    // 如果认证还未开始，先启动认证，让用户再点一次登录
    if (!state.isAuthenticating) {
        console.warn('[LightDM 主题] 认证尚未开始，尝试启动');
        startAuthentication();
        showMessage('请再次点击登录以完成验证', 'info');
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
        state.isAuthenticating = false;
        dom.passwordInput.value = '';
        dom.passwordInput.disabled = false;
        dom.loginBtn.disabled = false;
        dom.passwordInput.focus();
        showMessage('密码错误，请重试', 'error');
    }
}

function onShowPrompt(text) {
    if (text) {
        showMessage(text, 'info');
    }
    // 如果认证已启动且有密码输入，自动提交
    // 这处理了 show_prompt 在用户点击登录后才触发的情况
    if (state.isAuthenticating && dom.passwordInput.value && !dom.passwordInput.disabled) {
        console.log('[LightDM 主题] show_prompt 触发，自动提交密码');
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
    // 防止重复初始化
    if (_themeInitialized) return;
    _themeInitialized = true;

    try {
        // 获取用户列表
        state.users = getUsers();

        if (state.users.length === 0) {
            dom.passwordInput.disabled = true;
            dom.loginBtn.disabled = true;
            showMessage('没有可用用户账户', 'error');
            return;
        }

        state.currentUserIndex = 0;
        updateCurrentUser();

        // 初始化会话列表
        updateSessions();

        // 初始化电源控制
        initPowerControls();

        // 启动认证
        startAuthentication();
    } catch (e) {
        console.error('[LightDM 主题] 初始化失败:', e);
        showMessage('主题初始化失败', 'error');
    }
}

// ==========================================
// LightDM 信号监听
// ==========================================

window.greeter_ready = function () {
    console.log('[LightDM 主题] Greeter 已就绪');
    initTheme();
};

if (typeof lightdm !== 'undefined') {
    lightdm.authentication_complete = function () {
        console.log('[LightDM 主题] 认证完成');
        onAuthenticationComplete();
    };

    lightdm.show_prompt = function (text, type) {
        console.log('[LightDM 主题] 显示提示:', text, type);
        onShowPrompt(text);
    };

    lightdm.show_message = function (text, type) {
        console.log('[LightDM 主题] 显示消息:', text, type);
        onShowMessage(text, type);
    };

    // 部分 LightDM WebKit2 Greeter 版本不触发 greeter_ready
    // 直接在此处初始化，同时保留 greeter_ready 作为兼容
    console.log('[LightDM 主题] LightDM 可用，立即初始化');
    initTheme();
}

// ==========================================
// 备用：如果 LightDM API 不可用（开发模式）
// ==========================================

if (!isLightDMAvailable()) {
    console.warn('[LightDM 主题] LightDM API 不可用，使用模拟数据');

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
            console.log('[模拟] 开始认证:', username);
        },
        respond: function (secret) {
            console.log('[模拟] 发送密码:', secret);
            if (secret === 'password') {
                this.is_authenticated = true;
                if (this.authentication_complete) this.authentication_complete();
            } else {
                this.is_authenticated = false;
                if (this.authentication_complete) this.authentication_complete();
            }
        },
        cancel_authentication: function () {
            console.log('[模拟] 取消认证');
        },
        start_session: function (sessionKey) {
            console.log('[模拟] 启动会话:', sessionKey);
            alert(`[开发模式] 模拟启动会话: ${sessionKey}`);
            hideLoading();
            state.isLoggedIn = false;
            state.isAuthenticating = false;
            dom.passwordInput.disabled = false;
            dom.loginBtn.disabled = false;
            dom.passwordInput.value = '';
            dom.passwordInput.focus();
        },
        suspend: function () {
            alert('[开发模式] 模拟系统挂起');
        },
        restart: function () {
            alert('[开发模式] 模拟系统重启');
        },
        shutdown: function () {
            alert('[开发模式] 模拟系统关机');
        },
    };

    initTheme();
}
