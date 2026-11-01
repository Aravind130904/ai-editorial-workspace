import os
import re
import json
import logging
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app, origins=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(","))

MAX_TEXT = 30000
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; EditorialWorkspace/1.0)"}

def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()

def extract_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Enter a valid http or https URL.")
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    for node in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        node.decompose()
    title = clean_text(soup.title.get_text(" ", strip=True) if soup.title else parsed.netloc)
    candidates = soup.find_all(["article", "main"])
    root = max(candidates, key=lambda el: len(el.get_text(" ", strip=True)), default=soup.body or soup)
    paragraphs = [clean_text(p.get_text(" ", strip=True)) for p in root.find_all(["p", "h1", "h2", "h3"])]
    content = "\n".join(p for p in paragraphs if len(p) > 35)
    if len(content) < 120:
        content = clean_text(root.get_text(" ", strip=True))
    if len(content) < 80:
        raise ValueError("Not enough readable article text was found. Paste the article text instead.")
    return {"title": title, "url": url, "text": content[:MAX_TEXT], "status": "extracted"}

def normalize_sources(items):
    if not isinstance(items, list) or len(items) < 3:
        raise ValueError("Please provide at least three sources.")
    sources, errors = [], []
    for idx, item in enumerate(items[:10], 1):
        item = item or {}
        url = clean_text(item.get("url"))
        pasted = clean_text(item.get("text"))
        title = clean_text(item.get("title"))
        if pasted:
            sources.append({"id": f"S{idx}", "title": title or f"Pasted source {idx}",
                            "url": url or "", "text": pasted[:MAX_TEXT], "status": "pasted"})
        elif url:
            try:
                extracted = extract_url(url)
                sources.append({"id": f"S{idx}", **extracted})
            except Exception as exc:
                errors.append({"id": f"S{idx}", "url": url, "error": str(exc)})
        else:
            errors.append({"id": f"S{idx}", "error": "Source needs a URL or pasted text."})
    if len(sources) < 3:
        raise ValueError("At least three sources must contain readable text. " +
                         (f"{len(sources)} source(s) were usable. " if sources else "") +
                         "Paste text for inaccessible URLs.")
    return sources, errors

def fallback_brief(sources):
    source_notes = []
    for s in sources:
        sentences = re.split(r"(?<=[.!?])\s+", s["text"])
        excerpt = " ".join(sentences[:3])[:650]
        source_notes.append({
            "id": s["id"], "title": s["title"], "url": s["url"],
            "summary": excerpt,
            "facts": ["Review the linked source text and verify its specific claims before publication."],
            "why_it_matters": "Potential relevance depends on how this development changes costs, capabilities, distribution, or competitive dynamics.",
            "evidence": "Summary excerpt extracted from the supplied source text; not independently fact-checked.",
            "classification": "Source-derived excerpt"
        })
    return {
        "headline": "What these AI developments may signal",
        "what_happened": "The supplied sources describe developments that should be assessed together rather than treated as isolated announcements.",
        "why_it_matters": "For founders and operators, the useful question is whether these developments change the cost, speed, reliability, or distribution of a product or workflow.",
        "who_should_care": ["Founders evaluating product strategy", "Builders choosing tools and infrastructure", "Operators assessing workflow changes"],
        "story_opportunity": "Look for the shared shift across the sources: what has become newly possible, cheaper, faster, or more accessible—and what still does not work?",
        "newsletter_angles": [
            "The practical capability shift hiding behind this week's AI announcements",
            "What builders can adopt now versus what remains a demo"
        ],
        "editorial_caveats": ["This fallback is a research starting point, not a verified synthesis.", "Open each original source and confirm dates, numbers, and quotations."],
        "sources": source_notes,
        "mode": "deterministic_fallback"
    }

def openai_client():
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=key)
    except Exception:
        logging.exception("Could not initialize OpenAI client")
        return None

def ask_model(system, user, max_tokens=2200):
    client = openai_client()
    if not client:
        return None
    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.2,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        return json.loads(response.choices[0].message.content)
    except Exception:
        logging.exception("OpenAI request failed")
        return None

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "ai_enabled": bool(os.getenv("OPENAI_API_KEY", "").strip())})

@app.post("/api/research")
def research():
    try:
        payload = request.get_json(force=True) or {}
        sources, errors = normalize_sources(payload.get("sources", []))
        source_payload = [{"id": s["id"], "title": s["title"], "url": s["url"],
                           "text": s["text"][:9000]} for s in sources]
        prompt = (
            "Analyze the supplied sources for an AI industry newsletter editor. Return JSON with keys: "
            "headline, what_happened, why_it_matters, who_should_care (array), story_opportunity, "
            "newsletter_angles (array), editorial_caveats (array), sources (array), mode. "
            "For each sources item include id,title,url,summary,facts (array),why_it_matters,evidence,classification. "
            "Use only claims supported by the supplied text. Distinguish directly stated facts from analysis. "
            "Do not invent dates, metrics, quotations, or missing context. If sources disagree or lack evidence, say so. "
            "Reference source IDs in evidence. Analysis must be labelled as analysis, not fact."
        )
        brief = ask_model("You are a cautious, evidence-first senior AI editor. Return valid JSON only.", 
                          prompt + "\n\nSOURCES:\n" + json.dumps(source_payload, ensure_ascii=False))
        if not brief or not isinstance(brief.get("sources"), list):
            brief = fallback_brief(sources)
        else:
            brief["mode"] = "ai_assisted"
            # Preserve exact source URLs and IDs from the extracted inputs.
            lookup = {s["id"]: s for s in sources}
            for note in brief.get("sources", []):
                original = lookup.get(note.get("id"))
                if original:
                    note["url"] = original["url"]
                    note["title"] = original["title"]
        return jsonify({"brief": brief, "source_errors": errors,
                        "source_count": len(sources), "ai_enabled": bool(openai_client())})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        logging.exception("Research endpoint failed")
        return jsonify({"error": "Research failed. Please retry or paste source text."}), 500

FILLERS = ["in order to", "at the end of the day", "it is important to note that",
           "basically", "very", "really", "just", "actually", "in terms of",
           "needless to say", "due to the fact that"]
JARGON = ["synergistic", "paradigm", "leverage", "ideate", "north star", "10x",
          "agentic", "multimodal", "inference-time", "latent space"]

def sentences_of(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]

def count_syllables(word):
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    groups = re.findall(r"[aeiouy]+", word)
    count = len(groups)
    if word.endswith("e") and count > 1 and not word.endswith(("le", "ye")):
        count -= 1
    return max(1, count)

def readability(text):
    words = re.findall(r"\b[\w'-]+\b", text)
    sents = sentences_of(text)
    if not words or not sents:
        return None
    syllables = sum(count_syllables(w) for w in words)
    score = 206.835 - 1.015 * (len(words) / len(sents)) - 84.6 * (syllables / len(words))
    return round(score, 1)

def analyze_text(text):
    words = re.findall(r"\b[\w'-]+\b", text)
    sents = sentences_of(text)
    issues = []
    for sentence in sents:
        count = len(re.findall(r"\b[\w'-]+\b", sentence))
        if count > 28:
            issues.append({"type": "Long sentence", "severity": "high" if count > 38 else "medium",
                           "excerpt": sentence, "reason": f"This sentence has about {count} words. Its main point may be hard to hold in working memory.",
                           "suggestion": "Split around the main idea, while keeping related technical details together."})
        low = sentence.lower()
        for phrase in FILLERS:
            if re.search(r"\b" + re.escape(phrase) + r"\b", low):
                issues.append({"type": "Possible filler", "severity": "low", "excerpt": sentence,
                               "reason": f"'{phrase}' may add words without adding meaning.",
                               "suggestion": "Remove the phrase and check whether the sentence still says the same thing."})
                break
        passive = re.search(r"\b(am|is|are|was|were|be|been|being)\s+\w+(ed|en)\b", low)
        if passive:
            issues.append({"type": "Possible passive voice", "severity": "low", "excerpt": sentence,
                           "reason": "A passive construction may hide who is doing the action.",
                           "suggestion": "If the actor matters, name it and use an active verb. Keep passive voice when the actor is unknown or unimportant."})
        found = [term for term in JARGON if re.search(r"\b" + re.escape(term) + r"\b", low)]
        if found:
            issues.append({"type": "Possible jargon", "severity": "medium", "excerpt": sentence,
                           "reason": f"The term '{found[0]}' may be unclear to readers outside the field.",
                           "suggestion": "Add a short plain-language explanation on first use; keep the technical term if it is precise and useful."})
    paragraphs = [p for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    long_paras = [p for p in paragraphs if len(re.findall(r"\b[\w'-]+\b", p)) > 110]
    for p in long_paras:
        issues.append({"type": "Dense paragraph", "severity": "medium", "excerpt": p[:280] + ("…" if len(p) > 280 else ""),
                       "reason": "This paragraph is over 110 words and may contain more than one idea.",
                       "suggestion": "Consider separating the context, evidence, and implication into distinct paragraphs."})
    avg = round(len(words) / max(1, len(sents)), 1)
    score = readability(text)
    return {"metrics": {"word_count": len(words), "sentence_count": len(sents),
                        "average_sentence_length": avg, "reading_time_minutes": round(len(words)/220, 1),
                        "flesch_reading_ease": score,
                        "readability_note": "An approximate reading-effort signal, not a quality score. Technical writing may appropriately score lower."},
            "issues": issues[:40]}

@app.post("/api/writing/analyze")
def writing_analyze():
    payload = request.get_json(force=True) or {}
    text = payload.get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Paste a draft to analyze."}), 400
    return jsonify(analyze_text(text[:50000]))

@app.post("/api/writing/suggest")
def writing_suggest():
    payload = request.get_json(force=True) or {}
    text = clean_text(payload.get("text"))
    if len(text) < 20:
        return jsonify({"error": "Please provide a longer draft for rewrite suggestions."}), 400
    result = ask_model(
        "You are a careful newsletter editor. Preserve meaning, factual nuance, and author voice. Never add facts. Return JSON only.",
        "Review this draft and return JSON {suggestions:[{excerpt,reason,rewrite}]} with at most 5 high-value edits. "
        "Only suggest changes that improve clarity or remove genuine friction. Do not shorten technical terms that are necessary.\n\nDRAFT:\n" + text[:12000],
        1400
    )
    if not result or not isinstance(result.get("suggestions"), list):
        return jsonify({"suggestions": [], "message": "AI suggestions are unavailable. Use the deterministic feedback in Analyze."})
    return jsonify({"suggestions": result["suggestions"][:5]})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
