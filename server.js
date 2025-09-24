const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const CHAR_DIR = path.join(__dirname, "src/app/pages/dnd/characters");

// simple config for now
const config = {
  roomPassword: "letmein",   // players use this
  dmPassword: "swordfish",   // only you know this
};

// Serve character images from the same folder
app.use("/characters", express.static(path.join(__dirname, "src/app/pages/dnd/characters")));


// --- helper to load a character file
function loadCharacter(name) {
  try {
    const file = path.join(CHAR_DIR, `${name.toLowerCase()}.json`);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
    return null;
  } catch (err) {
    console.error("Error loading character:", err);
    return null;
  }
}

// --- helper to save character file
function saveCharacter(name, data) {
  try {
    const file = path.join(CHAR_DIR, `${name.toLowerCase()}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving character:", err);
  }
}

io.of("/dnd").on("connection", (socket) => {
  console.log("Client connected to /dnd");

  // --- LOGIN ---
  socket.on("login", ({ name, password, roomId }) => {
    if (name === "DM" && password === config.dmPassword) {
      socket.data.role = "dm";
      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.emit("loginSuccess", { role: "dm", roomId });
      console.log(" DM logged in");
    } else if (password === config.roomPassword) {
      socket.data.role = "player";
      socket.data.name = name;
      socket.data.roomId = roomId;
      socket.join(roomId);
      socket.emit("loginSuccess", { role: "player", name, roomId });
      console.log(` Player ${name} logged in`);
    } else {
      socket.emit("loginError", { message: "Invalid name or password" });
      socket.disconnect();
    }
  });

  // --- CHARACTERS ---
  socket.on("getCharacter", (name) => {
    const data = loadCharacter(name);
    if (data) {
      socket.emit("characterData", { name, data });
    }
  });

  socket.on("getCharacterList", () => {
    const files = fs.readdirSync(CHAR_DIR).filter(f => f.endsWith(".json"));
    const list = files.map(f => {
      const name = f.replace(".json", "");
      const data = loadCharacter(name);
      return { name, data };
    });
    socket.emit("characterList", list);
  });

  socket.on("saveCharacter", ({ name, data }) => {
    saveCharacter(name, data);
    io.of("/dnd").emit("characterUpdated", { name, data });
  });

  // --- TOKENS (same as before) ---
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { tokens: [] };
    socket.emit("initState", rooms[roomId]);
  });

  socket.on("moveToken", (roomId, token) => {
    if (!rooms[roomId]) return;
    rooms[roomId].tokens = rooms[roomId].tokens.map((t) =>
      t.id === token.id ? token : t
    );
    socket.to(roomId).emit("tokenMoved", token);
  });

  socket.on("addToken", (roomId, token) => {
    if (!rooms[roomId]) rooms[roomId] = { tokens: [] };
    rooms[roomId].tokens.push(token);
    io.of("/dnd").to(roomId).emit("tokenAdded", token);
  });
});

// --- Serve Angular dist
app.use(express.static(path.join(__dirname, "dist/frontend/browser")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist/frontend/browser/index.html"));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});

// room state (moved here so it persists between handlers)
const rooms = {};
