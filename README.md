# LdmWk2Theme - LightDM WebKit 登录主题

简洁现代的 LightDM 登录/锁屏主题，兼容 **lightdm-webkit2-greeter** 和 **lightdm-webkit (WebKit1)**。

> ⚠️ **单 N 卡独显或开启了独显直连的用户（纯 N 卡用户）请勿使用此配置！**
> **Do NOT use this configuration if you have a single/primary NVIDIA GPU!**

## 功能

🕐 实时中文时钟 · 👤 用户切换 · 🔑 密码登录 · 🖥️ 会话选择（localStorage 记忆）  
⚡ 电源管理 · 🌀 加载动画 · 🎨 毛玻璃效果 · 📱 响应式 · 🔄 双 API 兼容

## 安装

> 💡 **推荐使用 [ArchInit](https://github.com/KamiDream/ArchInit) 中的 `lightdm.sh` 脚本一键安装配置。**
> **It is recommended to use the `lightdm.sh` script from [ArchInit](https://github.com/KamiDream/ArchInit) for one-click installation and configuration.**

### 1. 安装 greeter

```bash
# Arch Linux — lightdm-webkit2-greeter（推荐）
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
├── css/style.css         # 样式（220行，CSS 变量 + 毛玻璃 + 响应式）
├── js/main.js            # 核心逻辑（232行，API 桥接 + 认证流程 + Mock）
└── assets/background.png # 默认背景
```

## API 兼容

| 功能 | WebKit1 | WebKit2 |
|------|---------|---------|
| 回调 | `window.show_prompt` 全局函数 | `lightdm.show_prompt` 属性赋值 |
| 认证 | `lightdm.start_authentication()` | `lightdm.authenticate()` |
| 密码 | `lightdm.provide_secret()` | `lightdm.respond()` |
| 会话 | `lightdm.login(user, key)` | `lightdm.start_session(key)` |
| 用户 | `user.name` / `user.real_name` | `user.username` / `user.display_name` |

三种回调绑定同时生效：Qt `.connect()` + 全局函数 + 属性赋值，覆盖所有 greeter 变体。

## 开发

浏览器直接打开 `index.html` 即可调试：

```bash
firefox index.html
```

Mock 数据：3 用户（Alice/Bob/Charlie）、4 会话（GNOME/KDE Plasma/Xfce/i3）。密码 `password` 模拟成功。

## 自定义

### 背景

替换 `assets/background.png`，或在 `css/style.css` 修改 `#background`。

### 主题色

在 `css/style.css` 的 `:root` 中调整变量（`--accent`、`--error`、`--success` 等）。

## 许可证

MIT License
