(function () {
  const socket = io();
  const state = {
    user: null,
    games: [],
    rooms: [],
    room: null,
    gameState: null,
    sound: true,
    volume: 0.35
  };

  window.Casino = {
    socket,
    state,
    action(action, data = {}) {
      return emitWithAck('game:action', { action, data });
    },
    notify(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `alert alert-${type === 'error' ? 'danger' : 'info'} position-fixed bottom-0 end-0 m-3 shadow`;
      toast.style.zIndex = 3000;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2800);
    },
    beep(freq = 660) {
      if (!state.sound) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = state.volume * 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 110);
    }
  };

  function emitWithAck(event, payload) {
    return new Promise((resolve, reject) => {
      socket.emit(event, payload, (reply) => {
        if (reply?.ok) resolve(reply);
        else reject(new Error(reply?.error || 'Error de servidor.'));
      });
    });
  }

  async function login(payload) {
    const reply = await emitWithAck('auth:login', payload);
    state.user = reply.user;
    renderProfile();
    Casino.notify(`Bienvenido, ${reply.user.name}`);
  }

  function renderProfile() {
    if (!state.user) return;
    document.getElementById('creditBadge').textContent = `${state.user.credits} creditos`;
    document.getElementById('profileName').textContent = state.user.name;
    document.getElementById('accountType').textContent = state.user.registered ? 'Registrado' : 'Invitado';
    document.getElementById('statGames').textContent = state.user.stats?.games || 0;
    document.getElementById('statWins').textContent = state.user.stats?.wins || 0;
    document.getElementById('statLosses').textContent = state.user.stats?.losses || 0;
  }

  function bindUi() {
    document.getElementById('guestBtn').addEventListener('click', async () => {
      const name = document.getElementById('displayName').value;
      await login(CasinoAuth.guestPayload(name));
    });

    document.getElementById('registerBtn').addEventListener('click', async () => {
      try {
        const payload = CasinoAuth.hasFirebaseConfig
          ? await CasinoAuth.register(email.value, password.value, displayName.value)
          : CasinoAuth.devRegisteredPayload(displayName.value);
        await login(payload);
      } catch (error) { Casino.notify(error.message, 'error'); }
    });

    document.getElementById('loginBtn').addEventListener('click', async () => {
      try {
        const payload = CasinoAuth.hasFirebaseConfig
          ? await CasinoAuth.login(email.value, password.value, displayName.value)
          : CasinoAuth.devRegisteredPayload(displayName.value);
        await login(payload);
      } catch (error) { Casino.notify(error.message, 'error'); }
    });

    document.getElementById('createRoomBtn').addEventListener('click', async () => {
      try {
        await emitWithAck('room:create', {
          gameId: createGameSelect.value,
          name: roomName.value
        });
      } catch (error) { Casino.notify(error.message, 'error'); }
    });

    document.getElementById('joinRoomBtn').addEventListener('click', async () => {
      try { await emitWithAck('room:join', { roomId: joinRoomId.value }); }
      catch (error) { Casino.notify(error.message, 'error'); }
    });

    document.getElementById('leaveRoomBtn').addEventListener('click', () => socket.emit('room:leave', {}, () => {
      state.room = null;
      state.gameState = null;
      window.CasinoLobby.renderRoom();
    }));

    document.getElementById('globalChatForm').addEventListener('submit', (event) => {
      event.preventDefault();
      socket.emit('chat:global:send', { message: globalChatInput.value });
      globalChatInput.value = '';
    });

    document.getElementById('roomChatForm').addEventListener('submit', (event) => {
      event.preventDefault();
      socket.emit('chat:room:send', { message: roomChatInput.value });
      roomChatInput.value = '';
    });

    document.getElementById('soundToggle').addEventListener('click', () => {
      state.sound = !state.sound;
      soundToggle.textContent = state.sound ? 'Sonido' : 'Mute';
    });
    document.getElementById('volumeRange').addEventListener('input', (event) => {
      state.volume = Number(event.target.value);
    });
  }

  socket.on('connect', () => {
    if (!state.user) login(CasinoAuth.guestPayload(localStorage.getItem('casino-name') || 'Invitado Neon')).catch(console.error);
  });
  socket.on('user:profile', (user) => { state.user = user; renderProfile(); });
  socket.on('games:list', (games) => { state.games = games; window.CasinoLobby.renderGames(); });
  socket.on('rooms:list', (rooms) => { state.rooms = rooms; window.CasinoLobby.renderRooms(); });
  socket.on('room:state', ({ room, gameState }) => {
    state.room = room;
    state.gameState = gameState;
    window.CasinoLobby.renderRoom();
  });
  socket.on('leaderboard:update', (rows) => window.CasinoLobby.renderLeaderboard(rows));
  socket.on('chat:global', (items) => window.CasinoLobby.renderChat('globalChat', items));
  socket.on('chat:room', (items) => window.CasinoLobby.renderChat('roomChat', items));

  window.addEventListener('load', () => {
    bindUi();
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 350);
  });
})();
