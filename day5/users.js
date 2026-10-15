const loadButton = document.querySelector("#load-users");
const statusText = document.querySelector("#status");
const usersList = document.querySelector("#users-list");
const filterInput = document.querySelector("#filter-input");

let users = [];

function renderUsers(list) {
  usersList.textContent = "";

  list.forEach(function (user) {
    const li = document.createElement("li");
    li.textContent =
      user.name +
      " | " +
      user.email +
      " | " +
      user.address.city +
      " | " +
      user.company.name;
    usersList.appendChild(li);
  });
}

async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadButton.disabled = true;
  usersList.textContent = "";

  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");

    if (!response.ok) {
      throw new Error("Status " + response.status);
    }

    users = await response.json();
    renderUsers(users);
    statusText.textContent = "Loaded " + users.length + " users.";
  } catch (error) {
    statusText.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadButton.disabled = false;
  }
}
function filterUsers() {
  const text = filterInput.value.toLowerCase();

  const matches = users.filter(function (user) {
    return user.name.toLowerCase().includes(text);
  });

  if (matches.length === 0) {
    usersList.textContent = "";
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    usersList.appendChild(li);
  } else {
    renderUsers(matches);
  }
}

loadButton.addEventListener("click", loadUsers);
filterInput.addEventListener("input", filterUsers);
