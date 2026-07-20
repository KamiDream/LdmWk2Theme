# LdmWk2Theme - LightDM WebKit2 登录主题

一个简洁、现代的 LightDM WebKit2 登录/锁屏主题，具有毛玻璃效果、流畅动画和直观的用户界面。

## 预览功能

- 🕐 **实时时钟** - 显示当前时间和日期（中文格式）
- 👤 **用户切换** - 支持多用户之间的切换（上下翻页按钮）
- 🔑 **密码登录** - 支持回车键和点击按钮提交密码
- 🖥️ **会话选择** - 可在登录前选择要启动的桌面环境
- ⚡ **电源管理** - 挂起、重启、关机按钮（根据系统能力自动显示/隐藏）
- 🌀 **加载动画** - 登录验证时的加载效果
- 🎨 **毛玻璃效果** - 使用 backdrop-filter 实现现代 UI 风格
- 🌈 **动态渐变背景** - 平滑流动的渐变色背景
- 📱 **响应式设计** - 适配不同分辨率和屏幕尺寸
- 🧪 **开发模式** - 无 LightDM 环境时可使用模拟数据进行前端调试

## 文件结构

```
LdmWk2Theme/
├── index.html          # 主 HTML 文件
├── theme.json          # 主题配置文件
├── README.md           # 本说明文件
├── css/
│   └── style.css       # 主题样式
├── js/
│   └── main.js         # 主题逻辑（LightDM API 交互）
└── assets/             # 资源目录（可放置背景图等）
```

## 安装方法

### 前置条件

确保已安装 `lightdm` 和 `lightdm-webkit2-greeter`：

```bash
# Arch Linux / Manjaro
sudo pacman -S lightdm lightdm-webkit2-greeter

# Debian / Ubuntu
sudo apt install lightdm lightdm-webkit2-greeter

# Fedora
sudo dnf install lightdm lightdm-webkit2-greeter
```

### 设置 LightDM 使用 WebKit2 Greeter

编辑 LightDM 配置文件 `/etc/lightdm/lightdm.conf`：

```ini
[Seat:*]
greeter-session=lightdm-webkit2-greeter
```

### 安装主题

1. 将主题目录复制到系统主题目录：

```bash
sudo cp -r LdmWk2Theme /usr/share/lightdm-webkit/themes/
```

或者对于 web-greeter（较新版本）：

```bash
sudo cp -r LdmWk2Theme /usr/share/web-greeter/themes/
```

2. 编辑 LightDM WebKit2 Greeter 配置文件 `/etc/lightdm/lightdm-webkit2-greeter.conf`：

```ini
[greeter]
webkit-theme = LdmWk2Theme
```

### 切换默认 Greeter（如果需要）

```bash
sudo lightdm --set-default-greeter lightdm-webkit2-greeter
```

### 重启 LightDM

```bash
sudo systemctl restart lightdm
```

> **注意**：如果当前在图形会话中，重启 LightDM 会退出当前会话。建议在 TTY 或 SSH 中执行。

## 开发模式

该主题支持在没有 LightDM 环境的情况下直接通过浏览器进行前端开发和调试。

只需在浏览器中直接打开 `index.html` 文件即可：

```bash
# 使用文件协议打开
firefox index.html
# 或者
chromium index.html
```

在开发模式下：
- 模拟了 2 个用户（`user` / `admin`）
- 模拟了 4 个桌面环境会话（GNOME / KDE Plasma / Xfce / i3）
- 密码 `password` 会模拟登录成功
- 其他密码会模拟登录失败
- 电源按钮会触发提示而不是实际执行操作

## 自定义配置

### 自定义背景图片

1. 将背景图片放入 `assets/` 目录
2. 在 `css/style.css` 中修改 `#background` 样式：

```css
#background {
    background: url('../assets/your-wallpaper.jpg') center/cover no-repeat;
}
```

### 修改主题颜色

在 `css/style.css` 的 `:root` 中修改变量：

```css
:root {
    --accent-color: #4fc3f7;      /* 强调色（蓝色） */
    --bg-gradient-start: #0f0c29;  /* 背景渐变起始色 */
    --bg-gradient-mid: #302b63;    /* 背景渐变中间色 */
    --bg-gradient-end: #24243e;    /* 背景渐变结束色 */
}
```

## 许可证

MIT License
