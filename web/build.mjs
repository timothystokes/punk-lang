// Builds the static site into site/: the interpreter bundled for browsers, the page,
// and the lessons from the lessons/ folder.
import { build } from 'esbuild';
import { marked } from 'marked';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

export const browserBuild = (options = {}) => build({
  entryPoints: [root('web/punk-web.js')],
  bundle: true,
  format: 'iife',
  globalName: 'Punk',
  platform: 'browser',
  define: { 'import.meta.url': '"file:///punk/"' },
  alias: {
    'node:fs': root('web/stubs/fs.js'),
    'node:http': root('web/stubs/http.js'),
    'node:path': root('web/stubs/path.js'),
    'node:url': root('web/stubs/url.js'),
  },
  ...options,
});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A lesson is one markdown file: a `# Title`, prose, and ```punk blocks.
// The bold output line after a block is dropped: the page shows the real output.
export function parseLesson(markdown) {
  const [, title, ...rest] = /^# (.*)\n([\s\S]*)$/.exec(markdown) ?? [null, 'Untitled', markdown];
  const body = rest.join('').replace(/^\*\*`.*`\*\*\n?/gm, '');
  const blocks = [];
  let last = 0;
  for (const m of body.matchAll(/```punk\n([\s\S]*?)```/g)) {
    blocks.push({ type: 'prose', html: marked.parse(body.slice(last, m.index)) });
    blocks.push({ type: 'code', code: m[1].replace(/\n$/, '') });
    last = m.index + m[0].length;
  }
  blocks.push({ type: 'prose', html: marked.parse(body.slice(last)) });
  return { title: title.trim(), id: slug(title), blocks: blocks.filter((b) => b.type === 'code' || b.html.trim()) };
}

const titleCase = (s) => s.replace(/^\d+-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// lessons/README.md is the home page. Each numbered folder is a section of lessons,
// and each file in it is a lesson, both in name order.
export function loadLessons(dir = root('lessons')) {
  const read = (f) => readFileSync(`${dir}/${f}`, 'utf8');
  const home = parseLesson(read('README.md'));
  const groups = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({
      title: titleCase(name),
      lessons: readdirSync(`${dir}/${name}`).filter((f) => f.endsWith('.md')).sort()
        .map((f) => parseLesson(read(`${name}/${f}`))),
    }));
  return { introTitle: home.title, intro: home.blocks.map((b) => b.html ?? '').join(''), groups };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = root('site');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await browserBuild({ outfile: `${out}/punk.js`, minify: true });
  writeFileSync(`${out}/examples.json`, JSON.stringify(loadLessons()));
  for (const f of ['index.html', 'style.css', 'app.js']) copyFileSync(root(`web/${f}`), `${out}/${f}`);
  writeFileSync(`${out}/.nojekyll`, '');
  console.log('built site/');
}
