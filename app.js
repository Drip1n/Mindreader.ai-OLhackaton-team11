// Konfigurácia pre visualizer
const flowNodes = {
    input: document.getElementById('node-input'),
    frontend: document.getElementById('node-frontend'),
    backend: document.getElementById('node-backend'),
    ai: document.getElementById('node-ai')
};

// Funkcia na animáciu toku dát (Data Flow Visualization)
function highlightNode(nodeName, duration = 300) {
    return new Promise(resolve => {
        const node = flowNodes[nodeName];
        if (node) {
            node.classList.add('active');
            setTimeout(() => {
                node.classList.remove('active');
                resolve();
            }, duration);
        } else {
            resolve();
        }
    });
}

async function visualizeFlow() {
    // Sekvencia: Input -> Frontend -> Backend -> AI
    await highlightNode('input', 200);
    await highlightNode('frontend', 200);
    document.getElementById('node-backend').classList.add('active'); // Backend svieti kým čaká na AI
}

async function sendAnswer(answerValue) {
    const questionElement = document.getElementById('question-text');
    const startBtn = document.getElementById('start-btn');
    const gameBtns = document.getElementById('game-btns');

    // 1. UI Update (Premýšľanie)
    questionElement.innerText = "Analyzing attributes...";
    questionElement.classList.add('thinking');
    
    if (startBtn) startBtn.style.display = 'none';
    if (gameBtns) {
        gameBtns.classList.remove('hidden');
        gameBtns.style.display = 'block';
    }

    // 2. Spustiť vizualizáciu toku dát
    visualizeFlow();

    try {
        // Odoslanie na Backend
        const response = await fetch('http://127.0.0.1:5000/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: answerValue })
        });

        // Backend posiela dáta do AI (simulácia vizuálu)
        document.getElementById('node-ai').classList.add('active'); 
        
        const data = await response.json();

        // 3. Update UI po prijatí odpovede
        questionElement.classList.remove('thinking');
        questionElement.innerText = data.question;

        // Vypnúť flow vizualizáciu
        document.getElementById('node-backend').classList.remove('active');
        document.getElementById('node-ai').classList.remove('active');
        await highlightNode('frontend', 200); // Dáta sa vrátili do frontendu

        // Update štatistík
        updateDashboard(data);

    } catch (error) {
        console.error(error);
        questionElement.innerText = "Error: Check connection to Python/Ollama.";
        questionElement.classList.remove('thinking');
    }
}

function updateDashboard(data) {
    // Confidence Bar
    const confBar = document.getElementById('conf-bar');
    const confText = document.getElementById('conf-text');
    if (confBar) confBar.style.width = data.confidence + "%";
    if (confText) confText.innerText = data.confidence + "%";

    // Elimination Pool
    const poolCount = document.getElementById('pool-count');
    if (poolCount) poolCount.innerText = data.remaining.toLocaleString();

    // Predictions List
    const list = document.getElementById('guess-list');
    if (list) {
        list.innerHTML = "";
        data.guesses.forEach(g => {
            let li = document.createElement('li');
            li.innerHTML = `<span>🔭</span> ${g}`;
            list.appendChild(li);
        });
    }
}

function startGame() {
    sendAnswer("start");
}