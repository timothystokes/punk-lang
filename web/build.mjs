// Builds the static site into site/: the interpreter bundled for browsers, the page,
// and the examples taken from docs/punk-by-example.md.
import { build } from 'esbuild';
import { marked } from 'marked';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
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

// Splits the by-example markdown into sections of prose and runnable code blocks.
// The bold output line after a block is dropped: the page shows the real output.
export function parseExamples(markdown) {
  const [intro, ...parts] = markdown.split(/^## /m);
  const sections = parts.map((part) => {
    const [title, ...rest] = part.split('\n');
    const body = rest.join('\n').replace(/^\*\*`.*`\*\*\n?/gm, '');
    const blocks = [];
    let last = 0;
    for (const m of body.matchAll(/```punk\n([\s\S]*?)```/g)) {
      blocks.push({ type: 'prose', html: marked.parse(body.slice(last, m.index)) });
      blocks.push({ type: 'code', code: m[1].replace(/\n$/, '') });
      last = m.index + m[0].length;
    }
    blocks.push({ type: 'prose', html: marked.parse(body.slice(last)) });
    return { title: title.trim(), id: slug(title), blocks: blocks.filter((b) => b.type === 'code' || b.html.trim()) };
  });
  return { intro: marked.parse(intro.replace(/^# .*\n/, '')), sections };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = root('site');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await browserBuild({ outfile: `${out}/punk.js`, minify: true });
  writeFileSync(`${out}/examples.json`, JSON.stringify(parseExamples(readFileSync(root('docs/punk-by-example.md'), 'utf8'))));
  for (const f of ['index.html', 'style.css', 'app.js']) copyFileSync(root(`web/${f}`), `${out}/${f}`);
  writeFileSync(`${out}/.nojekyll`, '');
  console.log('built site/');
}
