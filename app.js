// Function to send answers to our Python backend
async function sendAnswer(answerValue) {
    const questionElement = document.getElementById('question-text');
    const startBtn = document.getElementById('start-btn');
    const gameBtns = document.getElementById('game-btns');

    // UI Feedback: Show thinking state [cite: 17]
    questionElement.innerText = "Analyzing logic patterns...";
    if(startBtn) startBtn.style.display = 'none';
    gameBtns.style.display = 'block';

    try {
        const response = await fetch('http://127.0.0.1:5000/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: answerValue })
        });

        const data = await response.json();

        // Update the Main Experience [cite: 14, 15]
        questionElement.innerText = data.question;

        // Update the Educational Panel (AI Reasoning) [cite: 17, 24]
        document.getElementById('conf-bar').style.width = data.confidence + "%";
        document.getElementById('conf-text').innerText = data.confidence + "%";
        document.getElementById('pool-count').innerText = data.remaining.toLocaleString();

        const list = document.getElementById('guess-list');
        list.innerHTML = "";
        data.guesses.forEach(g => {
            let li = document.createElement('li');
            li.innerText = "🎯 " + g;
            list.appendChild(li);
        });

    } catch (error) {
        questionElement.innerText = "Error: Is the Python server running?";
        console.error(error);
    }
}

// Initial trigger
function startGame() {
    sendAnswer("start");
}