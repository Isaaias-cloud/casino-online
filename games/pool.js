(function () {
  let dragStart = null;

  function render(view, room, state) {
    const me = Casino.state.user?.uid;
    view.innerHTML = `
      <div class="row g-3">
        <div class="col-12">
          <div class="pool-wrap"><canvas id="poolCanvas" width="${state.width}" height="${state.height}"></canvas></div>
        </div>
        <div class="col-12 d-flex flex-wrap justify-content-between gap-2">
          <div class="small">Turno: <strong>${room.players.find((p) => p.uid === state.currentUid)?.name || '-'}</strong></div>
          <div class="small">Marcador: ${room.players.map((p) => `${p.name} ${state.scores[p.uid] || 0}`).join(' · ')}</div>
          <button class="btn btn-primary btn-sm" id="poolStart">Iniciar</button>
        </div>
      </div>
    `;
    const canvas = document.getElementById('poolCanvas');
    draw(canvas, state);
    poolStart.disabled = room.state !== 'Esperando';
    poolStart.onclick = () => Casino.action('start').catch((e) => Casino.notify(e.message, 'error'));

    canvas.onpointerdown = (event) => {
      if (state.currentUid !== me || state.moving || room.state !== 'En juego') return;
      dragStart = point(canvas, event);
    };
    canvas.onpointerup = (event) => {
      if (!dragStart) return;
      const end = point(canvas, event);
      const dx = dragStart.x - end.x;
      const dy = dragStart.y - end.y;
      const power = Math.min(24, Math.hypot(dx, dy) / 8);
      const angle = Math.atan2(dy, dx);
      dragStart = null;
      Casino.action('shoot', { power, angle }).catch((e) => Casino.notify(e.message, 'error'));
    };
  }

  function point(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function draw(canvas, state) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b6b50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 18;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    [[20,20],[450,16],[880,20],[20,440],[450,444],[880,440]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fillStyle = '#020403'; ctx.fill();
    });
    state.balls.forEach((ball) => {
      if (ball.pocketed) return;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ball.id === 0 ? '#111' : '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ball.id || '', ball.x, ball.y + 3);
    });
  }

  if (typeof window.registerGameRenderer !== 'function') {
    console.error('registerGameRenderer no esta definido');
    return;
  }

  window.registerGameRenderer('pool', render);
})();
