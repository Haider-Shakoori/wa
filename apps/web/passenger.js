'use strict';
// cPanel/CloudLinux Passenger entrypoint. Load credentials ONLY from a
// private owner-readable file outside public_html and the source repository.
const { existsSync, statSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');
const config = process.env.RELAYWA_ENV_FILE || join(homedir(), '.relaywa-private', 'web.env');
if (existsSync(config)) {
  if ((statSync(config).mode & 0o077) !== 0) {
    throw new Error('RelayWA private environment file must be owner-only');
  }
  process.loadEnvFile(config);
}
require('./server.js');
