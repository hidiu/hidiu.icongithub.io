(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const minimap = document.getElementById("minimap");
  const miniCtx = minimap.getContext("2d");

  const el = {
    score: document.getElementById("scoreValue"),
    length: document.getElementById("lengthValue"),
    rank: document.getElementById("rankValue"),
    board: document.getElementById("leaderboard"),
    boost: document.getElementById("boostFill"),
    start: document.getElementById("startOverlay"),
    death: document.getElementById("deathOverlay"),
    finalScore: document.getElementById("finalScore"),
    name: document.getElementById("nameInput"),
    startBtn: document.getElementById("startBtn"),
    restartBtn: document.getElementById("restartBtn"),
  };

  const WORLD_W = 4600;
  const WORLD_H = 3400;
  const SEG = 5;

  const FOOD_COLORS = [
    { c: "#ff6f4f", glow: "#ffb59d" },
    { c: "#f6c453", glow: "#ffe29a" },
    { c: "#57c785", glow: "#a9eac4" },
    { c: "#40b9d8", glow: "#a4e5f3" },
    { c: "#d45fd0", glow: "#f0a9ed" },
    { c: "#ffffff", glow: "#e8fff3" },
  ];

  const SKINS = {
    bbb: "BBB.png",
  };

  const SNAKE_STYLES = [
    { body: "#ff7a5c", dark: "#d74b30", glow: "#ffc1a8" },
    { body: "#2ec4b6", dark: "#148d82", glow: "#9beae1" },
    { body: "#a06cd5", dark: "#7443a6", glow: "#d7b6f3" },
    { body: "#f7c548", dark: "#cf9520", glow: "#ffe29a" },
    { body: "#ff6b9d", dark: "#d23c70", glow: "#ffb8d0" },
    { body: "#59c96b", dark: "#2f9c45", glow: "#a9eac4" },
    { body: "#4d96ff", dark: "#2a63c9", glow: "#a9c9ff" },
    { body: "#f58d42", dark: "#c15c16", glow: "#ffd0a4" },
    { body: "#63c7b2", dark: "#2f9a85", glow: "#b7efe3" },
    { body: "#ffd166", dark: "#d19a1c", glow: "#fff0b8" },
  ];

  const AI_NAMES = ["青柠", "闪电", "果冻", "奶糖", "泡泡", "阿紫", "薄荷", "糖豆", "流星", "小竹"];

  const view = { w: 0, h: 0, dpr: 1 };
  const camera = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0, down: false };
  const keys = {};
  const images = {};
  const sprites = {};
  let state = null;
  let raf = 0;
  let lastTime = 0;
  let selectedSkin = "bbb";

  function loadImages() {
    for (const key of Object.keys(SKINS)) {
      const img = new Image();
      img.src = SKINS[key];
      images[key] = img;
    }
    const foodImg = new Image();
    foodImg.src = "AAA.jpg";
    images.food = foodImg;
  }

  function buildCircularSprite(img, size, feather) {
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const c = sprite.getContext("2d");
    const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    c.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    const inner = 0.5 - feather;
    const grad = c.createRadialGradient(size / 2, size / 2, inner * size, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(inner / 0.5, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    c.globalCompositeOperation = "destination-in";
    c.fillStyle = grad;
    c.fillRect(0, 0, size, size);
    c.globalCompositeOperation = "source-over";
    return sprite;
  }

  function getHeadSprite() {
    if (!sprites.head && images.bbb && images.bbb.complete && images.bbb.naturalWidth > 0) {
      sprites.head = buildCircularSprite(images.bbb, 320, 0.16);
    }
    return sprites.head;
  }

  function getEnergySprite() {
    if (!sprites.food && images.food && images.food.complete && images.food.naturalWidth > 0) {
      sprites.food = buildCircularSprite(images.food, 256, 0.1);
    }
    return sprites.food;
  }

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function randomWaypoint() {
    return { x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80) };
  }

  function randomColor() {
    return SNAKE_STYLES[randInt(0, SNAKE_STYLES.length - 1)];
  }

  function hashPoint(i) {
    let n = i * 374761393 + 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    n = n ^ (n >> 16);
    const u = (n >>> 0) / 4294967295;
    return {
      x: ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1,
      y: ((Math.sin(i * 269.5 + 183.3) * 28001.8384) % 1 + 1) % 1,
      r: ((Math.sin(i * 73.7 + 91.2) * 12345.6789) % 1 + 1) % 1,
      c: i % 4,
    };
  }

  function spawnFood(x, y, mini) {
    const palette = FOOD_COLORS[randInt(0, FOOD_COLORS.length - 1)];
    state.food.push({
      x,
      y,
      r: mini ? rand(3.4, 5.2) : rand(5.5, 8.2),
      c: palette.c,
      glow: palette.glow,
      value: mini ? 2 : randInt(3, 8),
      pulse: rand(0, Math.PI * 2),
    });
  }

  function fillFood(count) {
    let missing = count - state.food.length;
    let guard = 0;
    while (missing > 0 && guard < 400) {
      guard++;
      const x = rand(50, WORLD_W - 50);
      const y = rand(50, WORLD_H - 50);
      let blocked = false;
      for (const s of state.snakes) {
        if (s.alive && dist(s.x, s.y, x, y) < 150) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        spawnFood(x, y, false);
        missing--;
      }
    }
  }

  class Snake {
    constructor(opts) {
      this.id = opts.id;
      this.name = opts.name;
      this.isPlayer = !!opts.isPlayer;
      this.style = opts.style || randomColor();
      this.skin = opts.skin || null;
      this.x = opts.x;
      this.y = opts.y;
      this.dir = opts.dir || { x: 1, y: 0 };
      this.angle = Math.atan2(this.dir.y, this.dir.x);
      this.length = opts.length || 36;
      this.speed = opts.speed || 108;
      this.radius = opts.radius || 14;
      this.boost = false;
      this.boostTimer = 0;
      this.score = 0;
      this.alive = true;
      this.controllable = this.isPlayer && !!opts.controllable;
      this.target = opts.target || { x: this.x + 220, y: this.y + 60 };
      this.waypointTimer = rand(2, 6);
      this.turnRate = this.isPlayer ? 4.8 : rand(1.7, 2.6);
      this.points = [];
      for (let i = 0; i < 14; i++) {
        this.points.push({
          x: this.x - this.dir.x * SEG * i,
          y: this.y - this.dir.y * SEG * i,
        });
      }
    }

    get head() {
      return this.points[0];
    }

    get bodyLength() {
      return Math.max(34, this.length * 14);
    }

    update(dt, game) {
      if (!this.alive) return;

      const boosting = this.boost && this.controllable && this.length > 26;
      const maxSpeed = this.isPlayer ? 236 : this.speed * 1.5;
      const speed = boosting ? maxSpeed : this.speed;

      if (boosting) {
        this.boostTimer += dt;
        this.length = Math.max(26, this.length - dt * 4.6);
        if (this.boostTimer >= 0.11) {
          this.boostTimer = 0;
          const tail = this.points[this.points.length - 1];
          spawnFood(tail.x + rand(-6, 6), tail.y + rand(-6, 6), true);
        }
      }

      let tx = this.target.x;
      let ty = this.target.y;
      if (this.isPlayer && this.controllable) {
        const kx = (keys["ArrowRight"] || keys["d"] ? 1 : 0) - (keys["ArrowLeft"] || keys["a"] ? 1 : 0);
        const ky = (keys["ArrowDown"] || keys["s"] ? 1 : 0) - (keys["ArrowUp"] || keys["w"] ? 1 : 0);
        if (kx !== 0 || ky !== 0) {
          tx = this.x + kx * 160;
          ty = this.y + ky * 160;
        } else {
          tx = camera.x + pointer.x;
          ty = camera.y + pointer.y;
        }
      } else if (!this.isPlayer) {
        if (
          dist(this.x, this.y, this.target.x, this.target.y) < 120 ||
          this.waypointTimer <= 0
        ) {
          this.target = randomWaypoint();
          this.waypointTimer = rand(2.5, 6.5);
        }
        this.waypointTimer -= dt;
        if (this.x < 120 || this.x > WORLD_W - 120 || this.y < 120 || this.y > WORLD_H - 120) {
          this.target = { x: WORLD_W / 2, y: WORLD_H / 2 };
        }
        if (game && game.player && game.player.alive && game.player.boost) {
          const d = dist(this.x, this.y, game.player.x, game.player.y);
          if (d < 260) {
            const away = Math.atan2(this.y - game.player.y, this.x - game.player.x);
            this.target = {
              x: this.x + Math.cos(away) * 260,
              y: this.y + Math.sin(away) * 260,
            };
          }
        }
      }

      const desired = Math.atan2(ty - this.y, tx - this.x);
      const turn = clamp(angleDiff(this.angle, desired), -this.turnRate * dt, this.turnRate * dt);
      this.angle += turn;
      this.dir = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
      this.x += this.dir.x * speed * dt;
      this.y += this.dir.y * speed * dt;
      this.x = clamp(this.x, 24, WORLD_W - 24);
      this.y = clamp(this.y, 24, WORLD_H - 24);

      this.points.unshift({ x: this.x, y: this.y });
      let path = 0;
      let cut = this.points.length;
      for (let i = 1; i < this.points.length; i++) {
        path += dist(this.points[i - 1].x, this.points[i - 1].y, this.points[i].x, this.points[i].y);
        if (path > this.bodyLength) {
          cut = i;
          break;
        }
      }
      if (cut < this.points.length) {
        this.points = this.points.slice(0, cut);
      }
    }
  }

  function makeSnake(opts) {
    return new Snake(opts);
  }

  function initWorld() {
    const player = makeSnake({
      id: "player",
      name: "我",
      isPlayer: true,
      controllable: false,
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      style: SNAKE_STYLES[0],
      skin: "bbb",
      length: 38,
      speed: 118,
      target: { x: WORLD_W / 2 + 200, y: WORLD_H / 2 },
    });

    const snakes = [player];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const x = clamp(WORLD_W / 2 + Math.cos(angle) * rand(700, 1300), 100, WORLD_W - 100);
      const y = clamp(WORLD_H / 2 + Math.sin(angle) * rand(500, 1000), 100, WORLD_H - 100);
      const ai = makeSnake({
        id: "ai-" + i,
        name: AI_NAMES[i % AI_NAMES.length],
        isPlayer: false,
        x,
        y,
        style: SNAKE_STYLES[(i + 1) % SNAKE_STYLES.length],
        length: randInt(30, 70),
        speed: rand(92, 116),
        target: randomWaypoint(),
      });
      snakes.push(ai);
    }

    state = {
      snakes,
      player,
      food: [],
      time: 0,
      aiSpawnTimer: 8,
      running: false,
      over: false,
    };
    fillFood(230);
  }

  function startGame(name, skin) {
    if (!state) initWorld();
    const p = state.player;
    p.name = name || "果冻蛇";
    p.skin = skin;
    p.controllable = true;
    p.alive = true;
    p.boost = false;
    p.length = 38;
    p.score = 0;
    p.x = WORLD_W / 2;
    p.y = WORLD_H / 2;
    p.angle = 0;
    p.dir = { x: 1, y: 0 };
    p.points = [];
    for (let i = 0; i < 14; i++) {
      p.points.push({ x: p.x - i * SEG, y: p.y });
    }

    for (const s of state.snakes) {
      if (s.isPlayer) continue;
      const nearSpawn = dist(s.x, s.y, p.x, p.y) < 520;
      if (s.alive && !nearSpawn) continue;
      const a = Math.random() * Math.PI * 2;
      const r = rand(720, 1350);
      s.x = clamp(p.x + Math.cos(a) * r, 120, WORLD_W - 120);
      s.y = clamp(p.y + Math.sin(a) * r * 0.7, 120, WORLD_H - 120);
      s.alive = true;
      s.boost = false;
      s.length = randInt(30, 70);
      s.score = 0;
      s.target = randomWaypoint();
      s.angle = Math.atan2(p.y - s.y, p.x - s.x);
      s.dir = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
      s.points = [];
      for (let i = 0; i < 14; i++) {
        s.points.push({
          x: s.x - s.dir.x * SEG * i,
          y: s.y - s.dir.y * SEG * i,
        });
      }
    }

    state.over = false;
    state.running = true;
    state.food = [];
    fillFood(230);
    el.start.classList.add("hidden");
    el.death.classList.add("hidden");
  }

  function endGame() {
    state.running = false;
    state.over = true;
    el.finalScore.textContent = String(state.player.score);
    el.death.classList.remove("hidden");
  }

  function killSnake(snake, scoreGain) {
    if (!snake.alive) return;
    snake.alive = false;
    if (scoreGain) {
      state.player.score += scoreGain;
    }
    const drops = Math.min(24, 10 + Math.floor(snake.length / 5));
    for (let i = 0; i < drops; i++) {
      const p = snake.points[randInt(0, Math.max(0, snake.points.length - 1))];
      if (p) spawnFood(p.x, p.y, false);
    }
    if (snake.isPlayer) {
      setTimeout(endGame, 420);
    }
  }

  function update(dt) {
    state.time += dt;
    for (const s of state.snakes) {
      s.update(dt, state);
    }

    const alive = state.snakes.filter((s) => s.alive);

    for (const s of alive) {
      const head = s.head;
      for (let i = state.food.length - 1; i >= 0; i--) {
        const f = state.food[i];
        if (dist(head.x, head.y, f.x, f.y) < s.radius + f.r) {
          state.food.splice(i, 1);
          s.length += f.value;
          s.score += f.value;
        }
      }
    }

    for (const s of alive) {
      const head = s.head;
      for (const other of alive) {
        if (other === s) continue;
        const skip = other.isPlayer ? 6 : 4;
        for (let i = skip; i < other.points.length; i += 2) {
          const p = other.points[i];
          const rr = s.radius * 0.72 + other.radius * 0.72;
          if (dist(head.x, head.y, p.x, p.y) < rr) {
            if (s.isPlayer) {
              killSnake(s, 0);
              break;
            }
            if (other.isPlayer) {
              killSnake(s, 30 + Math.floor(other.length / 4));
            }
            break;
          }
        }
        if (!s.alive) break;
      }
    }

    const aliveNow = state.snakes.filter((s) => s.alive);
    if (state.running && aliveNow.length < 6) {
      state.aiSpawnTimer -= dt;
      if (state.aiSpawnTimer <= 0) {
        state.aiSpawnTimer = 6;
        const pos = randomWaypoint();
        const idx = state.snakes.length;
        state.snakes.push(
          makeSnake({
            id: "ai-" + idx,
            name: AI_NAMES[idx % AI_NAMES.length],
            isPlayer: false,
            x: pos.x,
            y: pos.y,
            style: randomColor(),
            length: randInt(26, 42),
            speed: rand(94, 112),
            target: randomWaypoint(),
          })
        );
      }
    } else {
      state.aiSpawnTimer = 6;
    }

    fillFood(230);
    updateHud();
  }

  function updateHud() {
    if (!state) return;
    const p = state.player;
    el.score.textContent = String(p.score);
    el.length.textContent = String(Math.round(p.length));

    const sorted = state.snakes
      .filter((s) => s.alive)
      .sort((a, b) => b.score - a.score || b.length - a.length);
    const rank = sorted.findIndex((s) => s === p) + 1;
    el.rank.textContent = rank > 0 ? String(rank) : "-";

    el.boost.style.width = Math.round(clamp((p.length - 26) / 70, 0, 1) * 100) + "%";

    const rows = sorted.slice(0, 7);
    el.board.innerHTML = "";
    for (let i = 0; i < rows.length; i++) {
      const s = rows[i];
      const li = document.createElement("li");
      if (s === p) li.className = "me";
      const rankSpan = document.createElement("span");
      rankSpan.className = "rank";
      rankSpan.textContent = String(i + 1);
      const nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = s.name;
      const scoreSpan = document.createElement("span");
      scoreSpan.className = "score";
      scoreSpan.textContent = String(s.score);
      li.append(rankSpan, nameSpan, scoreSpan);
      el.board.appendChild(li);
    }
  }

  function drawBackground() {
    const left = Math.max(0, camera.x);
    const top = Math.max(0, camera.y);
    const right = Math.min(WORLD_W, camera.x + view.w);
    const bottom = Math.min(WORLD_H, camera.y + view.h);
    const sx0 = left - camera.x;
    const sy0 = top - camera.y;
    const sx1 = right - camera.x;
    const sy1 = bottom - camera.y;

    ctx.fillStyle = "#5d9471";
    ctx.fillRect(0, 0, view.w, view.h);

    if (sx0 >= sx1 || sy0 >= sy1) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    ctx.clip();

    const grad = ctx.createLinearGradient(sx0, sy0, sx1, sy1);
    grad.addColorStop(0, "#c9e8cf");
    grad.addColorStop(0.55, "#b7ddc3");
    grad.addColorStop(1, "#a7d3b4");
    ctx.fillStyle = grad;
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);

    ctx.lineWidth = 1;
    for (let x = Math.floor(left / 120) * 120; x <= right; x += 120) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(x - camera.x, sy0);
      ctx.lineTo(x - camera.x, sy1);
      ctx.stroke();
    }
    for (let y = Math.floor(top / 120) * 120; y <= bottom; y += 120) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(sx0, y - camera.y);
      ctx.lineTo(sx1, y - camera.y);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    for (let x = Math.floor(left / 480) * 480; x <= right; x += 480) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(x - camera.x, sy0);
      ctx.lineTo(x - camera.x, sy1);
      ctx.stroke();
    }
    for (let y = Math.floor(top / 480) * 480; y <= bottom; y += 480) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(sx0, y - camera.y);
      ctx.lineTo(sx1, y - camera.y);
      ctx.stroke();
    }

    const patternColors = [
      "rgba(255,122,89,0.16)",
      "rgba(246,196,83,0.18)",
      "rgba(64,185,216,0.16)",
      "rgba(151,108,213,0.14)",
    ];
    for (let i = 0; i < 340; i++) {
      const h = hashPoint(i);
      const x = h.x * WORLD_W;
      const y = h.y * WORLD_H;
      if (x < left - 20 || x > right + 20 || y < top - 20 || y > bottom + 20) continue;
      const r = 2.5 + h.r * 3.5;
      ctx.fillStyle = patternColors[h.c];
      ctx.beginPath();
      ctx.moveTo(x - camera.x, y - camera.y - r);
      ctx.lineTo(x - camera.x + r * 0.6, y - camera.y);
      ctx.lineTo(x - camera.x, y - camera.y + r);
      ctx.lineTo(x - camera.x - r * 0.6, y - camera.y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 5;
    ctx.strokeRect(2 - camera.x, 2 - camera.y, WORLD_W - 4, WORLD_H - 4);
    ctx.restore();
  }

  function drawFood() {
    const sprite = getEnergySprite();
    for (const f of state.food) {
      if (f.x < camera.x - 30 || f.x > camera.x + view.w + 30 || f.y < camera.y - 30 || f.y > camera.y + view.h + 30) {
        continue;
      }
      const pulse = 0.9 + Math.sin(state.time * 3 + f.pulse) * 0.1;
      const r = f.r * pulse;
      const s = r * 3.1;
      const g = ctx.createRadialGradient(f.x - s * 0.18, f.y - s * 0.18, s * 0.08, f.x, f.y, s * 0.82);
      g.addColorStop(0, f.glow);
      g.addColorStop(0.45, f.c);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, s * 0.74, 0, Math.PI * 2);
      ctx.fill();

      if (sprite) {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(state.time * 0.45 + f.pulse);
        ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.fillStyle = f.c;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawSnake(s) {
    if (!s.alive || s.points.length < 2) return;
    const n = s.points.length;

    for (let i = n - 1; i >= 0; i--) {
      const p = s.points[i];
      const t = 1 - i / (n - 1);
      const r = s.radius * (0.32 + t * 0.55);
      ctx.fillStyle = s.style.dark;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = n - 1; i >= 0; i--) {
      const p = s.points[i];
      const t = 1 - i / (n - 1);
      const r = s.radius * (0.32 + t * 0.55);
      ctx.fillStyle = s.style.body;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = n - 1; i >= 6; i -= 5) {
      const p = s.points[i];
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const head = s.head;
    const hd = Math.atan2(s.dir.y, s.dir.x);

    const glow = ctx.createRadialGradient(head.x, head.y, 2, head.x, head.y, s.radius * 2.5);
    glow.addColorStop(0, s.style.glow);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(head.x, head.y, s.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = s.style.dark;
    ctx.beginPath();
    ctx.arc(head.x, head.y, s.radius * 1.15 + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.style.body;
    ctx.beginPath();
    ctx.arc(head.x, head.y, s.radius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    const headSprite = s.skin ? getHeadSprite() : null;
    if (headSprite) {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(hd);
      const size = s.radius * 2.6;
      ctx.drawImage(headSprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(head.x + Math.cos(hd - 0.5) * s.radius * 0.45, head.y + Math.sin(hd - 0.5) * s.radius * 0.45, s.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(head.x + Math.cos(hd + 0.5) * s.radius * 0.45, head.y + Math.sin(hd + 0.5) * s.radius * 0.45, s.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#17332d";
      ctx.beginPath();
      ctx.arc(head.x + Math.cos(hd - 0.5) * s.radius * 0.45, head.y + Math.sin(hd - 0.5) * s.radius * 0.45, s.radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(head.x + Math.cos(hd + 0.5) * s.radius * 0.45, head.y + Math.sin(hd + 0.5) * s.radius * 0.45, s.radius * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "700 13px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const labelY = head.y - s.radius * 1.8;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.strokeText(s.name, head.x, labelY);
    ctx.fillStyle = s.isPlayer ? "#d94b2d" : "#17332d";
    ctx.fillText(s.name, head.x, labelY);
  }

  function drawMinimap() {
    const w = minimap.width;
    const h = minimap.height;
    miniCtx.clearRect(0, 0, w, h);
    miniCtx.fillStyle = "rgba(24,61,50,0.18)";
    miniCtx.fillRect(0, 0, w, h);
    const sx = w / WORLD_W;
    const sy = h / WORLD_H;

    for (const f of state.food) {
      miniCtx.fillStyle = "rgba(255,255,255,0.16)";
      miniCtx.fillRect(f.x * sx, f.y * sy, 1.5, 1.5);
    }
    for (const s of state.snakes) {
      if (!s.alive) continue;
      miniCtx.fillStyle = s.isPlayer ? "#ffffff" : s.style.body;
      miniCtx.beginPath();
      miniCtx.arc(s.x * sx, s.y * sy, s.isPlayer ? 3.2 : 2.2, 0, Math.PI * 2);
      miniCtx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, view.w, view.h);

    if (!state) {
      initWorld();
    }

    const p = state.player;
    const targetX = clamp(p.x - view.w / 2, 0, Math.max(0, WORLD_W - view.w));
    const targetY = clamp(p.y - view.h / 2, 0, Math.max(0, WORLD_H - view.h));
    camera.x += (targetX - camera.x) * 0.1;
    camera.y += (targetY - camera.y) * 0.1;

    drawBackground();
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawFood();
    const sorted = state.snakes.slice().sort((a, b) => {
      if (a.isPlayer) return 1;
      if (b.isPlayer) return -1;
      return b.length - a.length;
    });
    for (const s of sorted) drawSnake(s);
    ctx.restore();
    drawMinimap();
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0.016);
    lastTime = ts;
    if (state && state.running && !state.over) {
      update(dt);
    } else if (state) {
      for (const s of state.snakes) {
        if (s.alive && !s.isPlayer) s.update(dt, state);
      }
      state.time += dt;
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function initEvents() {
    window.addEventListener("resize", resize);

    window.addEventListener("pointermove", (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    });

    window.addEventListener("pointerdown", (e) => {
      if (!state || !state.running || state.over) return;
      if (e.target !== canvas) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.down = true;
      state.player.boost = true;
    });

    window.addEventListener("pointerup", () => {
      pointer.down = false;
      if (state && state.player) state.player.boost = false;
    });
    window.addEventListener("pointercancel", () => {
      pointer.down = false;
      if (state && state.player) state.player.boost = false;
    });

    window.addEventListener("keydown", (e) => {
      keys[e.key] = true;
      if (e.key === " " || e.key === "Shift") {
        if (state && state.player && state.running && !state.over) state.player.boost = true;
        e.preventDefault();
      }
      if (e.key.startsWith("Arrow")) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      keys[e.key] = false;
      if (e.key === " " || e.key === "Shift") {
        if (state && state.player) state.player.boost = false;
      }
    });

    el.startBtn.addEventListener("click", () => {
      startGame(el.name.value.trim() || "果冻蛇", selectedSkin);
    });
    el.restartBtn.addEventListener("click", () => {
      startGame(el.name.value.trim() || "果冻蛇", selectedSkin);
    });
    el.name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startGame(el.name.value.trim() || "果冻蛇", selectedSkin);
    });
  }

  resize();
  initEvents();
  loadImages();
  initWorld();
  lastTime = performance.now();
  raf = requestAnimationFrame(loop);
})();
