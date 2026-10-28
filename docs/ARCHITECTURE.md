# ResumeTitan v2 — Architecture & Structure

A lightweight, fast rebuild of ResumeTitan. The deprecated Node/React/Mongo app lives in
`depr/` and is kept only as a feature/prompt reference.

## Decisions (locked for v1)

| Area | Decision |
|------|----------|
| Scope | Core resume builder + AI enhance/tailor-to-job + PDF import/export. No cover letters, interview prep, chatbot, or payments yet. |
| Frontend | Raw HTML/CSS/JS, ES modules, **no build step**, served as static files by the C++ server. |
| Backend | C++ with the vendored **cpp-httplib** (server *and* outbound HTTPS client). |
| Database | **MySQL**, accessed via **MySQL Connector/C++** with a small connection pool. |
| Auth | Simple email/password + bcrypt-style hashing + server-side session cookie. No external IdP. |
| AI | **OpenRouter** (OpenAI-compatible `/chat/completions`) behind a thin provider interface. |
| PDF export | **Client-side** — print CSS + `window.print()` ("Save as PDF"). No headless browser. |
| Job import | **Paste the job description text** (stored as a `job` record). No URL scraping. |

## High-level shape

```
Browser (raw HTML/CSS/JS)
   │  fetch /api/*   (JSON, session cookie)
   ▼
C++ server (cpp-httplib)
   ├── static file mount  →  public/
   ├── /api/auth          →  sessions
   ├── /api/resumes       →  resume CRUD (JSON-Resume blob)
   ├── /api/jobs          →  pasted job descriptions
   └── /api/ai            →  OpenRouter client
   ▼
MySQL (users, sessions, resumes, jobs, ai_usage)
```

One binary. It serves the API *and* the static frontend from `./public`.

## Directory layout

```
ResumeTitan/
├── CMakeLists.txt
├── docker-compose.yml          # local MySQL (dev convenience)
├── docs/
│   └── ARCHITECTURE.md
├── server/
│   ├── main.cpp                # bootstrap: config, db, routes, listen
│   ├── third_party/
│   │   ├── httplib.h           # already vendored
│   │   └── json.hpp            # nlohmann/json (single header)
│   ├── src/
│   │   ├── config.{h,cpp}      # env loading, settings struct
│   │   ├── db/
│   │   │   ├── pool.{h,cpp}    # MySQL connection pool
│   │   │   └── migrate.{h,cpp} # runs sql/*.sql in order
│   │   ├── models/
│   │   │   ├── user.{h,cpp}
│   │   │   ├── session.{h,cpp}
│   │   │   ├── resume.{h,cpp}
│   │   │   └── job.{h,cpp}
│   │   ├── services/
│   │   │   ├── ai_client.{h,cpp}      # OpenRouter HTTP calls
│   │   │   ├── prompts.{h,cpp}        # ported from depr getPrompt()
│   │   │   ├── resume_service.{h,cpp} # merge/validate AI output
│   │   │   └── password.{h,cpp}       # hashing + verify
│   │   ├── middleware/
│   │   │   ├── auth.{h,cpp}           # session lookup
│   │   │   ├── json.{h,cpp}           # body parse / error shape
│   │   │   └── rate_limit.{h,cpp}     # per-IP token bucket
│   │   ├── routes/
│   │   │   ├── auth.{h,cpp}
│   │   │   ├── resumes.{h,cpp}
│   │   │   ├── jobs.{h,cpp}
│   │   │   └── ai.{h,cpp}
│   │   └── util/                      # ids, time, base64, cookies
│   └── sql/
│       ├── 001_init.sql
│       └── ...
├── public/
│   ├── index.html              # landing
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html          # resume + job lists
│   ├── editor.html             # builder with live preview
│   ├── print.html              # clean print view (print CSS)
│   ├── css/
│   │   ├── base.css
│   │   ├── app.css
│   │   ├── print.css           # @media print
│   │   └── templates/          # per-theme styles
│   ├── js/
│   │   ├── api.js              # fetch wrapper (credentials: same-origin)
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── editor.js           # form <-> JSON model binding
│   │   ├── ai.js               # enhance/tailor calls
│   │   ├── print.js            # render + window.print()
│   │   └── templates/*.js      # JSON-Resume -> HTML renderers
│   └── assets/
├── depr/                       # old app — reference only
└── README.md
```

## Database schema (sketch)

MySQL 8, `utf8mb4`. Resume bodies are stored as a `JSON` column so the flexible
JSON-Resume shape (from `depr/server/src/models/Resume.ts`) is preserved, while a few
scalar columns stay indexed for listing/sorting.

```sql
CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(120) NOT NULL DEFAULT '',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id         CHAR(43) PRIMARY KEY,          -- random token (hash stored)
  user_id    BIGINT UNSIGNED NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (user_id), INDEX (expires_at)
);

-- Pasted job postings; referenced by tailoring.
CREATE TABLE jobs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(255) NOT NULL DEFAULT '',
  company     VARCHAR(255) NOT NULL DEFAULT '',
  description MEDIUMTEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (user_id)
);

CREATE TABLE resumes (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  theme      VARCHAR(64)  NOT NULL DEFAULT 'professional',
  font       VARCHAR(64)  NOT NULL DEFAULT 'times-new-roman',
  data       JSON         NOT NULL,          -- full JSON-Resume object
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (user_id, updated_at)
);

-- Optional: undo/history + AI usage metering.
CREATE TABLE resume_versions (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resume_id  BIGINT UNSIGNED NOT NULL,
  data       JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
  INDEX (resume_id, created_at)
);

CREATE TABLE ai_usage (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  resume_id  BIGINT UNSIGNED NULL,
  section    VARCHAR(32)  NOT NULL,
  operation  VARCHAR(16)  NOT NULL,   -- generate | brainstorm | edit | tailor | import
  model      VARCHAR(128) NOT NULL,
  tokens     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, created_at)
);
```

## HTTP API

All responses are JSON. Auth uses an `HttpOnly`, `SameSite=Lax` session cookie.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Create account + session |
| POST | `/api/auth/login` | Verify password, start session |
| POST | `/api/auth/logout` | Destroy session |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/resumes` | List current user's resumes |
| POST | `/api/resumes` | Create resume |
| GET  | `/api/resumes/:id` | Fetch one |
| PUT  | `/api/resumes/:id` | Save (full document) |
| DELETE | `/api/resumes/:id` | Delete |
| POST | `/api/resumes/:id/duplicate` | Copy (optional) |
| GET  | `/api/jobs` | List saved job descriptions |
| POST | `/api/jobs` | Save pasted job |
| DELETE | `/api/jobs/:id` | Delete |
| POST | `/api/ai/section` | Enhance one section: `{section, data, operationType, userInput}` |
| POST | `/api/ai/tailor` | `{resumeId, jobId}` → suggested edits for the whole resume |
| POST | `/api/ai/import` | multipart PDF → structured resume JSON |
| GET  | `/api/health` | Liveness (already present) |

### `/api/ai/section` contract
Mirrors the old per-section endpoints but collapses them into one:
`section ∈ {summary, work, education, skills, projects, volunteer}`,
`operationType ∈ {generate, brainstorm, edit}`. The ported prompt builders in
`services/prompts.cpp` produce the request; the response is validated and returned as
JSON for the section only.

## AI layer (OpenRouter)

OpenRouter is OpenAI-compatible, so one client covers many models.

- Config: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (e.g. a Gemini/Claude/GPT model),
  `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`), optional
  `HTTP-Referer` / `X-Title` headers.
- Transport: reuse `httplib::Client` (built with OpenSSL) for the outbound HTTPS POST —
  no extra HTTP library.
- `AiClient::chat(messages, opts) -> json` and a helper `chat_json()` that strips
  ```json fences and parses with nlohmann/json.
- Keep a thin `Provider` seam so Gemini-direct or a local model can be added later.
- Structured output: request JSON in the prompt (as the old app did) and validate
  server-side before persisting.

### PDF import (note)
Client-side export is easy, but *import* still needs extraction. Two viable paths:
1. **OpenRouter multimodal** — base64 the PDF into a `file` content part and let a
   PDF-capable model return structured JSON (closest to the old flow).
2. **Text extraction in C++** — e.g. Poppler's `pdftotext`, then send the text to the
   model. More deps, no multimodal requirement.

Recommended: path 1, with path 2 as a fallback.

## Frontend

- No framework, no bundler. ES modules loaded via `<script type="module">`.
- `api.js` centralizes `fetch` with `credentials: 'same-origin'` and JSON/error handling.
- `editor.html` holds the form; state is a plain JS object shaped exactly like the
  stored JSON-Resume document, so save is a single `PUT`.
- Templates are pure functions `render(resume) -> html string` under
  `js/templates/`, replacing the old React template components.
- Export: "Save as PDF" opens `print.html` (or a hidden iframe) with `print.css` and
  calls `window.print()`.

## Dependencies

| Need | Choice |
|------|--------|
| HTTP server + client | `httplib.h` (vendored) |
| JSON | `nlohmann/json` (vendored header) |
| MySQL | MySQL Connector/C++ (`find_package`) |
| TLS for outbound HTTPS | OpenSSL + libcurl (httplib client) |
| Password hashing | libsodium `crypto_pwhash` (or OpenSSL PBKDF2) |
| Sessions / random IDs | OpenSSL `RAND_bytes` |
| Build | CMake 3.20+ |

Local deps via Homebrew on macOS (`mysql-connector-c++`, `openssl@3`, `libsodium`,
`curl`) or vcpkg.

## Security notes

- Parameterized/prepared statements everywhere; never string-concatenate SQL.
- Session cookie `HttpOnly` + `SameSite=Lax`; add a CSRF token for state-changing calls.
- Per-IP rate limiting on `/api/auth/*` and `/api/ai/*`.
- Cap request body sizes; validate all AI output before storing.
- Same-origin serving means minimal CORS surface.

## Build roadmap (phases)

1. **Scaffold** — CMake, config, DB pool, migrations runner, `/api/health`, static mount.
2. **Auth** — register/login/logout/me, sessions, middleware.
3. **Resumes** — CRUD + JSON storage; seed a sample resume.
4. **Frontend** — editor form, live preview, one template, print/PDF export.
5. **AI** — OpenRouter client + ported prompts + `/api/ai/section` + enhance/tailor UI.
6. **Import** — PDF → JSON.
7. **Hardening** — rate limits, usage metering, resume versions, more templates.

## Porting references (from `depr/`)

- Resume data model: `depr/server/src/models/Resume.ts`
- AI prompts (all sections/modes): `depr/server/src/controllers/resume.ts` (`getPrompt`)
- OpenRouter-equivalent client shape: `depr/server/src/ext/clients.ts`
- Route/endpoint map: `depr/server/src/routes/*`
- Templates to reimplement: `depr/client/src/templates/layouts/*`
