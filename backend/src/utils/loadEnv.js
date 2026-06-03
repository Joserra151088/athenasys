const fs = require('fs')
const os = require('os')
const path = require('path')
const dotenv = require('dotenv')

const candidateEnvFiles = [
  process.env.ATHENASYS_ENV_FILE,
  path.join(os.homedir(), '.athenasys', 'backend.env'),
  path.join(__dirname, '../../.env'),
].filter(Boolean)

let loadedEnvPath = null

for (const candidate of candidateEnvFiles) {
  if (!fs.existsSync(candidate)) continue
  dotenv.config({ path: candidate })
  loadedEnvPath = candidate
  break
}

if (!loadedEnvPath) {
  dotenv.config()
}

module.exports = {
  envPath: loadedEnvPath,
}
