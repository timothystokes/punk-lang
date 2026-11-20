// Error values raised by the Punk runtime.
//
// Every error carries a source position (line, col) so the user can
// locate the offending bit of code. Position info is best-effort:
// tokenizer errors always have it; later stages may report the
// position of the value that triggered the failure.

const formatMessage = (message, line, col) => {
  if (line == null) return message;
  if (col == null) return `${message} (line ${line})`;
  return `${message} (line ${line}, col ${col})`;
};

const makeError = (name, message, line, col) => Object.assign(
  new Error(formatMessage(message, line, col)),
  { name, line: line ?? null, col: col ?? null },
);

export const punkError = (message, line, col) => makeError('PunkError', message, line, col);
export const syntaxError = (message, line, col) => makeError('PunkSyntaxError', message, line, col);

export const isPunkError = (e) => e instanceof Error && (e.name === 'PunkError' || e.name === 'PunkSyntaxError');
export const isSyntaxError = (e) => e instanceof Error && e.name === 'PunkSyntaxError';
