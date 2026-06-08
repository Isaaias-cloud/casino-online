const crypto = require('crypto');

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

class GameManager {
  constructor({ io, economy, store }) {
    this.io = io;
    this.economy = economy;
    this.store = store;
    this.games = new Map();
    this.rooms = new Map();
  }

  registerGame(game) {
    this.games.set(game.id, game);
    game.manager = this;
  }

  listGames() {
    return [...this.games.values()].map((game) => game.publicInfo(this.rooms));
  }

  listRooms() {
    return [...this.rooms.values()].map((room) => this.publicRoom(room));
  }

  publicRoom(room) {
    return {
      id: room.id,
      gameId: room.gameId,
      name: room.name,
      state: room.state,
      players: room.players.map((player) => ({ uid: player.uid, name: player.name })),
      maxPlayers: room.maxPlayers,
      minPlayers: room.minPlayers,
      createdAt: room.createdAt
    };
  }

  createRoom({ gameId, name, owner }) {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Juego no disponible.');
    const room = {
      id: makeId('room'),
      gameId,
      name: String(name || `${game.name} VIP`).slice(0, 40),
      state: 'Esperando',
      ownerUid: owner.uid,
      players: [],
      sockets: new Map(),
      chat: [],
      maxPlayers: game.maxPlayers,
      minPlayers: game.minPlayers,
      data: {},
      createdAt: Date.now()
    };
    this.rooms.set(room.id, room);
    game.onCreateRoom(room);
    return room;
  }

  joinRoom(roomId, socket, user) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Sala no encontrada.');
    const game = this.games.get(room.gameId);
    if (room.state === 'Finalizada') throw new Error('La sala ya finalizo.');
    if (!room.players.some((player) => player.uid === user.uid)) {
      if (room.players.length >= room.maxPlayers) throw new Error('La sala esta llena.');
      room.players.push({ uid: user.uid, name: user.name });
    }
    room.sockets.set(socket.id, user.uid);
    socket.join(room.id);
    socket.data.roomId = room.id;
    game.onJoin(room, user);
    this.emitRoom(room);
    return room;
  }

  leaveRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    const uid = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);
    socket.leave(room.id);
    const stillConnected = [...room.sockets.values()].includes(uid);
    if (!stillConnected) room.players = room.players.filter((player) => player.uid !== uid);
    socket.data.roomId = null;
    const game = this.games.get(room.gameId);
    game.onLeave(room, uid);
    if (!room.players.length && room.state !== 'En juego') this.rooms.delete(room.id);
    else this.emitRoom(room);
  }

  async handleAction(socket, action, payload = {}) {
    const room = this.rooms.get(socket.data.roomId);
    if (!room) throw new Error('No estas en una sala.');
    const game = this.games.get(room.gameId);
    await game.onAction(room, socket.data.user, action, payload);
    this.emitRoom(room);
  }

  emitRoom(room) {
    const game = this.games.get(room.gameId);
    this.io.to(room.id).emit('room:state', {
      room: this.publicRoom(room),
      gameState: game.publicState(room)
    });
    this.io.emit('rooms:list', this.listRooms());
    this.io.emit('games:list', this.listGames());
  }

  pushRoomChat(room, user, message) {
    const clean = String(message || '').replace(/[<>]/g, '').trim().slice(0, 240);
    if (!clean) return;
    const item = { id: makeId('msg'), uid: user.uid, name: user.name, message: clean, at: Date.now() };
    room.chat.push(item);
    room.chat = room.chat.slice(-30);
    this.io.to(room.id).emit('chat:room', room.chat);
  }
}

module.exports = { GameManager, makeId };
