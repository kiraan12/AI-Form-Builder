# AI-Powered Form Builder & Document Autofill

A web app that lets a user design a form from scratch, upload a document (PDF/image), and have
AI extract matching values into the form — schema-driven, with no hardcoded fields.

## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Fast dev loop, no framework overhead needed for a focused single-flow app |
| Backend | Node.js + Express | Lightweight, easy to reason about, first-class `multipart/form-data` support via `multer` |
| Database | SQLite (`better-sqlite3`) | Zero setup, synchronous API keeps route handlers simple, fine for this scope |
| AI extraction | Claude API (`claude-sonnet-5`), multimodal input | Reads PDFs and images natively in one call — no separate OCR step needed |
| File upload | `multer` (memory storage) | File is only needed transiently to send to the LLM; never persisted to disk |

## Project structure

```
backend/            Node.js + Express version (see below)
backend-python/      FastAPI version — same routes, same SQLite schema, drop-in alternative
frontend/            React + Vite — works against either backend unchanged
```

Both backends implement the identical API contract (`/api/forms`, `/api/extract`, etc.), so you
only need to run **one** of them alongside the frontend. Pick whichever fits your stack.

### backend/ (Node.js)

```
backend/
  server.js           Express app entrypoint
  db.js               SQLite schema (forms, fields, submissions)
  routes/forms.js      Form CRUD + submissions
  routes/extract.js    Schema-driven AI extraction endpoint
```

### backend-python/ (FastAPI)

```
backend-python/
  requirements.txt
  app/
    main.py                  FastAPI app entrypoint, CORS, error handling
    db.py                    SQLite schema (identical to the Node version)
    schemas.py                Pydantic request models
    routers/forms.py          Form CRUD + submissions
    routers/extract.py        Schema-driven AI extraction endpoint
```

Frontend structure:

```
frontend/
  src/App.jsx                    Step router: build → upload → review
  src/components/FormBuilder.jsx  Add/edit/remove fields, live preview, export/import schema
  src/components/FieldEditor.jsx  One field's controls in the builder
  src/components/FormRenderer.jsx Shared renderer used by both live preview and review (same code path, so they can never drift out of sync)
  src/components/DocumentUpload.jsx File validation + extraction trigger
  src/components/ReviewForm.jsx     Editable results, required-field flags, confidence badges, save
```

## How schema-driven extraction works

1. The builder saves the form (title + fields) to the backend, getting back a form with real field IDs.
2. On upload, the frontend sends the file **and** the field list (`id`, `label`, `type`, `options`) to `/api/extract`.
3. The backend builds a prompt naming only those fields and sends it + the file (as a `document` or `image` content block) to Claude in a single multimodal call.
4. The model is instructed to return strict JSON keyed by field ID, with `null` for anything it can't find or isn't confident about, plus a `high`/`medium`/`low` confidence per field.
5. The backend re-validates the response against each field's type server-side (e.g. coerces/rejects non-numeric values for `number` fields) before returning it — the model's output is never trusted blindly.
6. The frontend pre-fills the review form with these values, flags empty required fields, and shows confidence badges.

Because the prompt and the JSON schema are both built from the same `fields` array at request time, the exact same code handles a resume, an invoice, or a medical intake form with no changes.

## Setup — running locally

Requires Node.js 18+ (frontend, and Node backend). Python 3.10+ if using the Python backend.

### 1. Backend — pick one

**Option A — Node.js**
```bash
cd backend
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=<your key>
npm start
```

**Option B — Python (FastAPI)**
```bash
cd backend-python
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=<your key>
uvicorn app.main:app --port 4000
```

Either way, the API runs on `http://localhost:4000`. The SQLite database file is created
automatically on first run in that backend's own folder.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` and proxies `/api/*` to the backend (see `vite.config.js`).

Open `http://localhost:5173` and walk through: build a form → upload a document → review & save.

## Edge cases handled

| Situation | Behaviour |
|---|---|
| Required field has no matching data | Left blank, outlined in red, listed in a warning banner |
| Upload attempted before any fields exist | "Continue to upload" is unreachable until at least one labelled field exists |
| Corrupted/unsupported file | Client-side MIME check blocks it immediately; server re-validates and returns a specific error either way |
| Number field with no numeric value found | Server coerces non-numeric extractions to `null`; field shown blank with low confidence |
| AI unsure about a value | Model is instructed to return `null` rather than guess; backend forces `low` confidence whenever value is `null` |
| SQL/DB errors, extraction failures | Caught server-side, returned as a plain-language `error` message rather than a stack trace |

## Bonus features implemented

- **Confidence indicators** — High/Medium/Low badge next to each extracted field
- **Form templates** — every saved form is listed and can be reloaded as a starting point for a new upload
- **Export/import form schema** — download the current builder state as JSON, or load one back in

Not implemented: drag-and-drop reordering, real-time (streaming) per-field extraction display — the extraction call returns as one JSON response rather than a stream, which was a deliberate scope trade-off (see below).

## Assumptions & trade-offs

- **One extraction call, not streamed.** The spec's "real-time extraction display" bonus implies streaming partial results; I chose a single request/response for reliability and simplicity, since a half-parsed JSON stream risks showing incorrect partial values. This was the one bonus feature knowingly dropped.
- **Files are never persisted.** Uploaded documents are held in memory only for the duration of the extraction call, then discarded — better for privacy, but means there's no "re-extract without re-uploading" feature.
- **Dropdown option matching is semantic, not exact-string.** The model is asked to match by meaning against the defined options; if nothing fits, it returns `null` rather than picking the closest one.
- **A form's schema is immutable once created.** Editing fields after a form has been saved (and after submissions exist against it) isn't supported — treated as out of scope; a form is versioned by creating a new one.
- **Auth is out of scope.** No login/user separation; all forms and submissions are global to the app instance, appropriate for a take-home assessment.
