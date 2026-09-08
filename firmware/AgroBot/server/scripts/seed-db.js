import { initializeDatabase, seedSampleData } from '../db/index.js'

async function main() {
  await initializeDatabase()
  const result = await seedSampleData()
  console.log('Seeded demo user and animals:', result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
