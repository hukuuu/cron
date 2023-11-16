import { Cron } from './cron.ts'
import { assertEquals } from 'https://deno.land/std@0.206.0/assert/mod.ts'

Deno.test(function parseTest() {
  // All tests should be working from this point in time
  const fixed = new Date(1700079540290)
  // Examples taken at random from here https://crontab.guru/#5_0_*_8_*
  assertEquals(Cron.from('5 0 * 8 *').next(fixed), '2024-08-01 00:05:00')
  assertEquals(Cron.from('15 14 1 * *').next(fixed), '2023-12-01 14:15:00')
  assertEquals(Cron.from('0 0,12 1 */2 *').next(fixed), '2024-01-01 00:00:00')
})

