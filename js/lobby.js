(function () {
  function gameArtLabel(gameId) {
    return {
      'horse-race': 'Carrera',
      blackjack: '21',
      pool: 'Pool',
      slots: '777'
    }[gameId] || 'Juego';
  }

  window.CasinoLobby = {
    renderGames() {
      const grid = document.getElementById('gamesGrid');
      const select = document.getElementById('createGameSelect');
      const template = document.getElementById('gameCardTemplate');
      grid.innerHTML = '';
      select.innerHTML = '';

      Casino.state.games.forEach((game) => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.name;
        select.appendChild(option);

        const node = template.content.cloneNode(true);
        node.querySelector('h3').textContent = game.name;
        node.querySelector('p').textContent = game.description;
        node.querySelector('.players').textContent = `${game.players} online`;
        const art = node.querySelector('.game-art');
        art.classList.add(game.id);
        art.textContent = gameArtLabel(game.id);
        const btn = node.querySelector('.play-btn');
        btn.addEventListener('click', async () => {
          try {
            if (game.id === 'slots') {
              await Casino.socket.emit('room:leave', {}, () => {});
              await new Promise((resolve, reject) => {
                Casino.socket.emit('room:create', { gameId: 'slots', name: 'Slots Solo' }, (reply) => {
                  if (reply?.ok) resolve(reply);
                  else reject(new Error(reply?.error || 'No se pudo abrir slots.'));
                });
              });
            } else {
              await new Promise((resolve, reject) => {
                Casino.socket.emit('room:create', { gameId: game.id, name: `${game.name} ${Date.now().toString().slice(-4)}` }, (reply) => {
                  if (reply?.ok) resolve(reply);
                  else reject(new Error(reply?.error || 'No se pudo crear sala.'));
                });
              });
            }
          } catch (error) { Casino.notify(error.message, 'error'); }
        });
        grid.appendChild(node);
      });
    },

    renderRooms() {
      const list = document.getElementById('roomsList');
      list.innerHTML = '';
      if (!Casino.state.rooms.length) {
        list.innerHTML = '<p class="small text-secondary m-0">No hay salas activas.</p>';
        return;
      }
      Casino.state.rooms.forEach((room) => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
          <div class="d-flex justify-content-between gap-2">
            <strong>${room.name}</strong>
            <span class="badge text-bg-secondary">${room.state}</span>
          </div>
          <div class="small text-secondary">${room.id}</div>
          <div class="small">${room.players.length}/${room.maxPlayers} jugadores</div>
          <button class="btn btn-outline-info btn-sm mt-2">Unirse</button>
        `;
        item.querySelector('button').addEventListener('click', () => {
          Casino.socket.emit('room:join', { roomId: room.id }, (reply) => {
            if (!reply?.ok) Casino.notify(reply?.error || 'No se pudo unir.', 'error');
          });
        });
        list.appendChild(item);
      });
    },

    renderRoom() {
      const room = Casino.state.room;
      const view = document.getElementById('gameView');
      if (!room) {
        roomTitle.textContent = 'Sin sala activa';
        roomMeta.textContent = 'Crea o unete a una sala para jugar.';
        view.className = 'game-view empty-state';
        view.textContent = 'Selecciona un juego para comenzar.';
        return;
      }
      view.className = 'game-view';
      roomTitle.textContent = room.name;
      roomMeta.textContent = `${room.id} · ${room.state} · ${room.players.length}/${room.maxPlayers}`;
      const renderer = window.getGameRenderer?.(room.gameId);
      if (renderer) renderer(view, room, Casino.state.gameState);
      else view.textContent = 'Renderizador no disponible.';
    },

    renderLeaderboard(rows) {
      const list = document.getElementById('leaderboard');
      list.innerHTML = '';
      rows.forEach((row) => {
        const item = document.createElement('li');
        item.innerHTML = `<span>${row.name}</span> <strong>${row.credits}</strong>`;
        list.appendChild(item);
      });
    },

    renderChat(targetId, items) {
      const box = document.getElementById(targetId);
      box.innerHTML = '';
      items.forEach((item) => {
        const line = document.createElement('div');
        line.className = 'chat-msg';
        line.innerHTML = `<strong>${item.name}:</strong> ${item.message}`;
        box.appendChild(line);
      });
      box.scrollTop = box.scrollHeight;
      if (targetId === 'roomChat') Casino.beep(520);
    }
  };
})();
