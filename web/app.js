// Page logic: a sidebar of examples; every code block is an editor on the left
// with its live output on the right.
const nav = document.getElementById('nav');
const main = document.getElementById('main');

const PLAYGROUND = { title: 'Playground', id: 'playground', blocks: [{ type: 'code', code: 'greet:(n:_)[Hello {n?}]\n[greet!Punk]!' }] };

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function showOutput(pane, source) {
  const { printed, result, error } = Punk.runPunk(source);
  pane.replaceChildren();
  printed.forEach((line) => pane.append(el('div', 'printed', line)));
  if (error) pane.append(el('div', 'error', error));
  else pane.append(el('div', 'result', result));
}

function editor(code) {
  const row = el('div', 'example');
  const input = el('textarea');
  input.value = code;
  input.spellcheck = false;
  input.rows = Math.max(3, code.split('\n').length + 1);
  const output = el('pre', 'output');
  let timer;
  const rerun = () => showOutput(output, input.value);
  input.addEventListener('input', () => {
    input.rows = Math.max(3, input.value.split('\n').length + 1);
    clearTimeout(timer);
    timer = setTimeout(rerun, 150);
  });
  row.append(input, output);
  rerun();
  return row;
}

function render(section) {
  main.replaceChildren(el('h1', null, section.title));
  if (section.intro) {
    const d = el('div', 'prose');
    d.innerHTML = section.intro;
    main.append(d);
  }
  for (const b of section.blocks) {
    if (b.type === 'code') main.append(editor(b.code));
    else {
      const d = el('div', 'prose');
      d.innerHTML = b.html;
      main.append(d);
    }
  }
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.hash === (section.id ? `#${section.id}` : '')));
  window.scrollTo(0, 0);
}

fetch('examples.json').then((r) => r.json()).then(({ introTitle, intro, groups }) => {
  const all = [PLAYGROUND, ...groups.flatMap((g) => g.lessons)];
  const home = { title: introTitle, id: '', intro, blocks: [] };
  const link = (s) => {
    const a = el('a', null, s.title);
    a.href = s.id ? `#${s.id}` : '#';
    nav.append(a);
  };
  link(home);
  link(PLAYGROUND);
  groups.forEach((g) => {
    nav.append(el('h2', null, g.title));
    g.lessons.forEach(link);
  });
  const show = () => {
    const id = location.hash.slice(1);
    render(all.find((s) => s.id === id) || home);
  };
  window.addEventListener('hashchange', show);
  show();
});
