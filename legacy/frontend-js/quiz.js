/* ====================================================
   STUDY GEN AI — QUIZ MODULE
   Handles: Quiz generation, question rendering, scoring
   ==================================================== */

// API base URL - change this when deploying
const API_BASE_URL = "http://127.0.0.1:8000";

// ====================================================
// QUIZ STATE
// ====================================================

let currentQuiz = null;

// ====================================================
// HELPER FUNCTIONS
// ====================================================

// Show an alert message
function showAlert(elementId, message, type = "error") {
    const alertEl = document.getElementById(elementId);
    if (!alertEl) return;

    alertEl.textContent = message;
    alertEl.className = `alert alert-${type} show`;
}

// Hide an alert message
function hideAlert(elementId) {
    const alertEl = document.getElementById(elementId);
    if (!alertEl) return;
    alertEl.className = "alert";
    alertEl.textContent = "";
}

// ====================================================
// RENDER QUIZ QUESTIONS
// ====================================================

function renderQuiz(questions) {
    const quizContainer = document.getElementById("quizQuestions");
    const scoreDiv = document.getElementById("quizScore");

    if (!quizContainer) return;

    // Clear previous quiz
    quizContainer.innerHTML = "";
    scoreDiv.classList.add("hidden");

    // Create question cards
    questions.forEach((question, index) => {
        const questionDiv = document.createElement("div");
        questionDiv.className = "quiz-question";

        const questionTitle = document.createElement("h3");
        questionTitle.textContent = `Question ${index + 1}: ${question.question}`;
        questionDiv.appendChild(questionTitle);

        const optionsDiv = document.createElement("div");
        optionsDiv.className = "quiz-options";

        question.options.forEach((option, optionIndex) => {
            const label = document.createElement("label");
            label.className = "quiz-option";

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = `question_${index}`;
            radio.value = optionIndex;

            const optionText = document.createElement("span");
            optionText.textContent = option;

            label.appendChild(radio);
            label.appendChild(optionText);
            optionsDiv.appendChild(label);
        });

        questionDiv.appendChild(optionsDiv);
        quizContainer.appendChild(questionDiv);
    });

    // Add check answers button
    const checkBtn = document.createElement("button");
    checkBtn.className = "btn btn-primary btn-block mt-3";
    checkBtn.id = "checkAnswersBtn";
    checkBtn.textContent = "Check Answers";
    checkBtn.addEventListener("click", checkAnswers);
    quizContainer.appendChild(checkBtn);

    // Scroll to quiz
    quizContainer.scrollIntoView({ behavior: "smooth" });
}

// ====================================================
// CHECK ANSWERS
// ====================================================

function checkAnswers() {
    if (!currentQuiz) return;

    let score = 0;
    const total = currentQuiz.length;

    currentQuiz.forEach((question, index) => {
        const selected = document.querySelector(`input[name="question_${index}"]:checked`);
        const options = document.querySelectorAll(`input[name="question_${index}"]`);

        // Highlight correct and incorrect answers
        options.forEach((option, optionIndex) => {
            const label = option.closest(".quiz-option");

            if (optionIndex === question.correctIndex) {
                label.classList.add("correct");
            } else if (option.checked && optionIndex !== question.correctIndex) {
                label.classList.add("incorrect");
            }

            // Disable all options after checking
            option.disabled = true;
        });

        // Count score
        if (selected && parseInt(selected.value) === question.correctIndex) {
            score++;
        }
    });

    // Show score
    const scoreDiv = document.getElementById("quizScore");
    const scoreText = document.getElementById("scoreText");
    const scoreMessage = document.getElementById("scoreMessage");

    scoreText.textContent = `Score: ${score} / ${total}`;

    // Score message based on performance
    const percentage = (score / total) * 100;
    if (percentage >= 80) {
        scoreMessage.textContent = "🌟 Excellent! Great job!";
    } else if (percentage >= 60) {
        scoreMessage.textContent = "👍 Good work! Keep practicing!";
    } else if (percentage >= 40) {
        scoreMessage.textContent = "📖 Not bad! Review your notes and try again.";
    } else {
        scoreMessage.textContent = "💪 Don't give up! Study the material and try again.";
    }

    scoreDiv.classList.remove("hidden");
    scoreDiv.scrollIntoView({ behavior: "smooth" });

    // Disable check button
    const checkBtn = document.getElementById("checkAnswersBtn");
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.textContent = "Answers Checked";
    }
}

// ====================================================
// GENERATE QUIZ
// ====================================================

async function generateQuiz() {
    const topicInput = document.getElementById("quizTopic");
    const countSelect = document.getElementById("quizCount");
    const generateBtn = document.getElementById("generateQuizBtn");

    const topic = topicInput.value.trim();
    const count = parseInt(countSelect.value);

    // Validate topic
    if (!topic) {
        showAlert("quizAlert", "Please enter a topic for your quiz.");
        return;
    }

    hideAlert("quizAlert");

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<span class="spinner"></span> Generating...`;

    try {
        // Attempt to call the backend quiz endpoint
        const response = await fetch(`${API_BASE_URL}/quiz/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("study_gen_token") || ""}`
            },
            body: JSON.stringify({ topic, count })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Failed to generate quiz.");
        }

        const data = await response.json();

        // Store quiz and render
        currentQuiz = data.questions || [];
        renderQuiz(currentQuiz);

    } catch (error) {
        // Backend endpoint not ready yet
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
            showAlert(
                "quizAlert",
                "⚠️ The quiz API is not connected yet. The backend /quiz/generate endpoint is still being developed. Please try again later.",
                "info"
            );
        } else {
            showAlert("quizAlert", error.message);
        }
    } finally {
        // Reset button
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Quiz";
    }
}

// ====================================================
// INITIALIZE
// ====================================================

function initQuiz() {
    const generateBtn = document.getElementById("generateQuizBtn");
    if (!generateBtn) return;

    generateBtn.addEventListener("click", generateQuiz);

    // Allow Enter key to generate quiz
    const topicInput = document.getElementById("quizTopic");
    if (topicInput) {
        topicInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                generateQuiz();
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initQuiz();
});