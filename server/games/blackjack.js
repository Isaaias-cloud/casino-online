const { BaseGame } = require('./base-game');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function newDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function score(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') { total += 11; aces++; }
    else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}

class BlackjackGame extends BaseGame {
  constructor() {
    super({
      id: 'blackjack',
      name: 'Blackjack 21',
      description: 'Mesa de 21 con dealer automatico, turnos sincronizados y pagos 3:2.',
      minPlayers: 1,
      maxPlayers: 4
    });
  }

  onCreateRoom(room) {
    room.data = { bets: {}, hands: {}, dealer: [], deck: [], current: 0, finished: false, results: {} };
  }

  publicState(room) {
    const hideHole = room.state === 'En juego';
    return {
      bets: room.data.bets,
      hands: room.data.hands,
      dealer: hideHole ? [room.data.dealer[0]].filter(Boolean) : room.data.dealer,
      dealerScore: hideHole ? null : score(room.data.dealer),
      currentUid: room.players[room.data.current]?.uid || null,
      finished: room.data.finished,
      results: room.data.results
    };
  }

  async onAction(room, user, action, payload) {
    if (action === 'bet') return this.bet(room, user, payload);
    if (action === 'start') return this.start(room);
    if (action === 'hit') return this.hit(room, user);
    if (action === 'stand') return this.stand(room, user);
    throw new Error('Accion de blackjack no valida.');
  }

  async bet(room, user, payload) {
    if (room.state !== 'Esperando') throw new Error('La mano ya empezo.');
    const amount = Math.max(10, Math.min(1000, Number(payload.amount || 100)));
    if (room.data.bets[user.uid]) throw new Error('Ya apostaste.');
    await this.manager.economy.debit(user.uid, amount, `Apuesta blackjack ${room.id}`);
    room.data.bets[user.uid] = { amount, name: user.name };
  }

  async start(room) {
    if (room.players.length < 1) throw new Error('No hay jugadores.');
    for (const player of room.players) if (!room.data.bets[player.uid]) throw new Error('Todos deben apostar.');
    room.state = 'En juego';
    room.data.deck = newDeck();
    room.data.dealer = [room.data.deck.pop(), room.data.deck.pop()];
    room.data.hands = {};
    room.data.results = {};
    room.data.current = 0;
    room.data.finished = false;
    for (const player of room.players) room.data.hands[player.uid] = [room.data.deck.pop(), room.data.deck.pop()];
    await this.skipBustedOrBlackjack(room);
  }

  async hit(room, user) {
    this.assertTurn(room, user);
    room.data.hands[user.uid].push(room.data.deck.pop());
    if (score(room.data.hands[user.uid]) >= 21) await this.nextTurn(room);
  }

  async stand(room, user) {
    this.assertTurn(room, user);
    await this.nextTurn(room);
  }

  assertTurn(room, user) {
    if (room.state !== 'En juego') throw new Error('La mano no esta activa.');
    if (room.players[room.data.current]?.uid !== user.uid) throw new Error('No es tu turno.');
  }

  async skipBustedOrBlackjack(room) {
    while (room.players[room.data.current] && score(room.data.hands[room.players[room.data.current].uid]) === 21) {
      room.data.current++;
    }
    if (!room.players[room.data.current]) await this.finish(room);
  }

  async nextTurn(room) {
    room.data.current++;
    if (room.data.current >= room.players.length) return this.finish(room);
    return this.skipBustedOrBlackjack(room);
  }

  async finish(room) {
    while (score(room.data.dealer) < 17) room.data.dealer.push(room.data.deck.pop());
    const dealerScore = score(room.data.dealer);
    for (const player of room.players) {
      const playerScore = score(room.data.hands[player.uid]);
      const bet = room.data.bets[player.uid].amount;
      let result = 'lose';
      let payout = 0;
      const blackjack = room.data.hands[player.uid].length === 2 && playerScore === 21;
      if (playerScore <= 21 && (dealerScore > 21 || playerScore > dealerScore)) {
        result = blackjack ? 'blackjack' : 'win';
        payout = blackjack ? Math.floor(bet * 2.5) : bet * 2;
      } else if (playerScore <= 21 && playerScore === dealerScore) {
        result = 'push';
        payout = bet;
      }
      if (payout) await this.manager.economy.credit(player.uid, payout, `Resultado blackjack ${room.id}`);
      await this.manager.economy.recordGame(player.uid, 'blackjack', result === 'win' || result === 'blackjack', bet);
      room.data.results[player.uid] = { result, playerScore, dealerScore, payout };
    }
    room.data.finished = true;
    room.state = 'Finalizada';
  }
}

module.exports = { BlackjackGame, score };
