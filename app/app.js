import documentData from './data/trophies.json' with { type: 'json' };
import { createProgressStore, createPreviewStorage } from './store.js';
import { route } from './route.js';

const trophies = documentData.trophies;
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const preview = Boolean(shot);
function browserStorage() {
  if (preview) return createPreviewStorage();
  try { return globalThis.localStorage; }
  catch {
    return { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); } };
  }
}
const store = createProgressStore(trophies, browserStorage());
const byId = new Map(trophies.map(t => [t.id, t]));
const kinds = { all: 'All trophies', story: 'Story', side: 'Activity', collectible: 'Collectible', combat: 'Combat & heists', online: 'Online', 'trophy-hub': 'Completion' };
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const medal = grade => `<span class="medal ${grade}" aria-hidden="true">${({ platinum:'P', gold:'G', silver:'S', bronze:'B' })[grade]}</span>`;
const validGrades = ['all', 'platinum', 'gold', 'silver', 'bronze'];
let view = params.get('view') === 'roadmap' || shot === 'roadmap' ? 'roadmap' : 'tracker';
let kind = kinds[params.get('kind')] ? params.get('kind') : 'all';
let selected = Number(params.get('detail')) || Number(location.hash.replace('#trophy-', '')) || 28;
let toastTimer;
let expandedStages = new Set();

if (preview) {
  store.mergeProgress({ earned: [2, 3, 4, 8, 9, 16, 20, 21, 35, 44, 47, 53, 55], counters: { 15: 97, 17: 18, 18: 6, 30: 1, 31: 46, 32: 23, 40: 2, 52: 92000, 54: 3 } });
  if (shot === 'cover') { kind = 'collectible'; selected = 28; }
  if (shot === 'detail') { $('#grade').value = 'silver'; selected = 17; }
  if (shot === 'filters') { kind = 'story'; selected = 10; }
  if (shot === 'roadmap') selected = null;
  $('#preview-label').hidden = false;
}
if (validGrades.includes(params.get('grade'))) $('#grade').value = params.get('grade');
if (params.get('spoilers') === 'off') store.setSpoilers(false);
if (selected !== null && !byId.has(selected)) selected = 28;
$('#spoilers').checked = store.state.spoilers;

function isShielded(t) { return t.kind === 'story' && store.state.spoilers && !store.has(t.id); }
function displayName(t) { return isShielded(t) ? 'Unrevealed story trophy' : t.name; }
function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
function saveLabel() {
  $('#save-state').textContent = preview ? 'Preview · real save untouched' : store.persistent ? 'Saved on this device' : 'Unsaved · export a backup';
}
function toggleTrophy(id) {
  store.toggle(id);
  render();
  if (!store.persistent) notify('Browser storage is unavailable. Export a backup before leaving.');
}
function visibleMatches(t) {
  if (view === 'missable' && !t.missable) return false;
  if (kind !== 'all' && t.kind !== kind) return false;
  if ($('#grade').value !== 'all' && t.grade !== $('#grade').value) return false;
  if ($('#status').value === 'earned' && !store.has(t.id)) return false;
  if ($('#status').value === 'remaining' && store.has(t.id)) return false;
  const query = $('#search').value.trim().toLocaleLowerCase();
  const searchable = isShielded(t) ? `unrevealed story trophy ${t.grade} chapter ${t.chapter ?? ''}` : `${t.name} ${t.description} ${t.guide} ${t.tips} ${t.kind}`;
  return !query || searchable.toLocaleLowerCase().includes(query);
}
function renderTrophyRow(t) {
  const shielded = isShielded(t);
  const counter = Number(store.state.counters[t.id]) || 0;
  return `<article class="trophy-row ${selected === t.id ? 'selected' : ''} ${store.has(t.id) ? 'is-earned' : ''}" data-id="${t.id}">
    <input class="trophy-check" type="checkbox" data-toggle="${t.id}" ${store.has(t.id) ? 'checked' : ''} aria-label="Mark ${escape(displayName(t))} earned">
    <button class="trophy-open" data-open="${t.id}" aria-pressed="${selected === t.id}"><span class="trophy-title">${escape(displayName(t))}</span>
    <span class="trophy-description">${shielded ? 'Name, description & guide protected until earned.' : escape(t.description)}</span>
    <span class="row-meta"><span>${escape(t.grade)}</span><span>·</span><span>${escape(kinds[t.kind])}</span>${t.missable ? '<span class="badge">Possible missable</span>' : ''}${store.has(t.id) ? '<span>✓ Earned</span>' : ''}</span>
    ${t.target && !shielded ? `<span class="mini-progress"><i><em style="width:${Math.min(100, counter / t.target * 100)}%"></em></i><small>${counter.toLocaleString()} / ${t.target.toLocaleString()} ${escape(t.unit)}</small></span>` : ''}</button>
    <span class="row-grade">${medal(t.grade)}</span></article>`;
}
function renderProgress() {
  const total = store.state.earned.length;
  $('#earned-total').textContent = total;
  $('#percent').textContent = `${Math.round(total / trophies.length * 100)}%`;
  $('#progress-heading').textContent = total === 55 ? 'Leonida legend. Every trophy logged.' : total ? `${55 - total} more stories to tell` : 'The road starts here';
  $('#progress-bar').setAttribute('aria-valuenow', String(total));
  $('#progress-bar i').style.width = `${total / trophies.length * 100}%`;
  $('#grade-counts').innerHTML = ['platinum', 'gold', 'silver', 'bronze'].map(grade => {
    const group = trophies.filter(t => t.grade === grade);
    return `<div class="grade-count">${medal(grade)}<span><b>${group.filter(t => store.has(t.id)).length}<span aria-hidden="true"> / </span><span class="sr-only">of</span>${group.length}</b><small>${grade}</small></span></div>`;
  }).join('');
  saveLabel();
}
function renderSource(source) {
  const split = source.indexOf(': ');
  const value = split >= 0 ? source.slice(split + 2) : '';
  let valid = false;
  try { valid = ['http:', 'https:'].includes(new URL(value).protocol); } catch { /* Named source, not a link. */ }
  return valid ? `<li>↗ <a href="${escape(value)}" target="_blank" rel="noopener noreferrer">${escape(source.slice(0, split))}</a></li>` : `<li>· ${escape(source)}</li>`;
}
function renderDetail() {
  const t = byId.get(selected);
  if (!t) { $('#detail').hidden = true; return; }
  $('#detail').hidden = false;
  const shielded = isShielded(t);
  const warning = t.missable ? `<div class="detail-warning"><b>POSSIBLE MISSABLE · CHAPTER 1</b><br>${escape(t.missableStatus)}. Take the balcony invitation before the chapter transition.</div>` : '';
  $('#detail').innerHTML = `<div class="detail-eyebrow"><span>FIELDNOTE ${String(t.id).padStart(2, '0')} / 55</span><button id="close-detail" aria-label="Close trophy detail">×</button></div>
    <div class="detail-grade">${medal(t.grade)}<span>${escape(t.grade)} <span aria-hidden="true">/</span> ${escape(kinds[t.kind])}</span></div>
    <h2>${escape(displayName(t))}</h2>
    ${shielded ? '<div class="spoiler-empty"><span class="lock-icon" aria-hidden="true">◇</span><p>Your spoiler shield is on.<br>The name, official description, guide and sources stay hidden until you earn this trophy.</p><p>Turn the shield off above to read ahead.</p></div>' : `<p class="official-description">${escape(t.description)}</p>${warning}<span class="section-label">THE FIELD GUIDE</span><p class="guide-text">${escape(t.guide)}</p><div class="tip"><b>POCKET TIP</b>${escape(t.tips)}</div><span class="section-label">SOURCES & CONFIDENCE</span><ul class="source-list">${t.sources.map(renderSource).join('')}</ul><p class="source-note">Original summary from the sources above, not first-hand gameplay. Public guides can change. Source check: 21 Nov 2026.</p>`}
    <button class="detail-toggle" data-toggle="${t.id}">${store.has(t.id) ? '✓ Earned — click to undo' : 'Mark as earned'}<span>${store.has(t.id) ? '−' : '+'}</span></button>
    ${!shielded && t.target ? `<label class="counter-control">Your tally <input id="counter" type="number" min="0" max="${t.target}" step="1" value="${Number(store.state.counters[t.id]) || 0}" aria-label="${escape(t.unit)} completed"><span>/ ${t.target.toLocaleString()} ${escape(t.unit)}</span></label><p class="source-note">Manual tally only. Reaching the target does not automatically mark a trophy earned.</p>` : ''}
    ${!shielded ? `<label class="notes">Personal fieldnotes<textarea id="note" maxlength="4000" placeholder="A location, a plan, a reminder…">${escape(store.state.notes[t.id] || '')}</textarea></label>` : ''}`;
  $('#close-detail').onclick = () => { selected = null; render(); };
  if ($('#counter')) $('#counter').onchange = event => {
    store.setCounter(t.id, event.target.valueAsNumber);
    const detailScroll = $('#detail').scrollTop;
    render();
    $('#detail').scrollTop = detailScroll;
    $('#counter')?.focus();
  };
  if ($('#note')) $('#note').oninput = event => { store.setNote(t.id, event.target.value); saveLabel(); };
}
function renderRoadmap(matches) {
  const included = new Set(matches.map(t => t.id));
  const stages = route.map((stage, index) => {
    const items = stage.ids.map(id => byId.get(id)).filter(t => included.has(t.id));
    if (!items.length) return '';
    const earned = stage.ids.filter(id => store.has(id)).length;
    const milestones = items.filter(t => t.kind === 'story').slice(0, 2).map(t => escape(displayName(t))).join(' · ');
    return `<section class="route-stage"><div class="stage-head"><span class="stage-index">${String(index + 1).padStart(2, '0')}</span><span class="stage-fraction">${earned} / ${stage.ids.length}</span></div><h2>${escape(stage.title)}</h2><p class="stage-note">${escape(stage.note)}</p>${stage.ids.includes(28) ? '<div class="route-warning"><b>! POSSIBLE MISSABLE</b><br>Positive Mental Attitude<br>Chapter 1 balcony session: take the invitation before leaving. Requirement unconfirmed.</div>' : `<p class="stage-milestones">${milestones || `${stage.ids.length} trophies · ${index === 5 ? 'Named contacts, range golds, races & heists' : index === 6 ? '250 stunts · 100 scans · 3 card sets' : '100% completion → platinum'}`}</p>`}<details data-stage="${index}" ${expandedStages.has(String(index)) ? 'open' : ''}><summary>Explore ${items.length} ${items.length === 1 ? 'trophy' : 'trophies'} <span>↓</span></summary><div class="stage-trophies">${items.map(renderTrophyRow).join('')}</div></details></section>`;
  }).join('');
  return `<p class="route-intro">Your chapter-first path. Open a stage to track its trophies and read their guides. Mission order within a chapter can vary; side jobs can start earlier than this cleanup route.</p><div class="roadmap-grid">${stages}</div><p class="route-sources">Derived from the official descriptions and the PowerPyx roadmap linked in each fieldnote. The Chapter 1 warning is precautionary, not a confirmed platinum lockout. The final mission's official description gives no chapter; it follows the Chapter 5 milestone here without claiming an exact assignment.</p>`;
}
function render() {
  if (view === 'roadmap' && document.querySelector('.roadmap-grid')) {
    expandedStages = new Set([...document.querySelectorAll('.roadmap-grid details[open]')].map(element => element.dataset.stage));
  }
  document.querySelector('main').classList.toggle('is-roadmap', view === 'roadmap');
  $('#content-hint').textContent = view === 'roadmap' ? 'OPEN A STAGE · FOLLOW THE ORDER' : 'CHECK TO LOG · SELECT TO READ';
  renderProgress();
  const matches = trophies.filter(visibleMatches);
  const filtered = kind !== 'all' || $('#grade').value !== 'all' || $('#status').value !== 'all' || $('#search').value;
  $('#result-count').textContent = `${matches.length} ${view === 'roadmap' ? 'TROPHIES ON YOUR ROUTE' : 'TROPHIES'}${filtered ? ' / 55' : ''}`;
  $('#clear-filters').hidden = !filtered;
  $('#spoiler-status').textContent = store.state.spoilers ? 'ON' : 'OFF';
  $('#page-title').textContent = view === 'roadmap' ? 'The long road, made clear.' : view === 'missable' ? 'One moment. Worth a save.' : 'Your platinum, planned.';
  $('#page-subtitle').textContent = view === 'roadmap' ? 'Chapter by chapter, then side content and the statewide sweep.' : view === 'missable' ? 'A precautionary watchlist, not a claim that your run is lost.' : 'A clear path through Leonida. A little less guesswork.';
  document.querySelectorAll('[data-kind]').forEach(button => button.classList.toggle('active', button.dataset.kind === kind));
  document.querySelectorAll('[data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
    button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false');
  });
  $('#kind-filters').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', button.dataset.kind === kind));
  if (!matches.length) {
    $('#results').innerHTML = `<div class="empty-state"><h2>${kind === 'online' ? 'No lobby required.' : 'Nothing in this corner.'}</h2><p>${kind === 'online' ? 'The official 55-trophy list has no online trophies. Your platinum path is single-player.' : 'Try a broader search or clear your filters. Story names and guide text are not searchable while shielded.'}</p></div>`;
  } else {
    $('#results').innerHTML = view === 'roadmap' ? renderRoadmap(matches) : matches.map(renderTrophyRow).join('');
  }
  renderDetail();
}
function openDetail(id) {
  selected = id;
  render();
  $('#detail').scrollTop = 0;
  if (!preview) history.replaceState(null, '', `#trophy-${id}`);
  if (matchMedia('(max-width: 920px)').matches) $('#detail').scrollIntoView({ behavior: 'instant', block: 'start' });
}
document.addEventListener('click', event => {
  const open = event.target.closest('[data-open]');
  if (open) openDetail(Number(open.dataset.open));
  const toggle = event.target.closest('button[data-toggle]');
  if (toggle) toggleTrophy(Number(toggle.dataset.toggle));
  const navigation = event.target.closest('[data-view]');
  if (navigation) {
    view = navigation.dataset.view;
    if (view === 'roadmap') selected = null;
    clearFilters();
    render();
  }
  const filter = event.target.closest('[data-kind]');
  if (filter) { kind = filter.dataset.kind; render(); }
});
$('#results').addEventListener('change', event => {
  if (!event.target.matches('input[data-toggle]')) return;
  const id = Number(event.target.dataset.toggle);
  toggleTrophy(id);
  document.querySelector(`input[data-toggle="${id}"]`)?.focus();
});
function clearFilters() {
  kind = 'all'; $('#search').value = ''; $('#grade').value = 'all'; $('#status').value = 'all';
}
$('#clear-filters').onclick = () => { clearFilters(); render(); };
$('#risk-banner').onclick = () => openDetail(28);
$('#search').oninput = render;
$('#grade').onchange = render;
$('#status').onchange = render;
$('#spoilers').onchange = event => { store.setSpoilers(event.target.checked); render(); };
$('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(store.backup(), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'leonida-fieldnotes-progress.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(preview ? 'Demo backup exported. Your real save is untouched.' : 'Backup exported. Keep it somewhere safe.');
};
$('#import-button').onclick = () => $('#import').click();
$('#import').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Backup is too large. Please use a file under 2 MB.');
    const added = store.mergeProgress(JSON.parse(await file.text()));
    render();
    notify(`${added} new ${added === 1 ? 'tick' : 'ticks'} merged. Existing ticks kept.${store.persistent ? '' : ' Storage unavailable: export now.'}`);
  } catch (error) { notify(`Import not applied: ${error.message}`); }
  event.target.value = '';
};
document.addEventListener('keydown', event => {
  const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (event.key === '/' && !editing) { event.preventDefault(); $('#search').focus(); }
  if (event.key === 'Escape') { $('#search').blur(); selected = null; render(); }
});
window.addEventListener('hashchange', () => {
  const id = Number(location.hash.replace('#trophy-', ''));
  if (byId.has(id)) openDetail(id);
});
render();
if (params.has('scroll')) window.scrollTo(0, Math.max(0, Number(params.get('scroll')) || 0));
document.documentElement.dataset.ready = 'true';
