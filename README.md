# ResumeTitan

![Coverage](https://shields.io<USERNAME>/<GIST_ID>/raw/coverage.json)

A fast, self-hosted resume builder. Write a resume once, sharpen it with AI, and tailor it to any job posting — then export a clean, ATS-friendly PDF.

ResumeTitan ships as **one Go binary** that serves an embedded plain HTML/CSS/JS frontend and a small JSON API, backed by a single **SQLite** file.

## Design principles

- Standard library first (`net/http`, `log/slog`, `embed`, `html/template`); add a dependency only when it removes real work.
- Every user-owned row is read and written with an ownership check, and sessions are handled server-side.
- External services sit behind small interfaces so they can be swapped.
- One process, one database file, one deploy.

## Stack

| Concern  | Choice                                       |
| -------- | -------------------------------------------- |
| Language | Go 1.27+ (static binary)                     |
| Routing  | `net/http` `ServeMux` (method + path patterns) |
| Database | SQLite (`modernc.org/sqlite`, pure Go, WAL)  |
| Frontend | Plain HTML5, CSS3 and ES modules — no build step, embedded with `embed.FS` |
| LLM      | OpenRouter, behind a swappable interface     |
| Logging  | `log/slog` (JSON)                            |

## Requirements

- **Go 1.27+** (`go version`)
- `make` (optional — every target maps to a plain `go` command)

## Getting started

```sh
git clone https://github.com/haym23-dev/ResumeTitan.git
cd ResumeTitan

cp .env.example .env   # fill in the values you need
```

The app reads configuration from the process environment. Defaults are provided for `HOST` and `PORT`, so it runs out of the box:

```sh
make run               # builds ./bin/server and starts it
# or, without make:
go run ./cmd/server
```

Then open <http://localhost:8080>.

### Make targets

| Target              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `make build`        | Compile the binary to `./bin/server`                |
| `make run`          | Build, then run                                     |
| `make test`         | Run all unit tests with `-race`                     |
| `make test-cover`   | Run tests and write `coverage.html`                 |
| `make lint`         | `go fmt`, `go vet`, and `golangci-lint`             |
| `make generate`     | Run code generation directives                      |
| `make clean`        | Remove build artifacts and coverage reports         |
| `make help`         | List every target                                   |

### Environment

| Variable             | Purpose                                            | Default   |
| -------------------- | -------------------------------------------------- | --------- |
| `HOST`               | Interface to bind                                   | `0.0.0.0` |
| `PORT`               | Port to listen on                                   | `8080`    |
| `SESSION_SECRET`     | Signs session cookies                               | —         |
| `OPENROUTER_BASE_URL`| Base URL for the LLM API                            | —         |
| `OPENROUTER_API_KEY` | API key for the LLM                                 | —         |

## Project layout

```
cmd/server/main.go     wiring, config, HTTP server
internal/
  config/              environment parsing and validation
  httpx/               static file serving, JSON helpers, API handlers
web/                   embedded frontend (HTML, CSS, JS, partials, mock data)
Makefile               build, test, lint and run targets
```

Additional packages (`db`, `auth`, `resume`, `coverletter`, `interview`, `llm`, `jobfetch`, `mail`, `speech`) are added as their features land.

## API

The frontend is served at `/` (with a custom `404.html`). The JSON API lives under `/api`.

### Implemented

| Method | Route         | Response              |
| ------ | ------------- | --------------------- |
| `GET`  | `/api/health` | `{"ok": true}`        |

### Planned

| Area          | Routes                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------- |
| Auth          | `POST /api/auth/{signup,login,logout,reset/request,reset/confirm,verify}`; `GET/DELETE /api/auth/me` |
| Resumes       | `GET/POST /api/resumes`; `GET/PUT/DELETE /api/resumes/{id}`; `POST /api/resumes/import`; `GET /api/resumes/{id}/pdf` |
| AI            | `POST /api/ai/{section}` with `{mode, data, instructions}`                                    |
| Interviews    | `GET/POST /api/interviews`; `GET/PUT/DELETE /api/interviews/{id}`; `POST /api/interviews/{id}/questions/{n}/feedback` |
| Cover letters | `GET/POST /api/cover-letters`; `GET/PUT/DELETE /api/cover-letters/{id}`                       |
| Other         | `POST /api/speech`, `POST /api/chat`, `GET /api/stats`                                        |

## Status

The Go server, project layout and Makefile are in place, static assets are embedded and served from the binary, and `GET /api/health` responds.

Next up: environment validation, server timeouts and graceful shutdown, and request middleware (request ID, access logs, panic recovery, body limits, security headers) — followed by the SQLite layer and authentication.

## License

[MIT](./LICENSE) © 2026 Mitchell Hay.
