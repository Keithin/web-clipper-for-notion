<h1 align="center">Notion Web Clipper</h1>

<p align="center">
  <em>一键将网页内容剪藏到 Notion · Clip any web page into Notion with one click</em>
</p>

<p align="center">
  <a href="https://github.com/webclipper/web-clipper">Forked from webclipper/web-clipper</a>
  ·
  <strong>Notion-only</strong> 精简版 · Stripped down to pure Notion
</p>

---

## 📖 简介 · About

**中文**

Notion Web Clipper 是基于 [webclipper/web-clipper](https://github.com/webclipper/web-clipper) 的精简分支，移除了所有其他平台（Obsidian、FlowUs、语雀、OneNote、Joplin、Bear 等 17+ 平台），**仅保留 Notion**。使用 Notion API v1 + Integration Token 进行认证，干净、专注、开箱即用。

**English**

Notion Web Clipper is a focused fork of [webclipper/web-clipper](https://github.com/webclipper/web-clipper) that removes all 17+ other platforms (Obsidian, FlowUs, Yuque, OneNote, Joplin, Bear, etc.) and **keeps only Notion**. Authenticated via Notion API v1 with Integration Tokens — clean, focused, and ready to use.

---

## ✨ 功能特性 · Features

| Feature | 中文 | English |
|---------|------|---------|
| 🎯 多模式剪藏 | 全页、选区、书签、截图、阅读模式 | Full page, selection, bookmark, screenshot, readability |
| 📝 HTML → Markdown | 使用 Turndown 自动转换 | Automatic conversion via Turndown |
| 🧹 纯净阅读模式 | 基于 Mozilla Readability | Powered by Mozilla Readability |
| 🏷️ 选择目标页面/数据库 | 创建子页面或添加到数据库 | Create sub-pages under any page or add items to databases |
| 🔗 格式保留 | 粗体、斜体、代码、链接 | Bold, italic, code, links preserved |
| 🔐 安全存储 | Token 保存在浏览器本地 | Token stays in your browser |

---

## 🚀 快速开始 · Quick Start

### 中文

1. 在 [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations) 创建 Integration
2. 复制 **Internal Integration Token**（以 `secret_xxx` 开头）
3. 在 Notion 中**分享**目标页面/数据库给 Integration
4. 安装扩展 → 绑定账号 → 粘贴 Token → 验证
5. 浏览任意网页，点击扩展图标即可剪藏

### English

1. Create an Integration at [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copy the **Internal Integration Token** (starts with `secret_xxx`)
3. **Share** your Notion pages/databases with the integration
4. Install extension → Bind Account → Paste token → Verify
5. Browse any web page and click the extension icon to clip

---

## 📦 安装 · Install

### 从源码安装 · From Source

```bash
pnpm install
pnpm run build
```

加载 `dist/chrome` 目录到 `chrome://extensions/`（开启开发者模式）

Load the `dist/chrome` folder in `chrome://extensions/` with Developer mode enabled.

---

## 🔧 开发 · Development

```bash
git clone https://github.com/Keithin/web-clipper-for-notion.git
cd web-clipper-for-notion
pnpm install
pnpm run dev
```

| 命令 | 作用 |
|------|------|
| `pnpm run build` | 生产构建 |
| `pnpm run dev` | 开发模式（热更新） |
| `pnpm run test` | 运行测试 |

---

## 🏗️ 项目架构 · Architecture

移除了所有非 Notion 平台代码，保留核心剪藏引擎：

Removed all non-Notion platform code, retaining the core clipping engine.

### Notion API 集成详情 · Integration Details

| 项目 | 详情 |
|------|------|
| API 版本 | v1 (`2022-06-28`) |
| 认证方式 | Bearer Token (Internal Integration Token) |
| 搜索接口 | `POST /v1/search` — 列出可访问的页面和数据库 |
| 验证接口 | `GET /v1/users/me` — 验证 Token 有效性 |
| 创建接口 | `POST /v1/pages` — 创建剪藏内容 |

**支持的 Block 类型：** heading 1-3, paragraph, bullet list, numbered list, code block, blockquote, toggle, divider

**行内格式：** bold, italic, inline code, links

---

## 📄 协议 · License

[GPL-2.0-or-later](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) — 与上游 [webclipper/web-clipper](https://github.com/webclipper/web-clipper) 保持一致
