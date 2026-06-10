const { BaseGame } = require('./base-game');

const WIDTH = 900;
const HEIGHT = 460;
const RADIUS = 12;
const FRICTION = 0.972;
const SPIN_DECAY = 0.94;
const POCKETS = [
  [20, 20], [WIDTH / 2, 16], [WIDTH - 20, 20],
  [20, HEIGHT - 20], [WIDTH / 2, HEIGHT - 16], [WIDTH - 20, HEIGHT - 20]
];

function makeBall(data) {
  return { vx: 0, vy: 0, spinX: 0, spinY: 0, pocketed: false, ...data };
}

function rackBalls() {
  const balls = [makeBall({ id: 0, x: 220, y: HEIGHT / 2, color: '#ffffff' })];
  let id = 1;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push(makeBall({
        id: id++,
        x: 610 + row * 25,
        y: HEIGHT / 2 + (col - row / 2) * 28,
        color: ['#ffd166', '#00d4ff', '#9b5cff', '#f72585', '#2dfc92', '#ff8c42', '#5cf2ff', '#e0e0e0', '#c77dff', '#f5cb5c'][id % 10],
      }));
    }
  }
  return balls;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

class PoolGame extends BaseGame {
  constructor() {
    super({
      id: 'pool',
      name: 'Billar 2D',
      description: 'Billar simplificado con fisica 2D, turnos y tiros validados por servidor.',
      minPlayers: 2,
      maxPlayers: 2
    });
  }

  onCreateRoom(room) {
    room.data = { width: WIDTH, height: HEIGHT, balls: rackBalls(), scores: {}, current: 0, moving: false };
  }

  onJoin(room, user) {
    if (!room.data.scores[user.uid]) room.data.scores[user.uid] = 0;
  }

  publicState(room) {
    return {
      width: WIDTH,
      height: HEIGHT,
      balls: room.data.balls,
      scores: room.data.scores,
      currentUid: room.players[room.data.current]?.uid || null,
      moving: room.data.moving
    };
  }

  async onAction(room, user, action, payload) {
    if (action === 'start') {
      if (room.players.length < 2) throw new Error('Se necesitan 2 jugadores.');
      room.state = 'En juego';
      return;
    }
    if (action !== 'shoot') throw new Error('Accion de billar no valida.');
    if (room.state !== 'En juego') throw new Error('La partida no esta activa.');
    if (room.players[room.data.current]?.uid !== user.uid) throw new Error('No es tu turno.');
    if (room.data.moving) throw new Error('Espera a que se detengan las bolas.');
    const cue = room.data.balls.find((ball) => ball.id === 0);
    const power = clamp(payload.power, 2, 22);
    const angle = Number(payload.angle || 0);
    const spinX = clamp(payload.spinX, -1, 1);
    const spinY = clamp(payload.spinY, -1, 1);
    cue.vx = Math.cos(angle) * power;
    cue.vy = Math.sin(angle) * power;
    cue.spinX = spinX;
    cue.spinY = spinY;
    this.simulate(room, user.uid);
  }

  simulate(room, shooterUid) {
    room.data.moving = true;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      const pocketedBefore = room.data.balls.filter((ball) => ball.pocketed).length;
      this.step(room);
      const pocketedAfter = room.data.balls.filter((ball) => ball.pocketed).length;
      if (pocketedAfter > pocketedBefore) room.data.scores[shooterUid] += pocketedAfter - pocketedBefore;
      const moving = room.data.balls.some((ball) => !ball.pocketed && Math.hypot(ball.vx, ball.vy) > 0.12);
      this.manager.emitRoom(room);
      if (!moving || ticks > 620) {
        clearInterval(timer);
        room.data.moving = false;
        room.data.current = (room.data.current + 1) % room.players.length;
        if (room.data.balls.filter((ball) => ball.id !== 0 && !ball.pocketed).length === 0) room.state = 'Finalizada';
        this.manager.emitRoom(room);
      }
    }, 33);
  }

  step(room) {
    const balls = room.data.balls;
    for (const ball of balls) {
      if (ball.pocketed) continue;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > 0.08 && (Math.abs(ball.spinX) > 0.01 || Math.abs(ball.spinY) > 0.01)) {
        const nx = ball.vx / speed;
        const ny = ball.vy / speed;
        ball.vx += -ny * ball.spinX * 0.025 + nx * ball.spinY * 0.012;
        ball.vy += nx * ball.spinX * 0.025 + ny * ball.spinY * 0.012;
        ball.spinX *= SPIN_DECAY;
        ball.spinY *= SPIN_DECAY;
      }
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= FRICTION;
      ball.vy *= FRICTION;
      if (Math.abs(ball.vx) < 0.06) ball.vx = 0;
      if (Math.abs(ball.vy) < 0.06) ball.vy = 0;
      if (ball.x < RADIUS || ball.x > WIDTH - RADIUS) { ball.vx *= -0.82; ball.x = Math.max(RADIUS, Math.min(WIDTH - RADIUS, ball.x)); }
      if (ball.y < RADIUS || ball.y > HEIGHT - RADIUS) { ball.vy *= -0.82; ball.y = Math.max(RADIUS, Math.min(HEIGHT - RADIUS, ball.y)); }
      for (const [px, py] of POCKETS) {
        if (Math.hypot(ball.x - px, ball.y - py) < 24) {
          if (ball.id === 0) { ball.x = 220; ball.y = HEIGHT / 2; ball.vx = 0; ball.vy = 0; ball.spinX = 0; ball.spinY = 0; }
          else ball.pocketed = true;
        }
      }
    }
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        if (a.pocketed || b.pocketed) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < RADIUS * 2) {
          const nx = dx / dist, ny = dy / dist;
          const p = 2 * (a.vx * nx + a.vy * ny - b.vx * nx - b.vy * ny) / 2;
          a.vx -= p * nx; a.vy -= p * ny;
          b.vx += p * nx; b.vy += p * ny;
          a.spinX *= 0.65; a.spinY *= 0.65;
          b.spinX *= 0.65; b.spinY *= 0.65;
          const overlap = RADIUS * 2 - dist;
          a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        }
      }
    }
  }
}

module.exports = { PoolGame };
