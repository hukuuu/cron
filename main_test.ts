import { Cron, union, Range } from './cron.ts'
import { assertEquals } from 'https://deno.land/std@0.206.0/assert/mod.ts'

Deno.test(function testUnion() {
  const r1 = Range.from(0, 59)
  const r2 = Range.from(2, 12)
  const r3 = Range.from(1, 4 )
  assertEquals(union(r1, r2, r3), Range.from( 2, 4))
 })
Deno.test(function testRange() {
  const r1 = Range.from(0, 59)
  const r2 = Range.from(2, 12)
  assertEquals(r1.containsRange(r2), true)
})

Deno.test(function parseTest() {
  
  // Tests should be working at this point in time
  let fixed = new Date(1700079540290) // Wed Nov 15 2023 22:19:00 GMT+0200 (Eastern European Standard Time)
  // Examples taken at random from here https://crontab.guru/#5_0_*_8_*
  assertEquals(Cron.from('15 14 1 * *').next(fixed), '2023-12-01 14:15:00')
  assertEquals(Cron.from('*/8 * * * *').next(fixed), '2023-11-15 22:24:00')
  assertEquals(Cron.from('0 0,12 1 */2 *').next(fixed), '2024-01-01 00:00:00')
  assertEquals(Cron.from('5 0 * 8 *').next(fixed), '2024-08-01 00:05:00')

  fixed = new Date(1700338937878) // Sat Nov 18 2023 22:23:23 GMT+0200 (Eastern European Standard Time)
  assertEquals(Cron.from('23 0-20/2 * * *').next(fixed), '2023-11-19 00:23:00')
  assertEquals(Cron.from('0 0,12 1 */2 *').next(fixed), '2024-01-01 00:00:00')
  assertEquals(Cron.from('0 4 8-14 * *').next(fixed), '2023-12-08 04:00:00')
})
  