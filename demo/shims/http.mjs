// Démo navigateur : le gestionnaire de requêtes du serveur est appelé directement par boot.mjs.
export function createServer(handler){globalThis.__bmDemo.handler=handler;return {listen(...args){const cb=args.find(a=>typeof a==='function');if(cb)cb();return this;},close(){}};}
export default {createServer};
