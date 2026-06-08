class BaseGame {
  constructor({ id, name, description, minPlayers, maxPlayers }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.minPlayers = minPlayers;
    this.maxPlayers = maxPlayers;
    this.manager = null;
  }

  publicInfo(rooms) {
    const activeRooms = [...rooms.values()].filter((room) => room.gameId === this.id);
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      players: activeRooms.reduce((sum, room) => sum + room.players.length, 0),
      rooms: activeRooms.length
    };
  }

  onCreateRoom() {}
  onJoin() {}
  onLeave() {}
  publicState(room) { return room.data; }
  async onAction() { throw new Error('Accion no soportada.'); }
}

module.exports = { BaseGame };
