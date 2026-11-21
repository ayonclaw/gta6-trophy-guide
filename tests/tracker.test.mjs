import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createProgressStore, createPreviewStorage } from '../app/store.js';
import { route } from '../app/route.js';

const doc = JSON.parse(readFileSync(new URL('../app/data/trophies.json', import.meta.url)));
const trophies = doc.trophies;
const storage = () => createPreviewStorage();

test('all 55 official fields match the starter commit', () => {
  const original = JSON.parse(execFileSync('git', ['show', 'e0856cc:app/data/trophies.json'], { encoding: 'utf8' })).trophies;
  assert.equal(trophies.length, 55);
  for (let i = 0; i < trophies.length; i++) {
    for (const key of ['id', 'name', 'description', 'grade']) assert.equal(trophies[i][key], original[i][key]);
  }
  assert.equal(Buffer.byteLength(JSON.stringify(doc)) < 150000, true);
  assert.deepEqual(Object.fromEntries(['platinum','gold','silver','bronze'].map(grade => [grade, trophies.filter(t => t.grade === grade).length])), { platinum:1, gold:2, silver:6, bronze:46 });
});

test('every guide has original guidance, sources, kind and a missable decision', () => {
  for (const trophy of trophies) {
    assert.equal(typeof trophy.guide, 'string');
    assert.ok(trophy.guide.length > 150);
    assert.ok(Array.isArray(trophy.sources) && trophy.sources.length > 0);
    assert.ok(trophy.sources.every(s => typeof s === 'string' && s.trim()));
    assert.equal(typeof trophy.missable, 'boolean');
    assert.ok(['story','side','collectible','online','combat','trophy-hub'].includes(trophy.kind));
    assert.ok(trophy.tips);
    const sentences = trophy.guide.match(/[.!?](?:\s|$)/g) || [];
    assert.ok(sentences.length >= 2 && sentences.length <= 4, `Guide ${trophy.id}: ${sentences.length} sentences`);
  }
});

test('roadmap contains every trophy once, flags the risk before leaving Chapter 1', () => {
  const ids = route.flatMap(stage => stage.ids);
  assert.equal(ids.length, 55);
  assert.deepEqual([...ids].sort((a,b) => a-b), trophies.map(t => t.id));
  assert.ok(route[0].ids.indexOf(28) < route[0].ids.indexOf(3));
  assert.equal(trophies.filter(t => t.missable).length, 1);
  assert.equal(trophies.find(t => t.id === 28).missableStatus, 'Potential, not confirmed');
});

test('fresh state shields story and toggles survive a reload', () => {
  const disk = storage();
  let store = createProgressStore(trophies, disk);
  assert.equal(store.state.spoilers, true);
  assert.deepEqual(store.state.earned, []);
  store.toggle(17);
  store = createProgressStore(trophies, disk);
  assert.equal(store.has(17), true);
  store.toggle(17);
  assert.equal(store.has(17), false);
  store.toggle(999);
  assert.deepEqual(store.state.earned, []);
});

test('backups merge ticks by union and counters by maximum', () => {
  const store = createProgressStore(trophies, storage());
  store.toggle(17);
  store.setCounter(17, 30);
  store.setNote(17, 'Keep the multiplier.');
  assert.equal(store.mergeProgress({ earned:[15,15,999], counters:{17:8,15:9999}, notes:{17:'Practice the last route.'}, spoilers:false }), 1);
  assert.deepEqual(store.state.earned.sort((a,b) => a-b), [15,17]);
  assert.equal(store.state.counters[17], 30);
  assert.equal(store.state.counters[15], 250);
  assert.equal(store.state.notes[17], 'Keep the multiplier.\nPractice the last route.');
  assert.equal(store.state.spoilers, true);
  const other = createProgressStore(trophies, storage());
  other.mergeProgress(store.backup());
  assert.deepEqual(other.state.earned, store.state.earned);
  assert.deepEqual(other.state.counters, store.state.counters);
  assert.deepEqual(other.state.notes, store.state.notes);
});

test('starter name-array migration and import preserve ticks', () => {
  const disk = storage();
  disk.setItem('gta6-trophy-checklist', JSON.stringify(['Trust', 'Not a trophy']));
  const store = createProgressStore(trophies, disk);
  assert.equal(store.has(8), true);
  store.mergeProgress(['The Shootist']);
  assert.deepEqual(store.state.earned, [8,17]);
  store.mergeProgress([]);
  assert.deepEqual(store.state.earned, [8,17]);
});

test('bad imports are atomic and non-executable', () => {
  const store = createProgressStore(trophies, storage());
  store.toggle(2);
  const before = store.backup();
  for (const value of [null, false, 5, 'bad', {}, { earned:'bad' }, {format:'another-app',earned:[]}]) {
    assert.throws(() => store.mergeProgress(value));
    assert.deepEqual(store.backup(), before);
  }
  store.setNote(2, '<script>unsafe()</script>');
  assert.equal(store.state.notes[2], '<script>unsafe()</script>');
});

test('corrupt or unavailable storage does not prevent ticking and exporting', () => {
  const broken = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } };
  const store = createProgressStore(trophies, broken);
  assert.equal(store.persistent, false);
  store.toggle(17);
  assert.equal(store.has(17), true);
  assert.deepEqual(store.backup().earned, [17]);
  const disk = storage();
  disk.setItem('leonida-fieldnotes-v1', 'not JSON');
  const recovered = createProgressStore(trophies, disk);
  assert.deepEqual(recovered.state.earned, []);
  recovered.toggle(15);
  assert.equal(recovered.persistent, true);
});

test('counter input is bounded and cannot earn a trophy automatically', () => {
  const store = createProgressStore(trophies, storage());
  store.setCounter(17, -1);
  assert.equal(store.state.counters[17], 0);
  store.setCounter(17, 999);
  assert.equal(store.state.counters[17], 42);
  assert.equal(store.has(17), false);
  store.setCounter(17, NaN);
  assert.equal(store.state.counters[17], 42);
});
