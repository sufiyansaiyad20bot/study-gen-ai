/* ====================================================
   STUDY GEN AI — UPLOAD MODULE
   Handles: PDF file selection, drag/drop, validation, upload
   ==================================================== */

// API base URL - change this when deploying
const API_BASE_URL = "http://127.0.0.1:8000";

// ====================================================
// UPLOAD STATE
// ====================================================

let selectedFile = null;

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

// Format file size (bytes to KB/MB)
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ====================================================
// FILE SELECTION
// ====================================================

function handleFileSelect(file) {
    const fileInput = document.getElementById("fileInput");
    const fileInfo = document.getElementById("fileInfo");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const uploadBtn = document.getElementById("uploadBtn");

    // Clear previous alerts
    hideAlert("uploadAlert");
    hideAlert("uploadSuccess");

    // Validate file exists
    if (!file) return;

    // Validate it's a PDF
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        showAlert("uploadAlert", "❌ Invalid file type. Please select a PDF file.");
        selectedFile = null;
        fileInfo.classList.add("hidden");
        uploadBtn.disabled = true;
        return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
        showAlert("uploadAlert", "❌ File is too large. Maximum size is 20MB.");
        selectedFile = null;
        fileInfo.classList.add("hidden");
        uploadBtn.disabled = true;
        return;
    }

    // Store selected file
    selectedFile = file;

    // Show file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove("hidden");

    // Enable upload button
    uploadBtn.disabled = false;

    // Reset progress
    document.getElementById("uploadProgress").classList.remove("show");
    document.getElementById("progressFill").style.width = "0%";
}

// ====================================================
// UPLOAD HANDLER
// ====================================================

async function handleUpload() {
    if (!selectedFile) return;

    const uploadBtn = document.getElementById("uploadBtn");
    const uploadProgress = document.getElementById("uploadProgress");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    // Clear previous alerts
    hideAlert("uploadAlert");
    hideAlert("uploadSuccess");

    // Show progress
    uploadProgress.classList.add("show");
    progressFill.style.width = "10%";
    progressText.textContent = "Uploading...";

    // Disable button
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";

    // Create FormData
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
        // Attempt to call the backend upload endpoint
        const response = await fetch(`${API_BASE_URL}/upload/pdf`, {
            method: "POST",
            headers: {
                // Include auth token if available
                "Authorization": `Bearer ${localStorage.getItem("study_gen_token") || ""}`
            },
            body: formData
        });

        // Simulate progress for better UX
        progressFill.style.width = "70%";

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || "Upload failed. Please try again.");
        }

        const data = await response.json();

        // Complete progress
        progressFill.style.width = "100%";
        progressText.textContent = "Upload complete!";

        // Show success message
        showAlert("uploadSuccess", "✅ PDF uploaded successfully! Your notes are being processed.", "success");

        // Reset after 3 seconds
        setTimeout(() => {
            uploadProgress.classList.remove("show");
            progressFill.style.width = "0%";
            uploadBtn.disabled = true;
            uploadBtn.textContent = "Upload PDF";
            document.getElementById("fileInfo").classList.add("hidden");
            document.getElementById("fileInput").value = "";
            selectedFile = null;
        }, 3000);

    } catch (error) {
        // Hide progress
        uploadProgress.classList.remove("show");

        // Backend endpoint not ready yet
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
            showAlert(
                "uploadAlert",
                "⚠️ The upload API is not connected yet. The backend /upload/pdf endpoint is still being developed. Please try again later.",
                "info"
            );
        } else {
            showAlert("uploadAlert", error.message);
        }

        // Re-enable button
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload PDF";
    }
}

// ====================================================
// INITIALIZE
// ====================================================

function initUpload() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const uploadBtn = document.getElementById("uploadBtn");

    if (!dropzone || !fileInput || !uploadBtn) return;

    // Click dropzone to open file picker
    dropzone.addEventListener("click", () => {
        fileInput.click();
    });

    // File selected via picker
    fileInput.addEventListener("change", (event) => {
        handleFileSelect(event.target.files[0]);
    });

    // Drag and drop support
    dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
        handleFileSelect(event.dataTransfer.files[0]);
    });

    // Upload button
    uploadBtn.addEventListener("click", handleUpload);
}

// ====================================================
// INITIALIZE
// ====================================================

document.addEventListener("DOMContentLoaded", () => {
    initUpload();
});