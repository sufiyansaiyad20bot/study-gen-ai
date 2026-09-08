/* ====================================================
   STUDY GEN AI — AUTHENTICATION MODULE
   Handles: Login, Register, Logout, Auth State
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

// Show loading state on a button
function setButtonLoading(button, isLoading, loadingText = "Please wait...") {
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ====================================================
// LOGIN HANDLER
// ====================================================

function initLogin() {
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Get form values
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const loginBtn = document.getElementById("loginBtn");

        // Clear previous errors
        hideAlert("loginAlert");
        document.getElementById("emailError").textContent = "";
        document.getElementById("passwordError").textContent = "";

        // Validate inputs
        let hasError = false;

        if (!email) {
            document.getElementById("emailError").textContent = "Email is required.";
            hasError = true;
        } else if (!isValidEmail(email)) {
            document.getElementById("emailError").textContent = "Please enter a valid email address.";
            hasError = true;
        }

        if (!password) {
            document.getElementById("passwordError").textContent = "Password is required.";
            hasError = true;
        }

        if (hasError) return;

        // Show loading state
        setButtonLoading(loginBtn, true, "Logging in...");

        try {
            // Attempt to call the backend login endpoint
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Login failed. Please check your credentials.");
            }

            const data = await response.json();

            // Store the JWT token (backend will return this when ready)
            if (data.access_token) {
                localStorage.setItem("study_gen_token", data.access_token);
                localStorage.setItem("study_gen_user", JSON.stringify(data.user || {}));
            }

            // Redirect to dashboard
            window.location.href = "dashboard.html";

        } catch (error) {
            // Backend endpoint not ready yet
            if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
                showAlert(
                    "loginAlert",
                    "⚠️ Login API is not connected yet. The backend /auth/login endpoint is still being developed. Please try again later.",
                    "info"
                );
            } else {
                showAlert("loginAlert", error.message);
            }
            setButtonLoading(loginBtn, false);
        }
    });
}

// ====================================================
// REGISTER HANDLER
// ====================================================

function initRegister() {
    const registerForm = document.getElementById("registerForm");
    if (!registerForm) return;

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Get form values
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const branch = document.getElementById("branch").value;
        const semester = document.getElementById("semester").value;
        const registerBtn = document.getElementById("registerBtn");

        // Clear previous errors
        hideAlert("registerAlert");
        document.getElementById("nameError").textContent = "";
        document.getElementById("emailError").textContent = "";
        document.getElementById("passwordError").textContent = "";
        document.getElementById("branchError").textContent = "";
        document.getElementById("semesterError").textContent = "";

        // Validate inputs
        let hasError = false;

        if (!name) {
            document.getElementById("nameError").textContent = "Full name is required.";
            hasError = true;
        }

        if (!email) {
            document.getElementById("emailError").textContent = "Email is required.";
            hasError = true;
        } else if (!isValidEmail(email)) {
            document.getElementById("emailError").textContent = "Please enter a valid email address.";
            hasError = true;
        }

        if (!password) {
            document.getElementById("passwordError").textContent = "Password is required.";
            hasError = true;
        } else if (password.length < 6) {
            document.getElementById("passwordError").textContent = "Password must be at least 6 characters.";
            hasError = true;
        }

        if (!branch) {
            document.getElementById("branchError").textContent = "Please select your branch.";
            hasError = true;
        }

        if (!semester) {
            document.getElementById("semesterError").textContent = "Please select your semester.";
            hasError = true;
        }

        if (hasError) return;

        // Show loading state
        setButtonLoading(registerBtn, true, "Creating account...");

        try {
            // Attempt to call the backend register endpoint
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    branch,
                    semester: parseInt(semester)
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Registration failed. Please try again.");
            }

            // Registration successful
            showAlert("registerAlert", "✅ Registration successful! Redirecting to login...", "success");

            // Redirect to login after a short delay
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);

        } catch (error) {
            // Backend endpoint not ready yet
            if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
                showAlert(
                    "registerAlert",
                    "⚠️ Registration API is not connected yet. The backend /auth/register endpoint is still being developed. Please try again later.",
                    "info"
                );
            } else {
                showAlert("registerAlert", error.message);
            }
            setButtonLoading(registerBtn, false);
        }
    });
}

// ====================================================
// LOGOUT HANDLER
// ====================================================

function initLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();

        // Clear authentication data
        localStorage.removeItem("study_gen_token");
        localStorage.removeItem("study_gen_user");

        // Redirect to login page
        window.location.href = "login.html";
    });
}

// ====================================================
// AUTH STATE CHECK
// ====================================================

function checkAuth() {
    // If we're on a protected page and no token exists, redirect to login
    const protectedPages = ["dashboard.html", "upload.html", "chatbot.html", "quiz.html", "revision.html"];
    const currentPage = window.location.pathname.split("/").pop();

    if (protectedPages.includes(currentPage)) {
        const token = localStorage.getItem("study_gen_token");
        if (!token) {
            // Don't redirect yet - backend auth isn't ready
            // This will be enabled when JWT authentication is implemented
            console.log("Auth check: No token found. Backend auth not ready yet.");
        }
    }
}

// ====================================================
// INITIALIZE
// ====================================================

document.addEventListener("DOMContentLoaded", () => {
    initLogin();
    initRegister();
    initLogout();
    checkAuth();
});