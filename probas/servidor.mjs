// Sirve la web publicada igual que GitHub Pages: en una subcarpeta y con 10 minutos de caché.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf'};
export const scope = '/galicianadepeto-web/';
export async function serve(root) {
  const state = {requests: [], change: undefined, stall: false};
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://x').pathname;
    state.requests.push(path);
    if (state.stall) return; // a network that accepts the connection and never answers
    if (!path.startsWith(scope)) { response.writeHead(404); response.end(); return; }
    const file = normalize(path.slice(scope.length) || 'index.html');
    try {
      if (file.startsWith('..')) throw Error('fuera');
      let body = await readFile(join(root, file));
      if (state.change) body = state.change(file, body) ?? body;
      response.writeHead(200, {'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600'});
      response.end(body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {state, url: 'http://127.0.0.1:' + server.address().port + scope,
    close: () => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); }};
}
