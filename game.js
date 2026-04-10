// =============================================
//  THE GREAT SHOWER ESCAPE
//  Starring Amelia the Owl
// =============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Screen helpers ---
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// =============================================
//  ROOMS
// =============================================
const ROOMS = [
  { name: 'Living Room', bg: '#d4a96a', floor: '#c8965a', walls: '#8B5E3C',
    furniture: [
      { x: 0.05, y: 0.25, w: 0.18, h: 0.30, color: '#5c3d2e', label: '🛋️' },  // couch
      { x: 0.70, y: 0.20, w: 0.12, h: 0.20, color: '#7b5e3c', label: '📺' },  // TV stand
      { x: 0.40, y: 0.60, w: 0.20, h: 0.12, color: '#a07850', label: '☕' },  // coffee table
    ],
    exits: { right: 1, down: 2 }
  },
  { name: 'Kitchen', bg: '#b8d4b8', floor: '#a0c4a0', walls: '#4a7c59',
    furniture: [
      { x: 0.00, y: 0.00, w: 0.30, h: 0.18, color: '#8b8b8b', label: '🍳' },  // counter
      { x: 0.60, y: 0.00, w: 0.40, h: 0.18, color: '#8b8b8b', label: '🍍' },  // counter
      { x: 0.35, y: 0.40, w: 0.20, h: 0.20, color: '#c4a265', label: '🪑' },  // table
    ],
    exits: { left: 0, down: 3 }
  },
  { name: 'Bedroom', bg: '#c9b8d4', floor: '#b8a0c4', walls: '#5a3d7a',
    furniture: [
      { x: 0.05, y: 0.05, w: 0.35, h: 0.35, color: '#9b7bb5', label: '🛏️' },  // bed
      { x: 0.70, y: 0.10, w: 0.15, h: 0.25, color: '#6b4f8a', label: '📚' },  // bookshelf
      { x: 0.45, y: 0.60, w: 0.18, h: 0.18, color: '#7b5f9a', label: '🖥️' },  // desk
    ],
    exits: { up: 0, right: 3 }
  },
  { name: 'Backyard', bg: '#7ec87e', floor: '#5ab05a', walls: '#2d6a2d',
    furniture: [
      { x: 0.60, y: 0.05, w: 0.18, h: 0.45, color: '#5c4a2a', label: '🌴' },  // palm tree
      { x: 0.10, y: 0.55, w: 0.22, h: 0.14, color: '#c4a265', label: '🌺' },  // flower bed
      { x: 0.35, y: 0.30, w: 0.20, h: 0.20, color: '#a07850', label: '🪑' },  // lawn chair
    ],
    exits: { up: 1, left: 2 }
  }
];

// =============================================
//  GAME STATE
// =============================================
let state = 'title'; // title | playing | minigame | gameover
let roomIndex = 0;
let player, mom;
let survivedSeconds = 0;
let survivalTimer = null;
let lives = 3;
let catchCooldown = false;

const TILE = 40; // logical grid tile size (unused for drawing but used for reference)
const PLAYER_SPEED = 3.5;
const MOM_BASE_SPEED = 1.6;

// Input
const keys = { up: false, down: false, left: false, right: false };

// =============================================
//  CANVAS SIZING
// =============================================
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resize(); });
resize();

// =============================================
//  ENTITY HELPERS
// =============================================
function makePlayer() {
  return { x: canvas.width * 0.5, y: canvas.height * 0.5, r: 18, speed: PLAYER_SPEED };
}

function makeMom() {
  // Start at a corner far from center
  return { x: 30, y: 30, r: 20, speed: MOM_BASE_SPEED + survivedSeconds * 0.01 };
}

// =============================================
//  COLLISION: player vs furniture
// =============================================
function getRoomFurniture() {
  const room = ROOMS[roomIndex];
  const W = canvas.width, H = canvas.height;
  return room.furniture.map(f => ({
    x: f.x * W,
    y: f.y * H + 50,        // offset for HUD
    w: f.w * W,
    h: f.h * (H - 50),
    label: f.label
  }));
}

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

function clampToRoom(entity, newX, newY) {
  const margin = entity.r;
  const W = canvas.width, H = canvas.height;
  newX = Math.max(margin, Math.min(W - margin, newX));
  newY = Math.max(50 + margin, Math.min(H - margin, newY));

  // Furniture collisions
  const furn = getRoomFurniture();
  for (const f of furn) {
    if (circleRect(newX, newY, entity.r, f.x, f.y, f.w, f.h)) {
      // Push out: find least-overlap axis
      const overlapLeft  = (newX + entity.r) - f.x;
      const overlapRight = (f.x + f.w) - (newX - entity.r);
      const overlapTop   = (newY + entity.r) - f.y;
      const overlapBot   = (f.y + f.h) - (newY - entity.r);
      const minH = Math.min(overlapLeft, overlapRight);
      const minV = Math.min(overlapTop, overlapBot);
      if (minH < minV) {
        newX = overlapLeft < overlapRight
          ? f.x - entity.r
          : f.x + f.w + entity.r;
      } else {
        newY = overlapTop < overlapBot
          ? f.y - entity.r
          : f.y + f.h + entity.r;
      }
    }
  }
  return { x: newX, y: newY };
}

// =============================================
//  ROOM TRANSITION
// =============================================
function checkRoomTransition() {
  const W = canvas.width, H = canvas.height;
  const room = ROOMS[roomIndex];
  const edge = 12;
  let next = null, nx, ny;

  if (player.x < edge && room.exits.left !== undefined) {
    next = room.exits.left; nx = W - 40; ny = player.y;
  } else if (player.x > W - edge && room.exits.right !== undefined) {
    next = room.exits.right; nx = 40; ny = player.y;
  } else if (player.y < 50 + edge && room.exits.up !== undefined) {
    next = room.exits.up; nx = player.x; ny = H - 40;
  } else if (player.y > H - edge && room.exits.down !== undefined) {
    next = room.exits.down; nx = player.x; ny = 50 + 40;
  }

  if (next !== null) {
    roomIndex = next;
    player.x = nx; player.y = ny;
    // Respawn mom in new room at a far corner
    mom = makeMom();
    mom.speed = MOM_BASE_SPEED + survivedSeconds * 0.012;
  }
}

// =============================================
//  DRAWING
// =============================================
function drawRoom() {
  const room = ROOMS[roomIndex];
  const W = canvas.width, H = canvas.height;

  // Floor
  ctx.fillStyle = room.floor;
  ctx.fillRect(0, 50, W, H - 50);

  // Walls (top strip)
  ctx.fillStyle = room.walls;
  ctx.fillRect(0, 50, W, 30);

  // Exit indicators
  const exits = room.exits;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  if (exits.left  !== undefined) ctx.fillRect(0, H * 0.35, 10, H * 0.30);
  if (exits.right !== undefined) ctx.fillRect(W - 10, H * 0.35, 10, H * 0.30);
  if (exits.up    !== undefined) ctx.fillRect(W * 0.35, 50, W * 0.30, 10);
  if (exits.down  !== undefined) ctx.fillRect(W * 0.35, H - 10, W * 0.30, 10);

  // Furniture
  const furn = getRoomFurniture();
  furn.forEach((f, i) => {
    const src = room.furniture[i];
    ctx.fillStyle = src.color;
    ctx.beginPath();
    ctx.roundRect(f.x, f.y, f.w, f.h, 8);
    ctx.fill();
    // Emoji label
    const fs = Math.min(f.w, f.h) * 0.55;
    ctx.font = `${fs}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(src.label, f.x + f.w / 2, f.y + f.h / 2);
  });
}

function drawOwl(x, y, r) {
  // Body
  ctx.fillStyle = '#c8a96e';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.2, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = '#f0d9a0';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.4, r * 0.5, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wings
  ctx.fillStyle = '#a07840';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.85, y + r * 0.2, r * 0.38, r * 0.55, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.85, y + r * 0.2, r * 0.38, r * 0.55, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#c8a96e';
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.55, r * 0.7, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ear tufts
  ctx.fillStyle = '#a07840';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y - r * 1.1);
  ctx.lineTo(x - r * 0.55, y - r * 1.45);
  ctx.lineTo(x - r * 0.15, y - r * 1.1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.15, y - r * 1.1);
  ctx.lineTo(x + r * 0.55, y - r * 1.45);
  ctx.lineTo(x + r * 0.4, y - r * 1.1);
  ctx.fill();

  // Eyes
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.6, r * 0.22, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.28, y - r * 0.6, r * 0.22, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2000';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.6, r * 0.12, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.28, y - r * 0.6, r * 0.12, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.24, y - r * 0.64, r * 0.04, r * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.32, y - r * 0.64, r * 0.04, r * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#e8a020';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.42);
  ctx.lineTo(x - r * 0.1, y - r * 0.28);
  ctx.lineTo(x + r * 0.1, y - r * 0.28);
  ctx.fill();
}

function drawMom(x, y, r) {
  // Body
  ctx.fillStyle = '#e07070';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.3, r * 0.75, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms
  ctx.strokeStyle = '#c05050';
  ctx.lineWidth = r * 0.25;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y);
  ctx.lineTo(x - r * 1.2, y + r * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y);
  ctx.lineTo(x + r * 1.2, y + r * 0.5);
  ctx.stroke();

  // Head
  ctx.fillStyle = '#f5c5a0';
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.65, r * 0.55, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#5c3a1e';
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.9, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.42, y - r * 0.7, r * 0.22, r * 0.4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.42, y - r * 0.7, r * 0.22, r * 0.4, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#3a2000';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.2, y - r * 0.65, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y - r * 0.65, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (stern)
  ctx.strokeStyle = '#9b4444';
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.15, y - r * 0.44);
  ctx.lineTo(x + r * 0.15, y - r * 0.44);
  ctx.stroke();

  // Speech bubble "SHOWER TIME!"
  const bx = x + r * 0.8, by = y - r * 1.5;
  const bw = 100, bh = 30;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#c05050';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();
  // Tail
  ctx.beginPath();
  ctx.moveTo(bx + 10, by + bh);
  ctx.lineTo(x + r * 0.3, by + bh + 12);
  ctx.lineTo(bx + 24, by + bh);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c05050';
  ctx.font = `bold ${r * 0.45}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚿 SHOWER!', bx + bw / 2, by + bh / 2);
}

function drawHUD() {
  document.getElementById('hud-time').textContent = `⏱ ${survivedSeconds}s`;
  document.getElementById('hud-room').textContent = ROOMS[roomIndex].name;
  document.getElementById('hud-lives').textContent = '🦉'.repeat(lives);
}

// =============================================
//  GAME LOOP
// =============================================
let lastTime = 0;
function gameLoop(ts) {
  if (state !== 'playing') return;
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;

  // Move player
  let dx = 0, dy = 0;
  if (keys.up)    dy -= PLAYER_SPEED * dt;
  if (keys.down)  dy += PLAYER_SPEED * dt;
  if (keys.left)  dx -= PLAYER_SPEED * dt;
  if (keys.right) dx += PLAYER_SPEED * dt;

  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

  const np = clampToRoom(player, player.x + dx, player.y + dy);
  player.x = np.x; player.y = np.y;

  // Move mom toward player (with slight random wobble)
  const momSpd = (MOM_BASE_SPEED + survivedSeconds * 0.012) * dt;
  const angle = Math.atan2(player.y - mom.y, player.x - mom.x);
  const wobble = (Math.random() - 0.5) * 0.3;
  const nm = clampToRoom(mom,
    mom.x + Math.cos(angle + wobble) * momSpd,
    mom.y + Math.sin(angle + wobble) * momSpd
  );
  mom.x = nm.x; mom.y = nm.y;

  // Check catch
  if (!catchCooldown) {
    const dist = Math.hypot(player.x - mom.x, player.y - mom.y);
    if (dist < player.r + mom.r) {
      lives--;
      if (lives <= 0) {
        startMinigame();
        return;
      } else {
        // Brief invincibility
        catchCooldown = true;
        // Teleport player to center
        player.x = canvas.width * 0.5;
        player.y = canvas.height * 0.5;
        setTimeout(() => { catchCooldown = false; }, 1500);
      }
    }
  }

  checkRoomTransition();

  // Draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoom();
  drawOwl(player.x, player.y, player.r);
  drawMom(mom.x, mom.y, mom.r);
  drawHUD();

  requestAnimationFrame(gameLoop);
}

// =============================================
//  MINIGAME
// =============================================
let mgTimer = null;
let bubblesPopped = 0;
let mgActive = false;

function startMinigame() {
  state = 'minigame';
  showScreen('screen-minigame');
  bubblesPopped = 0;
  mgActive = true;
  document.getElementById('bubble-count').textContent = '0';
  clearInterval(survivalTimer);

  let timeLeft = 15;
  document.getElementById('mg-timer').textContent = timeLeft;

  const area = document.getElementById('bubble-area');
  area.innerHTML = '';

  const EMOJIS = ['🎵', '🎶', '🧼', '🚿', '🦉', '🌺', '🌴', '🐠'];
  const BUBBLE_SIZE = 52;

  function spawnBubble() {
    if (!mgActive) return;
    const b = document.createElement('div');
    b.className = 'bubble';
    b.style.width = BUBBLE_SIZE + 'px';
    b.style.height = BUBBLE_SIZE + 'px';
    const areaW = area.clientWidth || 340;
    const areaH = area.clientHeight || 200;
    b.style.left = Math.random() * (areaW - BUBBLE_SIZE) + 'px';
    b.style.top  = Math.random() * (areaH - BUBBLE_SIZE) + 'px';
    b.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    b.addEventListener('pointerdown', () => {
      if (!mgActive) return;
      b.classList.add('pop');
      bubblesPopped++;
      document.getElementById('bubble-count').textContent = bubblesPopped;
      setTimeout(() => b.remove(), 200);
    });
    area.appendChild(b);
    // Auto-remove if not tapped
    setTimeout(() => { if (b.parentNode) b.remove(); }, 1800);
  }

  const spawnInterval = setInterval(() => {
    if (!mgActive) { clearInterval(spawnInterval); return; }
    spawnBubble();
  }, 500);
  // Spawn a few immediately
  for (let i = 0; i < 4; i++) setTimeout(spawnBubble, i * 120);

  mgTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('mg-timer').textContent = timeLeft;
    if (timeLeft <= 0) {
      mgActive = false;
      clearInterval(mgTimer);
      clearInterval(spawnInterval);
      endGame();
    }
  }, 1000);
}

// =============================================
//  GAME OVER
// =============================================
function endGame() {
  state = 'gameover';
  showScreen('screen-gameover');

  const msgs = [
    `You survived ${survivedSeconds} seconds before Mom won! 🚿`,
    `${survivedSeconds} seconds of freedom! Mom always wins eventually...`,
    `Amelia ran for ${survivedSeconds} seconds! Time to wash those feathers. 🦉`,
  ];
  const tips = [
    `You popped ${bubblesPopped} bubbles in the shower! 🎵`,
    `${bubblesPopped} bubbles popped! Amelia sang the whole time. 🎶`,
    `Amelia popped ${bubblesPopped} bubbles and sang louder than ever! 🎵🦉`,
  ];

  document.getElementById('go-message').textContent = msgs[Math.floor(Math.random() * msgs.length)];
  document.getElementById('go-score').textContent = tips[Math.floor(Math.random() * tips.length)];
}

// =============================================
//  START GAME
// =============================================
function startGame() {
  state = 'playing';
  roomIndex = 0;
  lives = 3;
  survivedSeconds = 0;
  catchCooldown = false;
  resize();
  player = makePlayer();
  mom = makeMom();
  showScreen('screen-game');
  canvas.style.display = 'block';

  clearInterval(survivalTimer);
  survivalTimer = setInterval(() => {
    survivedSeconds++;
  }, 1000);

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// =============================================
//  INPUT — Keyboard
// =============================================
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp'    || e.key === 'w') keys.up    = true;
  if (e.key === 'ArrowDown'  || e.key === 's') keys.down  = true;
  if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowUp'    || e.key === 'w') keys.up    = false;
  if (e.key === 'ArrowDown'  || e.key === 's') keys.down  = false;
  if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// =============================================
//  INPUT — D-Pad buttons
// =============================================
function bindDpad(id, key) {
  const btn = document.getElementById(id);
  btn.addEventListener('pointerdown', e => { e.preventDefault(); keys[key] = true; });
  btn.addEventListener('pointerup',   e => { e.preventDefault(); keys[key] = false; });
  btn.addEventListener('pointerleave',e => { e.preventDefault(); keys[key] = false; });
}
bindDpad('btn-up',    'up');
bindDpad('btn-down',  'down');
bindDpad('btn-left',  'left');
bindDpad('btn-right', 'right');

// =============================================
//  BUTTON WIRING
// =============================================
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);

// =============================================
//  INIT
// =============================================
showScreen('screen-title');
