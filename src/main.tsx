import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Async iteration over a ReadableStream — `for await (const x of stream)` — only
 * arrived in Safari 17.4, Chrome 124 and Firefox 117. pdf.js reads a page's text
 * that way in getTextContent, so on an older phone question detection threw
 * "undefined is not a function" while rendering carried on working, which is why
 * papers opened but reported no questions.
 */
if (typeof ReadableStream !== 'undefined'
  && !(ReadableStream.prototype as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator]) {
  const values = function (this: ReadableStream, { preventCancel = false } = {}) {
    const reader = this.getReader()
    return {
      next: () => reader.read(),
      async return(value: unknown) {
        if (preventCancel) reader.releaseLock()
        else { const cancelled = reader.cancel(value); reader.releaseLock(); await cancelled }
        return { done: true, value }
      },
      [Symbol.asyncIterator]() { return this },
    }
  }
  const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>
  proto.values = values
  proto[Symbol.asyncIterator] = values
}

// Older mobile browsers (iOS Safari below 17.4, some Android webviews) lack
// Promise.withResolvers, which pdf.js relies on. Guarantee it on the main thread
// so opening a paper never fails on that alone.
if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== 'function') {
  ;(Promise as unknown as { withResolvers: () => unknown }).withResolvers = function () {
    let resolve!: (value: unknown) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
