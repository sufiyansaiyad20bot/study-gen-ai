/* ====================================================
   STUDY GEN AI — CHAT MODULE
   Handles: AI chat messages, typing indicator, API calls
   ==================================================== */

// API base URL - change this when deploying
const API_BASE_URL = "http://127.0.0.1:8000";

// ====================================================
// CHAT HELPERS
// ====================================================

// Get current time in HH:MM format
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Add a message to the chat
function addMessage(text, sender) {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${sender}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = sender === "ai" ? "🤖" : "👤";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = text;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = getCurrentTime();

    bubble.appendChild(time);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;

    const typingDiv = document.createElement("div");
    typingDiv.className = "chat-message ai";
    typingDiv.id = "typingIndicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "🤖";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";

    bubble.appendChild(indicator);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(bubble);
    chatMessages.appendChild(typingDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById("typingIndicator");
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// ====================================================
// CHAT INITIALIZATION
// ====================================================

function initChat() {
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    const welcomeTime = document.getElementById("welcomeTime");

    if (!chatInput || !sendBtn) return;

    // Set welcome message time
    if (welcomeTime) {
        welcomeTime.textContent = getCurrentTime();
    }

    // Auto-resize textarea
    chatInput.addEventListener("input", () => {
        chatInput.style.height = "auto";
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
    });

    // Send message on Enter (Shift+Enter for new line)
    chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // Send message on button click
    sendBtn.addEventListener("click", sendMessage);
}

// ====================================================
// SEND MESSAGE
// ====================================================

async function sendMessage() {
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");

    const message = chatInput.value.trim();
    if (!message) return;

    // Add student message to chat
    addMessage(message, "student");

    // Clear input and reset height
    chatInput.value = "";
    chatInput.style.height = "auto";

    // Disable send button while waiting
    sendBtn.disabled = true;
    sendBtn.textContent = "...";

    // Show typing indicator
    showTypingIndicator();

    try {
        // Attempt to call the backend chat endpoint
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Include auth token if available
                "Authorization": `Bearer ${localStorage.getItem("study_gen_token") || ""}`
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Failed to get AI response.");
        }

        const data = await response.json();

        // Remove typing indicator and add AI response
        removeTypingIndicator();
        addMessage(data.response || "I received your question but couldn't generate a response.", "ai");

    } catch (error) {
        // Remove typing indicator
        removeTypingIndicator();

        // Backend endpoint not ready yet
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
            addMessage(
                "⚠️ The AI chat service is not connected yet. The backend /chat endpoint is still being developed. Please try again later.",
                "ai"
            );
        } else {
            addMessage(`⚠️ ${error.message}`, "ai");
        }
    } finally {
        // Re-enable send button
        sendBtn.disabled = false;
        sendBtn.textContent = "Send";
        chatInput.focus();
    }
}

// ====================================================
// INITIALIZE
// ====================================================

document.addEventListener("DOMContentLoaded", () => {
    initChat();
});