(function () {
  function cardText(card) {
    return card ? `${card.rank}${card.suit}` : '??';
  }

  function handHtml(cards) {
    return `<div class="card-hand">${(cards || []).map((card) => `<div class="playing-card">${cardText(card)}</div>`).join('')}</div>`;
  }

  function render(view, room, state) {
    const me = Casino.state.user?.uid;
    const current = state.currentUid;
    view.innerHTML = `
      <div class="row g-3">
        <div class="col-12 col-md-8">
          <div class="panel p-3 mb-3">
            <h3 class="h6">Dealer ${state.dealerScore ? `(${state.dealerScore})` : ''}</h3>
            ${handHtml(state.dealer)}
          </div>
          <div id="blackjackPlayers"></div>
        </div>
        <div class="col-12 col-md-4">
          <div class="panel p-3">
            <h3 class="h6">Mesa</h3>
            <input class="form-control form-control-sm mb-2" type="number" id="bjAmount" min="10" max="1000" value="100">
            <div class="d-grid gap-2">
              <button class="btn btn-warning btn-sm" id="bjBet">Apostar</button>
              <button class="btn btn-primary btn-sm" id="bjStart">Repartir</button>
              <button class="btn btn-info btn-sm" id="bjHit">Pedir carta</button>
              <button class="btn btn-outline-light btn-sm" id="bjStand">Plantarse</button>
            </div>
            <p class="small text-secondary mt-2 mb-0">Turno: ${room.players.find((p) => p.uid === current)?.name || '-'}</p>
          </div>
        </div>
      </div>
    `;
    blackjackPlayers.innerHTML = room.players.map((player) => {
      const result = state.results?.[player.uid];
      return `
        <div class="panel p-3 mb-2 ${player.uid === current ? 'border-warning' : ''}">
          <div class="d-flex justify-content-between">
            <strong>${player.name}</strong>
            <span>${result ? `${result.result} · paga ${result.payout}` : ''}</span>
          </div>
          ${handHtml(state.hands?.[player.uid] || [])}
        </div>
      `;
    }).join('');
    bjBet.disabled = room.state !== 'Esperando' || Boolean(state.bets?.[me]);
    bjStart.disabled = room.state !== 'Esperando';
    bjHit.disabled = room.state !== 'En juego' || current !== me;
    bjStand.disabled = bjHit.disabled;
    bjBet.onclick = () => Casino.action('bet', { amount: bjAmount.value }).catch((e) => Casino.notify(e.message, 'error'));
    bjStart.onclick = () => Casino.action('start').catch((e) => Casino.notify(e.message, 'error'));
    bjHit.onclick = () => Casino.action('hit').catch((e) => Casino.notify(e.message, 'error'));
    bjStand.onclick = () => Casino.action('stand').catch((e) => Casino.notify(e.message, 'error'));
  }

  if (typeof window.registerGameRenderer !== 'function') {
    console.error('registerGameRenderer no esta definido');
    return;
  }

  window.registerGameRenderer('blackjack', render);
})();
