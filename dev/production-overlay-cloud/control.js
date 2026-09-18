const loginView = document.getElementById("loginView");
const controlView = document.getElementById("controlView");
const loginForm = document.getElementById("loginForm");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");
const logoutButton = document.getElementById("logoutButton");

const form = document.getElementById("connectForm");
const usernameInput = document.getElementById("username");
const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const roomText = document.getElementById("roomText");
const errorText = document.getElementById("errorText");

let statusPollingId = null;

function showLogin() {
  loginView.hidden = false;
  controlView.hidden = true;

  if (statusPollingId !== null) {
    clearInterval(statusPollingId);
    statusPollingId = null;
  }

  passwordInput.value = "";
  passwordInput.focus();
}

function showControl() {
  loginView.hidden = true;
  controlView.hidden = false;
}

function renderStatus(status) {
  const state = status.status || "disconnected";

  statusIndicator.className = `status-indicator ${state}`;
  statusText.textContent = state;
  roomText.textContent = status.username
    ? `Room: @${status.username}`
    : "No room selected";

  errorText.textContent = status.error || "";

  const busy = state === "connecting" || state === "reconnecting";

  connectButton.disabled = busy;
  disconnectButton.disabled = state === "disconnected";

  if (status.username && document.activeElement !== usernameInput) {
    usernameInput.value = `@${status.username}`;
  }
}

async function getStatus() {
  try {
    const response = await fetch("/api/status", {
      cache: "no-store"
    });

    if (response.status === 401) {
      showLogin();
      return false;
    }

    if (!response.ok) {
      throw new Error(`Status request failed (${response.status}).`);
    }

    renderStatus(await response.json());
    return true;
  } catch (error) {
    errorText.textContent =
      error instanceof Error ? error.message : String(error);
    return false;
  }
}

function startStatusPolling() {
  if (statusPollingId !== null) {
    return;
  }

  statusPollingId = setInterval(getStatus, 1000);
}

async function enterControlRoom() {
  const authenticated = await getStatus();

  if (!authenticated) {
    return;
  }

  showControl();
  startStatusPolling();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginError.textContent = "";
  loginButton.disabled = true;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: passwordInput.value
      })
    });

    const result = await response.json();

    if (!response.ok || !result.authenticated) {
      throw new Error(result.error || "Unable to sign in.");
    }

    passwordInput.value = "";
    await enterControlRoom();
  } catch (error) {
    loginError.textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  errorText.textContent = "";

  try {
    const response = await fetch("/api/logout", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`Logout request failed (${response.status}).`);
    }

    showLogin();
  } catch (error) {
    errorText.textContent =
      error instanceof Error ? error.message : String(error);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorText.textContent = "";

  try {
    const response = await fetch("/api/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: usernameInput.value
      })
    });

    if (response.status === 401) {
      showLogin();
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to connect.");
    }

    renderStatus(result);
  } catch (error) {
    errorText.textContent =
      error instanceof Error ? error.message : String(error);
  }
});

disconnectButton.addEventListener("click", async () => {
  errorText.textContent = "";

  try {
    const response = await fetch("/api/disconnect", {
      method: "POST"
    });

    if (response.status === 401) {
      showLogin();
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to disconnect.");
    }

    renderStatus(result);
  } catch (error) {
    errorText.textContent =
      error instanceof Error ? error.message : String(error);
  }
});

enterControlRoom();