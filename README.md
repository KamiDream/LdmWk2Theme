# LdmWk2Theme - LightDM WebKit 登录主题

简洁现代的 LightDM WebKit 登录/锁屏主题，同时兼容 **lightdm-webkit (WebKit1)** 和 **lightdm-webkit2-greeter**。

## 功能特性

### 🕐 实时时钟
- 中文日期时间格式（`MM月DD日 星期X HH:mm:ss`），**每秒更新**
- 居中显示于顶部状态栏

### 👤 用户切换
- 点击头像弹出**用户下拉列表**
- 支持用户头像显示（读取系统 `user.image`）
- 无头像时自动显示用户名首字母占位
- 切换用户时自动取消当前认证并重新发起

### 🔑 密码登录
- 回车键或点击箭头按钮提交密码
- 密码错误时输入框**红色边框闪烁动画**（1.5 秒）
- 登录验证时头像边框**脉冲动画**反馈
- **30 秒认证超时保护**，超时自动重置

### 🖥️ 会话选择
- 顶部状态栏左侧显示当前桌面环境
- 下拉选择会话，支持 **localStorage 记忆**每个用户的偏好会话
- 自动匹配系统默认会话

### ⚡ 电源管理
- 重启、关机按钮（根据系统 `can_restart` / `can_shutdown` 能力自动显隐）
- 悬停时按钮分别变为蓝色（重启）和红色（关机）

### 🌀 加载动画
- 登录验证时显示**全屏遮罩 + 旋转加载动画**
- 提示文字动态变化（"正在验证..." / "正在登录..." / "正在重启..."）

### 🎨 毛玻璃效果
- `backdrop-filter: blur()` 实现现代 UI 质感
- 状态栏、密码框、下拉菜单均采用毛玻璃风格

### 📱 响应式设计
- 适配不同分辨率（`max-height: 600px` / `max-width: 480px` 断点）
- 小屏幕下自动调整间距和字号

### 🧪 开发模式
- 无 LightDM 环境时自动使用 **Mock 模拟数据**调试
- 模拟 3 个用户（Alice / Bob / Charlie）和 4 个会话（GNOME / KDE Plasma / Xfce / i3）
- 密码 `password` 模拟登录成功，其他密码模拟失败
- 电源按钮弹出提示而非实际操作

### 🔄 双 API 兼容
- 自动检测并使用正确的 LightDM API（WebKit1 / WebKit2）
- 同时绑定 Qt 信号（`connect()`）、全局函数和 lightdm 属性三种回调机制

## 文件结构

```
LdmWk2Theme/
├── index.html              # 主 HTML 入口
│                           #   - 顶部状态栏（会话选择 / 时钟 / 电源按钮）
│                           #   - 登录表单（Arch Logo / 头像 / 密码框 / 登录按钮）
│                           #   - 加载遮罩
├── theme.json              # LightDM WebKit2 主题配置
│                           #   - 主题名称、版本、作者
│                           #   - 布局定义、背景、超时配置
├── README.md               # 本文件
├── css/
│   └── style.css           # 样式表
│                           #   - 25+ CSS 变量集中控制主题色
│                           #   - 毛玻璃效果（backdrop-filter）
│                           #   - 按钮 / 下拉菜单 / 用户列表 / 加载动画
│                           #   - 响应式断点适配
│                           #   - 自定义滚动条样式
├── js/
│   └── main.js             # 核心交互逻辑
│                           #   - 状态管理（用户 / 会话 / 认证状态）
│                           #   - 双 API 检测与回调绑定
│                           #   - 时钟更新、用户切换、会话管理
│                           #   - 认证流程（超时保护 / 错误反馈）
│                           #   - 电源管理、开发模式 Mock
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

1. **Qt 信号** — `lightdm.show_prompt.connect(callback)`
2. **全局函数** — `window.show_prompt = callback`（WebKit1 方式）
3. **属性赋值** — `lightdm.show_prompt = callback`（WebKit2 方式）

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
| 用户 | alice / bob / charlie |
| 会话 | GNOME / KDE Plasma / Xfce / i3 |
| 登录密码 | `password` → 成功，其他 → 失败 |
| 电源操作 | 弹出 `alert` 提示而非实际操作 |

## 自定义

### 更换背景

替换 `assets/background.png`，主题同时会尝试加载 `assets/background.jpg` 作为回退。或在 `css/style.css` 中修改：

```css
#background {
    background: image-set(url('../assets/your-wallpaper.jpg') 1x) center/cover no-repeat;
}
```

### 修改主题色

在 `css/style.css` 的 `:root` 中调整 CSS 变量：

```css
:root {
    --accent-color: #4fc3f7;      /* 主题强调色（蓝色） */
    --error-color: #ef5350;        /* 错误提示色（红色） */
    --success-color: #66bb6a;      /* 成功提示色（绿色） */
    --text-color: #ffffff;         /* 主文字颜色 */
    --text-secondary: rgba(255, 255, 255, 0.6); /* 次要文字 */
    --input-bg: rgba(255, 255, 255, 0.1);       /* 输入框背景 */
    --card-bg: rgba(0, 0, 0, 0.4);              /* 卡片背景 */
    --status-bar-bg: rgba(0, 0, 0, 0.35);       /* 状态栏背景 */
}
```

## JavaScript 架构

核心模块划分：

| 模块 | 文件位置 | 职责 |
|------|---------|------|
| 状态管理 | [`main.js:10-19`](js/main.js:10) | 用户、会话、认证状态的集中管理 |
| DOM 引用 | [`main.js:24-42`](js/main.js:24) | 缓存所有 DOM 元素引用 |
| API 桥接 | [`main.js:47-74`](js/main.js:47) | 双 API 回调绑定 |
| 时钟模块 | [`main.js:81-92`](js/main.js:81) | 实时中文时钟更新 |
| API 辅助层 | [`main.js:97-138`](js/main.js:97) | 函数级能力检测与适配 |
| 用户管理 | [`main.js:143-179`](js/main.js:143) | 用户切换、下拉菜单 |
| 会话管理 | [`main.js:184-224`](js/main.js:184) | 会话选择、localStorage 持久化 |
| 认证流程 | [`main.js:229-333`](js/main.js:229) | 完整登录生命周期 |
| 电源管理 | [`main.js:338-342`](js/main.js:338) | 电源按钮显隐控制 |
| 开发 Mock | [`main.js:394-439`](js/main.js:394) | 无 LightDM 环境模拟 |

### 认证流程

```
用户输入密码 → submitPassword()
    → 发起认证 authenticate(username)
    → 等待 show_prompt 回调（设 _promptReceived = true）
    → 提交密码 respond(password)
    → 等待 authentication_complete 回调
    → 成功：startSession() / 失败：错误动画 + 自动重试
```

## 许可证

MIT License
