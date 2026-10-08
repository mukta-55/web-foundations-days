// ---------- 1. Select the elements ----------
const textarea = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const MAX_CHARS = 200;
const WARNING_AT = 180;

// ---------- 2. Update both counters and the warning classes ----------
function updateCounts() {
  const text = textarea.value;
  const chars = text.length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  charCount.textContent = `${chars} / ${MAX_CHARS} characters`;
  wordCount.textContent = `${words} words`;

  charCount.classList.remove("warning", "over");
  if (chars > MAX_CHARS) {
    charCount.classList.add("over");
  } else if (chars > WARNING_AT) {
    charCount.classList.add("warning");
  }
}

// ---------- 3. Keystrokes: update the counters and save the draft ----------
const DRAFT_KEY = "draft";

textarea.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(DRAFT_KEY, textarea.value);
});

// ---------- 4. On page load: restore the saved draft ----------
const savedDraft = localStorage.getItem(DRAFT_KEY);
if (savedDraft !== null) {
  textarea.value = savedDraft;
}
updateCounts();
// ---------- 5. Clear: button and Escape key ----------
function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

clearBtn.addEventListener("click", clearAll);

textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearAll();
  }
});
// ---------- 6. Theme toggle ----------
const THEME_KEY = "theme";

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }
}

themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

// On page load: restore the saved theme
applyTheme(localStorage.getItem(THEME_KEY) === "dark");
