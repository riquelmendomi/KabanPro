const express = require("express");
const path = require("path");
const { engine } = require("express-handlebars");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

const session = require("express-session");

app.use(
  session({
    secret: "kanbanpro-secret",
    resave: false,
    saveUninitialized: false,
  })
);

// ===== Social login (SIMULADO) =====
app.get("/auth/:provider", (req, res) => {
  const { provider } = req.params;

  // solo permitimos estos providers (evita urls raras)
  const allowed = ["google", "apple", "microsoft"];
  if (!allowed.includes(provider)) return res.status(404).send("Provider no válido");

  // simula usuario logueado
  req.session.user = {
    name: `Usuario ${provider}`,
    email: `demo@${provider}.com`,
    provider
  };

  return res.redirect("/dashboard");
});

/* ================= HANDLEBARS ================= */
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "layout",
    layoutsDir: path.join(__dirname, "views/layouts"),
  })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

/* ================= MIDDLEWARE ================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ================= DATA ================= */
const DATA_FILE = path.join(__dirname, "data.json");

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { boards: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

/* ================= HOME ================= */
app.get("/", (req, res) => res.render("home", { title: "Inicio" }));

/* ================= EMPEZAR ================= */
app.get("/empezar", (req, res) => {
  res.render("empezar", { title: "Empezar" });
});

/* ================= EMPEZAR (POST) ================= */
app.post("/empezar", (req, res) => {
  res.redirect("/dashboard");
});

/* ================= LOGIN (stub) ================= */
app.get("/login", (req, res) => {
  res.render("login", { title: "Login" });
});

/* ================= LOGIN EMAIL (PASO 1) ================= */
app.post("/login-email", (req, res) => {
  const { email } = req.body;
  if (!email) return res.render("login", { title: "Login", error: "Ingresa un correo válido" });

  const FIXED_CODE = "808080";

  res.render("login", {
    title: "Login",
    email,
    showCode: true,
    expectedCode: FIXED_CODE
  });
});

/* ================= LOGIN CODE (PASO 2) ================= */
app.post("/login-code", (req, res) => {
  const { email, code } = req.body;

  const FIXED_CODE = "808080";

  if (!email) return res.redirect("/login");

  if (String(code || "").trim() !== FIXED_CODE) {
    return res.render("login", {
      title: "Login",
      email,
      showCode: true,
      expectedCode: FIXED_CODE,
      error: "Código incorrecto. Revisa e inténtalo de nuevo."
    });
  }

  req.session.user = { email };
res.redirect("/dashboard");
});

/* ================= LOGOUT ================= */
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/* ================= DASHBOARD ================= */
app.get("/dashboard", (req, res) => {
  const data = readData();

  if (!data.boards.length) {
    return res.render("dashboard", { title: "Dashboard", board: null });
  }

  const boardId = req.query.boardId;
  const board = boardId
    ? data.boards.find((b) => b.id === boardId)
    : data.boards[0];

  const safeBoard = board || data.boards[0];

  const columns = safeBoard.categories.map((cat) => ({
    ...cat,
    tasks: safeBoard.tasks.filter((t) => t.categoryId === cat.id),
  }));

  res.render("dashboard", {
    title: "Dashboard",
    board: safeBoard,
    columns,
    boards: data.boards,
    activeBoardId: safeBoard.id,
    user: req.session.user,
    layout: "layoutdashboard",
  });
});
/* ================= NUEVA COLUMNA ================= */
app.post("/nueva-categoria", (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  board.categories.push({
    id: uuidv4(),
    name,
  });

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= CREAR TABLERO ================= */
app.post("/nuevo-tablero", (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect("/dashboard");

  const data = readData();

  const newBoard = {
    id: uuidv4(),
    name,
    categories: [
      { id: uuidv4(), name: "Por hacer" },
      { id: uuidv4(), name: "En progreso" },
      { id: uuidv4(), name: "Hecho" },
    ],
    tasks: [],
  };

  data.boards.push(newBoard);
  writeData(data);

  res.redirect(`/dashboard?boardId=${newBoard.id}`);
});

/* ================= NUEVA TAREA ================= */
app.post("/nueva-tarea", (req, res) => {
  const { categoryId, title, description, dueDate, status } = req.body;

  if (!categoryId || !title) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  board.tasks.push({
    id: uuidv4(),
    categoryId,
    title,
    description: description || "",
    dueDate: dueDate || "",
    status: status || "todo",
    createdAt: new Date().toISOString().split("T")[0],
  });

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= RENOMBRAR CATEGORIA ================= */
app.post("/renombrar-categoria", (req, res) => {
  const { categoryId, name } = req.body;
  if (!categoryId || !name) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  const cat = board.categories.find((c) => c.id === categoryId);
  if (cat) cat.name = name;

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= ELIMINAR CATEGORIA ================= */
app.post("/eliminar-categoria", (req, res) => {
  const { categoryId } = req.body;
  if (!categoryId) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  board.categories = board.categories.filter((c) => c.id !== categoryId);
  board.tasks = board.tasks.filter((t) => t.categoryId !== categoryId);

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= CAMBIAR ESTADO ================= */
app.post("/cambiar-estado", (req, res) => {
  const { taskId, status } = req.body;
  if (!taskId || !status) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  const task = board.tasks.find((t) => t.id === taskId);
  if (task) task.status = status;

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= EDITAR TAREA ================= */
app.post("/editar-tarea", (req, res) => {
  const { taskId, title, description, dueDate } = req.body;
  if (!taskId) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  const task = board.tasks.find((t) => t.id === taskId);

  if (task) {
    if (typeof title !== "undefined") task.title = title;
    task.description = description || "";
    task.dueDate = dueDate || "";
  }

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= ELIMINAR TAREA ================= */
app.post("/eliminar-tarea", (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.redirect("/dashboard");

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.redirect("/dashboard");

  board.tasks = board.tasks.filter((t) => t.id !== taskId);

  writeData(data);
  res.redirect("/dashboard");
});

/* ================= MOVER / ORDENAR TAREA (Drag & Drop) ================= */
app.post("/orden-tareas", (req, res) => {
  const { taskId, categoryId, position } = req.body;

  const data = readData();
  const board = data.boards[0];
  if (!board) return res.sendStatus(404);

  const task = board.tasks.find((t) => t.id === taskId);
  if (!task) return res.sendStatus(404);

  task.categoryId = categoryId;

  const pos = Number(position);
  board.tasks = board.tasks.filter((t) => t.id !== taskId);
  const safePos = Number.isFinite(pos) && pos >= 0 ? pos : board.tasks.length;
  board.tasks.splice(safePos, 0, task);

  writeData(data);
  res.sendStatus(200);
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🔥 KanbanPro corriendo en http://localhost:${PORT}`);
});

