(function () {
  const ui = {
    aimAngle: 0,
    power: 12,
    spinX: 0,
    spinY: 0,
    aiming: false
  };

  function render(view, room, state) {
    const me = Casino.state.user?.uid;
    const canShoot = state.currentUid === me && !state.moving && room.state === 'En juego';
    view.innerHTML = `
      <div class="row g-3">
        <div class="col-12 col-xl-9">
          <div class="pool-wrap"><canvas id="poolCanvas" width="${state.width}" height="${state.height}"></canvas></div>
        </div>
        <div class="col-12 col-xl-3">
          <div class="panel p-3 h-100">
            <div class="d-flex justify-content-between gap-2 mb-2">
              <span class="small">Turno</span>
              <strong>${room.players.find((p) => p.uid === state.currentUid)?.name || '-'}</strong>
            </div>
            <div class="small mb-3">Marcador: ${room.players.map((p) => `${p.name} ${state.scores[p.uid] || 0}`).join(' / ')}</div>

            <label class="form-label small" for="poolPower">Potencia</label>
            <input class="form-range" type="range" min="2" max="22" step="1" value="${ui.power}" id="poolPower">
            <div class="progress mb-3" style="height:12px;background:#101525">
              <div id="poolPowerFill" class="progress-bar bg-warning" style="width:${(ui.power / 22) * 100}%"></div>
            </div>

            <label class="form-label small" for="poolSpinX">Giro lateral</label>
            <input class="form-range" type="range" min="-1" max="1" step="0.1" value="${ui.spinX}" id="poolSpinX">
            <label class="form-label small" for="poolSpinY">Giro avance/retroceso</label>
            <input class="form-range" type="range" min="-1" max="1" step="0.1" value="${ui.spinY}" id="poolSpinY">
            <div class="mx-auto my-3 position-relative" style="width:92px;height:92px;border-radius:50%;background:#f8f8f8;border:3px solid #222;box-shadow:inset 0 0 18px rgba(0,0,0,.24)">
              <div id="spinDot" style="position:absolute;width:14px;height:14px;border-radius:50%;background:#f72585;left:${39 + ui.spinX * 34}px;top:${39 - ui.spinY * 34}px"></div>
              <div style="position:absolute;left:45px;top:8px;bottom:8px;border-left:1px solid rgba(0,0,0,.22)"></div>
              <div style="position:absolute;left:8px;right:8px;top:45px;border-top:1px solid rgba(0,0,0,.22)"></div>
            </div>

            <div class="d-grid gap-2">
              <button class="btn btn-primary btn-sm" id="poolStart">Iniciar</button>
              <button class="btn btn-warning btn-sm" id="poolShoot">Disparar</button>
            </div>
            <p class="small text-secondary mt-3 mb-0">Arrastra sobre la mesa para apuntar. La linea azul muestra la trayectoria inicial.</p>
          </div>
        </div>
      </div>
    `;

    const canvas = document.getElementById('poolCanvas');
    draw(canvas, state, canShoot);

    poolStart.disabled = room.state !== 'Esperando';
    poolShoot.disabled = !canShoot;
    poolStart.onclick = () => Casino.action('start').catch((e) => Casino.notify(e.message, 'error'));
    poolShoot.onclick = () => shoot(canShoot);

    poolPower.oninput = () => {
      ui.power = Number(poolPower.value);
      poolPowerFill.style.width = `${(ui.power / 22) * 100}%`;
      draw(canvas, state, canShoot);
    };
    poolSpinX.oninput = () => updateSpin(canvas, state, canShoot);
    poolSpinY.oninput = () => updateSpin(canvas, state, canShoot);

    canvas.onpointerdown = (event) => {
      if (!canShoot) return;
      ui.aiming = true;
      updateAim(canvas, state, event);
    };
    canvas.onpointermove = (event) => {
      if (!ui.aiming || !canShoot) return;
      updateAim(canvas, state, event);
    };
    canvas.onpointerup = () => { ui.aiming = false; };
    canvas.onpointerleave = () => { ui.aiming = false; };
  }

  function updateSpin(canvas, state, canShoot) {
    ui.spinX = Number(poolSpinX.value);
    ui.spinY = Number(poolSpinY.value);
    spinDot.style.left = `${39 + ui.spinX * 34}px`;
    spinDot.style.top = `${39 - ui.spinY * 34}px`;
    draw(canvas, state, canShoot);
  }

  function updateAim(canvas, state, event) {
    const cue = state.balls.find((ball) => ball.id === 0);
    const target = point(canvas, event);
    ui.aimAngle = Math.atan2(target.y - cue.y, target.x - cue.x);
    draw(canvas, state, true);
  }

  function shoot(canShoot) {
    if (!canShoot) return;
    Casino.action('shoot', {
      power: ui.power,
      angle: ui.aimAngle,
      spinX: ui.spinX,
      spinY: ui.spinY
    }).catch((e) => Casino.notify(e.message, 'error'));
  }

  function point(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function draw(canvas, state, canShoot) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTable(ctx, canvas);
    if (canShoot) drawGuide(ctx, state);
    drawBalls(ctx, state);
  }

  function drawTable(ctx, canvas) {
    ctx.fillStyle = '#064a38';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b6b50';
    ctx.fillRect(22, 22, canvas.width - 44, canvas.height - 44);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 24;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);
    [[20,20],[450,16],[880,20],[20,440],[450,444],[880,440]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fillStyle = '#020403';
      ctx.fill();
    });
  }

  function drawGuide(ctx, state) {
    const cue = state.balls.find((ball) => ball.id === 0 && !ball.pocketed);
    if (!cue) return;
    const hit = traceGuide(cue, state.balls);
    const backX = cue.x - Math.cos(ui.aimAngle) * (54 + ui.power * 3);
    const backY = cue.y - Math.sin(ui.aimAngle) * (54 + ui.power * 3);

    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(0, 212, 255, .95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(hit.x, hit.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#d8c39b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(backX, backY);
    ctx.lineTo(cue.x - Math.cos(ui.aimAngle) * 18, cue.y - Math.sin(ui.aimAngle) * 18);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 209, 102, .95)';
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function traceGuide(cue, balls) {
    const dx = Math.cos(ui.aimAngle);
    const dy = Math.sin(ui.aimAngle);
    let best = wallHit(cue, dx, dy);
    balls.forEach((ball) => {
      if (ball.id === 0 || ball.pocketed) return;
      const fx = cue.x - ball.x;
      const fy = cue.y - ball.y;
      const b = 2 * (dx * fx + dy * fy);
      const c = fx * fx + fy * fy - 24 * 24;
      const discriminant = b * b - 4 * c;
      if (discriminant < 0) return;
      const t = (-b - Math.sqrt(discriminant)) / 2;
      if (t > 0 && t < best.t) best = { t, x: cue.x + dx * t, y: cue.y + dy * t };
    });
    return best;
  }

  function wallHit(cue, dx, dy) {
    const candidates = [];
    if (dx > 0) candidates.push((888 - cue.x) / dx);
    if (dx < 0) candidates.push((12 - cue.x) / dx);
    if (dy > 0) candidates.push((448 - cue.y) / dy);
    if (dy < 0) candidates.push((12 - cue.y) / dy);
    const t = Math.min(...candidates.filter((value) => value > 0), 420);
    return { t, x: cue.x + dx * t, y: cue.y + dy * t };
  }

  function drawBalls(ctx, state) {
    state.balls.forEach((ball) => {
      if (ball.pocketed) return;
      ctx.beginPath();
      ctx.arc(ball.x + 2, ball.y + 3, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (ball.id === 0) {
        ctx.beginPath();
        ctx.arc(ball.x + ui.spinX * 5, ball.y - ui.spinY * 5, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f72585';
        ctx.fill();
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ball.id, ball.x, ball.y + 3);
      }
    });
  }

  if (typeof window.registerGameRenderer !== 'function') {
    console.error('registerGameRenderer no esta definido');
    return;
  }

  window.registerGameRenderer('pool', render);
})();
