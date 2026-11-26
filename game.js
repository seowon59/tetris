// =====================================================
// 별조각 낙하 - 오리지널 낙하 블록 퍼즐
// 조각은 2칸, 3칸, 5칸짜리 모양을 섞어 씁니다.
// 가끔 조각에 "별" 칸이 들어 있고, 별이 있는 줄을 지우면 보너스 점수!
// =====================================================

// ---------- 기본 설정 ----------
const COLS = 10;        // 가로 칸 수
const ROWS = 18;        // 세로 칸 수
const SIZE = 30;        // 한 칸의 크기(픽셀)
const STAR_CHANCE = 0.25; // 조각에 별이 들어갈 확률

// ---------- 조각 모양 (1 = 블록 있음) ----------
const PIECES = [
  { name: "쌍둥이", color: "#7fd8ff", shape: [[1, 1]] },
  { name: "막대",   color: "#ffd36e", shape: [[1, 1, 1]] },
  { name: "꺾쇠",   color: "#ff8fb1", shape: [[1, 0], [1, 1]] },
  { name: "십자",   color: "#b48cff", shape: [[0, 1, 0], [1, 1, 1], [0, 1, 0]] },
  { name: "컵",     color: "#7dffb2", shape: [[1, 0, 1], [1, 1, 1]] },
  { name: "계단",   color: "#ffa66e", shape: [[1, 0, 0], [1, 1, 0], [0, 1, 1]] },
  { name: "큰꺾쇠", color: "#6e9bff", shape: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
];

// ---------- 화면 요소 ----------
const board = document.getElementById("board");
const ctx = board.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const comboEl = document.getElementById("combo");
const startBtn = document.getElementById("start");

// ---------- 게임 상태 ----------
let grid;          // 쌓인 블록들 (각 칸: null 또는 {color, star})
let piece;         // 지금 떨어지는 조각
let nextPiece;     // 다음 조각
let score, lines, level, combo;
let dropTimer = 0; // 마지막으로 한 칸 내려간 뒤 지난 시간
let lastTime = 0;
let running = false;
let paused = false;

// 빈 판 만들기
function makeGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// 무작위 조각 만들기
function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  // 모양을 복사해서 각 칸을 객체로 바꿈 (별 표시를 넣기 위해)
  const cells = p.shape.map(row => row.map(v => (v ? { color: p.color, star: false } : null)));

  // 일정 확률로 칸 하나에 별을 넣음
  if (Math.random() < STAR_CHANCE) {
    const filled = [];
    cells.forEach((row, y) => row.forEach((c, x) => c && filled.push(c)));
    filled[Math.floor(Math.random() * filled.length)].star = true;
  }

  return {
    cells,
    x: Math.floor((COLS - cells[0].length) / 2),
    y: 0,
  };
}

// 시계 방향으로 90도 회전한 새 모양 돌려주기
function rotate(cells) {
  const h = cells.length;
  const w = cells[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    out.push([]);
    for (let y = h - 1; y >= 0; y--) out[x].push(cells[y][x]);
  }
  return out;
}

// 조각이 (x, y) 위치에 놓일 수 있는지 검사
function canPlace(cells, x, y) {
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false; // 벽이나 바닥 밖
      if (ny >= 0 && grid[ny][nx]) return false;            // 다른 블록과 겹침
    }
  }
  return true;
}

// 조각을 판에 고정
function lockPiece() {
  piece.cells.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = cell;
    })
  );
  clearLines();
  spawn();
}

// 꽉 찬 줄 지우기 + 점수 계산
function clearLines() {
  let cleared = 0;
  let stars = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (grid[y].every(cell => cell)) {
      stars += grid[y].filter(cell => cell.star).length;
      grid.splice(y, 1);                 // 그 줄을 빼고
      grid.unshift(Array(COLS).fill(null)); // 맨 위에 빈 줄 추가
      cleared++;
      y++; // 같은 자리를 다시 검사
    }
  }

  if (cleared > 0) {
    combo++;
    // 한 번에 많이 지울수록, 연속으로 지울수록 점수가 커짐
    const base = [0, 100, 250, 450, 700][Math.min(cleared, 4)];
    score += base * level * combo + stars * 50 * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
  } else {
    combo = 0;
  }
  updateInfo();
}

// 새 조각 등장
function spawn() {
  piece = nextPiece || randomPiece();
  nextPiece = randomPiece();
  if (!canPlace(piece.cells, piece.x, piece.y)) {
    gameOver();
  }
}

// 한 칸 아래로. 더 못 내려가면 고정
function softDrop() {
  if (canPlace(piece.cells, piece.x, piece.y + 1)) {
    piece.y++;
  } else {
    lockPiece();
  }
  dropTimer = 0;
}

// 바닥까지 바로 떨어뜨리기
function hardDrop() {
  while (canPlace(piece.cells, piece.x, piece.y + 1)) {
    piece.y++;
    score += 2;
  }
  lockPiece();
  dropTimer = 0;
}

function move(dx) {
  if (canPlace(piece.cells, piece.x + dx, piece.y)) piece.x += dx;
}

function turn() {
  const rotated = rotate(piece.cells);
  // 벽에 붙어 있을 때도 돌 수 있게 옆으로 살짝 밀어 봄
  for (const kick of [0, -1, 1, -2, 2]) {
    if (canPlace(rotated, piece.x + kick, piece.y)) {
      piece.cells = rotated;
      piece.x += kick;
      return;
    }
  }
}

// ---------- 그리기 ----------
function drawCell(context, x, y, cell, size, alpha = 1) {
  context.globalAlpha = alpha;
  context.fillStyle = cell.color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // 윗부분 반짝임
  context.fillStyle = "rgba(255,255,255,0.25)";
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (cell.star) {
    context.fillStyle = "#ffffff";
    context.font = `${size * 0.6}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("✦", x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, board.width, board.height);

  // 배경 점 (밤하늘 느낌)
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      ctx.fillRect(x * SIZE + SIZE / 2 - 1, y * SIZE + SIZE / 2 - 1, 2, 2);

  // 쌓인 블록
  grid.forEach((row, y) => row.forEach((cell, x) => cell && drawCell(ctx, x, y, cell, SIZE)));

  if (piece) {
    // 떨어질 자리 미리보기 (흐릿하게)
    let ghostY = piece.y;
    while (canPlace(piece.cells, piece.x, ghostY + 1)) ghostY++;
    piece.cells.forEach((row, r) =>
      row.forEach((cell, c) => cell && drawCell(ctx, piece.x + c, ghostY + r, cell, SIZE, 0.2))
    );
    // 진짜 조각
    piece.cells.forEach((row, r) =>
      row.forEach((cell, c) => cell && drawCell(ctx, piece.x + c, piece.y + r, cell, SIZE))
    );
  }

  // 다음 조각 미리보기
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (nextPiece) {
    const s = 22;
    const w = nextPiece.cells[0].length * s;
    const h = nextPiece.cells.length * s;
    nextCtx.save();
    nextCtx.translate((nextCanvas.width - w) / 2, (nextCanvas.height - h) / 2);
    nextPiece.cells.forEach((row, r) => row.forEach((cell, c) => cell && drawCell(nextCtx, c, r, cell, s)));
    nextCtx.restore();
  }

  if (paused) message("일시정지");
}

function message(text) {
  ctx.fillStyle = "rgba(13, 11, 36, 0.75)";
  ctx.fillRect(0, board.height / 2 - 40, board.width, 80);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, board.width / 2, board.height / 2);
}

function updateInfo() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo > 1 ? `x${combo}` : "-";
}

// ---------- 게임 흐름 ----------
function dropInterval() {
  // 단계가 오를수록 빨라짐 (최소 0.1초)
  return Math.max(100, 800 - (level - 1) * 70);
}

function loop(time = 0) {
  if (!running) return;
  const delta = time - lastTime;
  lastTime = time;

  if (!paused) {
    dropTimer += delta;
    if (dropTimer > dropInterval()) softDrop();
  }

  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  grid = makeGrid();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  nextPiece = null;
  paused = false;
  spawn();
  updateInfo();
  running = true;
  startBtn.textContent = "다시 시작";
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  piece = null;
  draw();
  message("게임 끝!");
}

// ---------- 입력 ----------
function handleKey(key) {
  if (!running) return;
  if (key === "p" || key === "P") { paused = !paused; return; }
  if (paused) return;

  if (key === "ArrowLeft") move(-1);
  else if (key === "ArrowRight") move(1);
  else if (key === "ArrowDown") { softDrop(); score += 1; updateInfo(); }
  else if (key === "ArrowUp") turn();
  else if (key === " ") { hardDrop(); updateInfo(); }
}

document.addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) e.preventDefault();
  handleKey(e.key);
});

document.querySelectorAll(".touch button").forEach(btn =>
  btn.addEventListener("click", () => handleKey(btn.dataset.key))
);

startBtn.addEventListener("click", () => {
  startBtn.blur(); // 스페이스바가 버튼을 다시 누르지 않게
  startGame();
});

// 처음 화면
grid = makeGrid();
draw();
message("시작하기를 누르세요");
