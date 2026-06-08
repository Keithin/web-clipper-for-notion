## 1.0.0

`2026-06-08`

- ✨ Notion-only fork of Web Clipper（仅保留 Notion）
- ✨ 支持 Notion Integration Token 鉴权（替代 OAuth）
- ✨ 修复 Notion Search API：filter.value 'database' → 'data_source'
- ✨ 修复图片渲染：markdown 图片现在正确生成 Notion image block
- ✨ 修复无效链接 URL 处理（相对路径、javascript:、data: 等）
- ✨ 优化知识库搜索：单次 API 调用、限制 50 条、按类型分组
- ✨ 移除所有非 Notion 后端（语雀、OneNote、Joplin 等）
- ✨ 移除图床服务（Notion 专用版无需此功能）
