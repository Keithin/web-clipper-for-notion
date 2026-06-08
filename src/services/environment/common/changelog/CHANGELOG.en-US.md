## 1.0.0

`2026-06-08`

- ✨ Notion-only fork of Web Clipper
- ✨ Support Notion Integration Token authentication (replaced OAuth)
- ✨ Fix Notion Search API: filter.value 'database' → 'data_source'
- ✨ Fix image rendering: markdown images now create Notion image blocks
- ✨ Fix invalid link URL handling (relative paths, javascript:, data: URLs)
- ✨ Optimize repository search: single API call, 50 item limit, grouped by type
- ✨ Remove all non-Notion backends (Yuque, OneNote, Joplin, etc.)
- ✨ Remove image hosting services (not needed for Notion-only)
