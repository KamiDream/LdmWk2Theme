# LdmWk2Theme - LightDM WebKit 登录主题

简洁现代的 LightDM WebKit 登录/锁屏主题，同时兼容 **lightdm-webkit (WebKit1)** 和 **lightdm-webkit2-greeter**。

## 功能特性

### 🕐 实时时钟
- 中文日期时间格式（`MM月DD日 星期X HH:mm:ss`），**每秒更新**
- 居中显示于顶部状态栏

### 👤 用户切换
- 点击头像弹出**用户下拉列表**
- 支持用户头像显示（读取系统 `user.image`），路径自动添加 `file://` 前缀
- 无头像时自动显示用户名首字母占位符
- 仅 2 个以上用户时头像可点击切换
- 切换用户时自动取消当前认证、重置登录状态，100ms 后重新发起认证

### 🔑 密码登录
- 回车键或点击箭头按钮提交密码
- 密码错误时输入框**红色边框抖动动画**（`.error-outline`，持续 1.5 秒）
- 登录验证时头像边框**脉冲动画**反馈（`.auth-loading`）
- **30 秒认证超时保护**，超时自动重置输入框状态
- 多阶段认证支持：`show_prompt` 回调可重新启用密码输入框

### 🖥️ 会话选择
- 顶部状态栏左侧显示当前桌面环境
- 下拉选择会话，支持 **localStorage 记忆**每个用户的偏好会话（键名 `session_{username}`）
- 自动回退系统默认会话（`lightdm.default_session`）

### ⚡ 电源管理
- 重启、关机按钮（根据系统 `can_restart` / `can_shutdown` 能力自动显隐）
- 悬停时按钮分别变为蓝色（`#42a5f5`，重启）和红色（`--error`，关机）

### 🌀 加载动画
- 用于会话启动/电源操作时显示**全屏遮罩 + 旋转加载动画**
- 动态提示文字（"正在验证..." / "正在登录..." / "正在重启..." / "正在关机..."）

### 🎨 毛玻璃效果
- `backdrop-filter: blur()` 实现现代 UI 质感
- 状态栏（6px）、密码框（6px）、下拉菜单（12px–20px）均采用毛玻璃风格

### 📱 响应式设计
- 适配不同分辨率（`max-height: 600px` / `max-width: 480px` 两个断点）
- 小屏幕下自动调整间距、字号、状态栏左右区域宽度

### 🧪 开发模式
- 无 LightDM 环境时自动使用 **Mock 模拟数据**调试
- 模拟 3 个用户（Alice / Bob / Charlie）和 4 个会话（GNOME / KDE Plasma / Xfce Session / i3）
- 密码 `password` 模拟登录成功，其他密码模拟失败
- 电源/启动会话操作弹出 `alert()` 提示而非实际操作

### 🔄 双 API 兼容
- 自动检测并使用正确的 LightDM API（WebKit1 / WebKit2）
- 同时绑定 Qt 信号（`.connect()`）、全局函数和 lightdm 属性三种回调机制

## 文件结构

```
LdmWk2Theme/
├── index.html              # 主 HTML 入口
│                           #   - 顶部状态栏（会话选择 / 时钟 / 电源按钮）
│                           #   - 登录表单（Arch Logo / 头像 / 密码框 / 登录按钮）
│                           #   - 加载遮罩
├── theme.json              # LightDM WebKit2 主题清单
│                           #   定义主题名称/版本/作者、布局、背景色、超时配置
├── README.md               # 本文件
├── css/
│   └── style.css           # 样式表（274行，紧凑格式）
│                           #   - 13 个 CSS 变量集中控制主题（--text / --accent / --error 等）
│                           #   - 毛玻璃效果（backdrop-filter）
│                           #   - 药丸形密码框（border-radius: 999px）
│                           #   - 下拉菜单 / 用户列表 / 加载动画 / 自定义滚动条
│                           #   - 动画：fadeUp / rot / avatarPulse / errorShake
│                           #   - 响应式断点适配
├── js/
│   └── main.js             # 核心交互逻辑（439行）
│                           #   - 状态管理（用户/会话/认证状态）
│                           #   - 双 API 回调绑定（connect + 全局函数 + 属性赋值）
│                           #   - 实时时钟 / 用户切换 / 会话管理（localStorage）
│                           #   - 认证流程（超时保护 / 错误抖动反馈）
│                           #   - 电源管理 / 开发模式 Mock
└── assets/
    └── background.png      # 默认登录背景图片
```

## 安装

### 前置条件

```bash
# Arch Linux
sudo pacman -S lightdm lightdm-webkit2-greeter

# 或使用 lightdm-webkit (WebKit1)
sudo pacman -S lightdm lightdm-webkit
```

### 安装主题

```bash
# 复制到 lightdm-webkit 主题目录
sudo cp -r LdmWk2Theme /usr/share/lightdm-webkit/themes/KamiDream_Theme
```

### 配置 LightDM

编辑 `/etc/lightdm/lightdm.conf`：

```ini
[Seat:*]
greeter-session=lightdm-webkit2-greeter
```

或使用 webkit (WebKit1)：

```ini
[Seat:*]
greeter-session=lightdm-webkit
```

编辑 greeter 配置文件指定主题：

```bash
# lightdm-webkit2-greeter：/etc/lightdm/lightdm-webkit2-greeter.conf
[greeter]
webkit-theme = KamiDream_Theme

# lightdm-webkit (WebKit1)：/etc/lightdm/lightdm-webkit.conf
[greeter]
webkit-theme = KamiDream_Theme
```

### 重启 LightDM

```bash
sudo systemctl restart lightdm
```

> ⚠️ 重启 LightDM 会退出当前图形会话，建议在 TTY 中执行。

## API 兼容性

主题自动检测 Greeter 类型并使用对应 API：

| 功能 | WebKit1 | WebKit2 |
|------|---------|---------|
| 回调 | `window.show_prompt` 全局函数 | `lightdm.show_prompt` 属性赋值 |
| 认证 | `lightdm.start_authentication()` | `lightdm.authenticate()` |
| 密码 | `lightdm.provide_secret()` | `lightdm.respond()` |
| 会话 | `lightdm.login(user, key)` | `lightdm.start_session(key)` |
| 用户属性 | `user.name` / `user.real_name` | `user.username` / `user.display_name` |

### 回调绑定策略

代码同时采用三种绑定方式确保最大兼容性：

1. **Qt 信号** — `lightdm.show_prompt.connect(callback)`（部分 greeter 变体）
2. **全局函数** — `window.show_prompt = callback`（WebKit1 方式）
3. **属性赋值** — `lightdm.show_prompt = callback`（WebKit2 方式，无 `.connect` 时）

## 开发模式

浏览器直接打开 `index.html` 即可调试，无需 LightDM 环境：

```bash
firefox index.html
# 或
chromium index.html
```

### 模拟数据

| 项目 | 内容 |
|------|------|
| 用户 | `alice` (Alice) / `bob` (Bob) / `charlie` (Charlie) |
| 会话 | GNOME / KDE Plasma / Xfce Session / i3 |
| 默认会话 | GNOME |
| 登录密码 | `password` → 成功，其他 → 失败 |
| 电源操作 | 弹出 `alert()` 提示而非实际操作 |

Mock 认证流程：调用 `authenticate()` 后 200ms 触发 `show_prompt`，调用 `respond()` 后 300ms 触发 `authentication_complete`。

## 自定义

### 更换背景

替换 [`assets/background.png`](assets/background.png)，或在 [`css/style.css`](css/style.css:26) 中修改：

```css
#background {
    background: url('../assets/your-wallpaper.jpg') center/cover no-repeat;
}
```

### 修改主题色

在 [`css/style.css`](css/style.css:1) 的 `:root` 中调整 CSS 变量：

```css
:root {
    --text: #ffffff;                      /* 主文字颜色 */
    --text-dim: rgba(255,255,255,0.6);    /* 次要文字颜色 */
    --input-bg: rgba(255,255,255,0.1);    /* 输入框背景色 */
    --input-bg-focus: rgba(255,255,255,0.15); /* 输入框聚焦背景 */
    --input-border: rgba(255,255,255,0.2);    /* 输入框边框 */
    --input-border-focus: rgba(255,255,255,0.5); /* 输入框聚焦边框 */
    --accent: #4fc3f7;                    /* 主题强调色（天蓝） */
    --error: #ef5350;                     /* 错误提示色（红色） */
    --success: #66bb6a;                   /* 成功提示色（绿色） */
    --card-border: rgba(255,255,255,0.08); /* 卡片/菜单边框 */
    --overlay: rgba(0,0,0,0.6);           /* 遮罩层背景 */
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, "Noto Sans SC", sans-serif; /* 字体栈 */
    --ts: 0.3s;                           /* 过渡动画时长 */
}
```

### CSS 动画参考

| 动画名 | 触发条件 | 效果 |
|--------|---------|------|
| `fadeUp` | 页面加载时 `#login-form` | 登录表单淡入上移（0.8s） |
| `rot` | `#loading-spinner` | 加载图标旋转（0.8s 无限循环） |
| `avatarPulse` | `#user-avatar-container.auth-loading` | 头像边框脉冲（1.5s 无限循环） |
| `errorShake` | `#password-container.error-outline` | 密码框缩放抖动（0.8s） |

## JavaScript 架构

核心模块划分：

| 模块 | 文件位置 | 职责 |
|------|---------|------|
| 状态管理 | [`main.js:10-19`](js/main.js:10) | 用户、会话、认证状态的集中管理 |
| DOM 引用 | [`main.js:24-42`](js/main.js:24) | 缓存所有 DOM 元素引用 |
| API 桥接 | [`main.js:47-74`](js/main.js:47) | 三种回调机制绑定 |
| 时钟模块 | [`main.js:79-92`](js/main.js:79) | 实时中文时钟，每秒更新 |
| API 辅助层 | [`main.js:97-138`](js/main.js:97) | 函数级能力检测，WebKit1→WebKit2 回退 |
| 用户管理 | [`main.js:143-179`](js/main.js:143) | 用户切换、下拉菜单构建 |
| 会话管理 | [`main.js:184-224`](js/main.js:184) | 会话选择、localStorage 持久化 |
| 认证流程 | [`main.js:229-332`](js/main.js:229) | 完整登录生命周期（认证→超时→成功/失败） |
| 电源管理 | [`main.js:337-341`](js/main.js:337) | 电源按钮根据系统能力显隐 |
| 事件绑定 | [`main.js:346-357`](js/main.js:346) | 全局事件监听、点击外部关闭下拉 |
| 初始化入口 | [`main.js:362-388`](js/main.js:362) | `greeter_ready` 回调 + 自动初始化 |
| 开发 Mock | [`main.js:393-438`](js/main.js:393) | 无 LightDM 环境自动启用模拟数据 |

### 认证流程

```
用户输入密码 → submitPassword()
    ├─ 未认证 → 自动调 startAuthentication()
    ├─ 未收到 prompt → 提示"正在连接认证服务..."
    └─ 已就绪 → respond(password)
                  ↓
        等待 authentication_complete 回调
                  ↓
       ┌─ is_authenticated === true
       │    → 显示"验证成功，正在登录..."
       │    → startSession() 启动会话
       │
       └─ is_authenticated === false
            → 密码框添加 error-outline 类（红色抖动 1.5 秒）
            → 300ms 后自动重新发起认证
```

> 认证全过程有 **30 秒超时保护**，超时后自动重置认证状态并清空加载动画。

## 主题配置

[`theme.json`](theme.json) 是 LightDM WebKit2 greeter 的清单文件：

| 字段 | 值 | 说明 |
|------|-----|------|
| `name` | `LdmWk2Theme` | 主题标识符 |
| `display_name` | `LDM WebKit2 主题` | 显示名称 |
| `description` | 简洁现代的 LightDM WebKit2 登录主题 | 描述 |
| `author` | Zoo | 作者 |
| `version` | `1.0.0` | 版本号 |
| `layouts[0].name` | `default` | 布局名称 |
| `layouts[0].icon` | `avatar-default` | 默认图标 |
| `layouts[0].background` | `true` | 启用背景 |
| `config.background_color` | `#1a1a2e` | 背景回退色 |
| `config.clock_format` | `24h` | 24 小时制时间 |
| `config.greeter_timeout` | `30` | 超时时间（秒） |

## 许可证

MIT License
