import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(folder, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(folder + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control':'no-store' });
    response.end(contents);
  } catch {
    response.writeHead(404).end('File not found');
  }
}).listen(5500, '127.0.0.1', () => console.log('Urban Threads: http://127.0.0.1:5500 (uses your cloud Firebase project)'));
