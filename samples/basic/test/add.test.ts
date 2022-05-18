import { describe, expect, it } from 'vitest'
import { add } from '../src/add'

describe('addition', () => {
  describe('test suit', () => {
    it('add', () => {
      console.log('=================')
      console.log('Console Output')
      expect(add(1, 1)).toBe(2)
    })

    it.skip('skipped', () => {
      expect(1 + 2).toBe(3)
    })

    it.todo('todo')
    it('async task', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('long task', () => {
      let sum = 0
      for (let i = 0; i < 2e8; i++)
        sum += i

      expect(sum).toBeGreaterThan(1)
    })
  })
})

describe('testing', () => {
  it('run', () => {
    const a = 10
    expect(a).toBe(10)
  })

  it('mul', () => {
    expect(5 * 5).toBe(25)
  })
})
