# LdmWk2Theme - LightDM WebKit2 登录主题

简洁现代的 LightDM 登录/锁屏主题，仅兼容 **lightdm-webkit2-greeter**（WebKit2）。

> ⚠️ **单 N 卡独显或开启了独显直连的用户（纯 N 卡用户）请勿使用此配置！**
> **Do NOT use this configuration if you have a single/primary NVIDIA GPU!**

## 功能

🕐 实时中文时钟 · 👤 用户切换 · 🔑 密码登录 · 🖥️ 会话选择（localStorage 记忆）  
⚡ 电源管理 · 🌀 加载动画 · 🎨 毛玻璃效果 · 📱 响应式

## 安装

> 💡 **推荐使用 [ArchInit](https://github.com/KamiDream/ArchInit) 中的 `lightdm.sh` 脚本一键安装配置。**
> **It is recommended to use the `lightdm.sh` script from [ArchInit](https://github.com/KamiDream/ArchInit) for one-click installation and configuration.**

### 1. 安装 greeter

```bash
# Arch Linux — lightdm-webkit2-greeter
sudo pacman -S lightdm-webkit2-greeter
```

### 2. 复制主题

```bash
sudo cp -r LdmWk2Theme /usr/share/lightdm-webkit/themes/KamiDream_Theme
```

### 3. 配置 LightDM

编辑 `/etc/lightdm/lightdm.conf`：

```ini
[Seat:*]
greeter-session=lightdm-webkit2-greeter
```

### 4. 配置 greeter 主题

```bash
# lightdm-webkit2-greeter：/etc/lightdm/lightdm-webkit2-greeter.conf
[greeter]
webkit_theme = KamiDream_Theme
```

### 5. 重启

```bash
reboot
```

> ⚠️ 重启 LightDM 会退出当前图形会话，建议在 TTY 中执行。

## 故障排除

### 黑屏

如果配置后出现黑屏，请编辑 `/etc/lightdm/lightdm.conf`，将：

```ini
greeter-session=lightdm-webkit2-greeter
```

修改为：

```ini
#greeter-session=lightdm-webkit2-greeter
```

然后重启系统:

```bash
reboot
```

## 文件结构

```
├── index.html            # 主 HTML
├── theme.json            # 主题清单
├── css/style.css         # 样式（CSS 变量 + 毛玻璃 + 响应式）
├── js/main.js            # 核心逻辑（认证流程 + 会话/用户管理 + 电源 + 缩放）
└── assets/background.png # 默认背景
```

## API（lightdm-webkit2-greeter）

| 功能 | API |
|------|-----|
| 认证 | `lightdm.authenticate(username)` |
| 密码 | `lightdm.respond(secret)` |
| 取消 | `lightdm.cancel_authentication()` |
| 会话 | `lightdm.start_session(key)` |
| 信号 | `lightdm.show_prompt` / `lightdm.show_message` / `lightdm.authentication_complete`（`.connect()`） |
| 数据 | `lightdm.users` / `lightdm.sessions` / `lightdm.default_session` / `lightdm.can_restart` / `lightdm.can_shutdown` |

主题通过 `greeter_ready()` 回调初始化，`lightdm` 对象由 greeter 注入。

## 自定义

### 背景

替换 `assets/background.png`，或在 `css/style.css` 修改 `#background`。

### 主题色

在 `css/style.css` 的 `:root` 中调整变量（`--accent`、`--error`、`--success` 等）。

## 许可证

MIT License
