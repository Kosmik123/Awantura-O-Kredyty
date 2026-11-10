(() => {
  const BID_STEP = 100;
  const HOLD_MS = 450;

  const PALETTE = [
    '#0062b3', '#0ba627', '#ffc400', '#c90000', '#6109e4',
    '#ff6200', '#00ffea', '#f3528a', '#9bee0b', '#509cff',
  ];

  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const teamCountInput = document.getElementById('team-count');
  const startingCapitalInput = document.getElementById('starting-capital');
  const anteInput = document.getElementById('ante');
  const teamNamesList = document.getElementById('team-names-list');
  const startBtn = document.getElementById('start-btn');
  const newGameBtn = document.getElementById('new-game-btn');
  const helpBtn = document.getElementById('help-btn');
  const helpPanel = document.getElementById('help-panel');
  const poolAmountEl = document.getElementById('pool-amount');
  const contributionsRow = document.getElementById('contributions-row');
  const teamsRow = document.getElementById('teams-row');
  const actionBtn = document.getElementById('action-btn');
  const penaltyBtn = document.getElementById('penalty-btn');
  const penaltyPanel = document.getElementById('penalty-panel');
  const penaltyTeamEl = document.getElementById('penalty-team');
  const penaltyAmountInput = document.getElementById('penalty-amount');
  const penaltyApplyBtn = document.getElementById('penalty-apply');
  const penaltyCancelBtn = document.getElementById('penalty-cancel');

  /** @type {{teams: {name:string, color:string, capital:number, eliminated:boolean}[], ante:number, phase: 'waiting'|'bidding'|'answering', pool:number, contributions:number[], leaderIdx: number|null, answeringTeamId: number|null}} */
  let state = null;
  // Wkłady z poprzedniego renderu: drużyna, której wkład wzrósł, dostaje animację bounce.
  let lastContributions = null;
  // Tryb kary: klawisz K albo przycisk. W tym trybie klawisz/klik drużyny ją wybiera zamiast licytować.
  const penalty = { active: false, teamIdx: null };

  function keyLabelForIndex(i) {
    return i === 9 ? '0' : String(i + 1);
  }

  function keyToTeamIndex(key) {
    if (key === '0') return 9;
    if (key >= '1' && key <= '9') return key.charCodeAt(0) - '1'.charCodeAt(0);
    return -1;
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('pl-PL');
  }

  // ---------- Setup screen ----------

  function renderTeamNameInputs() {
    const count = clampTeamCount(Number(teamCountInput.value));
    teamCountInput.value = count;
    teamNamesList.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'team-name-row';

      const dot = document.createElement('div');
      dot.className = 'team-color-dot';
      dot.style.background = PALETTE[i];

      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 24;
      input.placeholder = `Drużyna ${i + 1}`;
      input.id = `team-name-${i}`;

      row.appendChild(dot);
      row.appendChild(input);
      teamNamesList.appendChild(row);
    }
  }

  function clampTeamCount(n) {
    if (!Number.isFinite(n)) return 3;
    return Math.min(10, Math.max(1, Math.round(n)));
  }

  teamCountInput.addEventListener('input', renderTeamNameInputs);

  startBtn.addEventListener('click', () => {
    const count = clampTeamCount(Number(teamCountInput.value));
    const capital = Math.max(0, Number(startingCapitalInput.value) || 0);
    const ante = Math.max(0, Number(anteInput.value) || 0);
    const teams = [];
    for (let i = 0; i < count; i++) {
      const input = document.getElementById(`team-name-${i}`);
      const name = (input && input.value.trim()) || `Drużyna ${i + 1}`;
      teams.push({ name, color: PALETTE[i], capital, eliminated: false });
    }

    lastContributions = null;
    state = {
      teams,
      ante,
      phase: 'waiting',
      pool: 0,
      contributions: teams.map(() => 0),
      leaderIdx: null,
      answeringTeamId: null,
    };

    enterWaitingRound();
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    render();
  });

  newGameBtn.addEventListener('click', () => {
    closePenalty();
    pressed.forEach((r) => clearTimeout(r.timer));
    pressed.clear();
    state = null;
    gameScreen.classList.add('hidden');
    helpPanel.classList.add('hidden');
    setupScreen.classList.remove('hidden');
  });

  helpBtn.addEventListener('click', () => {
    helpPanel.classList.toggle('hidden');
  });

  // ---------- Game logic ----------

  function maxOtherContribution(idx) {
    return Math.max(0, ...state.contributions.filter((_, i) => i !== idx));
  }

  // Wkład drużyny staje się o `amount` większy od najwyższego wkładu w puli, także jej własnego
  // (drużyna może przebijać samą siebie). Nic się nie dzieje, jeśli nie stać jej na przebicie.
  function bid(idx, amount) {
    if (state.phase !== 'bidding') return;
    const team = state.teams[idx];
    const target = Math.max(state.contributions[idx], maxOtherContribution(idx)) + amount;
    const needed = target - state.contributions[idx];
    if (needed > team.capital) return;
    team.capital -= needed;
    state.pool += needed;
    state.contributions[idx] = target;
    state.leaderIdx = idx;
    bumpPool();
    render();
  }

  // Va bank: cały kapitał do puli i natychmiastowy koniec licytacji, odpowiada ta drużyna.
  // Niedozwolony, gdy po wrzuceniu całego kapitału wkład drużyny nie byłby wyższy
  // od najwyższego wkładu innej drużyny.
  function vaBanque(idx) {
    if (state.phase !== 'bidding') return;
    const team = state.teams[idx];
    const actual = team.capital;
    if (actual <= 0) return;
    if (state.contributions[idx] + actual <= maxOtherContribution(idx)) return;
    team.capital = 0;
    state.pool += actual;
    state.contributions[idx] += actual;
    state.leaderIdx = idx;
    bumpPool();
    endBidding();
  }

  function endBidding() {
    if (state.leaderIdx === null) return; // nobody bid yet
    state.answeringTeamId = state.leaderIdx;
    state.phase = 'answering';
    render();
  }

  function awardPoolToTeam(idx) {
    state.teams[idx].capital += state.pool;
    state.pool = 0;
    enterWaitingRound();
  }

  // Drużyna, która nie ma co najmniej wpisowego + BID_STEP, nie jest w stanie
  // wziąć udziału w licytacji nawet po wpłaceniu wpisowego, więc przegrywa (na stałe).
  function eliminateBrokeTeams() {
    state.teams.forEach((team) => {
      if (team.capital < state.ante + BID_STEP) team.eliminated = true;
    });
  }

  // Wpisowe: po naciśnięciu spacji na początku rundy każda drużyna, która jeszcze gra,
  // wpłaca do puli tyle samo. Wpisowe jest częścią wkładu drużyny (`contributions`).
  function collectAnte() {
    state.teams.forEach((team, i) => {
      if (team.eliminated) return;
      team.capital -= state.ante;
      state.pool += state.ante;
      state.contributions[i] += state.ante;
    });
  }

  // Nowa runda czeka na spację, która pobierze wpisowe i otworzy licytację.
  function enterWaitingRound() {
    state.phase = 'waiting';
    state.answeringTeamId = null;
    state.contributions = state.teams.map(() => 0);
    state.leaderIdx = null;
    eliminateBrokeTeams();
    render();
  }

  function startBidding() {
    collectAnte();
    state.phase = 'bidding';
    bumpPool();
    render();
  }

  function handleSpace() {
    if (!state || penalty.active) return;
    if (state.phase === 'waiting') {
      startBidding();
    } else if (state.phase === 'bidding') {
      endBidding();
    } else if (state.phase === 'answering') {
      // zła odpowiedź: ta sama spacja otwiera kolejną rundę i pobiera wpisowe
      enterWaitingRound();
      startBidding();
    }
  }

  function bumpPool() {
    poolAmountEl.classList.remove('bump');
    // restart animation
    void poolAmountEl.offsetWidth;
    poolAmountEl.classList.add('bump');
  }

  // ---------- Kara ----------

  function openPenalty() {
    if (!state) return;
    // przerwij wciśnięte właśnie klawisze/przyciski drużyn, żeby nie odpaliły va banku
    pressed.forEach((r) => clearTimeout(r.timer));
    pressed.clear();
    penalty.active = true;
    penalty.teamIdx = null;
    penaltyPanel.classList.remove('hidden');
    render();
  }

  function closePenalty() {
    penalty.active = false;
    penalty.teamIdx = null;
    penaltyPanel.classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    render();
  }

  function togglePenalty() {
    if (penalty.active) closePenalty();
    else openPenalty();
  }

  function selectPenaltyTeam(idx) {
    penalty.teamIdx = idx;
    penaltyAmountInput.focus();
    penaltyAmountInput.select();
    render();
  }

  function penaltyAmount() {
    return Math.floor(Number(penaltyAmountInput.value));
  }

  function canApplyPenalty() {
    return penalty.active && penalty.teamIdx !== null && penaltyAmount() > 0;
  }

  // Kara zabiera pieniądze z konta drużyny (nie więcej, niż drużyna ma); pieniądze znikają z gry.
  function applyPenalty() {
    if (!canApplyPenalty()) return;
    const team = state.teams[penalty.teamIdx];
    team.capital -= Math.min(penaltyAmount(), team.capital);
    closePenalty();
  }

  penaltyBtn.addEventListener('click', togglePenalty);
  penaltyCancelBtn.addEventListener('click', closePenalty);
  penaltyApplyBtn.addEventListener('click', applyPenalty);
  penaltyAmountInput.addEventListener('input', updatePenaltyUi);

  function updatePenaltyUi() {
    if (!state) return;
    const selected = penalty.teamIdx === null ? null : state.teams[penalty.teamIdx];
    penaltyTeamEl.textContent = selected ? selected.name : 'Nie wybrano drużyny';
    penaltyTeamEl.style.borderColor = selected ? selected.color : '';
    penaltyApplyBtn.disabled = !canApplyPenalty();
  }

  // ---------- Input handling (klawiatura i mysz) ----------

  // Per key / pointer: records the game phase at the moment it was pressed,
  // so release acts on that decision even if the phase changed in between
  // (e.g. awarding the pool on press immediately starts a new round).
  const pressed = new Map();

  function pressTeam(inputId, idx) {
    if (!state || idx < 0 || idx >= state.teams.length) return;
    if (state.teams[idx].eliminated) return;
    if (penalty.active) {
      selectPenaltyTeam(idx);
      return;
    }
    if (pressed.has(inputId)) return;

    const record = { idx, phase: state.phase, vaBanque: false, timer: null };
    pressed.set(inputId, record);

    if (record.phase === 'answering') {
      if (idx === state.answeringTeamId) {
        awardPoolToTeam(idx);
      }
      return;
    }

    if (record.phase !== 'bidding') return;

    record.timer = setTimeout(() => {
      record.vaBanque = true;
      vaBanque(idx);
    }, HOLD_MS);
  }

  function releaseTeam(inputId) {
    const record = pressed.get(inputId);
    pressed.delete(inputId);
    if (!record) return;
    if (record.timer) clearTimeout(record.timer);
    if (!state) return;

    if (record.phase === 'bidding' && !record.vaBanque) {
      bid(record.idx, BID_STEP);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (!state) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // pole kwoty kary: Enter nakłada karę, Esc anuluje, reszta to zwykłe pisanie
    if (e.target instanceof HTMLInputElement) {
      if (penalty.active && e.key === 'Enter') {
        e.preventDefault();
        applyPenalty();
      } else if (penalty.active && e.key === 'Escape') {
        closePenalty();
      }
      return;
    }

    if (e.key === 'Escape') {
      if (penalty.active) closePenalty();
      return;
    }

    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      if (!e.repeat) togglePenalty();
      return;
    }

    if (e.key === 'Enter' && penalty.active) {
      e.preventDefault();
      applyPenalty();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) handleSpace();
      return;
    }

    if (e.repeat) return;
    const idx = keyToTeamIndex(e.key);
    if (idx !== -1) pressTeam(e.key, idx);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      // nie pozwól, by spacja "kliknęła" przycisk, który ma fokus
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      return;
    }
    releaseTeam(e.key);
  });

  // Mysz: klik w ramkę (wkład albo drużyna) działa jak klawisz drużyny, przytrzymanie = va bank.
  function onTeamPointerDown(e) {
    if (e.button !== 0) return;
    const el = e.target.closest('[data-team-index]');
    if (!el) return;
    e.preventDefault();
    pressTeam('pointer', Number(el.dataset.teamIndex));
  }

  [teamsRow, contributionsRow].forEach((row) => {
    row.addEventListener('pointerdown', onTeamPointerDown);
    // bez tego klik w ramkę zabierałby fokus polu kwoty kary
    row.addEventListener('mousedown', (e) => e.preventDefault());
  });
  window.addEventListener('pointerup', () => releaseTeam('pointer'));
  window.addEventListener('pointercancel', () => releaseTeam('pointer'));

  // Przycisk pod pulą działa jak spacja.
  actionBtn.addEventListener('click', handleSpace);

  // Przyciski nie zatrzymują fokusu, żeby późniejsza spacja nie aktywowała ich ponownie.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('button');
    if (btn) btn.blur();
  });

  // ---------- Rendering ----------

  const ACTION_LABELS = {
    waiting: 'Pobierz wpisowe (spacja)',
    bidding: 'Zakończ licytację (spacja)',
    answering: 'Zła odpowiedź (spacja)',
  };

  function renderActionButton() {
    actionBtn.textContent = ACTION_LABELS[state.phase];
    // nie da się zakończyć licytacji, w której nikt jeszcze nie przebił
    actionBtn.disabled = penalty.active || (state.phase === 'bidding' && state.leaderIdx === null);
  }

  function render() {
    if (!state) return;

    poolAmountEl.textContent = fmt(state.pool);
    gameScreen.classList.toggle('penalty-mode', penalty.active);
    renderActionButton();
    updatePenaltyUi();

    contributionsRow.classList.toggle('hidden', state.phase !== 'bidding');
    contributionsRow.innerHTML = '';
    if (state.phase === 'bidding') {
      state.teams.forEach((team, i) => {
        const box = document.createElement('div');
        box.className = 'contribution-box' + (penalty.teamIdx === i ? ' penalty-selected' : '');
        box.dataset.teamIndex = i;
        box.style.setProperty('--team-color', team.color);
        if (team.eliminated) box.classList.add('eliminated');
        const increased = lastContributions && state.contributions[i] > lastContributions[i];
        box.innerHTML = `<div class="amount${increased ? ' bump' : ''}">${fmt(state.contributions[i])}</div>`;
        contributionsRow.appendChild(box);
      });
    }

    lastContributions = state.contributions.slice();

    teamsRow.innerHTML = '';
    state.teams.forEach((team, i) => {
      const box = document.createElement('div');
      const isAnswering = state.phase === 'answering' && i === state.answeringTeamId;
      box.className = 'team-box' + (isAnswering ? ' answering' : '') + (team.eliminated ? ' eliminated' : '') + (penalty.teamIdx === i ? ' penalty-selected' : '');
      box.dataset.teamIndex = i;
      box.style.setProperty('--team-color', team.color);

      const badge = document.createElement('div');
      badge.className = 'team-key-badge';
      badge.textContent = keyLabelForIndex(i);
      box.appendChild(badge);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = team.name;
      box.appendChild(name);

      const capital = document.createElement('div');
      capital.className = 'capital';
      capital.textContent = fmt(team.capital);
      box.appendChild(capital);

      teamsRow.appendChild(box);
    });
  }

  renderTeamNameInputs();
})();
