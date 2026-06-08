(function () {
  function render(view, room, state) {
    view.innerHTML = `
      <div class="row g-3">
        <div class="col-12 col-md-8">
          <div class="track"></div>
        </div>
        <div class="col-12 col-md-4">
          <div class="panel p-3">
            <h3 class="h6">Apuesta virtual</h3>
            <select class="form-select form-select-sm mb-2" id="horsePick"></select>
            <input class="form-control form-control-sm mb-2" type="number" id="horseAmount" min="10" max="1000" value="100">
            <div class="d-grid gap-2">
              <button class="btn btn-warning btn-sm" id="horseBetBtn">Apostar</button>
              <button class="btn btn-primary btn-sm" id="horseStartBtn">Iniciar</button>
            </div>
            <hr>
            <h3 class="h6">Apuestas</h3>
            <div id="horseBets" class="small"></div>
          </div>
        </div>
      </div>
    `;
    const track = view.querySelector('.track');
    const positions = new Map((state.positions || []).map((pos) => [pos.id, pos.x]));
    state.horses.forEach((horse) => {
      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.innerHTML = `<span class="small ms-2">${horse.name}</span><div class="horse" style="background:${horse.color};left:calc(${positions.get(horse.id) || 0}% - 17px)">${horse.id}</div>`;
      track.appendChild(lane);
      const option = document.createElement('option');
      option.value = horse.id;
      option.textContent = `${horse.name} (${Math.round(horse.probability * 100)}%)`;
      horsePick.appendChild(option);
    });
    horseBets.innerHTML = Object.values(state.bets || {}).map((bet) => `${bet.name}: ${bet.amount} al #${bet.horseId}`).join('<br>') || 'Sin apuestas.';
    if (state.winner) horseBets.innerHTML += `<div class="text-warning fw-bold mt-2">Ganador: caballo #${state.winner}</div>`;
    horseBetBtn.disabled = room.state !== 'Esperando';
    horseStartBtn.disabled = room.state !== 'Esperando';
    horseBetBtn.onclick = () => Casino.action('bet', { horseId: horsePick.value, amount: horseAmount.value }).catch((e) => Casino.notify(e.message, 'error'));
    horseStartBtn.onclick = () => Casino.action('start').catch((e) => Casino.notify(e.message, 'error'));
  }

  if (typeof window.registerGameRenderer !== 'function') {
    console.error('registerGameRenderer no esta definido');
    return;
  }

  window.registerGameRenderer('horse-race', render);
})();
