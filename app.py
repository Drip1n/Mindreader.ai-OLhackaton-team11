import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Allows your frontend to talk to this backend

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Shared game state (in a real app, use sessions)
game_data = {
    "history": [],
    "confidence": 10,
    "remaining": 2000
}

@app.route('/ask', methods=['POST'])
def ask_ai():
    user_data = request.json
    answer = user_data.get('answer')

    if answer != "start":
        game_data["history"].append(answer)
        # Educational objective: simulate logic narrowing down possibilities [cite: 5, 27]
        game_data["confidence"] = min(99, game_data["confidence"] + 12)
        game_data["remaining"] = max(1, int(game_data["remaining"] / 2.2))

    # Prompt for AI logic [cite: 34]
    prompt = f"We are playing a 'Think of an object' game. History of answers: {game_data['history']}. " \
             "Give me the next Yes/No question to identify the object. " \
             "Also provide 3 current best guesses. Format as JSON: {question, guesses}"

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "system", "content": "You are a logic engine for a guessing game. Return JSON only."},
                      {"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }
        )
        
        import json
        ai_res = json.loads(response.choices[0].message.content)

        return jsonify({
            "question": ai_res['question'],
            "confidence": game_data["confidence"],
            "remaining": game_data["remaining"],
            "guesses": ai_res['guesses']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)