import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync, copyFileSync, realpathSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const [destination, label] = process.argv.slice(2);
if (!destination || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(label || '')) {
  throw Error('Usage: node scripts/checkpoint.mjs <outside-repo-directory> <stage-label>');
}
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();
const root = realpathSync(git('rev-parse', '--show-toplevel'));
const parent = path.resolve(destination); mkdirSync(parent, {recursive: true});
const realParent = realpathSync(parent);
if (realParent === root || realParent.startsWith(root + path.sep)) throw Error('Checkpoint destination must be outside the repository.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(realParent, stamp + '-' + label); mkdirSync(out);
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean))].sort();
const checksums = {};
for (const file of files) {
  if (file.split('/').some(p => p === '..') || path.isAbsolute(file)) throw Error('Unsafe source path.');
  if (/^(\.env(?!\.example$)|id_rsa$|id_ed25519$)|\.(pem|key|p12|pfx)$/i.test(path.basename(file))) throw Error('Review secret-like file before checkpointing: ' + file);
  const from = path.join(root, file); let data;
  try {if (lstatSync(from).isSymbolicLink()) throw Error('Review symbolic link before checkpointing: ' + file); data = readFileSync(from);} catch (error) {if (error.code === 'ENOENT') continue; throw error;}
  const to = path.join(out, 'source', file); mkdirSync(path.dirname(to), {recursive: true}); copyFileSync(from, to);
  checksums['source/' + file] = createHash('sha256').update(data).digest('hex');
}
execFileSync('git', ['bundle', 'create', path.join(out, 'history.bundle'), '--all'], {cwd: root});
execFileSync('git', ['bundle', 'verify', path.join(out, 'history.bundle')], {cwd: root, stdio: 'pipe'});
checksums['history.bundle'] = createHash('sha256').update(readFileSync(path.join(out, 'history.bundle'))).digest('hex');
writeFileSync(path.join(out, 'CHECKPOINT.json'), JSON.stringify({label, createdAt: new Date().toISOString(), commit: git('rev-parse', 'HEAD'), status: git('status', '--short'), checksums, restoration: 'Copy source to a new directory; run npm test. Git bundle contains committed history only.'}, null, 2));
console.log(JSON.stringify({checkpoint: out, sourceFiles: Object.keys(checksums).length - 1}));
