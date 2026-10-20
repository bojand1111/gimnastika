// Podaci o aplikaciji.
const pkg = require('../package.json');

function verzija() {
  return pkg.version;
}

module.exports = { verzija };
