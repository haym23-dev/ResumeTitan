# ResumeTitan — Editor (Teal-style) Design Contract

Reference implementation: Teal's resume builder (`app.tealhq.com/resume-builder`).
Reverse-engineered from a Firefox profiler capture (3,106 screenshots + ~2,800
interaction markers) plus the page's outer HTML. This document is the layout we
build against; it precedes the code.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Tab scope | **Content Editor only.** Designer / Analyzer / Job Matcher / Cover Letter are stubbed tabs. |
| Rich text | **Lightweight `contenteditable` + mini toolbar** (bold / italic / bullet list). No TipTap, no bundler. |
| App shell | **Teal-style collapsed icon rail** (non-resume items stubbed/disabled). |
| Feature depth (pass 1) | **Core editing first** — accordion + items + inline edit + live preview. Per-field include checkboxes, drag-reorder, duplicate, undo come in a later pass. |
| Stack | Unchanged: raw HTML/CSS/JS ES modules, no build step, served by the C++ `httplib` static mount. |

## Anatomy

```
Global icon rail (collapsed, 3.75rem) │ Home · Resume Builder★ · Trackers · Job Search
                                      │ AI Job Search · Extension · All Tools
                                      │ ── footer: Referrals · Support · Account
──────────────────────────────────────┴───────────────────────────────────────────────
Builder header:  ← back | [Resume title input]            | Export PDF ▾ | Menu ▾
───────────────────────────────────────────────────────────────────────────────────────
Tabs: [Content Editor] [Designer] [Analyzer •n] [Job Matcher •!] [Cover Letter]
──────────────────────────────────┬────────────────────────────────────────────────────
LEFT EDITOR (55%, scrolls)         │ RIGHT PREVIEW (45%, scrolls)
  accordion of sections:           │  iframe[src=about:srcdoc] id="preview-iframe"
   ▸ Contact Information    (✎)    │   — full resume page, 100% width, dynamic height
   ▸ Target Title           (+)    │   — scroll-to-item flashes an anchor
   ▸ Professional Summary   (+)    │
   ▸ Work Experience     (+) (…)   │  ← drag handle between panes (30%–70%)
   ▾ Projects            (+) (…)
└──────────────────────────────────┴────────────────────────────────────────────────────
```

Section order (from Teal DOM ids): `contact-info`, `target-titles`, `blurbs`,
`work-experience`, `education`, `skills`, `certifications`, `awards`, `projects`,
`activities` (Volunteering & Leadership), `publications`.

Item row anatomy:

```
▸ [chevron] Section Title                    [+ add] [⋯ more]
   └─ item (hover actions: ✎ Edit  ⧉ Duplicate  ◎ Locate  🗑 Delete)
        ☑ Title (bold, click = include/exclude)
        ☑ Organization   ☑ Start – ☑ End
        ☑ Additional Information (rich text / bullets)
   └─ inline edit form: labeled fields + rich text + [Cancel] [Save]
```

## Observed interactions to replicate

1. Accordion open/close with sticky section headers.
2. Add item → inline form → Save (`form.submit` in Teal).
3. Edit item inline; rich-text for summary + bullets.
4. Live preview via `srcdoc` iframe; "locate" scrolls + flashes the item.
5. Later pass: per-field include checkboxes, drag-reorder, duplicate, undo.

## Files to add (all static, no build)

| File | Role |
|------|------|
| `public/editor.html` | shell: rail, header, tab strip, split panes, mount points |
| `public/css/editor.css` | editor styles using `base.css` tokens + `@layer` convention |
| `public/css/print.css` | print / PDF rules for the preview document |
| `public/js/editor.js` | bootstraps state + wires the shell |
| `public/js/state.js` | in-memory `resume` object, subscribe/notify, undo snapshots |
| `public/js/sections.js` | section + field schema driving accordion, rows, forms |
| `public/js/section-view.js` | renders the left editor pane (accordion + item rows) |
| `public/js/format.js` | shared date/range formatting for the view and templates |
| `public/js/form.js` | inline item editor (fields + contenteditable) |
| `public/js/templates/*.js` | pure `render(resume) -> html`, ported from `depr/client/src/templates/layouts/*` |
| `public/js/preview.js` | renders into the `srcdoc` iframe (debounced) + locate/highlight |
| `public/js/api.js` | `fetch` wrapper (`credentials: same-origin`) + debounced autosave |
| `public/mock/resume.json` | real JSON-Resume sample |

## Data model

Keep the JSON-Resume shape from `depr/server/src/models/Resume.ts`. Per-field
include flags (later pass) live under `_include` on each item:

```jsonc
{ "position": "Engineer", "name": "Acme",
  "_include": { "position": true, "name": true, "startDate": true } }
```

`_include` is presentation metadata; the template renderer skips unchecked
fields. The canonical schema is unchanged.

## DOM skeleton

```html
<body class="editor-layout">
  <nav class="app-rail">…icon rail…</nav>
  <main class="builder">
    <header class="builder__bar">
      <a class="builder__back" href="/dashboard.html">…</a>
      <input class="builder__title" value="Untitled Resume">
      <button class="btn">Export PDF</button>
      <button class="btn">Menu</button>
    </header>
    <div role="tablist" class="tabs">…Content Editor / Designer / Analyzer / Job Matcher / Cover Letter…</div>
    <div class="split" data-split="55">
      <div class="split__pane split__pane--left" id="editor-pane"><!-- sections --></div>
      <div class="split__handle" role="separator"></div>
      <div class="split__pane split__pane--right"><iframe id="preview-iframe"></iframe></div>
    </div>
  </main>
</body>
```

## Build phases

1. Shell + split pane + tab strip + preview iframe pipeline (static mock data, one template).
2. Sections/items read view (accordion, item rows).
3. Inline editing + live preview (inputs, contenteditable, add/delete).
4. Stub tabs: Designer / Analyzer / Job Matcher / Cover Letter.
5. Persistence (`/api/resumes`), undo, export PDF.
6. Later: per-field include checkboxes, drag-reorder, duplicate, locate.

## Status

- Done: 1 (shell), 2 (accordion + item rows), 3 (inline editing + rich text + add/delete + live preview), 4 (polished "coming soon" tabs + hash routing).
- Pending: 5 (persistence/undo/export), 6 (extras: per-field checkboxes, drag-reorder, duplicate, locate).
- Extra files beyond the original plan: `format.js` (shared date formatting),
  `sanitize.js` (allow-list HTML sanitizer for rich fields),
  `section-view.js` (the left-pane renderer).
