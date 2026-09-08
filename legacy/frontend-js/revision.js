/* ====================================================
   STUDY GEN AI — REVISION NOTES MODULE
   Handles: Revision notes generation and rendering
   ==================================================== */

// API base URL - change this when deploying
const API_BASE_URL = "http://127.0.0.1:8000";

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
// RENDER REVISION NOTES
// ====================================================

function renderRevisionNotes(notes) {
    const notesContainer = document.getElementById("revisionNotes");
    if (!notesContainer) return;

    // Clear previous notes
    notesContainer.innerHTML = "";

    // Summary section
    if (notes.summary) {
        const summarySection = document.createElement("div");
        summarySection.className = "revision-section";

        const summaryTitle = document.createElement("h2");
        summaryTitle.innerHTML = `<span class="section-icon">📋</span> Summary`;
        summarySection.appendChild(summaryTitle);

        const summaryText = document.createElement("p");
        summaryText.textContent = notes.summary;
        summarySection.appendChild(summaryText);

        notesContainer.appendChild(summarySection);
    }

    // Important Points section
    if (notes.important_points && notes.important_points.length > 0) {
        const pointsSection = document.createElement("div");
        pointsSection.className = "revision-section";

        const pointsTitle = document.createElement("h2");
        pointsTitle.innerHTML = `<span class="section-icon">⭐</span> Important Points`;
        pointsSection.appendChild(pointsTitle);

        const pointsList = document.createElement("ul");
        notes.important_points.forEach(point => {
            const li = document.createElement("li");
            li.textContent = point;
            pointsList.appendChild(li);
        });
        pointsSection.appendChild(pointsList);

        notesContainer.appendChild(pointsSection);
    }

    // Key Concepts section
    if (notes.key_concepts && notes.key_concepts.length > 0) {
        const conceptsSection = document.createElement("div");
        conceptsSection.className = "revision-section";

        const conceptsTitle = document.createElement("h2");
        conceptsTitle.innerHTML = `<span class="section-icon">🧠</span> Key Concepts`;
        conceptsSection.appendChild(conceptsTitle);

        const conceptsList = document.createElement("ul");
        notes.key_concepts.forEach(concept => {
            const li = document.createElement("li");
            li.textContent = concept;
            conceptsList.appendChild(li);
        });
        conceptsSection.appendChild(conceptsList);

        notesContainer.appendChild(conceptsSection);
    }

    // Exam Questions section
    if (notes.exam_questions && notes.exam_questions.length > 0) {
        const examSection = document.createElement("div");
        examSection.className = "revision-section";

        const examTitle = document.createElement("h2");
        examTitle.innerHTML = `<span class="section-icon">📝</span> Exam Questions`;
        examSection.appendChild(examTitle);

        const examList = document.createElement("ul");
        notes.exam_questions.forEach(question => {
            const li = document.createElement("li");
            li.textContent = question;
            examList.appendChild(li);
        });
        examSection.appendChild(examList);

        notesContainer.appendChild(examSection);
    }

    // Scroll to notes
    notesContainer.scrollIntoView({ behavior: "smooth" });
}

// ====================================================
// GENERATE REVISION NOTES
// ====================================================

async function generateRevisionNotes() {
    const topicInput = document.getElementById("revisionTopic");
    const generateBtn = document.getElementById("generateRevisionBtn");

    const topic = topicInput.value.trim();

    // Validate topic
    if (!topic) {
        showAlert("revisionAlert", "Please enter a topic for your revision notes.");
        return;
    }

    hideAlert("revisionAlert");

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<span class="spinner"></span> Generating...`;

    try {
        // Attempt to call the backend revision endpoint
        const response = await fetch(`${API_BASE_URL}/revision/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("study_gen_token") || ""}`
            },
            body: JSON.stringify({ topic })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Failed to generate revision notes.");
        }

        const data = await response.json();

        // Render the revision notes
        renderRevisionNotes(data);

    } catch (error) {
        // Backend endpoint not ready yet
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
            showAlert(
                "revisionAlert",
                "⚠️ The revision notes API is not connected yet. The backend /revision/generate endpoint is still being developed. Please try again later.",
                "info"
            );
        } else {
            showAlert("revisionAlert", error.message);
        }
    } finally {
        // Reset button
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Revision Notes";
    }
}

// ====================================================
// INITIALIZE
// ====================================================

function initRevision() {
    const generateBtn = document.getElementById("generateRevisionBtn");
    if (!generateBtn) return;

    generateBtn.addEventListener("click", generateRevisionNotes);

    // Allow Enter key to generate notes
    const topicInput = document.getElementById("revisionTopic");
    if (topicInput) {
        topicInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                generateRevisionNotes();
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initRevision();
});