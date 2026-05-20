// Error types raised by the Punk runtime.
//
// Every error carries a source position (line, col) so the user can
// locate the offending bit of code. Position info is best-effort:
// tokenizer errors always have it; later stages may report the
// position of the value that triggered the failure.

export class PunkError extends Error {
  constructor(message, line, col) {
    super(formatMessage(message, line, col));
    this.name = 'PunkError';
    this.line = line ?? null;
    this.col = col ?? null;
  }
}

export class PunkSyntaxError extends PunkError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = 'PunkSyntaxError';
  }
}

export class PunkRuntimeError extends PunkError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = 'PunkRuntimeError';
  }
}

function formatMessage(message, line, col) {
  if (line == null) return message;
  if (col == null) return `${message} (line ${line})`;
  return `${message} (line ${line}, col ${col})`;
}
