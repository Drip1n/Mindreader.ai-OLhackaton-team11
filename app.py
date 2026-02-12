from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app)

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3"

# Simple shared state (fine for demo)
game_data = {
    "turns": [],        # list of {"q": "...", "a": "yes/no/maybe"}
    "confidence": 10,   # simulated (kept for your bar)
    "remaining": 2000,  # simulated
    "last_question": None
}

SYSTEM_PROMPT = (
    "You are a guessing-game engine for a 14+ audience.\n"
    "We are playing 'Think of an object'.\n"
    "Ask ONE simple question answerable by: yes / no / maybe.\n"
    "Also provide exactly 3 best guesses with confidence percentages.\n"
    "Return ONLY valid JSON in this exact schema:\n"
    '{\n'
    '  "question": "string",\n'
    '  "guesses": [\n'
    '    {"name": "string", "confidence": 0},\n'
    '    {"name": "string", "confidence": 0},\n'
    '    {"name": "string", "confidence": 0}\n'
    '  ]\n'
    '}\n'
    "Rules:\n"
    "- confidence must be an integer 0..100\n"
    "- guesses must be length 3\n"
    "- No markdown. No extra keys."
)

def call_ollama(messages):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.2}
    }
    r = requests.post(OLLAMA_URL, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()["message"]["content"]

def safe_parse_json(text: str):
    try:
        return json.loads(text)
    except:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end+1])
        except:
            pass

    raise ValueError(f"Model did not return valid JSON. Raw: {text[:300]}")

def clamp_int(n, lo=0, hi=100):
    try:
        n = int(n)
    except:
        return lo
    return max(lo, min(hi, n))

@app.route("/ask", methods=["POST"])
def ask_ai():
    data = request.json or {}
    answer = (data.get("answer") or "").strip().lower()

    # Treat dontknow as maybe so your UI button works
    if answer == "dontknow":
        answer = "maybe"

    if answer not in ["start", "yes", "no", "maybe"]:
        return jsonify({"error": "answer must be one of: start, yes, no, maybe, dontknow", "ai_used": False}), 400

    # Reset for new game
    if answer == "start":
        game_data["turns"] = []
        game_data["confidence"] = 10
        game_data["remaining"] = 2000
        game_data["last_question"] = None

    # Update simulated stats
    if answer != "start":
        if game_data["last_question"]:
            game_data["turns"].append({"q": game_data["last_question"], "a": answer})

        game_data["confidence"] = min(99, game_data["confidence"] + 12)
        game_data["remaining"] = max(1, int(game_data["remaining"] / 2.2))

    # Build chat context
    history_lines = []
    for i, t in enumerate(game_data["turns"], start=1):
        history_lines.append(f"{i}) Q: {t['q']} | A: {t['a']}")

    user_prompt = (
        "We are playing: 'Think of an object'.\n"
        "Ask the next best yes/no/maybe question to narrow down the object.\n"
        "Also output 3 best guesses with confidence percent.\n\n"
        f"Previous turns:\n{chr(10).join(history_lines) if history_lines else '(none yet)'}\n"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    try:
        raw = call_ollama(messages)
        parsed = safe_parse_json(raw)

        question = (parsed.get("question") or "").strip()
        guesses = parsed.get("guesses")

        if not isinstance(question, str) or not question:
            raise ValueError("Missing/invalid 'question' field.")

        if not (isinstance(guesses, list) and len(guesses) == 3):
            raise ValueError("Missing/invalid 'guesses' field (must be 3 items).")

        cleaned = []
        for g in guesses:
            if not isinstance(g, dict):
                raise ValueError("Each guess must be an object with {name, confidence}.")
            name = (g.get("name") or "").strip()
            conf = clamp_int(g.get("confidence", 0))
            if not name:
                raise ValueError("Guess name cannot be empty.")
            cleaned.append({"name": name, "confidence": conf})

        # sort by confidence descending just in case
        cleaned.sort(key=lambda x: x["confidence"], reverse=True)

        top_guess = cleaned[0]
        llm_conf = top_guess["confidence"]
        is_final = llm_conf >= 99

        game_data["last_question"] = question

        return jsonify({
            "question": question,
            "confidence": game_data["confidence"],   # keep your simulated bar
            "remaining": game_data["remaining"],
            "guesses": cleaned,                      # now objects with %!
            "final": is_final,                       # frontend will switch UI
            "final_guess": top_guess if is_final else None,
            "ai_used": True
        })

    except Exception as e:
        return jsonify({"error": str(e), "ai_used": False}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
