import { getDatabase } from '../src/server/db/client.ts';
import { purgeExpiredEvent } from '../src/server/game/retention.ts';
const eventId=process.argv.find(value=>value.startsWith('--event-id='))?.slice('--event-id='.length);
if(!eventId||!/^[0-9a-f-]{36}$/i.test(eventId)||!['development','production'].includes(process.env.DATABASE_ENVIRONMENT)) {
  throw new Error('Select one --event-id and configure DATABASE_ENVIRONMENT. Defaults to dry run; --apply deletes only an expired event.');
}
try {
  const result=await purgeExpiredEvent(getDatabase(),eventId,process.argv.includes('--apply'));
  console.log(JSON.stringify(result));
} catch {console.error('Retention check failed or event is ineligible. No raw database details are logged.');process.exitCode=1;}
