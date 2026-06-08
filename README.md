# Notion Web Clipper

> A browser extension to clip any web page content into **Notion** with one click.
>
> Forked from [webclipper/web-clipper](https://github.com/webclipper/web-clipper), stripped down to **Notion-only**, with a clean Notion API v1 integration using Integration Tokens.

---

## Features

- 🎯 **Clip any web page** — full page, selected text, bookmark, screenshot, or readability mode
- 📝 **Convert HTML to Markdown** automatically using Turndown
- 🧹 **Clean reading mode** powered by Mozilla Readability
- 🏷️ **Choose target page or database** — create new sub-pages under any page or add items to any database
- 🔗 **Markdown with inline formatting** — bold, italic, code, links preserved
- 🌐 **Multiple capture modes**: full page, selection, screenshot, bookmark, readability
- 🔐 **Secure token storage** — your Notion Integration Token stays in your browser

---

## How It Works

1. Create a Notion Integration at [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copy the **Internal Integration Token** (starts with `secret_xxx`)
3. **Share** your Notion pages/databases with the integration (go to page → Share → Add your integration)
4. Install the extension and add your token
5. Browse any web page and click the extension icon to clip it

---

## Install

### From Chrome Web Store (once published)

...

### From Source

1. Download [notion-web-clipper-v1.0.0.zip](https://github.com/{YOUR_USERNAME}/notion-web-clipper/releases) from Releases
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Drag & drop the zip file, or click **Load unpacked** and select the `dist/chrome` folder

### Build from Source

```bash
pnpm install
pnpm run build
```

The built extension will be in `dist/chrome/`.

---

## Setup: Notion Integration

### Step 1 — Create an Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Name it (e.g., "Web Clipper")
4. Under **Capabilities**, enable:
   - ✅ Read content
   - ✅ Update content
   - ✅ Insert content
5. Submit and copy the **Internal Integration Secret** (starts with `secret_xxx`)

### Step 2 — Share Pages with the Integration

For each Notion page or database you want to clip into:

1. Open the page in Notion
2. Click **Share** (top right)
3. Add your integration by name
4. Grant **Can edit** access

### Step 3 — Add to Extension

1. Click the extension icon → **Bind Account**
2. Select **Notion** as the type
3. Paste your token (`secret_xxx`)
4. Click **Verify**
5. Choose your default target page or database

---

## Development

```bash
git clone https://github.com/{YOUR_USERNAME}/notion-web-clipper.git
cd notion-web-clipper
pnpm install
pnpm run dev
```

- Load `dist/chrome` folder in Chrome extensions (Developer mode)
- For Firefox, load from `dist/manifest.json`

### Test

```bash
pnpm run test
```

---

## Architecture (Removed Platforms)

This fork removes all other platforms (Obsidian, FlowUs, Yuque, OneNote, Joplin, Bear, etc.) and keeps only **Notion**. The original upstream at [webclipper/web-clipper](https://github.com/webclipper/web-clipper) supports 18+ platforms.

### Notion Integration Details

- **API**: Notion API v1 (`2022-06-28`)
- **Auth**: Bearer token (Internal Integration Token)
- **Endpoints used**:
  - `POST /v1/search` — list accessible pages and databases
  - `GET /v1/users/me` — verify token
  - `POST /v1/pages` — create clipped pages
- **Block types supported**: heading 1-3, paragraph, bullet list, numbered list, code block, blockquote, toggle, divider
- **Inline formatting**: bold, italic, inline code, links

---

## License

GPL-2.0-or-later — same as the original [webclipper/web-clipper](https://github.com/webclipper/web-clipper).
