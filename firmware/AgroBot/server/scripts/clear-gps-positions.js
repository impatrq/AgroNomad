import 'dotenv/config'
import {initializeDatabase,deleteAllGpsPositions} from '../db/index.js'

async function main() {
  //await initializeDatabase()
  await deleteAllGpsPositions()
}



main().catch((error) => {
  console.error(error)
  process.exit(1)
})