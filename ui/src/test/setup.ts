import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as React from 'react'

// React 19 compatibility: Set IS_REACT_ACT_ENVIRONMENT
// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Polyfill for testing-library to use React's act from react package
// @ts-ignore  
if (!global.React) {
  // @ts-ignore
  global.React = React
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})
