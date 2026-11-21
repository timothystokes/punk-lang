// Browser stand-in for node:http. `serve` has nothing to listen on in a page, so it does nothing.
export const createServer = () => ({ listen() {}, close() {} });
