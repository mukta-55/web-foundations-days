// ===== Starting data =====
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

// ===== 1. searchNotes =====
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(search));
}

// Tests
console.log(searchNotes("JAVASCRIPT")); // [ { id: 4, text: "Revise JavaScript arrays", category: "study" } ]  (case is ignored)
console.log(searchNotes("the").length); // 2  (notes 2 and 3 both contain "the")
console.log(searchNotes("xyz")); // []  (no matches)

// ===== 2. longestNote =====
function longestNote() {
  if (notes.length === 0) return null;

  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// Tests
console.log(longestNote()); // { id: 3, text: "Email the project report to Grace", category: "work" }  (33 characters)

const savedNotes = notes;
notes = [];
console.log(longestNote()); // null  (no notes)
notes = savedNotes;

// ===== 3. countByCategory =====
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category] === undefined) {
      counts[note.category] = 0;
    }
    counts[note.category]++;
  }
  return counts;
}

// Tests
console.log(countByCategory()); // { personal: 2, study: 2, work: 1 }

notes = [];
console.log(countByCategory()); // {}  (no notes, so nothing to count)
notes = savedNotes;

// ===== 4. getSummary =====
function getSummary() {
  const total = notes.length;
  if (total === 0) return "0 notes.";

  const counts = countByCategory();
  const word = total === 1 ? "note" : "notes";

  const parts = [];
  for (const category in counts) {
    parts.push(`${counts[category]} ${category}`);
  }

  return `${total} ${word}: ${parts.join(", ")}.`;
}

// Tests
console.log(getSummary()); // "5 notes: 2 personal, 2 study, 1 work."

notes = [savedNotes[0]];
console.log(getSummary()); // "1 note: 1 personal."

notes = [];
console.log(getSummary()); // "0 notes."
notes = savedNotes;

// ===== 5. isDuplicate =====
function isDuplicate(text) {
  const cleaned = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === cleaned);
}

// Tests
console.log(isDuplicate("Buy eggs")); // false  (no such note)
console.log(isDuplicate("  BUY MILK AND BREAD  ")); // true  (same text, ignoring case and extra spaces)

notes = [];
console.log(isDuplicate("Call mum")); // false  (no notes to match)
notes = savedNotes;

// ===== 6. addNote =====
const validCategories = ["personal", "work", "study"];

function addNote(text, category) {
  const cleaned = text.trim();

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Note rejected: text must be 1-200 characters.");
    return false;
  }
  if (!validCategories.includes(category)) {
    console.log("Note rejected: category must be personal, work or study.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("Note rejected: a note with this text already exists.");
    return false;
  }

  const newNote = { id: Date.now(), text: cleaned, category: category };
  notes.push(newNote);
  console.log(`Added: "${newNote.text}" (${newNote.category})`);
  return true;
}

// Tests
console.log(addNote("Pay electricity bill", "personal")); // logs: Added: "Pay electricity bill" (personal), then true
console.log(notes.length); // 6
console.log(addNote("pay electricity bill ", "personal")); // logs the duplicate reason, then false
console.log(addNote("Plan the week", "hobby")); // logs the category reason, then false
console.log(addNote("a".repeat(201), "work")); // logs the length reason, then false
