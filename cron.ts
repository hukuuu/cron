//
// *    *    *    *    *
// ┬    ┬    ┬    ┬    ┬
// │    │    │    │    |
// │    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
// │    │    │    └───── month (1 - 12)
// │    │    └────────── day of month (1 - 31, L)
// │    └─────────────── hour (0 - 23)
// └──────────────────── minute (0 - 59)
//

const debug = false
const log = debug ? console.log.bind(console) : () => {}

import { assert } from 'https://deno.land/std@0.206.0/assert/assert.ts'

export enum FieldType {
  ANY,
  LIST,
  RANGE,
  STEP,
  EXACT
}

export class Range {
  private constructor(readonly min: number, readonly max: number) {}
  static from(min: number, max: number): Range {
    assert(max > min, `Max must be bigger than min ( ${max} > ${min} )`)
    return new Range(min, max)
  }
  containsValue(value: number) {
    return this.min <= value && value <= this.max
  }
  containsRange(range: Range) {
    return this.min <= range.min && this.max >= range.max
  }
  toString() {
    return `${this.min}-${this.max}`
  }
}

export const union = (...ranges: Range[]): Range =>
  Range.from(
    Math.max(...ranges.map(r => r.min)),
    Math.min(...ranges.map(r => r.max))
  )

type FieldUnit = 'minutes' | 'hours' | 'days' | 'months' | 'years'
abstract class Field {
  private static RANGES: Record<FieldUnit, Range> = {
    minutes: Range.from(0, 59),
    hours: Range.from(0, 23),
    days: Range.from(1, 31),
    months: Range.from(1, 12),
    years: Range.from(0, Number.MAX_SAFE_INTEGER)
  }
  public stepNext = false
  public resetPrev = false

  protected constructor(
    protected pattern: string,
    public unit: FieldUnit,
    protected range: Range,
    public value: number
  ) {}

  static from(pattern: string, unit: FieldUnit, value: number): Field {
    const range = Field.RANGES[unit]
    if (pattern.includes(',')) return new ListField(pattern, unit, range, value)
    else if (pattern.includes('-') || pattern.includes('*'))
      return new RangeField(pattern, unit, range, value)
    return new ExactField(pattern, unit, range, value)
  }

  abstract step(start?: number): void
  abstract reset(): void
}
class RangeField extends Field {
  step(start: number = this.value) {
    log('STEP', this.unit)
    const [pattern, dividerString] = this.pattern.split('/')
    const items = pattern.includes('*')
      ? [this.range.min, this.range.max]
      : pattern.split('-').map(Number)

    const [lo, hi] = items

    let divider = 0
    if (dividerString) {
      divider = Number(dividerString)
      assert(
        Number.isInteger(divider),
        `Range skip must be a numer ${this.pattern} -> ${dividerString}`
      )
      assert(
        divider > 0,
        `Range skip must be greater than 0 ${this.pattern} -> ${divider}`
      )
    }

    assert(items.length === 2, `Range must give 2 numbers ${pattern}`)
    assert(
      [lo, hi].map(Number.isInteger).reduce((a, b) => a && b),
      `Range must give 2 numbers ${pattern}`
    )
    const givenRange = Range.from(lo, hi)
    assert(
      this.range.containsRange(givenRange),
      `Range ${givenRange} is not contained by the unit range for ${this.unit}(${this.range})`
    )

    const range = union(this.range, givenRange)
    if (
      range.containsValue(start) &&
      (!divider || (start + this.range.min) % divider === 0)
    ) {
      this.resetPrev = start > this.value
      this.value = start
      this.stepNext = false
      log('return?')
      return
    }
    this.unit === 'months' && log('continue')
    let next = Math.max(start, range.min) + 1
    if (divider) {
      while (next % divider !== 0) {
        next++
      }
    }

    this.stepNext = next > range.max
    this.value = this.stepNext ? range.min : next
    this.resetPrev = true
  }
  reset() {
    if (this.pattern.includes('*')) {
      this.value = this.range.min
    } else {
      this.value = Number(this.pattern.split('-')[0])
    }
  }
}
class ListField extends Field {
  step(start: number = this.value) {
    const values = this.pattern.split(',').map(Number)
    assert(
      values.map(Number.isInteger).reduce((a, b) => a && b),
      `List must give only numbers ${this.pattern}`
    )
    assert(
      this.range.containsRange(
        Range.from(values[0], values[values.length - 1])
      ),
      `List ${this.pattern} is not contained by the unit range for ${this.unit}(${this.range})`
    )
    //TODO assert all values are incremental
    values.sort()

    if (start === this.value && values.includes(start)) {
      this.stepNext = false
      this.resetPrev = false
      return
    }

    if (start > values[values.length - 1]) {
      this.value = values[0]
      this.stepNext = true
      this.resetPrev = true
      return
    }
    for (const i of values) {
      if (i < start) continue
      this.value = i
      this.resetPrev = true
      this.stepNext = false
    }
  }

  reset() {
    this.value = Number(this.pattern.split(',')[0])
  }
}

class ExactField extends Field {
  step(start: number = this.value) {
    const value = Number(this.pattern)
    assert(
      Number.isInteger(value),
      `${this.unit} is not a number (${this.pattern})`
    )

    if (start === value) {
      this.resetPrev = false
      this.stepNext = false
      return
    }

    this.value = value
    this.stepNext = start > this.value
    this.resetPrev = start !== this.value
  }
  reset() {
    this.value = Number(this.pattern)
  }
}

export class Cron {
  private constructor(private fields: Field[], private pattern: string) {}
  static from = (pattern: string): Cron => {
    const [m, h, d, mo] = pattern.split(' ')

    const minutes = Field.from(m, 'minutes', 0)
    const hours = Field.from(h, 'hours', 0)
    const days = Field.from(d, 'days', 0)
    const months = Field.from(mo, 'months', 0)
    const years = Field.from('*', 'years', 0)

    return new Cron([minutes, hours, days, months, years], pattern)
  }

  next = (from?: Date) => {
    const now = from || new Date()
    log('Calculating next hit from ', now)

    const minutes = now.getMinutes()
    const hours = now.getHours()
    const days = now.getDate()
    const months = now.getMonth() + 1
    const years = now.getFullYear()

    const clock = [minutes, hours, days, months, years]
    for (let i = 0; i < clock.length; i++) {
      this.fields[i].value = clock[i]
    }

    const pad = (s: string, n = 10) =>
      s
        .split(' ')
        .map(s => s.padStart(n))
        .join('')

    log(pad(''), pad('m h d mo w'))
    log(pad('pattern'), pad(this.pattern))
    log(pad('now'), pad(`${minutes} ${hours} ${days} ${months} ${years}`))

    for (let i = 0; i < this.fields.length - 1; i++) {
      let current = this.fields[i]
      current.step()
      log(
        'bump',
        current.unit,
        current.value,
        current.stepNext ? 'OVERFLOW' : '',
        current.resetPrev ? 'RESET' : ''
      )

      while (current.stepNext) {
        i++
        current = this.fields[i]
        current.step(current.value + 1)
        log(
          'bump',
          current.unit,
          current.value,
          current.stepNext ? 'OVERFLOW' : '',
          current.resetPrev ? 'RESET' : ''
        )
      }
      log(current)
      if (current.resetPrev) {
        log('reset on', i)

        for (let k = 0; k < i; k++) {
          this.fields[k].reset()
        }
      }
    }
    log(pad('result'), pad(this.fields.map(f => f.value).join(' ')))
    const ret = this.fields
      .map(f => f.value)
      .map(n => (n < 10 ? String(n).padStart(2, '0') : n))
    return `${ret[4]}-${ret[3]}-${ret[2]} ${ret[1]}:${ret[0]}:00`
  }
}
