const STORAGE_KEY = 'leonida-fieldnotes-v1';
const LEGACY_KEY = 'gta6-trophy-checklist';

export function createProgressStore(trophies, storage = globalThis.localStorage) {
  const byId = new Map(trophies.map(t => [t.id, t]));
  const byName = new Map(trophies.map(t => [t.name, t.id]));
  let persistent = true;
  let state = { earned: [], counters: {}, notes: {}, spoilers: true };

  function normalizeIds(items) {
    if (!Array.isArray(items)) throw new Error('Expected a list of earned trophies.');
    return [...new Set(items.map(value => typeof value === 'string' && byName.has(value)
      ? byName.get(value) : Number(value)).filter(id => byId.has(id)))];
  }

  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) {
      const value = JSON.parse(saved);
      state = { ...state, ...value, earned: normalizeIds(value.earned) };
      if (!state.counters || typeof state.counters !== 'object') state.counters = {};
      if (!state.notes || typeof state.notes !== 'object') state.notes = {};
      state.spoilers = state.spoilers !== false;
    } else {
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy) state.earned = normalizeIds(JSON.parse(legacy));
    }
  } catch { persistent = false; }

  function save() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); persistent = true; }
    catch { persistent = false; }
    return persistent;
  }

  function mergeProgress(payload) {
    if (!Array.isArray(payload) && (!payload || typeof payload !== 'object')) {
      throw new Error('This is not a progress backup.');
    }
    if (!Array.isArray(payload) && payload.format && payload.format !== 'leonida-fieldnotes') {
      throw new Error('Unrecognized backup format.');
    }
    const incoming = normalizeIds(Array.isArray(payload) ? payload : payload.earned);
    const merged = new Set([...state.earned, ...incoming]);
    const added = merged.size - state.earned.length;
    const counters = { ...state.counters };
    const notes = { ...state.notes };
    for (const t of trophies) {
      const value = Number(payload.counters?.[t.id]);
      if (t.target && Number.isFinite(value) && value >= 0) {
        counters[t.id] = Math.max(Number(counters[t.id]) || 0, Math.min(t.target, Math.floor(value)));
      }
      const note = payload.notes?.[t.id];
      if (typeof note === 'string' && note.trim()) {
        const previous = typeof notes[t.id] === 'string' ? notes[t.id] : '';
        notes[t.id] = previous.includes(note) ? previous : [previous, note].filter(Boolean).join('\n').slice(0, 4000);
      }
    }
    state = { ...state, earned: [...merged], counters, notes };
    save();
    return added;
  }

  return {
    get state() { return state; },
    get persistent() { return persistent; },
    has(id) { return state.earned.includes(id); },
    toggle(id) {
      if (!byId.has(id)) return;
      state.earned = this.has(id) ? state.earned.filter(value => value !== id) : [...state.earned, id];
      save();
    },
    setSpoilers(value) { state.spoilers = Boolean(value); save(); },
    setCounter(id, value) {
      const target = byId.get(id)?.target;
      if (!target || !Number.isFinite(value)) return;
      state.counters[id] = Math.max(0, Math.min(target, Math.floor(value)));
      save();
    },
    setNote(id, value) {
      if (!byId.has(id)) return;
      state.notes[id] = String(value).slice(0, 4000);
      save();
    },
    mergeProgress,
    backup() {
      return { format: 'leonida-fieldnotes', version: 1, earned: [...state.earned],
        counters: { ...state.counters }, notes: { ...state.notes }, spoilers: state.spoilers };
    },
  };
}

export function createPreviewStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
