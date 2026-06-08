const { BaseGame } = require('./base-game');

const SYMBOLS = ['7', 'BAR', '★', '♣', '♦', '♥', '♠', '☀', '☾', '⚡'];
const PAYTABLE = {
  '7|7|7': 25,
  'BAR|BAR|BAR': 15,
  '★|★|★': 10,
  anyPair: 2
};

class SlotsGame extends BaseGame {
  constructor() {
    super({
      id: 'slots',
      name: 'Tragamonedas',
      description: 'Tres rodillos, diez simbolos y premios calculados exclusivamente en servidor.',
      minPlayers: 1,
      maxPlayers: 1
    });
  }

  onCreateRoom(room) {
    room.data = { symbols: SYMBOLS, paytable: PAYTABLE, lastSpin: null };
  }

  async onAction(room, user, action, payload) {
    if (action !== 'spin') throw new Error('Accion de slots no valida.');
    const amount = Math.max(10, Math.min(500, Number(payload.amount || 50)));
    await this.manager.economy.debit(user.uid, amount, `Giro slots ${room.id}`);
    const result = [this.pick(), this.pick(), this.pick()];
    const multiplier = this.multiplier(result);
    const payout = amount * multiplier;
    if (payout) await this.manager.economy.credit(user.uid, payout, `Premio slots ${room.id}`);
    await this.manager.economy.recordGame(user.uid, 'slots', payout > amount, amount);
    room.data.lastSpin = { uid: user.uid, result, amount, payout, at: Date.now() };
    room.state = 'Finalizada';
  }

  pick() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }

  multiplier(result) {
    const key = result.join('|');
    if (PAYTABLE[key]) return PAYTABLE[key];
    if (new Set(result).size === 2) return PAYTABLE.anyPair;
    return 0;
  }
}

module.exports = { SlotsGame, SYMBOLS, PAYTABLE };
