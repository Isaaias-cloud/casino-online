(function () {
  const symbols = ['7', 'BAR', '★', '♣', '♦', '♥', '♠', '☀', '☾', '⚡'];

  function render(view, room, state) {
    const last = state.lastSpin;
    view.innerHTML = `
      <div class="text-center py-3">
        <div class="slot-reels mb-3">
          <div class="slot-reel">${last?.result?.[0] || '7'}</div>
          <div class="slot-reel">${last?.result?.[1] || 'BAR'}</div>
          <div class="slot-reel">${last?.result?.[2] || '★'}</div>
        </div>
        <div class="mx-auto" style="max-width:320px">
          <input class="form-control mb-2 text-center" type="number" min="10" max="500" value="50" id="slotAmount">
          <button class="btn btn-warning w-100" id="slotSpin">Girar</button>
        </div>
        <p class="mt-3">${last ? `Apuesta ${last.amount}, premio ${last.payout}` : 'Resultado calculado por servidor.'}</p>
      </div>
    `;
    slotSpin.onclick = async () => {
      const reels = view.querySelectorAll('.slot-reel');
      reels.forEach((reel) => reel.classList.add('spin'));
      const animation = setInterval(() => {
        reels.forEach((reel) => { reel.textContent = symbols[Math.floor(Math.random() * symbols.length)]; });
      }, 90);
      try {
        const reply = await new Promise((resolve, reject) => {
          Casino.socket.emit('slots:spin', { amount: slotAmount.value }, (res) => res?.ok ? resolve(res) : reject(new Error(res?.error || 'Error de giro.')));
        });
        setTimeout(() => {
          clearInterval(animation);
          reels.forEach((reel, i) => {
            reel.classList.remove('spin');
            reel.textContent = reply.state.result[i];
          });
          Casino.notify(`Premio: ${reply.state.payout} creditos`);
        }, 900);
      } catch (error) {
        clearInterval(animation);
        reels.forEach((reel) => reel.classList.remove('spin'));
        Casino.notify(error.message, 'error');
      }
    };
  }

  if (typeof window.registerGameRenderer !== 'function') {
    console.error('registerGameRenderer no esta definido');
    return;
  }

  window.registerGameRenderer('slots', render);
})();
