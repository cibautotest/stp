/**
 * 前端纯工具函数单测（示例：red-green 节奏）
 * 覆盖点：formatDuration / formatDate / deepClone / debounce / throttle
 * 说明：仅测纯逻辑；copyText/downloadFile 依赖 DOM，由全流程验收兜底
 */
import { describe, it, expect, vi } from 'vitest'
import { formatDate, formatDuration, deepClone, debounce, throttle } from './index'

describe('formatDuration', () => {
  it('秒级格式化为 Ns', () => {
    expect(formatDuration(45)).toBe('45s')
  })
  it('分钟级格式化为 Nm Ns', () => {
    expect(formatDuration(125)).toBe('2m 5s')
  })
  it('小时级格式化为 Nh Nm', () => {
    expect(formatDuration(3725)).toBe('1h 2m')
  })
})

describe('formatDate', () => {
  it('默认格式输出 YYYY-MM-DD HH:mm:ss', () => {
    const d = new Date(2026, 8, 28, 9, 5, 3) // 2026-09-28 09:05:03
    expect(formatDate(d)).toBe('2026-09-28 09:05:03')
  })
  it('支持自定义格式', () => {
    const d = new Date(2026, 0, 2, 0, 0, 0)
    expect(formatDate(d, 'YYYY/MM/DD')).toBe('2026/01/02')
  })
})

describe('deepClone', () => {
  it('深拷贝嵌套对象且互不影响', () => {
    const src = { a: 1, b: { c: [1, 2] } }
    const cloned = deepClone(src)
    cloned.b.c.push(3)
    expect(src.b.c).toHaveLength(2)
    expect(cloned).toEqual({ a: 1, b: { c: [1, 2, 3] } })
  })
  it('原始值与 null 原样返回', () => {
    expect(deepClone(null)).toBeNull()
    expect(deepClone(42)).toBe(42)
  })
})

describe('debounce / throttle', () => {
  it('debounce 在延迟内合并多次调用', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced(); debounced(); debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
  it('throttle 在窗口期内只执行一次', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const throttled = throttle(fn, 100)
    throttled(); throttled()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(150)
    throttled()
    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
