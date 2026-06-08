const { BaseGame } = require('./base-game');

const WIDTH = 900;
const HEIGHT = 460;
const RADIUS = 12;
const FRICTION = 0.985;
const POCKETS = [
  [20, 20], [WIDTH / 2, 16], [WIDTH - 20, 20],
  [20, HEIGHT - 20], [WIDTH / 2, HEIGHT - 16], [WIDTH - 20, HEIGHT - 20]
];

function rackBalls() {
  const balls = [{ id: 0, x: 220, y: HEIGHT / 2, vx: 0, vy: 0, color: '#ffffff', pocketed: false }];
  let id = 1;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({
        id: id++,
        x: 610 + row * 25,
        y: HEIGHT / 2 + (col - row / 2) * 28,
        vx: 0,
        vy: 0,
        color: ['#ffd166', '#00d4ff', '#9b5cff', '#f72585', '#2dfc92', '#ff8c42', '#5cf2ff', '#e0e0e0', '#c77dff', '#f5cb5c'][id % 10],
        pocketed: false
      });
    }
  }
  return balls;
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
    const power = Math.min(24, Math.max(2, Number(payload.power || 0)));
    const angle = Number(payload.angle || 0);
    cue.vx = Math.cos(angle) * power;
    cue.vy = Math.sin(angle) * power;
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
      const moving = room.data.balls.some((ball) => !ball.pocketed && Math.hypot(ball.vx, ball.vy) > 0.08);
      this.manager.emitRoom(room);
      if (!moving || ticks > 900) {
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
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= FRICTION;
      ball.vy *= FRICTION;
      if (Math.abs(ball.vx) < 0.04) ball.vx = 0;
      if (Math.abs(ball.vy) < 0.04) ball.vy = 0;
      if (ball.x < RADIUS || ball.x > WIDTH - RADIUS) { ball.vx *= -0.9; ball.x = Math.max(RADIUS, Math.min(WIDTH - RADIUS, ball.x)); }
      if (ball.y < RADIUS || ball.y > HEIGHT - RADIUS) { ball.vy *= -0.9; ball.y = Math.max(RADIUS, Math.min(HEIGHT - RADIUS, ball.y)); }
      for (const [px, py] of POCKETS) {
        if (Math.hypot(ball.x - px, ball.y - py) < 24) {
          if (ball.id === 0) { ball.x = 220; ball.y = HEIGHT / 2; ball.vx = 0; ball.vy = 0; }
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
          const overlap = RADIUS * 2 - dist;
          a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        }
      }
    }
  }
}

module.exports = { PoolGame };
