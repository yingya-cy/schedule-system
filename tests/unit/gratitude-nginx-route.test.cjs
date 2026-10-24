const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('IP and HTTPS hosts route gratitude to its own page', () => {
  const config = fs.readFileSync(path.join(__dirname, '../../nginx/nginx.conf'), 'utf8');
  const ip = config.split('listen 80 default_server;')[1].split('server_name yingyacy.top ai.yingyacy.top;')[0];
  const https = config.split('server_name yingyacy.top;')[1].split('server_name ai.yingyacy.top;')[0];

  for (const server of [ip, https]) {
    assert.match(server, /location = \/gratitude\s*\{\s*return 301 \/gratitude\/;/);
    assert.match(server, /location \/gratitude\/\s*\{[^}]*alias \/usr\/share\/nginx\/html\/gratitude\/;/);
    assert.match(server, /location \/gratitude\/\s*\{[^}]*try_files \$uri \$uri\/ @gratitude_index;/);
    assert.match(server, /location @gratitude_index\s*\{[^}]*try_files \/gratitude\/index\.html =404;/);
  }
});
