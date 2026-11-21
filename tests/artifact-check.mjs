import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildDossier } from '../vendor/makefun-frontend.ts';

const text = path => readFileSync(path, 'utf8');
const bytes = path => readFileSync(path);
const data = JSON.parse(text('app/data/trophies.json'));
assert.equal(data.trophies.length, 55);
assert.ok(statSync('app/data/trophies.json').size < 150000);
assert.ok(data.trophies.every(t => t.guide.trim() && Array.isArray(t.sources) && t.sources.length));
console.log('PASS: valid trophy JSON, 55 nonempty guides and source lists, under 150 KB');

function files(directory) {
  return readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    const path = join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), path);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const appFiles = files('app');
for (const path of appFiles) {
  let content = text(path);
  if (path.endsWith('trophies.json')) {
    const sanitized = JSON.parse(content);
    for (const trophy of sanitized.trophies) trophy.sources = [];
    content = JSON.stringify(sanitized);
  }
  for (const forbidden of ['http://', 'https://', 'fetch(']) assert.ok(!content.includes(forbidden), `${path}: ${forbidden}`);
  assert.deepEqual(bytes(path), bytes(join('out', path)));
}
console.log('PASS: no URL/fetch literals except trophy source strings; output app bytes match source');

assert.deepEqual(bytes('vendor/makefun-frontend.ts'), execFileSync('git', ['show','e0856cc:vendor/makefun-frontend.ts']));
const originalReadme = execFileSync('git', ['show','e0856cc:README.md'], { encoding:'utf8' });
assert.deepEqual(text('README.md').split('\n').filter(line => line.includes('badge/')), originalReadme.split('\n').filter(line => line.includes('badge/')));
assert.equal(typeof JSON.parse(text('.makefun/owner.json')).wallet, 'string');
console.log('PASS: vendor byte-identical, all three README badge lines unchanged, public owner claim parses');

const shots = JSON.parse(text('shots.json'));
assert.equal(shots.length, 4);
assert.deepEqual(readdirSync('screenshots').sort(), shots.map(shot => shot.file).sort());
assert.deepEqual(readdirSync('out/screenshots').sort(), shots.map(shot => shot.file).sort());
for (const shot of shots) {
  const png = bytes(join('screenshots', shot.file));
  assert.deepEqual([...png.subarray(0,8)], [137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16), 1280);
  assert.equal(png.readUInt32BE(20), 720);
  assert.ok(png.length <= 262144);
  assert.deepEqual(png, bytes(join('out/screenshots', shot.file)));
}
console.log('PASS: exactly four 1280x720 PNGs, each below 256 KiB; output screenshots match');

const options = { text_max_bytes:163840, screenshots:{max:4,max_bytes:262144}, app_max_files:993, app_max_bytes:50331648 };
const dossierBytes = bytes('out/dossier.json');
const dossier = JSON.parse(dossierBytes);
assert.ok(dossierBytes.length < 1572864);
assert.deepEqual(dossierBytes, Buffer.from(buildDossier('out', options)));
console.log('PASS: dossier parses and matches an independent vendor rebuild byte-for-byte');
console.log(`Dossier size: ${dossierBytes.length} bytes`);
console.log(`Dossier SHA256: ${createHash('sha256').update(dossierBytes).digest('hex')}`);
console.log(dossier.text.split('\n').find(line => line.startsWith('Totals')));

const before = new Map(files('out').map(path => [path, createHash('sha256').update(bytes(path)).digest('hex')]));
execFileSync('node', ['main.ts'], { env:{...process.env, MAKEFUN_OUTPUT_DIR:'out'} });
assert.deepEqual(new Map(files('out').map(path => [path, createHash('sha256').update(bytes(path)).digest('hex')])), before);
console.log('PASS: a second main.ts run produces identical output bytes for every artifact');
