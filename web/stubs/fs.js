// Browser stand-in for node:fs. There is no file system in the page, so every file lookup fails
// and the interpreter evaluates it to the non-thing.
const unavailable = () => { throw new Error('no file system in the browser'); };

export const readFileSync = unavailable;
export const writeFileSync = unavailable;
export const appendFileSync = unavailable;
export const statSync = unavailable;
export const existsSync = () => false;
