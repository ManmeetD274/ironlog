// ─── IRONLOG APP ─────────────────────────────────────────────────────────────

// State
let state = {
  activeTab: 'log',
  selectedDate: todayStr(),
  activeWorkout: null,  // { id, date, clientId, notes, exercises: [] }
  exSearch: '',
  exMuscleFilter: 'All',
  exEquipFilter: 'All',
  selectedExercises: [],  // during picker
  clients: [],
  allWorkouts: [],
  activeClientFilter: null,
  restTimer: null,
  restSeconds: 0,
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// ─── BOOT ──────────────────────────────────────────────────────────────────
async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
  await openDB();
  state.clients = await DB.getAllClients();
  state.allWorkouts = await DB.getAllWorkouts();
  renderAll();
  // Load today's workout if exists
  const todayWorkouts = await DB.getWorkoutsByDate(state.selectedDate);
  if (todayWorkouts.length > 0) {
    state.activeWorkout = todayWorkouts[0];
  } else {
    state.activeWorkout = null;
  }
  renderLogScreen();
}

// ─── NAVIGATION ────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-'+tab).classList.add('active');
  document.getElementById('nav-'+tab).classList.add('active');
  if (tab === 'log') renderLogScreen();
  if (tab === 'history') renderHistoryScreen();
  if (tab === 'clients') renderClientsScreen();
  if (tab === 'profile') renderProfileScreen();
}

function renderAll() {
  renderLogScreen();
  renderHistoryScreen();
  renderClientsScreen();
  renderProfileScreen();
}

// ─── LOG SCREEN ────────────────────────────────────────────────────────────
function renderLogScreen() {
  renderDateStrip();
  renderActiveWorkout();
}

function renderDateStrip() {
  const el = document.getElementById('date-strip');
  const today = new Date();
  let html = '';
  for (let i = -6; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const str = d.toISOString().split('T')[0];
    const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const hasW = state.allWorkouts.some(w => w.date === str);
    const isActive = str === state.selectedDate;
    html += `<div class="date-pill${isActive?' active':''}${hasW&&!isActive?' has-workout':''}" onclick="selectDate('${str}')">
      <span class="day-name">${dayNames[d.getDay()]}</span>
      <span class="day-num">${d.getDate()}</span>
    </div>`;
  }
  el.innerHTML = html;
  setTimeout(() => {
    const pills = el.querySelectorAll('.date-pill');
    if (pills.length) pills[pills.length-1].scrollIntoView({block:'nearest', inline:'center'});
  }, 50);
}

async function selectDate(dateStr) {
  state.selectedDate = dateStr;
  const workouts = await DB.getWorkoutsByDate(dateStr);
  state.activeWorkout = workouts[0] || null;
  renderDateStrip();
  renderActiveWorkout();
}

function renderActiveWorkout() {
  const el = document.getElementById('log-body');
  const w = state.activeWorkout;
  const dateLabel = formatDate(state.selectedDate);

  if (!w) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-icon">💪</div>
        <h3>No workout logged for ${dateLabel}</h3>
        <p style="color:var(--muted);font-size:.85rem;margin:8px 0 24px">Start a new workout or add exercises</p>
        <button class="btn btn-full" onclick="startWorkout()">+ Start Workout</button>
      </div>`;
    return;
  }

  const totalSets = w.exercises.reduce((a,e)=>a+e.sets.length,0);
  const doneSets = w.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0);
  const pct = totalSets ? Math.round(doneSets/totalSets*100) : 0;

  let html = `
    <div class="card row sb" style="margin-bottom:16px">
      <div>
        <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">${dateLabel}</div>
        <div style="font-family:var(--font-head);font-weight:800;font-size:1.2rem;margin-top:2px">${doneSets}/${totalSets} Sets Done</div>
        <div class="progress-bar" style="width:200px;margin-top:8px"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="openExercisePicker()">+ Add</button>
    </div>`;

  if (w.exercises.length === 0) {
    html += `<div class="empty"><div class="empty-icon">🏋️</div><h3>Add exercises to get started</h3></div>`;
  }

  w.exercises.forEach((ex, ei) => {
    const allDone = ex.sets.length > 0 && ex.sets.every(s => s.done);
    html += `
      <div class="workout-ex-card">
        <div class="workout-ex-header">
          <div>
            <div class="ex-name">${ex.name}</div>
            <div class="ex-meta">${ex.muscle} · ${ex.sets.length} set${ex.sets.length!==1?'s':''}</div>
          </div>
          <div class="row" style="gap:6px">
            ${allDone ? '<span style="font-size:.75rem;color:var(--success);font-weight:700">✓ Done</span>' : ''}
            <button class="btn btn-sm btn-muted" onclick="removeExercise(${ei})" style="padding:6px 10px;font-size:.7rem">✕</button>
          </div>
        </div>
        <div class="workout-ex-body">
          <table class="set-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Previous</th>
                <th>kg</th>
                <th>Reps</th>
                <th>✓</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="sets-${ei}">
              ${renderSetsHTML(ex, ei)}
            </tbody>
          </table>
          <button class="btn btn-muted btn-sm" style="margin-top:10px;width:100%" onclick="addSet(${ei})">+ Add Set</button>
        </div>
      </div>`;
  });

  html += `
    <div style="margin-top:8px;display:flex;gap:10px">
      <button class="btn btn-ghost btn-full" onclick="openExercisePicker()">+ Add Exercise</button>
      <button class="btn btn-danger btn-sm" onclick="deleteWorkout()" style="flex-shrink:0">🗑</button>
    </div>`;

  el.innerHTML = html;
}

function renderSetsHTML(ex, ei) {
  if (ex.sets.length === 0) return `<tr><td colspan="6" style="color:var(--muted);font-size:.8rem;padding:8px 0;text-align:center">No sets yet</td></tr>`;
  return ex.sets.map((s, si) => {
    const prevKey = `${ex.id}_${si}`;
    const prev = getPrevSet(ex.id, si);
    return `<tr>
      <td>${si+1}</td>
      <td style="color:var(--muted);font-size:.8rem">${prev ? prev.weight+'kg×'+prev.reps : '—'}</td>
      <td><input class="set-input" type="number" min="0" step="0.5" value="${s.weight||''}" placeholder="0" onchange="updateSet(${ei},${si},'weight',this.value)"></td>
      <td><input class="set-input" type="number" min="0" step="1" value="${s.reps||''}" placeholder="0" onchange="updateSet(${ei},${si},'reps',this.value)"></td>
      <td><button class="set-done-btn${s.done?' done':''}" onclick="toggleSetDone(${ei},${si})" title="Mark done">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button></td>
      <td><button class="set-del-btn" onclick="removeSet(${ei},${si})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button></td>
    </tr>`;
  }).join('');
}

function getPrevSet(exerciseId, setIndex) {
  // Find most recent workout (before today) that has this exercise
  const sorted = [...state.allWorkouts]
    .filter(w => w.date < state.selectedDate || w.id !== state.activeWorkout?.id)
    .sort((a,b) => b.date.localeCompare(a.date));
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.id === exerciseId);
    if (ex && ex.sets[setIndex]) return ex.sets[setIndex];
  }
  return null;
}

async function startWorkout() {
  const w = {
    id: uid(),
    date: state.selectedDate,
    clientId: null,
    notes: '',
    exercises: [],
    createdAt: Date.now()
  };
  await DB.saveWorkout(w);
  state.activeWorkout = w;
  state.allWorkouts.push(w);
  renderDateStrip();
  renderActiveWorkout();
}

async function deleteWorkout() {
  if (!state.activeWorkout) return;
  if (!confirm('Delete this workout?')) return;
  await DB.deleteWorkout(state.activeWorkout.id);
  state.allWorkouts = state.allWorkouts.filter(w => w.id !== state.activeWorkout.id);
  state.activeWorkout = null;
  renderDateStrip();
  renderActiveWorkout();
  showToast('Workout deleted');
}

async function removeExercise(ei) {
  state.activeWorkout.exercises.splice(ei, 1);
  await DB.saveWorkout(state.activeWorkout);
  renderActiveWorkout();
}

async function addSet(ei) {
  const ex = state.activeWorkout.exercises[ei];
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ reps: last?.reps||0, weight: last?.weight||0, done: false });
  await DB.saveWorkout(state.activeWorkout);
  renderActiveWorkout();
}

async function removeSet(ei, si) {
  state.activeWorkout.exercises[ei].sets.splice(si, 1);
  await DB.saveWorkout(state.activeWorkout);
  renderActiveWorkout();
}

async function updateSet(ei, si, field, val) {
  state.activeWorkout.exercises[ei].sets[si][field] = parseFloat(val) || 0;
  await DB.saveWorkout(state.activeWorkout);
  // update in allWorkouts too
  const idx = state.allWorkouts.findIndex(w => w.id === state.activeWorkout.id);
  if (idx > -1) state.allWorkouts[idx] = state.activeWorkout;
}

async function toggleSetDone(ei, si) {
  const set = state.activeWorkout.exercises[ei].sets[si];
  set.done = !set.done;
  await DB.saveWorkout(state.activeWorkout);
  // update allWorkouts
  const idx = state.allWorkouts.findIndex(w => w.id === state.activeWorkout.id);
  if (idx > -1) state.allWorkouts[idx] = state.activeWorkout;
  renderActiveWorkout();
  if (set.done) startRestTimer();
}

// ─── REST TIMER ────────────────────────────────────────────────────────────
function startRestTimer() {
  if (state.restTimer) clearInterval(state.restTimer);
  state.restSeconds = 90;
  showRestTimer();
  state.restTimer = setInterval(() => {
    state.restSeconds--;
    const el = document.getElementById('rest-time');
    if (el) el.textContent = formatTime(state.restSeconds);
    if (state.restSeconds <= 0) {
      clearInterval(state.restTimer);
      state.restTimer = null;
      hideRestTimer();
    }
  }, 1000);
}
function showRestTimer() {
  const el = document.getElementById('rest-banner');
  if (el) { el.style.display = 'flex'; document.getElementById('rest-time').textContent = formatTime(state.restSeconds); }
}
function hideRestTimer() {
  const el = document.getElementById('rest-banner');
  if (el) el.style.display = 'none';
  if (state.restTimer) { clearInterval(state.restTimer); state.restTimer = null; }
}
function formatTime(s) {
  const m = Math.floor(s/60); const sec = s%60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

// ─── EXERCISE PICKER ───────────────────────────────────────────────────────
function openExercisePicker() {
  state.selectedExercises = [];
  state.exSearch = '';
  state.exMuscleFilter = 'All';
  state.exEquipFilter = 'All';
  renderExercisePicker();
  openOverlay('picker-overlay');
}

async function renderExercisePicker() {
  const custom = await DB.getAllCustomExercises();
  const all = [...EXERCISES, ...custom];
  const q = state.exSearch.toLowerCase();
  const filtered = all.filter(e => {
    const matchName = e.name.toLowerCase().includes(q);
    const matchMuscle = state.exMuscleFilter === 'All' || e.muscle === state.exMuscleFilter;
    const matchEquip = state.exEquipFilter === 'All' || e.equipment === state.exEquipFilter;
    return matchName && matchMuscle && matchEquip;
  });

  // Muscles chips
  let muscleChips = MUSCLES.map(m => `<span class="chip${state.exMuscleFilter===m?' active':''}" onclick="setExFilter('muscle','${m}')">${m}</span>`).join('');

  let exList = '';
  if (filtered.length === 0) {
    exList = `<div class="empty"><div class="empty-icon">🔍</div><h3>No exercises found</h3></div>`;
  } else {
    exList = filtered.map(e => {
      const sel = state.selectedExercises.includes(e.id);
      return `<div class="ex-row${sel?' selected':''}" onclick="toggleExSelect('${e.id}')">
        <div class="ex-info">
          <div class="ex-name">${e.name}</div>
          <div class="ex-meta">${e.muscle} · ${e.equipment}</div>
        </div>
        <div class="ex-check">${sel?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
      </div>`;
    }).join('');
  }

  const count = state.selectedExercises.length;
  document.getElementById('picker-body').innerHTML = `
    <div class="search-wrap" style="margin-bottom:10px">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="search" placeholder="Search exercises…" value="${state.exSearch}" oninput="setExSearch(this.value)" id="ex-search-input">
    </div>
    <div class="chips-row" style="margin-bottom:6px">${muscleChips}</div>
    <div style="flex:1;overflow-y:auto;margin:0 -20px;padding:4px 20px">${exList}</div>
    ${count > 0 ? `<div style="position:sticky;bottom:0;background:var(--bg2);padding:12px 0 0;border-top:1px solid var(--border);margin:0 -20px;padding:12px 20px 0">
      <button class="btn btn-full" onclick="addSelectedExercises()">Add ${count} Exercise${count>1?'s':''}</button>
    </div>` : ''}`;
}

function setExSearch(val) {
  state.exSearch = val;
  renderExercisePicker();
  setTimeout(() => { const el = document.getElementById('ex-search-input'); if(el) { el.focus(); el.setSelectionRange(val.length,val.length); }}, 10);
}

function setExFilter(type, val) {
  if (type === 'muscle') state.exMuscleFilter = val;
  else state.exEquipFilter = val;
  renderExercisePicker();
}

function toggleExSelect(id) {
  const idx = state.selectedExercises.indexOf(id);
  if (idx > -1) state.selectedExercises.splice(idx, 1);
  else state.selectedExercises.push(id);
  renderExercisePicker();
}

async function addSelectedExercises() {
  if (!state.activeWorkout) await startWorkout();
  const custom = await DB.getAllCustomExercises();
  const all = [...EXERCISES, ...custom];
  for (const id of state.selectedExercises) {
    const ex = all.find(e => e.id === id);
    if (!ex) continue;
    // Avoid duplicates
    if (state.activeWorkout.exercises.some(e => e.id === id)) continue;
    state.activeWorkout.exercises.push({
      id: ex.id,
      name: ex.name,
      muscle: ex.muscle,
      equipment: ex.equipment,
      sets: [{ reps: 0, weight: 0, done: false }]
    });
  }
  await DB.saveWorkout(state.activeWorkout);
  const idx = state.allWorkouts.findIndex(w => w.id === state.activeWorkout.id);
  if (idx > -1) state.allWorkouts[idx] = state.activeWorkout;
  closeOverlay('picker-overlay');
  renderActiveWorkout();
  showToast(`Added ${state.selectedExercises.length} exercise(s)`, 'success');
}

// ─── HISTORY SCREEN ────────────────────────────────────────────────────────
function renderHistoryScreen() {
  const el = document.getElementById('history-body');
  const sorted = [...state.allWorkouts].sort((a,b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><h3>No workouts yet</h3></div>`;
    return;
  }
  // Group by month
  const groups = {};
  for (const w of sorted) {
    const [y, m] = w.date.split('-');
    const key = `${y}-${m}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  }
  let html = '';
  for (const [key, workouts] of Object.entries(groups)) {
    const [y,m] = key.split('-');
    const monthName = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleString('default',{month:'long',year:'numeric'});
    html += `<div class="history-date-label">${monthName}</div>`;
    for (const w of workouts) {
      const client = w.clientId ? state.clients.find(c=>c.id===w.clientId) : null;
      const totalSets = w.exercises.reduce((a,e)=>a+e.sets.length,0);
      const exNames = w.exercises.slice(0,3).map(e=>e.name).join(', ') + (w.exercises.length>3?` +${w.exercises.length-3} more`:'');
      html += `<div class="card card-sm" onclick="viewWorkoutDetail('${w.id}')" style="cursor:pointer">
        <div class="row sb">
          <div>
            <div style="font-weight:600;font-size:.9rem">${formatDate(w.date)}</div>
            ${client ? `<div style="font-size:.75rem;color:var(--accent);margin-top:2px">${client.name}</div>` : ''}
            <div style="font-size:.75rem;color:var(--muted);margin-top:4px">${w.exercises.length} exercises · ${totalSets} sets</div>
            ${exNames ? `<div style="font-size:.75rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px">${exNames}</div>` : ''}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }
  }
  el.innerHTML = html;
}

function viewWorkoutDetail(id) {
  const w = state.allWorkouts.find(x => x.id === id);
  if (!w) return;
  const client = w.clientId ? state.clients.find(c=>c.id===w.clientId) : null;
  let html = `<div style="margin-bottom:16px">
    <div style="font-family:var(--font-head);font-weight:800;font-size:1.3rem">${formatDate(w.date)}</div>
    ${client?`<div style="color:var(--accent);font-size:.85rem;margin-top:4px">Client: ${client.name}</div>`:''}
  </div>`;
  for (const ex of w.exercises) {
    const vol = ex.sets.reduce((a,s)=>a+(s.weight||0)*(s.reps||0),0);
    html += `<div class="card card-sm" style="margin-bottom:8px">
      <div style="font-weight:700;margin-bottom:6px">${ex.name}</div>
      ${ex.sets.map((s,i)=>`<div style="display:flex;gap:12px;font-size:.8rem;color:var(--muted);padding:2px 0">
        <span style="color:var(--text);font-weight:600">Set ${i+1}</span>
        <span>${s.weight||0} kg × ${s.reps||0} reps</span>
        ${s.done?'<span style="color:var(--success)">✓</span>':''}
      </div>`).join('')}
      <div style="font-size:.75rem;color:var(--muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">Volume: ${vol.toLocaleString()} kg</div>
    </div>`;
  }
  html += `<button class="btn btn-danger btn-full" style="margin-top:8px" onclick="deleteWorkoutById('${w.id}')">Delete Workout</button>`;
  document.getElementById('detail-body').innerHTML = html;
  openOverlay('detail-overlay');
}

async function deleteWorkoutById(id) {
  if (!confirm('Delete this workout?')) return;
  await DB.deleteWorkout(id);
  state.allWorkouts = state.allWorkouts.filter(w => w.id !== id);
  if (state.activeWorkout?.id === id) state.activeWorkout = null;
  closeOverlay('detail-overlay');
  renderHistoryScreen();
  renderLogScreen();
  showToast('Workout deleted');
}

// ─── CLIENTS SCREEN ────────────────────────────────────────────────────────
function renderClientsScreen() {
  const el = document.getElementById('clients-body');
  if (state.clients.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">👥</div><h3>No clients yet. Add your first client!</h3></div>`;
    return;
  }
  el.innerHTML = state.clients.map(c => {
    const workouts = state.allWorkouts.filter(w => w.clientId === c.id);
    const initials = c.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
    return `<div class="card card-sm row" onclick="viewClient('${c.id}')" style="cursor:pointer">
      <div class="client-avatar">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700">${c.name}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${c.goal||'No goal set'}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">${workouts.length} workout${workouts.length!==1?'s':''} logged</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
}

function viewClient(id) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  const workouts = state.allWorkouts.filter(w => w.clientId === id).sort((a,b)=>b.date.localeCompare(a.date));
  const initials = c.name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  let html = `
    <div style="text-align:center;padding:8px 0 20px">
      <div class="client-avatar" style="width:64px;height:64px;font-size:1.4rem;margin:0 auto 12px">${initials}</div>
      <div style="font-family:var(--font-head);font-weight:800;font-size:1.3rem">${c.name}</div>
      ${c.goal?`<div style="color:var(--muted);font-size:.85rem;margin-top:4px">${c.goal}</div>`:''}
      ${c.notes?`<div style="font-size:.8rem;color:var(--muted);margin-top:8px;padding:8px;background:var(--bg3);border-radius:8px">${c.notes}</div>`:''}
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${workouts.length}</div><div class="stat-label">Workouts</div></div>
      <div class="stat-card"><div class="stat-value">${workouts.reduce((a,w)=>a+w.exercises.length,0)}</div><div class="stat-label">Exercises</div></div>
    </div>
    <div style="margin-bottom:12px">
      <button class="btn btn-full" onclick="startClientWorkout('${id}')">+ Log Workout for ${c.name.split(' ')[0]}</button>
    </div>
    <div class="divider"></div>
    <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Workout History</div>`;
  if (workouts.length === 0) {
    html += `<div style="color:var(--muted);font-size:.85rem;text-align:center;padding:20px">No workouts logged yet</div>`;
  } else {
    html += workouts.map(w => {
      const totalSets = w.exercises.reduce((a,e)=>a+e.sets.length,0);
      return `<div class="card card-sm" onclick="viewWorkoutDetail('${w.id}')" style="cursor:pointer;margin-bottom:8px">
        <div class="row sb">
          <div>
            <div style="font-weight:600;font-size:.9rem">${formatDate(w.date)}</div>
            <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${w.exercises.length} exercises · ${totalSets} sets</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('');
  }
  html += `<div class="divider"></div>
    <button class="btn btn-danger btn-full" onclick="deleteClient('${id}')">Delete Client</button>`;
  document.getElementById('client-detail-body').innerHTML = html;
  openOverlay('client-detail-overlay');
}

function openAddClient() {
  document.getElementById('client-form').reset();
  openOverlay('add-client-overlay');
}

async function saveClient() {
  const name = document.getElementById('client-name').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  const c = {
    id: uid(),
    name,
    goal: document.getElementById('client-goal').value.trim(),
    notes: document.getElementById('client-notes').value.trim(),
    createdAt: Date.now()
  };
  await DB.saveClient(c);
  state.clients.push(c);
  closeOverlay('add-client-overlay');
  renderClientsScreen();
  showToast(`${name} added!`, 'success');
}

async function deleteClient(id) {
  if (!confirm('Delete this client and all their workout links?')) return;
  await DB.deleteClient(id);
  state.clients = state.clients.filter(c => c.id !== id);
  closeOverlay('client-detail-overlay');
  renderClientsScreen();
  showToast('Client deleted');
}

async function startClientWorkout(clientId) {
  closeOverlay('client-detail-overlay');
  const d = todayStr();
  state.selectedDate = d;
  switchTab('log');
  // Check if workout for today already exists for this client
  let w = state.allWorkouts.find(x => x.date === d && x.clientId === clientId);
  if (!w) {
    w = { id: uid(), date: d, clientId, notes: '', exercises: [], createdAt: Date.now() };
    await DB.saveWorkout(w);
    state.allWorkouts.push(w);
  }
  state.activeWorkout = w;
  renderLogScreen();
}

// ─── PROFILE SCREEN ────────────────────────────────────────────────────────
function renderProfileScreen() {
  const el = document.getElementById('profile-body');
  const total = state.allWorkouts.length;
  const myWorkouts = state.allWorkouts.filter(w => !w.clientId);
  const totalSets = state.allWorkouts.reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.length,0),0);
  const totalVol = state.allWorkouts.reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.reduce((c,s)=>c+(s.weight||0)*(s.reps||0),0),0),0);

  // Streak
  let streak = 0;
  const d = new Date();
  while (true) {
    const str = d.toISOString().split('T')[0];
    if (state.allWorkouts.some(w => w.date === str)) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }

  // Top exercises
  const exCount = {};
  for (const w of state.allWorkouts) for (const e of w.exercises) { exCount[e.name] = (exCount[e.name]||0)+1; }
  const top = Object.entries(exCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  el.innerHTML = `
    <div style="text-align:center;padding:12px 0 24px">
      <div style="font-size:2.5rem;margin-bottom:8px">🏋️</div>
      <div style="font-family:var(--font-head);font-weight:800;font-size:1.5rem">Your Stats</div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${myWorkouts.length}</div><div class="stat-label">My Workouts</div></div>
      <div class="stat-card"><div class="stat-value">${streak}</div><div class="stat-label">Day Streak 🔥</div></div>
      <div class="stat-card"><div class="stat-value">${totalSets}</div><div class="stat-label">Total Sets</div></div>
      <div class="stat-card"><div class="stat-value">${totalVol >= 1000 ? (totalVol/1000).toFixed(1)+'t' : totalVol+'kg'}</div><div class="stat-label">Total Volume</div></div>
    </div>
    ${top.length > 0 ? `
    <div class="card" style="margin-top:8px">
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:12px">Most Logged Exercises</div>
      ${top.map(([name,count],i)=>`<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:.9rem">${i+1}. ${name}</div>
        <div style="font-size:.8rem;color:var(--muted)">${count}×</div>
      </div>`).join('')}
    </div>` : ''}
    <div class="divider"></div>
    <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:12px">Manage</div>
    <button class="btn btn-ghost btn-full" style="margin-bottom:10px" onclick="openAddCustomExercise()">+ Add Custom Exercise</button>
    <button class="btn btn-muted btn-full" onclick="exportData()">Export Data (JSON)</button>`;
}

// ─── CUSTOM EXERCISES ──────────────────────────────────────────────────────
function openAddCustomExercise() {
  document.getElementById('custom-ex-form').reset();
  openOverlay('custom-ex-overlay');
}
async function saveCustomExercise() {
  const name = document.getElementById('ce-name').value.trim();
  if (!name) { showToast('Name required','error'); return; }
  const ex = {
    id: 'c-'+uid(), name,
    muscle: document.getElementById('ce-muscle').value,
    equipment: document.getElementById('ce-equip').value,
    category: 'Custom'
  };
  await DB.saveCustomExercise(ex);
  closeOverlay('custom-ex-overlay');
  showToast(`${name} added!`, 'success');
}

// ─── EXPORT ────────────────────────────────────────────────────────────────
async function exportData() {
  const workouts = await DB.getAllWorkouts();
  const clients = await DB.getAllClients();
  const blob = new Blob([JSON.stringify({workouts,clients},null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ironlog-export-${todayStr()}.json`;
  a.click();
  showToast('Data exported!', 'success');
}

// ─── OVERLAY HELPERS ───────────────────────────────────────────────────────
function openOverlay(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// ─── FORMAT HELPERS ────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '';
  const [y,m,d] = str.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((dt-today)/86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return dt.toLocaleDateString('en-IN', {day:'numeric', month:'short', year: diff < -30 ? 'numeric' : undefined});
}

// ─── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── BOOT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);
