# AI Editorial Workspace

A lightweight editorial research and writing application built for the This Week in AI take-home assignment.

## Features

### Research Assistant
- Accepts three or more article URLs or pasted article text.
- Extracts readable article content from URLs.
- Produces concise source summaries, key facts, implications, evidence notes, and newsletter angles.
- Separates source-supported facts from editorial analysis.
- Retains original source URLs alongside the brief.
- Includes clear extraction/API error handling.

### Writing Assistant
- Analyzes long sentences, filler phrases, passive-voice patterns, and possible jargon.
- Provides actionable feedback and suggested rewrites.
- Keeps the original draft unchanged until suggestions are accepted.
- Supports accepting/rejecting individual suggestions and comparing original/revised text.
- Shows word count, sentence count, average sentence length, estimated reading time, and a Flesch Reading Ease estimate.

### Sample editorial output
The app includes a sample newsletter draft and sample sources in `sample-output/`.

## Tech stack
- React 18 + Vite
- Flask + Flask-CORS
- OpenAI Python SDK (optional but recommended for richer research synthesis)
- BeautifulSoup + requests for article extraction
- Deterministic Python rules for writing metrics and issue detection

## Requirements
- Node.js 18+
- Python 3.10+
- An OpenAI API key for AI-generated research synthesis (optional; deterministic research fallback is available)

## Local setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and add your key:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
FRONTEND_ORIGIN=http://localhost:5173
```

Start Flask:

```bash
python app.py
```

Backend runs at `http://localhost:5000`.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `OPENAI_API_KEY` | Enables AI synthesis and AI writing feedback | No; deterministic fallback is available |
| `OPENAI_MODEL` | OpenAI model name | No; defaults to `gpt-4o-mini` |
| `FRONTEND_ORIGIN` | CORS origin | No |
| `VITE_API_BASE_URL` | Backend URL for frontend | No; defaults to localhost |

Never commit `.env`. The repository includes `.env.example` files only.

## API endpoints

- `GET /api/health` — health check
- `POST /api/research` — research brief from sources
- `POST /api/writing/analyze` — deterministic writing analysis
- `POST /api/writing/suggest` — optional AI rewrite suggestions

## Editorial and engineering decisions

Primary user: A newsletter editor who needs to move from a pile of AI-related source material to a defensible editorial angle and a readable draft.

Core problem: Summaries alone do not help an editor decide what matters. The product therefore combines source-level extraction, fact/analysis separation, implications, and a potential angle.

Priorities: End-to-end workflow, traceable source URLs, transparent deterministic checks, and writer-controlled edits.

Deliberately excluded: Authentication, publishing integrations, collaborative editing, persistent cloud storage, social listening, and automated fact-checking against the entire web. These are outside a 6–8 hour MVP.

AI vs deterministic logic: OpenAI is used for synthesis and optional contextual rewrites. Sentence segmentation, metrics, and issue detection use deterministic rules so they remain explainable and work without an API key.

Failure handling: URL extraction errors are shown per source; the editor can paste source text instead. AI failures fall back to a deterministic brief rather than silently fabricating source content. The UI labels fallback output.

Evidence discipline: Every source summary retains its original URL. The brief asks the model to reference source IDs and only describe claims supported by supplied text. This is editorial traceability, not independent verification; an editor must open and verify original sources before publication.

Success measures: Time from source collection to a usable angle, percentage of cited claims an editor can verify, suggestion acceptance rate, and editor-rated usefulness—not raw number of summaries.

Next day of work: Add persistent projects, better extraction for paywalled/JS-heavy pages, claim-level quote spans, source conflict detection, automated tests, and human evaluation of suggestion quality.

Editorial principle: Clear writing is specific, accurate, and appropriately paced. Shorter is not automatically better. The tool flags patterns for human review and never changes a draft without acceptance.

## Tools used / disclosure
This implementation is designed to be built and run with React, Flask, BeautifulSoup, and the OpenAI API. AI coding assistance may be used during implementation; disclose the actual tools used and distinguish generated scaffolding from code personally tested and verified. 

## Known limitations
- Some publishers block automated extraction or render content in JavaScript. Paste the article text in those cases.
- Passive voice and jargon detection are heuristic and can produce false positives/negatives.
- Flesch Reading Ease is an estimate and is not a measure of factual quality or editorial value.
- The AI brief is only as reliable as the supplied source text and still requires editorial verification.
