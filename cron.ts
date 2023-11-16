//
// *    *    *    *    *    *
// ┬    ┬    ┬    ┬    ┬    ┬
// │    │    │    │    │    |
// │    │    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
// │    │    │    │    └───── month (1 - 12)
// │    │    │    └────────── day of month (1 - 31, L)
// │    │    └─────────────── hour (0 - 23)
// │    └──────────────────── minute (0 - 59)
// └───────────────────────── second (0 - 59, optional)
//

export enum FieldType {
  ANY,
  LIST,
  RANGE,
  STEP,
  EXACT
}

type Range = [number, number]

function* range([min, max]: Range) {
  for (let i = min; i <= max; i++) {
    yield i
  }
}

function* makeAnyGenerator(valuesRange: Range, start?: number) {
  for (const i of range(valuesRange)) {
    if (start !== undefined && i < start) continue
    yield i
  }
  //in case of rotation
  return valuesRange[0]
}
function* makeListGenerator(value: string, start?: number) {
  const values = value.split(',').map(Number)
  for (const i of values) {
    if (start !== undefined && i < start) continue
    yield i
  }
  //in case of rotation
  return values[0]
}
function* makeRangeGenerator(value: string, start?: number) {
  const [min, max] = value.split('-').map(Number)
  for (let i = min; i <= max; i++) {
    if (start !== undefined && i < start) continue
    yield i
  }
  // in case of rotation
  return min
}
function* makeStepGenerator(value: string, valuesRange: Range, start?: number) {
  //TODO handle more complicated stuff like 3-20/2 - At every 2nd minute from 3 through 20.
  const [_, divider] = value.split('/').map(Number)
    
  for (const i of range(valuesRange)) {
        if (i % divider === 0 && start !== undefined && i >= start) yield i
  }
  //in case of rotation
  return 0
}
function* makeExactGenerator(value: string, start?: number) {
  const v = Number(value)
  //in case of rotation
  if (start !== undefined && start > v) return v
  yield v
  //in case of rotation
  return v
}

type FieldUnit = 'minutes' | 'hours' | 'days' | 'months'
class Field {
  private static RANGES: Record<FieldUnit, Range> = {
    minutes: [0, 59],
    hours: [0, 23],
    days: [1, 31],
    months: [1, 12]
  }
  private constructor(
    private type: FieldType,
    private value: string,
    private unit: FieldUnit
  ) {}
  static from(value: string, unit: FieldUnit): Field {
    let type = FieldType.ANY
    if (value.includes('/')) type = FieldType.STEP
    else if (value.includes(',')) type = FieldType.LIST
    else if (value.includes('-')) type = FieldType.RANGE
    else if (value.includes('*')) type = FieldType.ANY
    else type = FieldType.EXACT
    return new Field(type, value, unit)
  }
  //TODO deprecate in favor of next
  getGenerator(start?: number) {
    const { unit, value, type } = this
    switch (type) {
      case FieldType.ANY:
        return makeAnyGenerator(Field.RANGES[unit], start)
      case FieldType.LIST:
        return makeListGenerator(value, start)
      case FieldType.RANGE:
        return makeRangeGenerator(value, start)
      case FieldType.STEP:
        return makeStepGenerator(value, Field.RANGES[unit], start)
      case FieldType.EXACT:
        return makeExactGenerator(value, start)
    }
  }
  //TODO implement
  next(): { value: number; reset: boolean } {
    return { value: 3, reset: false }
  }
}

export class Cron {
  private constructor(private fields: Field[], private pattern: string) {}
  static from = (pattern: string): Cron => {
    const [m, h, d, mo] = pattern.split(' ')

    const minutes = Field.from(m, 'minutes')
    const hours = Field.from(h, 'hours')
    const days = Field.from(d, 'days')
    const months = Field.from(mo, 'months')

    return new Cron([minutes, hours, days, months], pattern)
  }

  next = (from?: Date) => {
    const now = from || new Date()
    console.log('Calculating next hit from ', now)

    const minutes = now.getMinutes()
    const hours = now.getHours()
    const days = now.getDate()
    const months = now.getMonth() + 1
    const years = now.getFullYear()

    const pad = (s: string, n = 10) =>
      s
        .split(' ')
        .map(s => s.padStart(n))
        .join('')

    console.log(pad(''), pad('m h d mo w'))
    console.log(pad('pattern'), pad(this.pattern))
    console.log(
      pad('now'),
      pad(`${minutes} ${hours} ${days} ${months} ${years}`)
    )

    const clock = [minutes, hours, days, months, years]

    for (let i = 0; i < clock.length - 1; i++) {
      // console.log(clock[i], ...Object.values(this.fields[i]))
      const field = this.fields[i]
      const generator = field.getGenerator(clock[i])
      const { value, done } = generator.next()
      clock[i] = value
      /**
       * done indicates reset. in this case we need to bump the next value
       * and reset all previous values to the first valid choice
       * (ignoring the current time -> meaning not passing `start` to getGenerator)
       */
      if (done) {
        clock[i + 1]++
        for (let j = 0; j < i; j++) {
          clock[j] = this.fields[j].getGenerator().next().value
        }
      }
    }
    console.log(pad('result'), pad(clock.join(' ')))

    const ret = clock.map(n => (n < 10 ? String(n).padStart(2, '0') : n))
    return `${ret[4]}-${ret[3]}-${ret[2]} ${ret[1]}:${ret[0]}:00`

    // const date = new Date()
    // date.setFullYear(clock[4])
    // date.setMonth(clock[3])
    // date.setDate(clock[2])
    // date.setHours(clock[1])
    // date.setMinutes(clock[0])
    // date.setSeconds(0)
    // date.setMilliseconds(0)
    // return date
  }
}
