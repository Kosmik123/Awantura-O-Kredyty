(() => {
  const BID_STEP = 100;
  const HOLD_MS = 450;

  const PALETTE = [
    '#e63946', '#2a9d8f', '#f1a208', '#457b9d', '#8338ec',
    '#ff6d00', '#06d6a0', '#ef476f', '#118ab2', '#9b5de5',
  ];

  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const teamCountInput = document.getElementById('team-count');
  const startingCapitalInput = document.getElementById('starting-capital');
  const teamNamesList = document.getElementById('team-names-list');
  const startBtn = document.getElementById('start-btn');
  const newGameBtn = document.getElementById('new-game-btn');
  const helpBtn = document.getElementById('help-btn');
  const helpPanel = document.getElementById('help-panel');
  const poolAmountEl = document.getElementById('pool-amount');
  const contributionsRow = document.getElementById('contributions-row');
  const teamsRow = document.getElementById('teams-row');

  /** @type {{teams: {name:string, color:string, capital:number}[], phase: 'bidding'|'answering', pool:number, contributions:number[], allIn:boolean[], answeringTeamId: number|null}} */
  let state = null;

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
    const teams = [];
    for (let i = 0; i < count; i++) {
      const input = document.getElementById(`team-name-${i}`);
      const name = (input && input.value.trim()) || `Drużyna ${i + 1}`;
      teams.push({ name, color: PALETTE[i], capital });
    }

    state = {
      teams,
      phase: 'bidding',
      pool: 0,
      contributions: teams.map(() => 0),
      allIn: teams.map(() => false),
      answeringTeamId: null,
    };

    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    render();
  });

  newGameBtn.addEventListener('click', () => {
    state = null;
    gameScreen.classList.add('hidden');
    helpPanel.classList.add('hidden');
    setupScreen.classList.remove('hidden');
  });

  helpBtn.addEventListener('click', () => {
    helpPanel.classList.toggle('hidden');
  });

  // ---------- Game logic ----------

  function bid(idx, amount) {
    const team = state.teams[idx];
    const actual = Math.min(amount, team.capital);
    if (actual <= 0) return;
    team.capital -= actual;
    state.pool += actual;
    state.contributions[idx] += actual;
    bumpPool();
    render();
  }

  function vaBanque(idx) {
    const team = state.teams[idx];
    const actual = team.capital;
    if (actual <= 0) return;
    team.capital = 0;
    state.pool += actual;
    state.contributions[idx] += actual;
    state.allIn[idx] = true;
    bumpPool();
    render();
  }

  function endBidding() {
    const candidates = state.teams.map((_, i) => i).filter((i) => state.allIn[i]);
    let winnerIdx;
    if (candidates.length > 0) {
      winnerIdx = candidates.reduce(
        (best, i) => (state.contributions[i] > state.contributions[best] ? i : best),
        candidates[0]
      );
    } else {
      const maxVal = Math.max(...state.contributions);
      if (maxVal <= 0) return; // nobody bid yet
      winnerIdx = state.contributions.indexOf(maxVal);
    }
    state.answeringTeamId = winnerIdx;
    state.phase = 'answering';
    render();
  }

  function awardPoolToTeam(idx) {
    state.teams[idx].capital += state.pool;
    state.pool = 0;
    startNewBiddingRound();
  }

  function startNewBiddingRound() {
    state.phase = 'bidding';
    state.answeringTeamId = null;
    state.contributions = state.teams.map(() => 0);
    state.allIn = state.teams.map(() => false);
    render();
  }

  function handleSpace() {
    if (!state) return;
    if (state.phase === 'bidding') {
      endBidding();
    } else if (state.phase === 'answering') {
      startNewBiddingRound();
    }
  }

  function bumpPool() {
    poolAmountEl.classList.remove('bump');
    // restart animation
    void poolAmountEl.offsetWidth;
    poolAmountEl.classList.add('bump');
  }

  // ---------- Keyboard handling ----------

  // Per physical key: records the game phase at the moment it was pressed,
  // so keyup acts on that decision even if the phase changed in between
  // (e.g. awarding the pool on keydown immediately starts a new bidding round).
  const keysPhysicallyDown = new Set();
  const keyRecords = new Map();

  window.addEventListener('keydown', (e) => {
    if (!state) return;

    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) handleSpace();
      return;
    }

    const idx = keyToTeamIndex(e.key);
    if (idx === -1 || idx >= state.teams.length) return;
    if (e.repeat) return;
    if (keysPhysicallyDown.has(e.key)) return;
    keysPhysicallyDown.add(e.key);

    const record = { phase: state.phase, vaBanque: false, timer: null };
    keyRecords.set(e.key, record);

    if (record.phase === 'answering') {
      if (idx === state.answeringTeamId) {
        awardPoolToTeam(idx);
      }
      return;
    }

    record.timer = setTimeout(() => {
      record.vaBanque = true;
      vaBanque(idx);
    }, HOLD_MS);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') return;

    const idx = keyToTeamIndex(e.key);
    keysPhysicallyDown.delete(e.key);

    const record = keyRecords.get(e.key);
    keyRecords.delete(e.key);
    if (!record) return;
    if (record.timer) clearTimeout(record.timer);

    if (!state || idx === -1 || idx >= state.teams.length) return;

    if (record.phase === 'bidding' && !record.vaBanque) {
      bid(idx, BID_STEP);
    }
  });

  // ---------- Rendering ----------

  function render() {
    if (!state) return;

    poolAmountEl.textContent = fmt(state.pool);

    contributionsRow.classList.toggle('hidden', state.phase !== 'bidding');
    contributionsRow.innerHTML = '';
    if (state.phase === 'bidding') {
      state.teams.forEach((team, i) => {
        const box = document.createElement('div');
        box.className = 'contribution-box' + (state.allIn[i] ? ' all-in' : '');
        box.style.borderColor = team.color;
        box.innerHTML = `<div class="amount">${fmt(state.contributions[i])}</div>`;
        contributionsRow.appendChild(box);
      });
    }

    teamsRow.innerHTML = '';
    state.teams.forEach((team, i) => {
      const box = document.createElement('div');
      const isAnswering = state.phase === 'answering' && i === state.answeringTeamId;
      box.className = 'team-box' + (isAnswering ? ' answering' : '') + (team.capital <= 0 ? ' eliminated' : '');
      box.style.borderColor = isAnswering ? '#ffffff' : team.color;

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
      capital.style.color = team.color;
      capital.textContent = fmt(team.capital);
      box.appendChild(capital);

      teamsRow.appendChild(box);
    });
  }

  renderTeamNameInputs();
})();
