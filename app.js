const flowNodes = {
  input: document.getElementById("node-input"),
  frontend: document.getElementById("node-frontend"),
  backend: document.getElementById("node-backend"),
  ai: document.getElementById("node-ai"),
};

function setInputWaiting(isWaiting) {
  const node = flowNodes.input;
  if (!node) return;
  if (isWaiting) node.classList.add("active");
  else node.classList.remove("active");
}

function setBackendWaiting(isWaiting) {
  const node = flowNodes.backend;
  if (!node) return;
  if (isWaiting) node.classList.add("active");
  else node.classList.remove("active");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flashNode(nodeName, duration = 200) {
  const node = flowNodes[nodeName];
  if (!node) return;
  node.classList.add("active");
  await sleep(duration);
  node.classList.remove("active");
}

function showFinalPanel(finalGuess) {
  const panel = document.getElementById("final-panel");
  const guessText = document.getElementById("final-guess-text");
  const guessConf = document.getElementById("final-guess-confidence");

  if (!panel || !guessText || !guessConf) return;

  panel.classList.remove("hidden");
  guessText.innerText = `I think it is: ${finalGuess?.name || "Unknown"}`;
  guessConf.innerText = `${finalGuess?.confidence ?? 99}%`;
}

function hideFinalPanel() {
  const panel = document.getElementById("final-panel");
  if (panel) panel.classList.add("hidden");
}

async function sendAnswer(answerValue) {
  const questionElement = document.getElementById("question-text");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const gameBtns = document.getElementById("game-btns");

  // user clicked -> stop waiting glow
  setInputWaiting(false);

  // thinking UI
  questionElement.innerText = "Analyzing attributes...";
  questionElement.classList.add("thinking");

  // show controls
  if (startBtn) startBtn.style.display = "none";
  if (restartBtn) {
    restartBtn.classList.remove("hidden");
    restartBtn.style.display = "inline-block";
  }
  if (gameBtns) {
    gameBtns.classList.remove("hidden");
    gameBtns.style.display = "block";
  }

  // flow
  await flashNode("frontend", 180);
  setBackendWaiting(true);

  try {
    const response = await fetch("http://127.0.0.1:5000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answerValue }),
    });

    const data = await response.json().catch(() => ({}));

    questionElement.classList.remove("thinking");

    if (!response.ok) {
      questionElement.innerText = data.error || "Backend error.";
      setBackendWaiting(false);
      setInputWaiting(true);
      return;
    }

    // backend done
    setBackendWaiting(false);

    // AI lights only if backend says AI used
    if (data.ai_used) {
      const aiNode = flowNodes.ai;
      if (aiNode) {
        aiNode.classList.add("active");
        await sleep(1000); // keep AI lit >= 1s
        aiNode.classList.remove("active");
      }
    }

    // update UI question / final state
    if (data.final && data.final_guess) {
      // show final guess panel + set big text
      showFinalPanel(data.final_guess);
      questionElement.innerText = "The AI is confident. Final guess ready.";
    } else {
      hideFinalPanel();
      questionElement.innerText = data.question || "No question returned.";
    }

    // Data returned to frontend
    await flashNode("frontend", 200);

    updateDashboard(data);

    // waiting for next click
    setInputWaiting(true);
  } catch (err) {
    console.error(err);
    questionElement.innerText = "Error: Check connection to Python/Ollama.";
    questionElement.classList.remove("thinking");
    setBackendWaiting(false);
    setInputWaiting(true);
  }
}

function updateDashboard(data) {
  // confidence bar still uses your simulated backend number
  const confBar = document.getElementById("conf-bar");
  const confText = document.getElementById("conf-text");
  const conf = Math.max(0, Math.min(100, Number(data.confidence || 0)));

  if (confBar) confBar.style.width = conf + "%";
  if (confText) confText.innerText = conf + "%";

  // remaining pool
  const poolCount = document.getElementById("pool-count");
  if (poolCount) {
    const remaining = typeof data.remaining === "number" ? data.remaining : null;
    poolCount.innerText = remaining !== null ? remaining.toLocaleString() : "Unknown";
  }

  // guesses list with probability
  const list = document.getElementById("guess-list");
  if (list) {
    list.innerHTML = "";

    const guesses = Array.isArray(data.guesses) ? data.guesses : [];

    if (guesses.length === 0) {
      const li = document.createElement("li");
      li.className = "placeholder";
      li.innerText = "Waiting for data...";
      list.appendChild(li);
      return;
    }

    guesses.forEach((g) => {
      const name = typeof g === "string" ? g : (g?.name || "Unknown");
      const pct = typeof g === "object" && g !== null ? (g.confidence ?? null) : null;

      const li = document.createElement("li");
      li.innerHTML = `
        <span>🔭</span>
        <span style="flex:1">${name}</span>
        <span style="color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
          ${pct !== null ? pct + "%" : ""}
        </span>
      `;
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = "10px";
      list.appendChild(li);
    });
  }
}

function startGame() {
  hideFinalPanel();
  sendAnswer("start");
}

function restartGame() {
  // reset UI quickly
  const confBar = document.getElementById("conf-bar");
  const confText = document.getElementById("conf-text");
  const poolCount = document.getElementById("pool-count");
  const list = document.getElementById("guess-list");
  const q = document.getElementById("question-text");

  if (confBar) confBar.style.width = "0%";
  if (confText) confText.innerText = "0%";
  if (poolCount) poolCount.innerText = "Unknown";
  if (list) list.innerHTML = `<li class="placeholder">Waiting for data...</li>`;
  if (q) q.innerText = "Resetting game...";
  hideFinalPanel();

  sendAnswer("start");
}

window.addEventListener("load", () => {
  setInputWaiting(true);
});
