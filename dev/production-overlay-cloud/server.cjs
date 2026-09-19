const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 5175;
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
let currentTikTokUser = null;
const clients = new Set();
const clientSessions = new Map();
const sessions = new Map();
const loginFailures = new Map();

const SESSION_COOKIE_NAME = "overlay_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_FAILURE_WINDOW_MS = 10 * 60 * 1000;

const apiKey = process.env.EULER_API_KEY;
const accessPassword = process.env.APP_ACCESS_PASSWORD;
const overlayAccessToken = process.env.OVERLAY_ACCESS_TOKEN;

if (!apiKey) {
  console.error("EULER_API_KEY is not available.");
  process.exit(1);
}

if (!accessPassword) {
  console.error("APP_ACCESS_PASSWORD is not available.");
  process.exit(1);
}

if (!overlayAccessToken) {
  console.error("OVERLAY_ACCESS_TOKEN is not available.");
  process.exit(1);
}

function parseCookies(req) {
  const cookies = {};

  for (const part of (req.headers.cookie || "").split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (name) {
      cookies[name] = value;
    }
  }

  return cookies;
}

function createSession(now = Date.now()) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = now + SESSION_TTL_MS;

  sessions.set(token, expiresAt);

  const expiryTimer = setTimeout(() => {
    if (sessions.get(token) === expiresAt) {
      destroySession(token);
    }
  }, SESSION_TTL_MS);

  expiryTimer.unref();

  return token;
}

function destroySession(token) {
  sessions.delete(token);

  for (const [client, clientToken] of clientSessions) {
    if (clientToken === token) {
      clients.delete(client);
      clientSessions.delete(client);
      client.end();
    }
  }
}

function hasValidSession(token, now = Date.now()) {
  if (!token) {
    return false;
  }

  const expiresAt = sessions.get(token);

  if (!expiresAt) {
    return false;
  }

  if (now >= expiresAt) {
    destroySession(token);
    return false;
  }

  return true;
}

function isAuthenticated(req) {
  const token = parseCookies(req)[SESSION_COOKIE_NAME];
  return hasValidSession(token);
}

function hasValidOverlayAccessToken(candidate) {
  if (!candidate) {
    return false;
  }

  const suppliedDigest = crypto
    .createHash("sha256")
    .update(candidate, "utf8")
    .digest();

  const expectedDigest = crypto
    .createHash("sha256")
    .update(overlayAccessToken, "utf8")
    .digest();

  return crypto.timingSafeEqual(suppliedDigest, expectedDigest);
}

function loginClientKey(req) {
  return req.socket.remoteAddress || "unknown";
}

function getLoginFailureState(key, now = Date.now()) {
  const state = loginFailures.get(key);

  if (!state) {
    return null;
  }

  if (now - state.windowStartedAt >= LOGIN_FAILURE_WINDOW_MS) {
    loginFailures.delete(key);
    return null;
  }

  return state;
}

function isLoginRateLimited(key, now = Date.now()) {
  const state = getLoginFailureState(key, now);
  return Boolean(state && state.count >= LOGIN_MAX_FAILURES);
}

function recordLoginFailure(key, now = Date.now()) {
  const state = getLoginFailureState(key, now);

  if (!state) {
    loginFailures.set(key, {
      count: 1,
      windowStartedAt: now
    });
    return;
  }

  state.count += 1;
}

function clearLoginFailures(key) {
  loginFailures.delete(key);
}

function sessionCookieAttributes() {
  const secureAttribute =
    process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `Path=/; HttpOnly; SameSite=Strict${secureAttribute}`;
}

function sessionCookie(token) {
  const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${token}; ${sessionCookieAttributes()}; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; ${sessionCookieAttributes()}; Max-Age=0`;
}
function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 16_384) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (req.method === "POST" && pathname === "/api/login") {
    const clientKey = loginClientKey(req);

    if (isLoginRateLimited(clientKey)) {
      sendJson(res, 429, {
        error: "Too many failed login attempts. Try again later."
      });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const suppliedPassword =
        typeof body.password === "string" ? body.password : "";

      const suppliedDigest = crypto
        .createHash("sha256")
        .update(suppliedPassword, "utf8")
        .digest();

      const expectedDigest = crypto
        .createHash("sha256")
        .update(accessPassword, "utf8")
        .digest();

      const passwordMatches =
        crypto.timingSafeEqual(suppliedDigest, expectedDigest);

      if (!passwordMatches) {
        recordLoginFailure(clientKey);
        sendJson(res, 401, { error: "Invalid credentials." });
        return;
      }

      clearLoginFailures(clientKey);
      const token = createSession();

      res.setHeader("Set-Cookie", sessionCookie(token));
      sendJson(res, 200, { authenticated: true });
    } catch (error) {
      sendJson(res, 400, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return;
  }
  if (req.method === "POST" && pathname === "/api/logout") {
    const token = parseCookies(req)[SESSION_COOKIE_NAME];

    if (token) {
      destroySession(token);
    }

    res.setHeader("Set-Cookie", clearSessionCookie());
    sendJson(res, 200, { authenticated: false });
    return;
  }
  const requiresSessionAuthentication =
    pathname === "/api/status" ||
    pathname === "/api/connect" ||
    pathname === "/api/disconnect" ||
    pathname === "/api/overlay-url";

  if (requiresSessionAuthentication && !isAuthenticated(req)) {
    sendJson(res, 401, { error: "Authentication required." });
    return;
  }

  const overlayToken =
    new URL(req.url, `http://${req.headers.host || "localhost"}`)
      .searchParams.get("token");
  const eventSessionAuthenticated = isAuthenticated(req);
  const eventOverlayAuthenticated =
    hasValidOverlayAccessToken(overlayToken);

  if (
    pathname === "/events" &&
    !eventSessionAuthenticated &&
    !eventOverlayAuthenticated
  ) {
    sendJson(res, 401, { error: "Authentication required." });
    return;
  }
  if (req.method === "GET" && pathname === "/api/status") {
    sendJson(res, 200, getConnectionStatus());
    return;
  }

  if (req.method === "GET" && pathname === "/api/overlay-url") {
    sendJson(res, 200, {
      url: `/overlay?token=${encodeURIComponent(overlayAccessToken)}`
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/connect") {
    try {
      const body = await readJsonBody(req);

      broadcast("OverlayResetMessage", {
        reason: "connect"
      });

      const status = connectToTikTok(body.username);

      sendJson(res, 202, status);
    } catch (error) {
      sendJson(res, 400, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return;
  }

  if (req.method === "POST" && pathname === "/api/disconnect") {
    disconnectFromTikTok();

    broadcast("OverlayResetMessage", {
      reason: "disconnect"
    });

    sendJson(res, 200, getConnectionStatus());
    return;
  }

  if (pathname === "/events") {
    const sessionToken = parseCookies(req)[SESSION_COOKIE_NAME];

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    res.write(": connected\n\n");
    clients.add(res);

    if (eventSessionAuthenticated) {
      clientSessions.set(res, sessionToken);
    }

    req.on("close", () => {
      clients.delete(res);
      clientSessions.delete(res);
    });

    return;
  }

  const requestPath =
    pathname === "/"
      ? "control.html"
      : pathname === "/overlay" || pathname === "/overlay/"
        ? "overlay.html"
        : pathname === "/control" || pathname === "/control/"
          ? "control.html"
          : pathname.replace(/^\/+/, "");

  const filePath = path.resolve(ROOT, requestPath);
  const relativePath = path.relative(ROOT, filePath);
  const isOutsideRoot =
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);

  if (isOutsideRoot) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store"
    });

    res.end(data);
  });
});

function broadcast(eventName, data) {
  const payload = JSON.stringify({ eventName, data });

  for (const client of clients) {
    client.write(`data: ${payload}\n\n`);
  }
}

const RETRY_INTERVAL_MS = 30_000;
const INVALID_AUTH_CLOSE_CODE = 4401;

let ws = null;
let reconnectTimer = null;
let shuttingDown = false;
let connectionDesired = false;
let connectionStatus = "disconnected";
let connectionError = null;

function getConnectionStatus() {
  return {
    status: connectionStatus,
    username: currentTikTokUser,
    error: connectionError
  };
}

function scheduleReconnect() {
  if (shuttingDown || !connectionDesired || reconnectTimer) {
    return;
  }

  connectionStatus = "reconnecting";

  console.log(`EulerStream reconnecting in ${RETRY_INTERVAL_MS / 1000}s`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectEulerStream();
  }, RETRY_INTERVAL_MS);
}

function connectEulerStream() {
  if (
    shuttingDown ||
    !connectionDesired ||
    !currentTikTokUser ||
    ws?.readyState === WebSocket.OPEN ||
    ws?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  connectionStatus = "connecting";
  connectionError = null;

  const url = new URL("wss://ws.eulerstream.com");
  url.searchParams.set("uniqueId", currentTikTokUser);
  url.searchParams.set("apiKey", apiKey);

  let socket;

  try {
    socket = new WebSocket(url);
  } catch (error) {
    console.error(
      "EulerStream WebSocket creation failed:",
      error instanceof Error ? error.message : String(error)
    );
    scheduleReconnect();
    return;
  }

  ws = socket;

  socket.onopen = () => {
    if (ws !== socket) return;

    connectionStatus = "connected";
    connectionError = null;

    console.log(`EulerStream connected to @${currentTikTokUser}`);
  };

  socket.onmessage = (event) => {
    if (ws !== socket) return;

    try {
      const bundle = JSON.parse(event.data);

      for (const message of bundle.messages || []) {
        broadcast(message.type, message.data);

        if (message.type === "WebcastMemberMessage") {
          console.log(
            "JOIN:",
            message.data?.user?.uniqueId,
            "|",
            message.data?.user?.nickname
          );
        }

        if (message.type === "WebcastChatMessage") {
          console.log(
            "COMMENT:",
            message.data?.user?.uniqueId,
            "|",
            message.data?.user?.nickname,
            "|",
            message.data?.comment
          );
        }

        if (
          message.type === "WebcastSocialMessage" &&
          message.data?.user?.uniqueId === "giftgame.live"
        ) {
          console.log(
            "CONTROL SOCIAL PAYLOAD:",
            JSON.stringify(message.data)
          );
        }

        if (message.type === "WebcastGiftMessage") {
          console.log(
            "GIFT PAYLOAD:",
            JSON.stringify(message.data)
          );
        }

        if (message.type === "WebcastLikeMessage") {
          console.log(
            "LIKE:",
            message.data?.user?.uniqueId,
            "|",
            message.data?.user?.nickname,
            "| +",
            message.data?.likeCount,
            "| total",
            message.data?.totalLikeCount
          );
        }
      }
    } catch (error) {
      console.error("Message parse error:", error.message);
    }
  };

  socket.onerror = () => {
    if (ws !== socket) return;

    connectionError = "EulerStream WebSocket error";
    console.error(connectionError);
  };

  socket.onclose = (event) => {
    if (ws !== socket) return;

    ws = null;

    const closeReason =
      event.reason || `EulerStream connection closed (${event.code}).`;

    console.log("EulerStream closed:", event.code, event.reason);

    if (shuttingDown) {
      return;
    }

    if (!connectionDesired) {
      connectionStatus = "disconnected";
      connectionError = null;
      return;
    }

    connectionError = closeReason;

    if (event.code === INVALID_AUTH_CLOSE_CODE) {
      connectionDesired = false;
      connectionStatus = "error";
      console.error("EulerStream authentication rejected; reconnect disabled.");
      return;
    }

    scheduleReconnect();
  };
}

function disconnectFromTikTok() {
  connectionDesired = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    const socket = ws;
    ws = null;
    socket.close();
  }

  currentTikTokUser = null;
  connectionStatus = "disconnected";
  connectionError = null;
}

function connectToTikTok(username) {
  const normalizedUsername =
    typeof username === "string"
      ? username.trim().replace(/^@+/, "")
      : "";

  if (!normalizedUsername) {
    throw new Error("TikTok username is required.");
  }

  connectionDesired = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    const socket = ws;
    ws = null;
    socket.close();
  }

  currentTikTokUser = normalizedUsername;
  connectionDesired = true;
  connectionStatus = "connecting";
  connectionError = null;

  connectEulerStream();

  return getConnectionStatus();
}
function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    const socket = ws;
    ws = null;
    socket.close();
  }

  for (const client of clients) {
    client.end();
  }
  clients.clear();

  server.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(PORT, HOST, () => {
  console.log(`Overlay server listening on ${HOST}:${PORT}`);
});
