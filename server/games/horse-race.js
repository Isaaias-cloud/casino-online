const { BaseGame } = require('./base-game');

const HORSES = [
  { id: 1, name: 'Neon Azul', probability: 0.24, color: '#00d4ff' },
  { id: 2, name: 'Rayo Dorado', probability: 0.21, color: '#ffd166' },
  { id: 3, name: 'Sombra Violeta', probability: 0.18, color: '#9b5cff' },
  { id: 4, name: 'Turbo Noche', probability: 0.15, color: '#f72585' },
  { id: 5, name: 'Centella', probability: 0.12, color: '#2dfc92' },
  { id: 6, name: 'Cometa', probability: 0.10, color: '#ff8c42' }
];

function weightedHorse() {
  let roll = Math.random();
  for (const horse of HORSES) {
    roll -= horse.probability;
    if (roll <= 0) return horse.id;
  }
  return HORSES[0].id;
}

class HorseRaceGame extends BaseGame {
  constructor() {
    super({
      id: 'horse-race',
      name: 'Carreras de Caballos',
      description: 'Apuesta creditos virtuales por uno de seis caballos y mira la carrera sincronizada.',
      minPlayers: 2,
      maxPlayers: 6
    });
  }

  onCreateRoom(room) {
    room.data = { horses: HORSES, bets: {}, positions: HORSES.map((h) => ({ id: h.id, x: 0 })), winner: null };
  }

  publicState(room) {
    return {
      horses: room.data.horses,
      bets: room.data.bets,
      positions: room.data.positions,
      winner: room.data.winner,
      endsAt: room.data.endsAt || null
    };
  }

  async onAction(room, user, action, payload) {
    if (action === 'bet') return this.bet(room, user, payload);
    if (action === 'start') return this.start(room, user);
    throw new Error('Accion de carrera no valida.');
  }

  async bet(room, user, payload) {
    if (room.state !== 'Esperando') throw new Error('La carrera ya empezo.');
    const horseId = Number(payload.horseId);
    const amount = Math.max(10, Math.min(1000, Number(payload.amount || 0)));
    if (!HORSES.some((horse) => horse.id === horseId)) throw new Error('Caballo invalido.');
    if (room.data.bets[user.uid]) throw new Error('Ya registraste una apuesta.');
    await this.manager.economy.debit(user.uid, amount, `Apuesta carrera ${room.id}`);
    room.data.bets[user.uid] = { uid: user.uid, name: user.name, horseId, amount };
  }

  async start(room) {
    if (room.players.length < this.minPlayers) throw new Error('Se necesitan al menos 2 jugadores.');
    if (Object.keys(room.data.bets).length < this.minPlayers) throw new Error('Faltan apuestas.');
    if (room.state !== 'Esperando') return;
    room.state = 'En juego';
    const winner = weightedHorse();
    const duration = 15000 + Math.floor(Math.random() * 15000);
    const startedAt = Date.now();
    room.data.winner = null;
    room.data.endsAt = startedAt + duration;
    room.data.serverWinner = winner;

    room.data.timer = setInterval(async () => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      room.data.positions = HORSES.map((horse) => {
        const bias = horse.id === winner ? 0.15 : -0.05 + Math.random() * 0.1;
        return { id: horse.id, x: Math.min(100, Math.max(0, t * 92 + bias * t * 100 + Math.random() * 4)) };
      });
      if (t >= 1) {
        clearInterval(room.data.timer);
        room.data.positions = HORSES.map((horse) => ({ id: horse.id, x: horse.id === winner ? 100 : 80 + Math.random() * 12 }));
        room.data.winner = winner;
        room.state = 'Finalizada';
        await this.payWinners(room, winner);
      }
      this.manager.emitRoom(room);
    }, 500);
  }

  async payWinners(room, winner) {
    const horse = HORSES.find((item) => item.id === winner);
    const multiplier = Math.max(2, Math.round((1 / horse.probability) * 100) / 100);
    for (const bet of Object.values(room.data.bets)) {
      if (bet.horseId === winner) {
        await this.manager.economy.credit(bet.uid, Math.floor(bet.amount * multiplier), `Premio carrera ${room.id}`);
      }
      await this.manager.economy.recordGame(bet.uid, 'horse-race', bet.horseId === winner, bet.amount);
    }
  }
}

module.exports = { HorseRaceGame };
