// Browser stand-in for node:path. Only used to locate module files, which cannot exist in a page.
export const join = (...parts) => parts.join('/');
export const resolve = (...parts) => parts.join('/');
export const dirname = (p) => p.replace(/\/[^/]*$/, '') || '.';
