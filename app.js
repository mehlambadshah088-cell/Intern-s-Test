/* =========================================================
   TaskFlow — app.js   (Login & Auth logic)
   ========================================================= */

"use strict";

// ---- Simulated "database" of users ----
const USERS = [
  { email: "admin@taskflow.io", password: "admin123", role: "admin", name: "Admin User" },
  { email: "dev@taskflow.io",   password: "dev12345", role: "member", name: "Dev Tester" },
];

// ---- Utility: show toast ----
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ---- Utility: validate email format ----
function isValidEmail(email) {
  // Basic regex — intentionally simple for demo
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---- Login handler ----

// [BUG-E3] Typo in event name: "submitt" instead of "submit".
// The form never fires the login logic. The form will do a native
// page reload instead (default browser behavior), and since the
// action attribute is missing it just refreshes the page.
document.getElementById("loginForm").addEventListener("submitt", function (e) {
  e.preventDefault();

  const emailInput    = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const emailError    = document.getElementById("emailError");
  const passwordError = document.getElementById("passwordError");

  let valid = true;

  // Reset errors
  emailError.classList.remove("visible");
  passwordError.classList.remove("visible");

  if (!isValidEmail(emailInput.value.trim())) {
    emailError.classList.add("visible");
    valid = false;
  }

  if (passwordInput.value.length < 8) {
    passwordError.classList.add("visible");
    valid = false;
  }

  if (!valid) return;

  // [BUG-M1] Loose equality (==) used to compare email and password.
  // In normal cases this works, but it allows type coercion exploits.
  // E.g., if a value resolves to NaN, (NaN == NaN) is false — but more
  // importantly this is a bad practice / security anti-pattern. The correct
  // approach is strict equality (===) or better: a proper server-side check.
  const user = USERS.find(
    (u) => u.email == emailInput.value.trim() && u.password == passwordInput.value
  );

  if (!user) {
    showToast("Invalid email or password.", "error");
    return;
  }

  // [BUG-M2] Storing the raw password in localStorage is a serious
  // security vulnerability. Anyone with access to the browser
  // (DevTools, XSS attack, shared computer) can read it trivially.
  // The correct approach: store a short-lived auth token/JWT, never the password.
  localStorage.setItem("tf_user",  JSON.stringify({ name: user.name, role: user.role }));
  localStorage.setItem("tf_pass",  user.password);   // <-- BUG M2 is right here

  showToast(`Welcome back, ${user.name}!`, "success");

  // Redirect to dashboard after a short delay
  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1000);
});

// ---- Auth guard: redirect to dashboard if already logged in ----
(function checkAlreadyLoggedIn() {
  const user = localStorage.getItem("tf_user");
  if (user) {
    // Small UX detail — if already signed in, send to dashboard
    // (disabled for demo clarity)
    // window.location.href = "dashboard.html";
  }
})();

// [BUG-E3 also] Leftover debug log — should never appear in production code.
console.log("DEBUG: USERS array =", USERS);
