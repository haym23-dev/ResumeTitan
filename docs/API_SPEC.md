# ResumeTitan v1 API Spec (deprecated Node/Express backend)

Reference specification for the **old** API that lives in `depr/server/`. This is kept so
the C++ rewrite can reimplement equivalent behavior. The running server is an Express app
(`depr/server/src/index.ts`) backed by MongoDB (Mongoose) and Google Gemini.

> **Status:** deprecated / reference only. The v2 C++ server is specified in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md). Endpoint shapes here are what the old React client
> actually calls, so treat this as the behavioral contract to port.

---

## 1. Overview

| Item | Value |
|------|-------|
| Runtime | Node.js 21 (`tsx src/index.ts`), Express 4 |
| Default host/port | `HOST` (default `localhost`), `PORT` (default `3001`) |
| Base URL | Provided by env; the React client reads `REACT_APP_API_URL` |
| Content type | `application/json` (except PDF and speech endpoints) |
| Body size limit | 30 MB (`body-parser` json + urlencoded) |
| DB | MongoDB via Mongoose (`MONGO_URL`) |
| AI provider | Google Gemini (`gemini-2.0-flash`) via `GEMINI_API_KEY` |
| Error tracking | Sentry (`SENTRY_BACKEND_DSN`) |
| CORS | Wide open (`cors()` with defaults) |
| Security headers | `helmet` + cross-origin resource policy `cross-origin` |
| Logging | `morgan('common')` |

### Route mounts

```
/auth          → depr/server/src/routes/auth.ts
/resume        → depr/server/src/routes/resume.ts
/interview     → depr/server/src/routes/interview.ts
/cover-letter  → depr/server/src/routes/coverLetter.ts
/speech        → depr/server/src/routes/speech.ts
/chat          → depr/server/src/routes/chat.ts
/metrics       → depr/server/src/routes/metrics.ts
/assets        → static files (public/assets) with cache headers
```

`stripe` routes/controllers exist but are **commented out** and not mounted (see §10).

---

## 2. Authentication  - To be added in the C++ rewrite

The v1 API authenticates with **Clerk** JWT bearer tokens. The v2 C++ design uses a
first-party session cookie instead, so this whole section must be re-designed — it is
called out explicitly here because **auth will need to be added later**.

### How v1 auth works (`depr/server/src/middleware/auth.ts`)

- Wraps Clerk's `ClerkExpressWithAuth` using `CLERK_JWT_SECRET` and an allow-list of
  `authorizedParties` (local dev + Fly hosts + `https://resumetitan.com`).
- A request is accepted if **either**:
  1. **`clerkId` is present as a query parameter** — the user ID is trusted directly with
     *no token verification*. This exists so the Puppeteer print page can load a resume
     without a bearer token.
  2. **`Authorization: Bearer <jwt>`** is present and verifies. `req.auth.userId` is set
     to the Clerk user id; `req.auth.getToken()` returns the raw token.
- Failure responses are `401` with `{ "msg": "No token provided" }` or
  `{ "msg": "Authentication failed" }`.

### Client side

- The React client attaches `Authorization: Bearer <token>` on every request via an axios
  interceptor (`depr/client/src/api/actions.js`); the token comes from
  `Clerk.session.getToken()` (`depr/client/src/api/token.ts`).
- Some calls pass `clerkId` / `userId` in the **query string** or **body** instead of a
  token (`GET /resume`, `GET /resume/user`, print, interview, cover-letter creation).

### Protected vs. public (v1)

| Endpoint | Auth |
|----------|------|
| `GET /auth/reload` | Bearer token |
| `POST /auth/clerk` | **none** (webhook) |
| `/resume/*` | Bearer token (all routes) |
| `/interview/*` | Bearer token (all routes) |
| `/cover-letter/*` | Bearer token (all routes) |
| `POST /chat` | Bearer token |
| `POST /speech/speech-to-text` | **none** (unprotected — port carefully) |
| `GET /metrics/total` | **none** (public landing-page stats) |
| `/metrics` (others) | Bearer token |

### Porting notes for auth

- Replace Clerk with email/password + `HttpOnly` `SameSite=Lax` session cookie
  (`/api/auth/register|login|logout|me`).
- Every v1 route that used `verifyToken` maps to a v2 route that requires the session.
- Drop the `clerkId` query-param bypass; the print view should render from data already
  fetched by the logged-in page (or a short-lived signed token), not an unauthenticated ID.
- `GET /metrics/total` can stay public; `POST /metrics` should become admin-only.
- `POST /speech/speech-to-text` was unauthenticated in v1 — **do not** repeat that.

---

## 3. Common conventions

- **Success bodies** are JSON objects, usually wrapping the payload in a named key
  (`{ resume }`, `{ interviews }`, `{ coverLetters }`, `{ response }`, `{ interview }`).
  This is inconsistent; the C++ rewrite should normalize (e.g. always `{ data }` or bare).
- **Error bodies** are inconsistent across controllers:
  - Most: `{ "msg": "..." }`
  - Resume/AI: `{ "error": "..." }` (sometimes with `details`, `errorType`)
  - Metrics: `{ "success": false, "error": "...", "message": "..." }`
- **Status codes:** `200` ok, `201` created, `204` deleted (no body), `400` bad request,
  `401` unauthenticated, `404` not found, `408` timeout, `500` server error.

---

## 4. Auth endpoints — `/auth`

### `GET /auth/reload`
Return the current user document. Requires Bearer token.

- **Response `200`** — the Mongoose `User` document.
- **`400`** `{ "msg": "User not found." }`
- **`500`** `{ "msg": "<message>" }`

> Note: the controller reads `req.auth.id`, but the middleware sets `req.auth.userId`, so
> this likely always 400s in practice. Flag for the rewrite.

### `POST /auth/clerk`
Clerk webhook receiver. **No auth.**

- **Request body**
  ```json
  { "type": "user.created | user.updated | user.deleted", "data": { "...": "clerk payload" } }
  ```
  For `user.created`, expects `data.firstName`, `data.lastName`, `data.email`, `data.passwordHash`.
- **Response `200`**
  ```json
  { "token": "<jwt signed with JWT_SECRET>", "user": { "...": "saved user" }, "msg": "Clerk handled." }
  ```
- **`404`** `{ "msg": "User not found." }` (update) or `{ "msg": "Unknown type: <type>" }`
- **`500`** `{ "msg": "<message>" }`

Not needed in v2 (no external IdP).

---

## 5. Resume endpoints — `/resume`

All routes require a Bearer token. The resume body follows the **JSON Resume** shape
(see §9.1).

### `GET /resume?id=<resumeId>`
Fetch one resume, scoped to the authenticated user.

- **Response `200`** `{ "resume": { ...resume } }`
- **`404`** `{ "msg": "Resume not found" }`
- **`500`** `{ "msg": "<message>" }`

### `GET /resume/user?userId=<clerkId>`
List a user's resumes, newest-modified first. ⚠️ `userId` comes from the **query**, not the
token, so a caller can list another user's resumes.

- **Response `200`** `{ "resumes": [ ...resume ] }`
- **`500`** `{ "msg": "<message>" }`

### `POST /resume/print`
Render a resume to PDF server-side with Puppeteer (loads the client print page).

- **Request body** `{ "id": "<resumeId>" }`
- **Response `200`** — `application/pdf` bytes,
  `Content-Disposition: attachment; filename="resume.pdf"`.
- **`401`** plain text `User not known, cannot authenticate print`
- **`500`** plain text `Internal Server Error`

> v2 replaces this with client-side print CSS + `window.print()`.

### `POST /resume/upload-pdf`
Upload a resume PDF and have Gemini extract structured JSON. `multipart/form-data`,
field name **`pdf`** (memory storage, `application/pdf` only, 10 MB multer limit, 20 MB
inline-data check).

- **Response `200`** — the extracted resume JSON **directly** (not wrapped), matching the
  `UploadedResumeSchema` (§9.1).
- **`400`** `{ "error": "No PDF file uploaded" }` or `{ "error": "PDF file too large", "details": "..." }`
- **`500`** `{ "error": "...", "details": "...", "validationErrors"?: [...], "rawResponse"?: "..." }`

### `PUT /resume/update`
Create or update a resume from the full editor document.

- **Request body** — a full resume object (§9.1). If it has `_id`, it is updated (upsert);
  otherwise a new resume is created. `clerkId` is overwritten from the token.
- **Response `200`** `{ "resume": { ...saved resume } }`
- **`401`** `{ "msg": "User not authenticated" }`
- **`500`** `{ "msg": "<message>" }`

Side effect: creating a new resume increments the `RESUMES_TOTAL` metric.

### `DELETE /resume/delete/:id`
- **Response `200`** `{ "resume": { ...deleted resume } }` (not 204)
- **`500`** `{ "msg": "<message>" }`

### AI section endpoints

All accept `operationType ∈ { "generate", "brainstorm", "edit" }` and an optional
`userInput` (free-text instruction). If `operationType` is omitted it is inferred from the
presence of `userInput` and/or existing highlights. Responses wrap the section payload in
`response`.

| Method | Path | Request body | Success body |
|--------|------|--------------|--------------|
| POST | `/resume/summary` | `{ summary, work, education, skills, volunteer, basics, userInput, operationType }` | `{ "message": "...", "response": { "summary": "..." } }` |
| POST | `/resume/education` | `{ education, userInput, operationType }` | `{ "message": "...", "response": <Education> }` |
| POST | `/resume/work` | `{ job, userInput, operationType }` | `{ "message": "...", "response": <Work> }` |
| POST | `/resume/projects` | `{ project, userInput, operationType }` | `{ "message": "...", "response": <Project> }` |
| POST | `/resume/skills` | `{ skills, work, education, summary, volunteer, userInput, operationType }` | `{ "msg": "...", "response": { "skills": [ ... ] } }` |
| POST | `/resume/volunteer` | `{ volunteer, userInput, operationType }` | `{ "message": "...", "response": <Volunteer> }` |
| POST | `/resume/resume` | *(none)* | `{ "resume": <assembled resume> }` |

Errors: `500` `{ "error": "Failed to generate ..." }`.

> ⚠️ **Server-global mutable state:** the section handlers accumulate into a module-level
> `resumeData` object and `POST /resume/resume` serializes it. This is shared across all
> users/requests and is not safe. In v2, collapse these into one stateless
> `POST /api/ai/section` that takes the section + data and returns only that section.
>
> The v2 equivalent is specified in `ARCHITECTURE.md` (`/api/ai/section`), with prompt
> builders ported from `depr/server/src/controllers/resume.ts`.

---

## 6. Interview endpoints — `/interview`

All routes require a Bearer token.

### `POST /interview`
Create or update an interview (generate tailored questions).

- **Request body**
  ```json
  {
    "jobTitle": "Senior Software Engineer",
    "jobDescription": "...",
    "jobUrl": "https://...",
    "useJobUrl": false,
    "company": "Acme",
    "resumeId": "<optional resume id for tailoring>",
    "interviewId": "<optional existing interview id to update>",
    "clerkId": "<clerk user id>"
  }
  ```
  If `useJobUrl && jobUrl`, the server scrapes the posting (Python scraper → axios →
  Puppeteer → ScraperAPI fallback chain) and extracts title/company/description before
  generating questions.
- **Response `200`**
  ```json
  { "interview": { "_id": "...", "questions": [ ... ], "jobTitle": "...", "jobDescription": "...", "company": "...", "jobUrl": "...", "clerkId": "..." } }
  ```
- **`400`** `{ "error": "...", "errorType"?: "URL_PARSE_ERROR" }` (missing fields / bad URL)
- **`500`** `{ "error": "<message>" }`

Side effect: creating an interview increments the `INTERVIEWS_TOTAL` metric.

### `GET /interview`
- **Response `200`** `{ "interviews": [ ...interview ] }` (scoped to token user, newest first)

### `GET /interview/:id`
- **Response `200`** `{ "interview": { ... } }`
- **`500`** `{ "error": "<message>" }`

### `DELETE /interview/:id`
- **Response `204`** (empty)

### `PUT /interview/:id`
- **Request body** — interview object.
- **Response `200`** `{ "interview": { ...updated } }`

### `POST /interview/analyze`
AI feedback on a single answer.

- **Request body** `{ "answer": "...", "question": "..." }`
- **Response `200`** `{ "analysis": "..." }`
- **`400`** `{ "error": "Missing required fields: answer and question" }`

> v2 scope: interview prep is **out of scope for v1** per `ARCHITECTURE.md`; keep for later.

---

## 7. Cover letter endpoints — `/cover-letter`

All routes require a Bearer token.

### `GET /cover-letter`
- **Response `200`** `{ "coverLetters": [ ... ] }` (scoped to token user, newest first)

### `GET /cover-letter/:id`
- **Response `200`** `{ "coverLetter": { ... } }`

### `POST /cover-letter`
Generate (or update) a cover letter.

- **Request body**
  ```json
  {
    "coverLetter": {
      "_id": "<optional — present means update>",
      "jobTitle": "...",
      "jobDescription": "...",
      "company": "...",
      "resumeId": "<optional>",
      "jobUrl": "...",
      "useJobUrl": false,
      "name": "..."
    },
    "clerkId": "<optional; defaults to 'dev-user-id'>"
  }
  ```
  If `useJobUrl && jobUrl`, scrapes the posting to fill title/company/description, then
  generates the letter with Gemini.
- **Response `201`** `{ "coverLetter": { ...created } }`
- **Response `200`** `{ "coverLetter": { ...updated } }` (when `coverLetter._id` given)
- **`400`** `{ "error": "Failed to parse job posting from URL", "errorType": "URL_PARSE_ERROR" }`
- **`404`** `{ "error": "Resume not found" }`
- **`500`** `{ "error": "<message>" }`

Side effect: creating increments the `COVERLETTERS_TOTAL` metric.

### `PUT /cover-letter/:id`
- **Request body** — cover letter object (`$set` semantics).
- **Response `200`** `{ "coverLetter": { ...updated } }`

### `DELETE /cover-letter/:id`
- **Response `204`** (empty)

> v2 scope: cover letters are **out of scope for v1** per `ARCHITECTURE.md`.

---

## 8. Chat endpoint — `/chat`

### `POST /chat`
Docs-aware support chatbot. Middleware chain:
`verifyToken` → `chatRateLimiter` (60 req/min per IP) → `timeout(12s)` → `cacheMiddleware(3600)`.

- **Request body** `{ "message": "How do I add a job?" }`
- **Response `200`** `{ "response": "## Adding a Job\n\n• ..." }`
- **`400`** `{ "error": "Message is required" }`
- **`408`** `{ "error": "Request timeout" }`
- **`429`** plain text `Too many requests from this IP, please try again after a minute`
- **`500`** `{ "error": "Failed to process chat message" }`

Behavior details:
- Loads `depr/server/src/docs/*.md` at boot and injects matching topics into the prompt.
- Caches responses **by message text only** (not per user) for 1 hour.
- Forwards both user message and bot reply to a **hard-coded Discord webhook URL**
  (secret embedded in source — remove this in v2).

> v2 scope: chatbot is **out of scope for v1** per `ARCHITECTURE.md`.

---

## 9. Speech endpoint — `/speech`

### `POST /speech/speech-to-text`
Speech-to-text via Google Cloud Speech. `multipart/form-data`, field name **`audio`**.
Transcodes mp4/aac/m4a/webm to WAV with ffmpeg, then calls `client.recognize`.
**No auth middleware in v1.**

- **Response `200`** `{ "transcript": "..." }`
- **`500`** `{ "error": "<message>" }`

> Not in v2 scope; if ported, require auth.

---

## 10. Metrics endpoints — `/metrics`

### `GET /metrics/total`
Public aggregate stats (keys containing `TOTAL`). **No auth.**

- **Response `200`**
  ```json
  { "success": true, "data": { "resumestotal": { "key": "RESUMES_TOTAL", "value": 123, "description": "...", "title": "...", "icon": "...", "lastUpdated": "..." } }, "count": 1 }
  ```

### `GET /metrics`
All metrics (debug). Requires Bearer token.
- **Response `200`** `{ "success": true, "data": [ { "key", "value", "description", "lastUpdated" } ], "count": 1 }`

### `GET /metrics/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
Requires Bearer token.
- **Response `200`**
  ```json
  {
    "success": true,
    "data": {
      "dateRange": { "start": "2026-01-01", "end": "2026-01-31" },
      "newItems": { "resumes": 0, "editedResumes": 0, "interviews": 0, "coverLetters": 0 },
      "totals":   { "resumes": 0, "editedResumes": 0, "interviews": 0, "coverLetters": 0 },
      "growth":   { "resumes": "0", "editedResumes": "0", "interviews": "0", "coverLetters": "0" }
    }
  }
  ```
- **`400`** `{ "success": false, "error": "Start date and end date are required" }` (or invalid format)

### `GET /metrics/:key`
Requires Bearer token.
- **Response `200`** `{ "success": true, "data": { "key", "value", "description", "lastUpdated" } }`
- **`404`** `{ "success": false, "error": "Metric not found" }`

### `POST /metrics`
Upsert a metric (admin use, but only requires a bearer token in v1).
- **Request body** `{ "key": "RESUMES_TOTAL", "value": 123, "description": "...", "title": "..." }`
- **Response `200`** `{ "success": true, "data": { ...metric }, "message": "Metric updated successfully" }`
- **`400`** `{ "success": false, "error": "Key and value are required. Value must be a number." }`

---

## 11. Stripe endpoints — disabled

`depr/server/src/routes/stripe.ts` and `controllers/stripe.ts` are entirely commented out
and **not mounted**. They previously defined:

- `POST /checkout/session` — create a Stripe checkout session for a plan
  (`7days` / `1month` / `6months`).
- `POST /checkout/webhook` — handle `checkout.session.completed` and set
  `premiumUntil` on the Clerk user.

The client still calls `POST /checkout/session` (`depr/client/src/api/stripe.ts`) against a
non-existent route. Payments are out of v2 scope.

---

## 12. Data models

### 12.1 Resume (JSON Resume based)
`depr/server/src/models/Resume.ts`. Stored per user (`clerkId`), timestamps on.

```jsonc
{
  "_id": "mongo id",
  "clerkId": "clerk user id",            // required
  "name": "Resume Name",                 // default "Resume Name"
  "theme": "professional",               // default "professional"
  "font": "times-new-roman",             // default "times-new-roman"
  "sections": ["Basics"],                // render order
  "basics": {                            // required
    "name": "", "label": "", "image": "", "email": "", "phone": "", "url": "", "summary": "",
    "location": { "address": "", "postalCode": "", "city": "", "countryCode": "", "region": "" },
    "profiles": [ { "network": "", "username": "", "url": "" } ]
  },
  "summary": "",
  "work":       [ { "id": 0, "position": "", "name": "", "city": "", "state": "", "startDate": "", "endDate": "", "endDateCurrent": false, "notes": "", "highlights": [] } ],
  "education":  [ { "id": 0, "institution": "", "area": "", "studyType": "", "startDate": "", "endDate": "", "endDateCurrent": false, "highlights": [] } ],
  "volunteer":  [ { "id": 0, "organization": "", "position": "", "url": "", "startDate": "", "endDate": "", "endDateCurrent": false, "highlights": [] } ],
  "projects":   [ { "id": 0, "name": "", "startDate": "", "endDate": "", "endDateCurrent": false, "description": "", "highlights": [], "url": "" } ],
  "skills":     [ { "name": "", "level": "", "keywords": [] } ],
  "awards":     [ { "title": "", "awarder": "", "summary": "" } ],
  "createdAt": "ISO date", "updatedAt": "ISO date"
}
```

The richer TypeScript shape (including certificates, publications, languages, interests,
references) lives in `depr/server/src/types/types.ts` (`ResumeType`).

### 12.2 Interview
```jsonc
{
  "_id": "mongo id",
  "questions": [ { "question": "", "example": "", "guidance": "", "answer": "" } ],
  "jobTitle": "", "jobDescription": "", "company": "", "jobUrl": "",
  "clerkId": "",                          // required
  "createdAt": "ISO date", "updatedAt": "ISO date"
}
```

### 12.3 CoverLetter
```jsonc
{
  "_id": "mongo id",
  "name": "", "date": "ISO date", "letter": "",
  "jobTitle": "", "jobDescription": "", "company": "",
  "city": "", "state": "",
  "resumeId": "resume id ref",
  "clerkId": "",                          // required
  "createdAt": "ISO date", "updatedAt": "ISO date"
}
```

### 12.4 User
```jsonc
{
  "firstName": "", "lastName": "", "email": "",   // required, email unique
  "password": "",                                   // required (hash)
  "phone": 0, "premiumUntil": "ISO date", "chatId": "",
  "createdAt": "ISO date", "updatedAt": "ISO date"
}
```

### 12.5 Metric
```jsonc
{ "key": "RESUMES_TOTAL", "value": 0, "title": "", "icon": "", "description": "", "lastUpdated": "ISO date" }
```

Known metric keys: `RESUMES_TOTAL`, `INTERVIEWS_TOTAL`, `COVERLETTERS_TOTAL`.

---

## 13. Discrepancies & gotchas to fix in the rewrite

1. **Server-global `resumeData`** in `resume.ts` — shared mutable state across users.
2. **Unauthenticated `/speech/speech-to-text`** — should require auth.
3. **`GET /resume/user` trusts `userId` from the query** — horizontal access risk.
4. **`GET /auth/reload` reads `req.auth.id`** but middleware sets `req.auth.userId`.
5. **`DELETE /resume/delete/:id` returns 200 with the deleted doc** instead of 204.
6. **Inconsistent error envelopes** (`msg` vs `error` vs `success/error/message`).
7. **Chat cache is keyed on message text only** and is not per-user.
8. **Hard-coded Discord webhook secret** in `chat.ts`.
9. **Client calls `POST /resume/create`** (`depr/client/src/pages/actionPage/index.jsx`) but
   no such route exists — create actually happens via `PUT /resume/update`.
10. **Client calls `POST /checkout/session`** but the Stripe route is disabled.
11. **`clerkId` query-param auth bypass** — remove in favor of sessions.
12. **AI endpoints return only generated section data**; prompts and schemas are in
    `depr/server/src/controllers/{resume,interview,coverLetter}.ts`.

---

## 14. C++ rewrite mapping

| v1 (depr) | v2 (C++) — see `ARCHITECTURE.md` |
|-----------|----------------------------------|
| `POST /auth/clerk`, Clerk bearer | `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me` + session cookie |
| `GET /resume`, `/resume/user` | `GET /api/resumes`, `GET /api/resumes/:id` |
| `PUT /resume/update` | `POST /api/resumes`, `PUT /api/resumes/:id` |
| `DELETE /resume/delete/:id` | `DELETE /api/resumes/:id` |
| `POST /resume/{summary,work,education,skills,projects,volunteer}` | `POST /api/ai/section` (unified, stateless) |
| `POST /resume/upload-pdf` | `POST /api/ai/import` (multipart PDF) |
| `POST /resume/print` (Puppeteer) | client-side `window.print()` / `print.html` |
| `POST /interview/*`, `/cover-letter/*`, `/chat`, `/speech` | out of v1 scope (later) |
| `GET /metrics/total` | keep public (optional) |
| `POST /metrics` | admin-only (later) |
| MongoDB / Mongoose | MySQL (JSON column for resume body) |

Auth is intentionally deferred: v2 ships first-party email/password sessions, so none of
the Clerk-based auth above is reused. See `ARCHITECTURE.md` §"Decisions" and §"HTTP API".
