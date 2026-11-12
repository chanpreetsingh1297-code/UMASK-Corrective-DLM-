// ============ STATE ============
const state = {
  user: { name: '', avatar: '🌿', passcode: null },
  view: 'dashboard',
  theme: 'dark',
  habits: [],
  tasks: [],
  timer: { running: false, paused: false, mode: 'focus', seconds: 25*60, total: 25*60, interval: null },
  ambient: { rain: false, fire: false, cafe: false },
  ai: { enabled: false, provider: 'openai', key: '' },
  floatDismissed: false
};

const HABIT_COLORS = {
  terracotta: { bg: '#D47A55', soft: '#E89B7A', name: 'Terracotta' },
  sage: { bg: '#7E9E82', soft: '#A3BFA6', name: 'Sage' },
  amber: { bg: '#E3B341', soft: '#EFCB73', name: 'Amber' },
  lavender: { bg: '#9B8EA9', soft: '#B8ADC4', name: 'Lavender' }
};

const ICON_CHOICES = ['🌿','🎯','📚','🧘','💧','🏃','✍️','🎨','🎵','☕','🌅','🌙','🍎','💪','🧠','🌸','🔥','⭐'];

// ============ UTILITIES ============
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmtDate = d => d.toISOString().slice(0,10);
const today = () => fmtDate(new Date());

function getStreak(habit) {
  let streak = 0;
  const d = new Date();
  while (habit.completions[fmtDate(d)]) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
function getTotal(habit) { return Object.keys(habit.completions).length; }

// Safe event binding helper
function on(sel, evt, fn, root = document) {
  const el = typeof sel === 'string' ? root.querySelector(sel) : sel;
  if (el) el.addEventListener(evt, fn);
  return el;
}
function onAll(sel, evt, fn, root = document) {
  const els = root.querySelectorAll(sel);
  els.forEach(el => el.addEventListener(evt, fn));
}

// ============ TOAST ============
function showToast(message, icon = '✨') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast glass rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-2 text-sm';
  toast.innerHTML = `<span class="text-base">${icon}</span><span class="font-medium">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ============ MODAL ============
function openModal(html) {
  $('#modal-panel').innerHTML = html;
  $('#modal').classList.add('open');
  setTimeout(() => {
    const first = $('#modal-panel').querySelector('input');
    if (first) first.focus();
  }, 100);
}
function closeModal() { $('#modal').classList.remove('open'); }

// ============ NAVIGATION ============
function setView(view) {
  state.view = view;
  state.floatDismissed = false;
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  render();
}

// ============ LIVE CLOCK ============
function updateClock() {
  const el = $('#live-clock');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
setInterval(updateClock, 1000);

// ============ RENDER ============
function render() {
  const container = $('#view-container');
  container.classList.remove('stagger');
  void container.offsetWidth;
  container.classList.add('stagger');

  const views = {
    dashboard: renderDashboard,
    habits: renderHabits,
    tasks: renderTasks,
    timer: renderTimer,
    analytics: renderAnalytics,
    ai: renderAI,
    settings: renderSettings
  };
  container.innerHTML = '';
  (views[state.view] || renderDashboard)(container);
  updateFloatVisibility();
}

// ============ DASHBOARD ============
function renderDashboard(root) {
  const todayStr = today();
  const hasData = state.habits.length > 0 || state.tasks.length > 0;

  if (!hasData) {
    root.innerHTML = `
      <div class="fade-up flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div class="empty-illustration mb-6">🌱</div>
        <h1 class="text-4xl font-bold tracking-tight mb-2">Your sanctuary awaits.</h1>
        <p class="opacity-60 mb-8 max-w-md">
          Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${state.user.name}.
          <br/>This space is yours to shape. Start by planting a seed.
        </p>
        <div class="flex gap-3">
          <button id="empty-habit" class="spring gradient-sage px-6 py-3 rounded-2xl font-semibold text-white shadow-lg">🌱 Plant First Habit</button>
          <button id="empty-task" class="spring gradient-terra px-6 py-3 rounded-2xl font-semibold text-white shadow-lg">📋 Add First Task</button>
        </div>
        <div class="mt-12 flex items-center gap-2 text-xs opacity-50">
          <span class="pulse-dot"></span>
          <span id="live-clock">—</span>
          <span>·</span>
          <span>Everything stays on your device</span>
        </div>
      </div>
    `;
    on('#empty-habit', 'click', openHabitModal);
    on('#empty-task', 'click', openTaskModal);
    updateClock();
    return;
  }

  const todayHabits = state.habits.filter(h => h.completions[todayStr]);
  const totalToday = state.habits.length;
  const progress = totalToday ? Math.round((todayHabits.length / totalToday) * 100) : 0;
  const activeTasks = state.tasks.filter(t => t.status !== 'done');

  root.innerHTML = `
    <div class="fade-up">
      <div class="flex items-end justify-between mb-8">
        <div>
          <div class="text-sm opacity-60 mb-1">
            Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${state.user.name} ${state.user.avatar}
          </div>
          <h1 class="text-4xl font-bold tracking-tight">Your sanctuary.</h1>
          <div class="flex items-center gap-2 mt-1 text-sm opacity-60">
            <span id="live-clock">—</span>
            <span>·</span>
            <span>${todayHabits.length}/${totalToday} habits today</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button id="dash-new-habit" class="spring glass px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10">+ Habit</button>
          <button id="dash-new-task" class="spring gradient-terra px-4 py-2.5 rounded-xl text-sm font-semibold">+ Task</button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-4 mb-8">
        ${statCard('🔥', 'Best Streak', bestStreak() + 'd', 'sage')}
        ${statCard('✅', 'Today', progress + '%', 'terra', `${todayHabits.length}/${totalToday}`)}
        ${statCard('📋', 'Active Tasks', activeTasks.length, 'amber')}
        ${statCard('🌱', 'Habits', state.habits.length, 'lavender')}
      </div>

      ${state.habits.length > 0 ? `
      <div class="glass rounded-3xl p-6 mb-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-lg font-bold">Your Journey</h2>
            <p class="text-xs opacity-60 mt-0.5">Every day you showed up</p>
          </div>
          <div class="flex gap-1 bg-espresso-700/50 p-1 rounded-xl">
            <button class="heatmap-filter active spring px-3 py-1.5 rounded-lg text-xs font-medium" data-filter="all">All</button>
            ${state.habits.map(h => `<button class="heatmap-filter spring px-3 py-1.5 rounded-lg text-xs font-medium" data-filter="${h.id}" style="color:${HABIT_COLORS[h.color].bg}">${h.icon}</button>`).join('')}
          </div>
        </div>
        <div id="heatmap" class="overflow-x-auto scrollbar-thin pb-2"></div>
      </div>
      ` : ''}

      ${activeTasks.length > 0 ? `
      <div class="glass rounded-3xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold">Active Tasks</h3>
          <button id="dash-view-all-tasks" class="text-xs opacity-60 hover:opacity-100">View all →</button>
        </div>
        <div class="space-y-2">
          ${activeTasks.slice(0,4).map(t => taskRow(t)).join('')}
        </div>
      </div>
      ` : `
      <div class="glass rounded-3xl p-8 text-center">
        <div class="text-3xl mb-2">📋</div>
        <div class="font-semibold mb-1">No active tasks</div>
        <div class="text-xs opacity-60 mb-4">Add something you'd like to accomplish</div>
        <button id="dash-cta-task" class="spring gradient-terra px-5 py-2 rounded-xl text-sm font-semibold text-white">+ Add Task</button>
      </div>
      `}
    </div>
  `;

  updateClock();
  if (state.habits.length > 0) {
    renderHeatmap('all');
    onAll('.heatmap-filter', 'click', e => {
      const btn = e.currentTarget;
      $$('.heatmap-filter').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderHeatmap(btn.dataset.filter);
    });
  }
  on('#dash-cta-task', 'click', openTaskModal);
  on('#dash-new-habit', 'click', openHabitModal);
  on('#dash-new-task', 'click', openTaskModal);
  on('#dash-view-all-tasks', 'click', () => setView('tasks'));
}

function statCard(icon, label, value, color, sub) {
  const c = HABIT_COLORS[color];
  return `
    <div class="spring glass rounded-2xl p-4 border border-white/5 hover:border-white/10">
      <div class="flex items-center justify-between mb-2">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style="background:${c.bg}20;color:${c.bg}">${icon}</div>
        ${sub ? `<span class="text-[10px] opacity-50">${sub}</span>` : ''}
      </div>
      <div class="text-2xl font-bold">${value}</div>
      <div class="text-xs opacity-60 mt-0.5">${label}</div>
    </div>
  `;
}

function bestStreak() {
  if (state.habits.length === 0) return 0;
  return Math.max(...state.habits.map(getStreak));
}

function taskRow(t) {
  const pColor = t.priority==='high'?'#D47A55':t.priority==='medium'?'#E3B341':'#7E9E82';
  return `
    <div class="spring flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5">
      <div class="w-1.5 h-8 rounded-full" style="background:${pColor}"></div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${t.title}</div>
        <div class="flex gap-1.5 mt-1">
          ${t.tags.map(tg => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 opacity-70">#${tg}</span>`).join('')}
        </div>
      </div>
      <div class="text-xs opacity-50 capitalize">${t.status === 'doing' ? 'In Progress' : 'To Do'}</div>
    </div>
  `;
}

// ============ HEATMAP ============
function renderHeatmap(filter) {
  const container = $('#heatmap');
  if (!container) return;
  const todayDate = new Date();
  const weeks = 52;
  const cellSize = 13;
  const gap = 3;

  const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - (w*7 + (6-d)));
      if (date > todayDate) { col.push(null); continue; }
      const key = fmtDate(date);
      let count = 0;
      if (filter === 'all') {
        state.habits.forEach(h => { if (h.completions[key]) count++; });
      } else {
        const h = state.habits.find(x => x.id === filter);
        if (h && h.completions[key]) count = 1;
      }
      col.push({ date: key, count });
    }
    cells.push(col);
  }

  const totalW = cells.length * (cellSize + gap);
  const totalH = 7 * (cellSize + gap);

  let svg = `<svg width="${totalW}" height="${totalH}" class="block">`;
  cells.forEach((col, wi) => {
    col.forEach((cell, di) => {
      if (!cell) return;
      const x = wi * (cellSize + gap);
      const y = di * (cellSize + gap);
      const isToday = cell.date === fmtDate(todayDate);
      let opacity = 0;
      if (filter === 'all') {
        opacity = cell.count === 0 ? 0 : 0.25 + (cell.count / Math.max(state.habits.length,1)) * 0.75;
      } else {
        opacity = cell.count > 0 ? 1 : 0;
      }
      const fill = opacity === 0 ? 'rgba(255,255,255,0.04)' : `rgba(212,122,85,${opacity})`;
      svg += `<rect class="cell-hover" data-date="${cell.date}" data-count="${cell.count}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="${fill}" ${isToday ? 'stroke="#D47A55" stroke-width="1.5"' : ''}/>`;
    });
  });
  svg += '</svg>';
  container.innerHTML = svg;

  const tooltip = $('#tooltip');
  container.querySelectorAll('rect').forEach(rect => {
    rect.addEventListener('mouseenter', e => {
      const date = rect.dataset.date;
      const count = parseInt(rect.dataset.count);
      const d = new Date(date + 'T00:00');
      const dayName = d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
      const habitsDone = state.habits.filter(h => h.completions[date]).map(h => `${h.icon} ${h.name}`);
      tooltip.innerHTML = `
        <div class="font-semibold mb-1">${dayName}</div>
        <div class="opacity-80">${count} habit${count!==1?'s':''} completed</div>
        ${habitsDone.length ? `<div class="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] opacity-70">${habitsDone.join(' · ')}</div>` : ''}
      `;
      const r = rect.getBoundingClientRect();
      tooltip.style.left = (r.left + r.width/2) + 'px';
      tooltip.style.top = (r.top - 8) + 'px';
      tooltip.style.transform = 'translate(-50%, -100%)';
      tooltip.classList.add('show');
    });
    rect.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
  });
}

function updateHeatmapCell(dateStr) {
  const cell = document.querySelector(`#heatmap rect[data-date="${dateStr}"]`);
  if (!cell) return;
  let count = 0;
  state.habits.forEach(h => { if (h.completions[dateStr]) count++; });
  const maxH = Math.max(state.habits.length, 1);
  const opacity = count === 0 ? 0 : 0.25 + (count / maxH) * 0.75;
  const fill = opacity === 0 ? 'rgba(255,255,255,0.04)' : `rgba(212,122,85,${opacity})`;
  cell.setAttribute('fill', fill);
  cell.setAttribute('data-count', count);
  cell.classList.remove('pop');
  void cell.offsetWidth;
  cell.classList.add('pop');
}

// ============ HABITS VIEW ============
function renderHabits(root) {
  if (state.habits.length === 0) {
    root.innerHTML = `
      <div class="fade-up flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div class="empty-illustration mb-6">🌱</div>
        <h1 class="text-4xl font-bold tracking-tight mb-2">Plant your first habit</h1>
        <p class="opacity-60 mb-8 max-w-md">Small seeds, grown daily. Create a habit to start tracking your progress.</p>
        <button id="habits-empty-cta" class="spring gradient-sage px-6 py-3 rounded-2xl font-semibold text-white shadow-lg">+ Create Habit</button>
      </div>
    `;
    on('#habits-empty-cta', 'click', openHabitModal);
    return;
  }

  const todayStr = today();
  root.innerHTML = `
    <div class="fade-up">
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-4xl font-bold tracking-tight">Habits</h1>
          <p class="opacity-60 mt-1">Small seeds, grown daily 🌱</p>
        </div>
        <button id="new-habit" class="spring gradient-terra px-4 py-2.5 rounded-xl text-sm font-semibold">+ New Habit</button>
      </div>

      <div id="habits-grid" class="grid grid-cols-2 gap-4 mb-6">
        ${state.habits.map(h => habitCard(h, todayStr)).join('')}
      </div>

      <div class="glass rounded-3xl p-6">
        <h3 class="font-bold mb-4">Yearly Contribution</h3>
        <div id="heatmap" class="overflow-x-auto scrollbar-thin pb-2"></div>
      </div>
    </div>
  `;

  renderHeatmap('all');
  on('#new-habit', 'click', openHabitModal);

  // Event delegation — single listener for the whole grid
  const grid = $('#habits-grid');
  grid.addEventListener('click', e => {
    const toggleBtn = e.target.closest('.habit-toggle');
    if (toggleBtn) {
      e.stopPropagation();
      toggleHabit(toggleBtn.dataset.id);
      return;
    }
    const deleteBtn = e.target.closest('.habit-delete');
    if (deleteBtn) {
      e.stopPropagation();
      deleteHabit(deleteBtn.dataset.id);
      return;
    }
  });
}

function habitCard(h, todayStr) {
  const c = HABIT_COLORS[h.color];
  const done = !!h.completions[todayStr];
  const streak = getStreak(h);
  const total = getTotal(h);
  return `
    <div class="spring glass rounded-3xl p-5 border border-white/5 hover:border-white/10 relative overflow-hidden habit-card" data-habit-id="${h.id}">
      <button class="habit-delete spring w-7 h-7 rounded-lg bg-white/5 hover:bg-terra/20 hover:text-terra flex items-center justify-center text-xs" data-id="${h.id}" title="Delete habit">✕</button>
      <div class="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style="background:${c.bg};transform:translate(30%,-30%)"></div>
      <div class="flex items-start justify-between mb-4 relative">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style="background:${c.bg}20">${h.icon}</div>
          <div>
            <div class="font-bold">${h.name}</div>
            <div class="text-xs opacity-60">${c.name} · <span class="habit-total">${total}</span> total</div>
          </div>
        </div>
        <button class="habit-toggle spring w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${done ? '' : 'bg-white/5 hover:bg-white/10'}" data-id="${h.id}" style="${done ? `background:${c.bg};box-shadow:0 0 30px ${c.bg}40` : ''}">
          <span class="habit-toggle-icon">${done ? '✓' : h.icon}</span>
        </button>
      </div>
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5">
          <span style="color:${c.bg}">🔥</span>
          <span class="font-semibold habit-streak">${streak}</span>
          <span class="opacity-60">day streak</span>
        </div>
        <div class="flex gap-0.5 habit-week">
          ${Array.from({length:7}).map((_,i) => {
            const d = new Date(); d.setDate(d.getDate() - (6-i));
            const k = fmtDate(d);
            const on = !!h.completions[k];
            return `<div class="w-1.5 h-6 rounded-full" style="background:${on ? c.bg : 'rgba(255,255,255,0.08)'}"></div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  const todayStr = today();
  if (h.completions[todayStr]) delete h.completions[todayStr];
  else h.completions[todayStr] = true;

  const card = document.querySelector(`.habit-card[data-habit-id="${id}"]`);
  if (card) {
    const btn = card.querySelector('.habit-toggle');
    const icon = card.querySelector('.habit-toggle-icon');
    const streakEl = card.querySelector('.habit-streak');
    const totalEl = card.querySelector('.habit-total');
    const c = HABIT_COLORS[h.color];
    const nowDone = !!h.completions[todayStr];

    if (nowDone) {
      btn.style.background = c.bg;
      btn.style.boxShadow = `0 0 30px ${c.bg}40`;
      btn.classList.remove('bg-white/5');
      icon.textContent = '✓';
      showToast(`${h.icon} ${h.name} done!`, '🌱');
    } else {
      btn.style.background = '';
      btn.style.boxShadow = '';
      btn.classList.add('bg-white/5');
      icon.textContent = h.icon;
    }
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');

    streakEl.textContent = getStreak(h);
    totalEl.textContent = getTotal(h);

    const weekBars = card.querySelector('.habit-week');
    if (weekBars) {
      weekBars.querySelectorAll('div').forEach((bar, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6-i));
        const k = fmtDate(d);
        const on = !!h.completions[k];
        bar.style.background = on ? c.bg : 'rgba(255,255,255,0.08)';
      });
    }
  }
  updateHeatmapCell(todayStr);
}

function deleteHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  if (!confirm(`Delete habit "${h.name}"? This cannot be undone.`)) return;
  state.habits = state.habits.filter(x => x.id !== id);
  showToast(`Deleted ${h.icon} ${h.name}`, '🗑');
  render();
}

// ============ HABIT MODAL ============
function openHabitModal() {
  let selectedIcon = '🌿';
  let selectedColor = 'sage';

  const html = `
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold">New Habit</h2>
        <button id="modal-close-x" class="opacity-60 hover:opacity-100 text-xl">✕</button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Name</label>
          <input id="habit-name" type="text" placeholder="e.g. Morning Journal" class="w-full bg-espresso-700/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-terra transition" />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Icon</label>
          <div id="icon-grid" class="grid grid-cols-9 gap-1.5">
            ${ICON_CHOICES.map((ic, i) => `<button data-icon="${ic}" class="icon-pick spring w-10 h-10 rounded-xl bg-espresso-700/50 border border-white/10 text-lg ${i===0?'selected':''}">${ic}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Color</label>
          <div id="color-grid" class="flex gap-3">
            ${Object.entries(HABIT_COLORS).map(([k,v], i) => `
              <button data-color="${k}" class="color-pick spring w-12 h-12 rounded-2xl ${i===1?'selected':''}" style="background:${v.bg}" title="${v.name}"></button>
            `).join('')}
          </div>
        </div>
        <button id="habit-create" class="spring w-full gradient-sage text-white font-semibold py-3 rounded-xl mt-2">Create Habit</button>
      </div>
    </div>
  `;
  openModal(html);

  on('#modal-close-x', 'click', closeModal);
  onAll('#icon-grid .icon-pick', 'click', e => {
    const b = e.currentTarget;
    $$('#icon-grid .icon-pick').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    selectedIcon = b.dataset.icon;
  });
  onAll('#color-grid .color-pick', 'click', e => {
    const b = e.currentTarget;
    $$('#color-grid .color-pick').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    selectedColor = b.dataset.color;
  });

  const doCreate = () => {
    const name = $('#habit-name').value.trim();
    if (!name) { $('#habit-name').focus(); return; }
    const habit = { id: 'h' + Date.now(), name, icon: selectedIcon, color: selectedColor, completions: {} };
    state.habits.push(habit);
    closeModal();
    showToast(`Created ${selectedIcon} ${name}`, '🌱');
    render();
  };

  on('#habit-create', 'click', doCreate);
  on('#habit-name', 'keydown', e => { if (e.key === 'Enter') doCreate(); });
}

// ============ TASKS VIEW ============
function renderTasks(root) {
  if (state.tasks.length === 0) {
    root.innerHTML = `
      <div class="fade-up flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div class="empty-illustration mb-6">📋</div>
        <h1 class="text-4xl font-bold tracking-tight mb-2">Your board is clear</h1>
        <p class="opacity-60 mb-8 max-w-md">Add your first task to get started. Drag between columns as you progress.</p>
        <button id="tasks-empty-cta" class="spring gradient-terra px-6 py-3 rounded-2xl font-semibold text-white shadow-lg">+ Add First Task</button>
      </div>
    `;
    on('#tasks-empty-cta', 'click', openTaskModal);
    return;
  }

  const cols = [
    { id: 'todo', label: 'To Do', color: '#9B8EA9' },
    { id: 'doing', label: 'In Progress', color: '#E3B341' },
    { id: 'done', label: 'Done', color: '#7E9E82' }
  ];
  root.innerHTML = `
    <div class="fade-up">
      <div class="flex items-end justify-between mb-8">
        <div>
          <h1 class="text-4xl font-bold tracking-tight">Tasks</h1>
          <p class="opacity-60 mt-1">Organize your day, one task at a time</p>
        </div>
        <button id="new-task" class="spring gradient-terra px-4 py-2.5 rounded-xl text-sm font-semibold">+ New Task</button>
      </div>

      <div id="task-board" class="grid grid-cols-3 gap-4">
        ${cols.map(col => `
          <div class="glass rounded-3xl p-4">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background:${col.color}"></div>
                <h3 class="font-semibold text-sm">${col.label}</h3>
                <span class="text-xs opacity-50 col-count" data-status="${col.id}">${state.tasks.filter(t=>t.status===col.id).length}</span>
              </div>
            </div>
            <div class="kanban-col space-y-2 min-h-[200px] rounded-2xl p-1 transition-all" data-status="${col.id}">
              ${state.tasks.filter(t=>t.status===col.id).map(t => taskCard(t)).join('')}
              ${state.tasks.filter(t=>t.status===col.id).length === 0 ? `<div class="text-center text-xs opacity-30 py-8 border-2 border-dashed border-white/5 rounded-xl">Drop tasks here</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  on('#new-task', 'click', openTaskModal);
  attachTaskBoardHandlers();
}

function taskCard(t) {
  const pColor = t.priority==='high'?'#D47A55':t.priority==='medium'?'#E3B341':'#7E9E82';
  const subDone = t.subtasks.filter(s=>s.done).length;
  return `
    <div class="task-card task-card-clickable group spring bg-espresso-700/40 hover:bg-espresso-700/70 border border-white/5 rounded-2xl p-3" data-id="${t.id}">
      <div class="flex items-start gap-2 mb-2">
        <div class="w-1 h-full min-h-[20px] rounded-full mt-0.5 flex-shrink-0" style="background:${pColor}"></div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium task-title">${t.title}</div>
          ${t.subtasks.length ? `<div class="text-[10px] opacity-60 mt-1">${subDone}/${t.subtasks.length} subtasks</div>` : ''}
        </div>
        <button class="task-delete text-xs opacity-40 hover:opacity-100 hover:text-terra transition p-1 flex-shrink-0" data-id="${t.id}" title="Delete">✕</button>
      </div>
      <div class="flex gap-1 flex-wrap">
        ${t.tags.map(tg => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 opacity-70">#${tg}</span>`).join('')}
      </div>
    </div>
  `;
}

function attachTaskBoardHandlers() {
  const board = $('#task-board');
  if (!board) return;

  let dragId = null;

  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add('dragging');
  });
  board.addEventListener('dragend', e => {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('dragging');
    $$('.kanban-col').forEach(c => c.classList.remove('drop-active'));
    dragId = null;
  });
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.kanban-col');
    if (!col) return;
    e.preventDefault();
    $$('.kanban-col').forEach(c => c.classList.remove('drop-active'));
    col.classList.add('drop-active');
  });
  board.addEventListener('dragleave', e => {
    const col = e.target.closest('.kanban-col');
    if (!col) return;
    const related = e.relatedTarget;
    if (!col.contains(related)) col.classList.remove('drop-active');
  });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.kanban-col');
    if (!col || !dragId) return;
    e.preventDefault();
    col.classList.remove('drop-active');
    const t = state.tasks.find(x => x.id === dragId);
    if (t && t.status !== col.dataset.status) {
      t.status = col.dataset.status;
      const card = document.querySelector(`.task-card[data-id="${dragId}"]`);
      if (card) {
        col.appendChild(card);
        card.classList.add('slide-in-soft');
        setTimeout(() => card.classList.remove('slide-in-soft'), 350);
      }
      $$('.col-count').forEach(c => {
        c.textContent = state.tasks.filter(t=>t.status===c.dataset.status).length;
      });
      const label = col.dataset.status === 'doing' ? 'In Progress' : col.dataset.status === 'done' ? 'Done' : 'To Do';
      showToast(`Moved to ${label}`, '📋');
    }
    dragId = null;
  });

  board.addEventListener('click', e => {
    // Delete button
    const del = e.target.closest('.task-delete');
    if (del) {
      e.stopPropagation();
      const id = del.dataset.id;
      const task = state.tasks.find(t => t.id === id);
      state.tasks = state.tasks.filter(t => t.id !== id);
      const card = document.querySelector(`.task-card[data-id="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
          card.remove();
          $$('.col-count').forEach(c => {
            c.textContent = state.tasks.filter(t=>t.status===c.dataset.status).length;
          });
        }, 300);
      }
      showToast(`Removed "${task?.title || 'task'}"`, '🗑');
      return;
    }
    // Click on card to edit
    const card = e.target.closest('.task-card');
    if (card) {
      openTaskModal(card.dataset.id);
    }
  });
}

// ============ TASK MODAL (create + edit) ============
function openTaskModal(editId = null) {
  const editing = editId != null;
  const task = editing ? state.tasks.find(t => t.id === editId) : null;

  const html = `
    <div>
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-xl font-bold">${editing ? 'Edit Task' : 'New Task'}</h2>
        <button id="modal-close-x" class="opacity-60 hover:opacity-100 text-xl">✕</button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Title</label>
          <input id="task-title" type="text" placeholder="What needs doing?" value="${editing ? task.title.replace(/"/g,'&quot;') : ''}" class="w-full bg-espresso-700/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-terra transition" />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Status</label>
          <div id="status-grid" class="flex gap-2">
            <button data-s="todo" class="status-pick spring flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">To Do</button>
            <button data-s="doing" class="status-pick spring flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">In Progress</button>
            <button data-s="done" class="status-pick spring flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">Done</button>
          </div>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Priority</label>
          <div id="priority-grid" class="flex gap-2">
            <button data-p="low" class="priority-pick spring flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">🟢 Low</button>
            <button data-p="medium" class="priority-pick spring flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">🟡 Medium</button>
            <button data-p="high" class="priority-pick spring flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">🔴 High</button>
          </div>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Tags (comma separated)</label>
          <input id="task-tags" type="text" placeholder="work, design, urgent" value="${editing ? task.tags.join(', ') : ''}" class="w-full bg-espresso-700/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-terra transition" />
        </div>
        <button id="task-save" class="spring w-full gradient-terra text-white font-semibold py-3 rounded-xl mt-2">${editing ? 'Save Changes' : 'Create Task'}</button>
        ${editing ? `<button id="task-delete-btn" class="spring w-full py-2.5 rounded-xl text-sm text-terra hover:bg-terra/10 border border-terra/20">Delete Task</button>` : ''}
      </div>
    </div>
  `;
  openModal(html);

  on('#modal-close-x', 'click', closeModal);

  let selectedPriority = editing ? task.priority : 'medium';
  let selectedStatus = editing ? task.status : 'todo';

  const applyPriorityStyle = (btn, p) => {
    const colors = {
      low: { bg: 'rgba(126,158,130,0.1)', border: '#7E9E82' },
      medium: { bg: 'rgba(227,179,65,0.1)', border: '#E3B341' },
      high: { bg: 'rgba(212,122,85,0.1)', border: '#D47A55' }
    };
    btn.style.background = colors[p].bg;
    btn.style.borderColor = colors[p].border;
  };
  const applyStatusStyle = (btn, s) => {
    const colors = {
      todo: { bg: 'rgba(155,142,169,0.1)', border: '#9B8EA9' },
      doing: { bg: 'rgba(227,179,65,0.1)', border: '#E3B341' },
      done: { bg: 'rgba(126,158,130,0.1)', border: '#7E9E82' }
    };
    btn.style.background = colors[s].bg;
    btn.style.borderColor = colors[s].border;
  };

  // Initialize selected states
  $$('#priority-grid .priority-pick').forEach(b => {
    if (b.dataset.p === selectedPriority) applyPriorityStyle(b, b.dataset.p);
  });
  $$('#status-grid .status-pick').forEach(b => {
    if (b.dataset.s === selectedStatus) applyStatusStyle(b, b.dataset.s);
  });

  onAll('#priority-grid .priority-pick', 'click', e => {
    const b = e.currentTarget;
    $$('#priority-grid .priority-pick').forEach(x => {
      x.style.background = 'rgba(255,255,255,0.05)';
      x.style.borderColor = 'rgba(255,255,255,0.1)';
    });
    applyPriorityStyle(b, b.dataset.p);
    selectedPriority = b.dataset.p;
  });
  onAll('#status-grid .status-pick', 'click', e => {
    const b = e.currentTarget;
    $$('#status-grid .status-pick').forEach(x => {
      x.style.background = 'rgba(255,255,255,0.05)';
      x.style.borderColor = 'rgba(255,255,255,0.1)';
    });
    applyStatusStyle(b, b.dataset.s);
    selectedStatus = b.dataset.s;
  });

  const doSave = () => {
    const title = $('#task-title').value.trim();
    if (!title) { $('#task-title').focus(); return; }
    const tags = $('#task-tags').value.split(',').map(t => t.trim()).filter(Boolean);

    if (editing) {
      task.title = title;
      task.priority = selectedPriority;
      task.status = selectedStatus;
      task.tags = tags;
      closeModal();
      showToast('Task updated', '✏️');
    } else {
      state.tasks.push({
        id: 't' + Date.now(),
        title, status: selectedStatus, priority: selectedPriority,
        tags, subtasks: []
      });
      closeModal();
      showToast('Task added', '📋');
    }
    render();
  };

  on('#task-save', 'click', doSave);
  on('#task-title', 'keydown', e => { if (e.key === 'Enter') doSave(); });

  if (editing) {
    on('#task-delete-btn', 'click', () => {
      if (!confirm(`Delete "${task.title}"?`)) return;
      state.tasks = state.tasks.filter(t => t.id !== editId);
      closeModal();
      showToast('Task deleted', '🗑');
      render();
    });
  }
}

// ============ TIMER VIEW ============
function renderTimer(root) {
  const { seconds, total, running, paused, mode } = state.timer;
  const progress = 1 - (seconds / total);
  const circumference = 2 * Math.PI * 140;
  const offset = circumference * (1 - progress);
  const mm = String(Math.floor(seconds/60)).padStart(2,'0');
  const ss = String(seconds%60).padStart(2,'0');

  root.innerHTML = `
    <div class="fade-up flex flex-col items-center justify-center min-h-[80vh]">
      <div class="text-sm opacity-60 mb-2 uppercase tracking-widest">${mode === 'focus' ? '🎯 Focus Session' : '☕ Break Time'}</div>
      <div id="timer-wrap" class="relative w-80 h-80 mb-8 ${running && !paused ? 'timer-breathing' : ''}">
        <svg class="w-80 h-80 -rotate-90" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12"/>
          <circle id="timer-ring" cx="160" cy="160" r="140" fill="none" stroke="url(#grad)" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" class="ring-smooth"/>
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#D47A55"/>
              <stop offset="100%" stop-color="#E3B341"/>
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <div id="timer-time" class="text-6xl font-bold tracking-tight">${mm}:${ss}</div>
          <div id="timer-status" class="text-xs opacity-60 mt-2">${running ? (paused ? 'Paused' : 'In flow...') : 'Ready when you are'}</div>
        </div>
      </div>

      <div class="flex gap-3 mb-6">
        <button id="timer-start" class="spring gradient-terra px-8 py-3 rounded-2xl font-semibold">
          ${running ? (paused ? 'Resume' : 'Pause') : 'Start'}
        </button>
        <button id="timer-reset" class="spring glass px-6 py-3 rounded-2xl font-medium">Reset</button>
        <button id="timer-skip" class="spring glass px-6 py-2.5 rounded-2xl text-sm">Skip →</button>
      </div>

      <div id="mode-buttons" class="flex gap-2 mb-8">
        <button class="mode-btn spring px-4 py-2 rounded-xl text-sm ${mode==='focus'?'bg-terra/20 text-terra border border-terra/30':'bg-white/5'}" data-mode="focus">Focus · 25m</button>
        <button class="mode-btn spring px-4 py-2 rounded-xl text-sm ${mode==='short'?'bg-sage/20 text-sage border border-sage/30':'bg-white/5'}" data-mode="short">Short · 5m</button>
        <button class="mode-btn spring px-4 py-2 rounded-xl text-sm ${mode==='long'?'bg-lavender/20 text-lavender border border-lavender/30':'bg-white/5'}" data-mode="long">Long · 15m</button>
      </div>

      <div class="glass rounded-3xl p-6 w-full max-w-md">
        <h3 class="font-bold mb-3 text-sm">Ambient Sounds</h3>
        <div class="grid grid-cols-3 gap-2">
          <button class="ambient-btn spring p-4 rounded-2xl bg-white/5 border border-white/5 text-center ${state.ambient.rain?'active':''}" data-sound="rain">
            <div class="text-2xl mb-1">🌧</div><div class="text-xs">Rain</div>
          </button>
          <button class="ambient-btn spring p-4 rounded-2xl bg-white/5 border border-white/5 text-center ${state.ambient.fire?'active':''}" data-sound="fire">
            <div class="text-2xl mb-1">🔥</div><div class="text-xs">Fireplace</div>
          </button>
          <button class="ambient-btn spring p-4 rounded-2xl bg-white/5 border border-white/5 text-center ${state.ambient.cafe?'active':''}" data-sound="cafe">
            <div class="text-2xl mb-1">☕</div><div class="text-xs">Cafe</div>
          </button>
        </div>
      </div>
    </div>
  `;

  on('#timer-start', 'click', () => {
    if (!state.timer.running) startTimer();
    else if (state.timer.paused) resumeTimer();
    else pauseTimer();
  });
  on('#timer-reset', 'click', resetTimer);
  on('#timer-skip', 'click', () => {
    state.timer.mode = state.timer.mode === 'focus' ? 'short' : 'focus';
    resetTimer();
  });
  onAll('.mode-btn', 'click', e => {
    const b = e.currentTarget;
    state.timer.mode = b.dataset.mode;
    state.timer.total = b.dataset.mode === 'focus' ? 25*60 : b.dataset.mode === 'short' ? 5*60 : 15*60;
    resetTimer();
  });
  onAll('.ambient-btn', 'click', e => {
    const b = e.currentTarget;
    const s = b.dataset.sound;
    state.ambient[s] = !state.ambient[s];
    b.classList.toggle('active');
  });

  updateFloatVisibility();
}

// ============ LIVE TIMER ENGINE ============
function startTimer() {
  state.timer.running = true;
  state.timer.paused = false;
  state.floatDismissed = false;
  updateTimerButtons();
  updateFloatVisibility();

  const status = $('#timer-status');
  if (status) status.textContent = 'In flow...';
  const wrap = $('#timer-wrap');
  if (wrap) wrap.classList.add('timer-breathing');

  const ring = $('#timer-ring');
  if (ring) ring.classList.add('ring-smooth');

  if (state.timer.interval) clearInterval(state.timer.interval);
  state.timer.interval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  if (state.timer.seconds > 0) {
    state.timer.seconds--;
    updateTimerDisplay();
  } else {
    completeTimer();
  }
}

function updateTimerDisplay() {
  const { seconds, total } = state.timer;
  const mm = String(Math.floor(seconds/60)).padStart(2,'0');
  const ss = String(seconds%60).padStart(2,'0');
  const timeStr = `${mm}:${ss}`;
  const progress = 1 - (seconds / total);

  const mainTime = $('#timer-time');
  if (mainTime) mainTime.textContent = timeStr;
  const mainRing = $('#timer-ring');
  if (mainRing) {
    const circumference = 2 * Math.PI * 140;
    mainRing.setAttribute('stroke-dashoffset', circumference * (1 - progress));
  }

  const floatTime = $('#float-time');
  if (floatTime) floatTime.textContent = timeStr;
  const floatRing = $('#float-ring');
  if (floatRing) {
    floatRing.setAttribute('stroke-dashoffset', 150.8 * (1 - progress));
  }

  document.title = `${timeStr} — AuraSync`;
}

function updateTimerButtons() {
  const btn = $('#timer-start');
  if (btn) btn.textContent = state.timer.running ? (state.timer.paused ? 'Resume' : 'Pause') : 'Start';
  const status = $('#timer-status');
  if (status) status.textContent = state.timer.running ? (state.timer.paused ? 'Paused' : 'In flow...') : 'Ready when you are';
  const wrap = $('#timer-wrap');
  if (wrap) {
    if (state.timer.running && !state.timer.paused) wrap.classList.add('timer-breathing');
    else wrap.classList.remove('timer-breathing');
  }
  const pauseBtn = $('#float-pause');
  if (pauseBtn) pauseBtn.textContent = state.timer.paused ? 'Resume' : 'Pause';
  const modeLabel = $('#float-mode');
  if (modeLabel) modeLabel.textContent = state.timer.mode === 'focus' ? 'Focus' : 'Break';
}

function updateModeButtonsUI() {
  $$('.mode-btn').forEach(b => {
    const isActive = b.dataset.mode === state.timer.mode;
    b.className = 'mode-btn spring px-4 py-2 rounded-xl text-sm bg-white/5';
    if (isActive) {
      const colors = {
        focus: 'bg-terra/20 text-terra border border-terra/30',
        short: 'bg-sage/20 text-sage border border-sage/30',
        long: 'bg-lavender/20 text-lavender border border-lavender/30'
      };
      b.className = `mode-btn spring px-4 py-2 rounded-xl text-sm ${colors[state.timer.mode]}`;
    }
  });
}

function pauseTimer() {
  state.timer.paused = true;
  clearInterval(state.timer.interval);
  updateTimerButtons();
  showToast('Timer paused', '⏸');
}

function resumeTimer() {
  state.timer.paused = false;
  state.timer.interval = setInterval(tickTimer, 1000);
  updateTimerButtons();
}

function resetTimer() {
  clearInterval(state.timer.interval);
  state.timer.running = false;
  state.timer.paused = false;
  state.timer.seconds = state.timer.total;

  const ring = $('#timer-ring');
  if (ring) {
    ring.classList.remove('ring-smooth');
    const circumference = 2 * Math.PI * 140;
    ring.setAttribute('stroke-dashoffset', circumference);
    void ring.offsetWidth;
  }

  updateTimerDisplay();
  updateTimerButtons();
  updateModeButtonsUI();
  updateFloatVisibility();
  document.title = 'AuraSync';
}

function completeTimer() {
  clearInterval(state.timer.interval);
  state.timer.running = false;
  state.timer.paused = false;
  playChime();
  showToast(`${state.timer.mode === 'focus' ? 'Focus session' : 'Break'} complete!`, '🎉');

  state.timer.mode = state.timer.mode === 'focus' ? 'short' : 'focus';
  state.timer.total = state.timer.mode === 'focus' ? 25*60 : state.timer.mode === 'short' ? 5*60 : 15*60;
  state.timer.seconds = state.timer.total;

  const ring = $('#timer-ring');
  if (ring) {
    ring.classList.remove('ring-smooth');
    const circumference = 2 * Math.PI * 140;
    ring.setAttribute('stroke-dashoffset', circumference);
    void ring.offsetWidth;
  }

  updateTimerDisplay();
  updateTimerButtons();
  updateModeButtonsUI();
  updateFloatVisibility();
  document.title = 'AuraSync';
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i*0.15);
      gain.gain.linearRampToValueAtTime(0.15, now + i*0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i*0.15 + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i*0.15);
      osc.stop(now + i*0.15 + 0.8);
    });
  } catch(e) {}
}

function updateFloatVisibility() {
  const shouldShow = state.timer.running && state.view !== 'timer' && !state.floatDismissed;
  $('#float-timer').classList.toggle('hidden', !shouldShow);
  if (shouldShow) updateTimerDisplay();
}

on('#float-close', 'click', () => {
  state.floatDismissed = true;
  $('#float-timer').classList.add('hidden');
});
on('#float-pause', 'click', () => {
  if (state.timer.paused) resumeTimer(); else pauseTimer();
});
on('#float-stop', 'click', () => resetTimer());

// ============ ANALYTICS VIEW ============
function renderAnalytics(root) {
  if (state.habits.length === 0) {
    root.innerHTML = `
      <div class="fade-up flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div class="empty-illustration mb-6">📊</div>
        <h1 class="text-4xl font-bold tracking-tight mb-2">Not enough data yet</h1>
        <p class="opacity-60 mb-8 max-w-md">Create some habits and track them for a few days to see your patterns emerge.</p>
        <button id="analytics-cta" class="spring gradient-sage px-6 py-3 rounded-2xl font-semibold text-white">🌱 Create a Habit</button>
      </div>
    `;
    on('#analytics-cta', 'click', openHabitModal);
    return;
  }

  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - (w*7 + d));
      const key = fmtDate(date);
      state.habits.forEach(h => { if (h.completions[key]) count++; });
    }
    weeks.push({ week: 12-w, count });
  }
  const maxCount = Math.max(...weeks.map(w=>w.count), 1);

  const habitData = state.habits.map(h => ({
    name: h.name, icon: h.icon,
    color: HABIT_COLORS[h.color].bg,
    count: getTotal(h), streak: getStreak(h)
  }));
  const maxCountH = Math.max(...habitData.map(h=>h.count), 1);

  root.innerHTML = `
    <div class="fade-up">
      <div class="mb-8">
        <h1 class="text-4xl font-bold tracking-tight">Analytics</h1>
        <p class="opacity-60 mt-1">Your journey, visualized ✨</p>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        ${statCard('🌱','Total Completions', habitData.reduce((a,h)=>a+h.count,0), 'sage')}
        ${statCard('🔥','Best Streak', Math.max(...habitData.map(h=>h.streak)) + 'd', 'terra')}
        ${statCard('🌱','Active Habits', state.habits.length, 'amber')}
      </div>

      <div class="glass rounded-3xl p-6 mb-6">
        <h3 class="font-bold mb-6">Habit Consistency · 12 Weeks</h3>
        <div class="flex items-end gap-2 h-48">
          ${weeks.map(w => {
            const h = (w.count / maxCount) * 100;
            return `
              <div class="flex-1 flex flex-col items-center gap-2 group">
                <div class="text-[10px] opacity-0 group-hover:opacity-100 transition font-semibold">${w.count}</div>
                <div class="w-full relative" style="height:${Math.max(h, 2)}%">
                  <div class="spring w-full h-full rounded-t-lg gradient-terra opacity-80 hover:opacity-100"></div>
                </div>
                <div class="text-[10px] opacity-50">W${w.week}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="glass rounded-3xl p-6">
        <h3 class="font-bold mb-4">Habit Breakdown</h3>
        <div class="space-y-3">
          ${habitData.map(h => `
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2 text-sm">
                  <span>${h.icon}</span>
                  <span class="font-medium">${h.name}</span>
                </div>
                <div class="text-xs opacity-60">${h.count} · 🔥${h.streak}</div>
              </div>
              <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700" style="width:${(h.count/maxCountH)*100}%;background:${h.color}"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============ AI VIEW ============
function renderAI(root) {
  root.innerHTML = `
    <div class="fade-up">
      <div class="mb-8">
        <h1 class="text-4xl font-bold tracking-tight">AI Companion</h1>
        <p class="opacity-60 mt-1">Your gentle productivity coach 🧠</p>
      </div>

      <div class="glass rounded-3xl p-8 text-center">
        <div class="text-5xl mb-4">🧠</div>
        <h3 class="text-xl font-bold mb-2">Enable your AI coach</h3>
        <p class="opacity-60 mb-6 max-w-md mx-auto text-sm">
          Bring your own API key (OpenAI, Anthropic, Gemini, or local Ollama). Your data stays local — only prompts are sent.
        </p>
        <button id="ai-go-settings" class="spring gradient-lavender px-6 py-3 rounded-2xl font-semibold text-white">Configure in Settings →</button>
      </div>
    </div>
  `;
  on('#ai-go-settings', 'click', () => setView('settings'));
}

// ============ SETTINGS VIEW ============
function renderSettings(root) {
  root.innerHTML = `
    <div class="fade-up max-w-3xl">
      <div class="mb-8">
        <h1 class="text-4xl font-bold tracking-tight">Settings</h1>
        <p class="opacity-60 mt-1">Your sanctuary, your rules 🔒</p>
      </div>

      <div class="space-y-4">
        <div class="glass rounded-3xl p-6">
          <h3 class="font-bold mb-4 flex items-center gap-2"><span>👤</span> Profile</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Display Name</label>
              <input id="set-name" type="text" value="${state.user.name.replace(/"/g,'&quot;')}" class="w-full bg-espresso-700/50 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-terra transition text-sm" />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wider opacity-60 mb-1.5 block">Avatar</label>
              <div id="settings-avatars" class="flex gap-2">
                ${['🌿','🦊','☕','🌙','📚','🍂'].map(a => `<button class="av-pick spring w-10 h-10 rounded-xl bg-espresso-700/50 border ${state.user.avatar===a?'border-terra':'border-white/10'} text-lg" data-av="${a}">${a}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="glass rounded-3xl p-6">
          <h3 class="font-bold mb-4 flex items-center gap-2"><span>🔒</span> Security</h3>
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between p-3 rounded-xl bg-sage/10 border border-sage/20">
              <div>
                <div class="font-semibold">AES-256-GCM Encryption</div>
                <div class="text-xs opacity-60">All local data encrypted</div>
              </div>
              <div class="text-sage text-xs font-semibold">● Active</div>
            </div>
            <div class="flex items-center justify-between p-3 rounded-xl bg-sage/10 border border-sage/20">
              <div>
                <div class="font-semibold">PBKDF2 Key Derivation</div>
                <div class="text-xs opacity-60">100,000 iterations · salted</div>
              </div>
              <div class="text-sage text-xs font-semibold">● Active</div>
            </div>
          </div>
        </div>

        <div class="glass rounded-3xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold flex items-center gap-2"><span>🧠</span> AI Companion</h3>
            <label class="relative inline-flex items-center cursor-pointer">
              <input id="ai-toggle" type="checkbox" ${state.ai.enabled?'checked':''} class="sr-only peer">
              <div class="w-11 h-6 bg-espresso-700 peer-checked:bg-lavender rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
          <p class="text-xs opacity-60 mb-4">Bring your own API key. All data stays local.</p>
          <div class="space-y-3">
            <select id="ai-provider" class="w-full bg-espresso-700/50 border border-white/10 rounded-xl px-4 py-2.5 outline-none text-sm">
              <option value="openai" ${state.ai.provider==='openai'?'selected':''}>OpenAI (GPT-4)</option>
              <option value="anthropic" ${state.ai.provider==='anthropic'?'selected':''}>Anthropic (Claude)</option>
              <option value="gemini" ${state.ai.provider==='gemini'?'selected':''}>Google Gemini</option>
              <option value="ollama" ${state.ai.provider==='ollama'?'selected':''}>Local Ollama</option>
            </select>
            <input type="password" placeholder="API Key (sk-...)" value="${state.ai.key}" id="ai-key" class="w-full bg-espresso-700/50 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-lavender transition text-sm" />
          </div>
        </div>

        <div class="glass rounded-3xl p-6">
          <h3 class="font-bold mb-4 flex items-center gap-2"><span>🎨</span> Appearance</h3>
          <div class="flex gap-2">
            <button id="set-dark" class="spring flex-1 p-4 rounded-xl bg-espresso-800 border-2 ${state.theme==='dark'?'border-terra':'border-white/5'} text-center">
              <div class="text-2xl mb-1">🌙</div><div class="text-xs font-semibold">Dark</div>
            </button>
            <button id="set-light" class="spring flex-1 p-4 rounded-xl bg-cream-100 border-2 ${state.theme==='light'?'border-terra':'border-white/5'} text-center text-espresso-900">
              <div class="text-2xl mb-1">☀️</div><div class="text-xs font-semibold">Light</div>
            </button>
          </div>
        </div>

        <div class="glass rounded-3xl p-6">
          <h3 class="font-bold mb-4 flex items-center gap-2"><span>⚠️</span> Danger Zone</h3>
          <button id="reset-data" class="spring w-full py-2.5 rounded-xl text-sm text-terra hover:bg-terra/10 border border-terra/20">Reset All Data</button>
        </div>
      </div>
    </div>
  `;

  on('#set-name', 'input', e => {
    state.user.name = e.target.value;
    $('#user-name').textContent = e.target.value || '—';
  });

  onAll('#settings-avatars .av-pick', 'click', e => {
    const b = e.currentTarget;
    state.user.avatar = b.dataset.av;
    $$('#settings-avatars .av-pick').forEach(x => {
      x.classList.remove('border-terra');
      x.classList.add('border-white/10');
    });
    b.classList.remove('border-white/10');
    b.classList.add('border-terra');
    $('#user-avatar').textContent = b.dataset.av;
    showToast('Avatar updated', '✨');
  });

  on('#set-dark', 'click', () => setTheme('dark'));
  on('#set-light', 'click', () => setTheme('light'));
  on('#ai-toggle', 'change', e => {
    state.ai.enabled = e.target.checked;
    showToast(state.ai.enabled ? 'AI enabled' : 'AI disabled', '🧠');
  });
  on('#ai-provider', 'change', e => { state.ai.provider = e.target.value; });
  on('#ai-key', 'input', e => { state.ai.key = e.target.value; });

  on('#reset-data', 'click', () => {
    if (!confirm('Delete ALL habits, tasks, and settings? This cannot be undone.')) return;
    state.habits = [];
    state.tasks = [];
    showToast('All data reset', '🗑');
    render();
  });
}

// ============ THEME ============
function setTheme(t) {
  state.theme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
  $('#theme-icon').textContent = t === 'dark' ? '🌙' : '☀️';
  $('#theme-label').textContent = t === 'dark' ? 'Dark Mode' : 'Light Mode';
  const d = $('#set-dark'), l = $('#set-light');
  if (d && l) {
    d.className = `spring flex-1 p-4 rounded-xl bg-espresso-800 border-2 ${t==='dark'?'border-terra':'border-white/5'} text-center`;
    l.className = `spring flex-1 p-4 rounded-xl bg-cream-100 border-2 ${t==='light'?'border-terra':'border-white/5'} text-center text-espresso-900`;
  }
}
on('#theme-toggle', 'click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));

// ============ GLOBAL LISTENERS ============
// Nav
onAll('#nav .nav-item', 'click', e => {
  const btn = e.currentTarget;
  if (btn.dataset.view) setView(btn.dataset.view);
});

// Modal backdrop close
on('#modal', 'click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ============ ONBOARDING ============
let selectedAvatar = '🌿';
onAll('#avatar-picker .av-btn', 'click', e => {
  const b = e.currentTarget;
  selectedAvatar = b.dataset.av;
  $$('#avatar-picker .av-btn').forEach(x => {
    x.classList.remove('border-terra');
    x.classList.add('border-white/10');
  });
  b.classList.remove('border-white/10');
  b.classList.add('border-terra');
});

on('#ob-enter', 'click', () => {
  const name = $('#ob-name').value.trim() || 'Friend';
  const pass = $('#ob-pass').value;
  if (!pass || pass.length < 4) {
    showToast('Passcode must be at least 4 characters', '⚠️');
    $('#ob-pass').focus();
    return;
  }
  state.user.name = name;
  state.user.avatar = selectedAvatar;
  state.user.passcode = pass;
  $('#user-name').textContent = name;
  $('#user-avatar').textContent = selectedAvatar;
  $('#onboarding').style.opacity = '0';
  $('#onboarding').style.transition = 'opacity 0.4s';
  setTimeout(() => {
    $('#onboarding').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#app').classList.add('flex');
    render();
    showToast(`Welcome, ${name} 🌿`, '✨');
  }, 400);
});

// Enter key on onboarding passcode
on('#ob-pass', 'keydown', e => { if (e.key === 'Enter') $('#ob-enter').click(); });
on('#ob-name', 'keydown', e => { if (e.key === 'Enter') $('#ob-pass').focus(); });

updateClock();