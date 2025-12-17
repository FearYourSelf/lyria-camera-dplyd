
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const isLocal = 
  location.hostname === "localhost" || 
  location.hostname === "127.0.0.1" || 
  new URLSearchParams(window.location.search).has('debug');
