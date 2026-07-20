# LdmWk2Theme - LightDM WebKit 登录主题

简洁现代的 LightDM WebKit 登录/锁屏主题，同时兼容 **lightdm-webkit (WebKit1)** 和 **lightdm-webkit2-greeter**。

## 功能特性

- 🕐 **实时时钟** — 中文日期时间格式，每秒更新
- 👤 **用户切换** — 点击头像下拉切换用户
- 🔑 **密码登录** — 回车键或点击按钮提交
- 🖥️ **会话选择** — 选择桌面环境，支持 localStorage 记忆
- ⚡ **电源管理** — 重启、关机按钮（根据系统能力自动显示）
- 🌀 **加载动画** — 登录验证时显示加载遮罩
- 🎨 **毛玻璃效果** — backdrop-filter 实现现代 UI
- 📱 **响应式设计** — 适配不同分辨率
- 🧪 **开发模式** — 无 LightDM 时自动使用模拟数据调试
- 🔄 **双 API 兼容** — 自动检测并使用正确的 LightDM API

## 文件结构

```
LdmWk2Theme/
├── index.html          # 主 HTML
├── theme.json          # 主题配置
├── README.md           # 本文件
├── css/
│   └── style.css       # 样式
├── js/
│   └── main.js         # 核心逻辑（API 检测、认证流程、会话管理）
└── assets/
    └── background.png  # 默认背景
```

## 安装

### 前置条件

```bash
# Arch Linux
sudo pacman -S lightdm lightdm-webkit2-greeter

# 或使用 lightdm-webkit (WebKit1)
sudo pacman -S lightdm
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
# lightdm-webkit2-greeter
/etc/lightdm/lightdm-webkit2-greeter.conf
[greeter]
webkit-theme = KamiDream_Theme

# lightdm-webkit (WebKit1)
/etc/lightdm/lightdm-webkit.conf
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

## 开发模式

浏览器直接打开 `index.html` 即可调试，无需 LightDM 环境：

```bash
firefox index.html
```

模拟数据：
- 3 个用户：alice / bob / charlie
- 4 个会话：GNOME / KDE Plasma / Xfce / i3
- 密码 `password` 模拟登录成功，其他密码模拟失败
- 电源按钮弹出提示而非实际操作

## 自定义

### 更换背景

替换 `assets/background.png`，或在 `css/style.css` 中修改：

```css
#background {
    background: url('../assets/your-wallpaper.jpg') center/cover no-repeat;
}
```

### 修改主题色

在 `css/style.css` 的 `:root` 中：

```css
:root {
    --accent-color: #4fc3f7;
    --error-color: #ef5350;
    --success-color: #66bb6a;
}
```

## 许可证

MIT License
