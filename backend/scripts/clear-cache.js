const { createClient } = require('redis');

async function run() {
  const client = createClient({ url: 'redis://localhost:6379' });
  client.on('error', (err) => console.log('Redis Client Error', err));
  await client.connect();

  const keys = await client.keys('analytics:*');
  if (keys.length > 0) {
    await client.del(keys);
    console.log(`Deleted ${keys.length} analytics keys.`);
  } else {
    console.log('No analytics keys to delete.');
  }
  await client.quit();
}
run();
