// Page logic: a sidebar of examples; every code block is an editor on the left
// with its live output on the right.
const nav = document.getElementById('nav');
const main = document.getElementById('main');

const PLAYGROUND = { title: 'Playground', id: 'playground', intro: '<p>The playground is a blank page to try your own Punk.</p><p>Type code in the <b>left</b> side. The <b>right</b> side shows the result of the last expression, and updates as you type. Anything printed with <code>print!</code> shows there too, and a syntax error appears there as a message. Press Tab to indent and Shift+Tab to outdent. Nothing is saved, and nothing here can touch your files.</p>', blocks: [{ type: 'code', code: 'greet:(n:_)[Hello {n?}]\n[greet!Punk]!' }] };

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function showOutput(pane, source) {
  const { printed, result, error } = Punk.runPunk(source);
  pane.replaceChildren();
  pane.classList.toggle('has-error', !!error);
  printed.forEach((line) => pane.append(el('div', 'printed', line)));
  if (error) pane.append(el('div', 'error', error));
  else pane.append(el('div', 'result', result));
}

const INDENT = '  ';

// Tab indents the selected lines (or inserts spaces), Shift+Tab removes one level.
function indentKey(input, e) {
  if (e.key !== 'Tab') return false;
  e.preventDefault();
  const { value, selectionStart: start, selectionEnd: end } = input;
  const multi = value.slice(start, end).includes('\n');
  if (!e.shiftKey && !multi) {
    input.setRangeText(INDENT, start, end, 'end');
    return true;
  }
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const block = value.slice(lineStart, end);
  const lines = block.split('\n');
  const changed = lines.map((l) => (e.shiftKey ? l.replace(/^( {1,2}|\t)/, '') : INDENT + l));
  input.setRangeText(changed.join('\n'), lineStart, end, 'preserve');
  const first = changed[0].length - lines[0].length;
  const total = changed.join('\n').length - block.length;
  input.setSelectionRange(Math.max(lineStart, start + first), end + total);
  return true;
}

function editor(code) {
  const row = el('div', 'example');
  const box = el('div', 'editor');
  const gutter = el('pre', 'gutter');
  const input = el('textarea');
  input.value = code;
  input.spellcheck = false;
  input.wrap = 'off';
  const output = el('pre', 'output');
  let timer;
  const rerun = () => showOutput(output, input.value);
  const resize = () => {
    const n = input.value.split('\n').length;
    input.rows = Math.max(3, n + 1);
    gutter.textContent = Array.from({ length: input.rows }, (_, i) => (i < n ? i + 1 : '')).join('\n');
  };
  input.addEventListener('keydown', (e) => {
    if (indentKey(input, e)) input.dispatchEvent(new Event('input'));
  });
  input.addEventListener('input', () => {
    resize();
    clearTimeout(timer);
    timer = setTimeout(rerun, 150);
  });
  input.addEventListener('scroll', () => { gutter.scrollTop = input.scrollTop; });
  box.append(gutter, input);
  row.append(box, output);
  resize();
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
