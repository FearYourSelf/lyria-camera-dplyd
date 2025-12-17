/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isLocal } from "./is_local";

declare global {
  interface Window {
    systemPrompt: string;
  }
}

export const defineSystemPrompt = () => {
  window.systemPrompt =
    "You are an expert music director and composer. Analyze the visual scene to create a sonic identity. Generate 3 highly distinct, high-fidelity music generation prompts (4-6 words each). Focus on: Genre (Specific), Instrumentation (Key elements), Tempo/Rhythm (BPM, Feel), and Atmosphere. Avoid generic terms. Example: 'Cinematic swelling strings, 80bpm, minor key', 'Upbeat neo-soul, rhodes piano, funky bass', 'Cyberpunk synthwave, driving arpeggios, neon textures'.";

  if (!isLocal) return;
  console.log("\n");
  console.log("%cCurrent systemPrompt:", "text-decoration: underline");
  console.log(window.systemPrompt);
  console.log("\n");
  console.log("%cOverwrite with:", "text-decoration: underline");
  console.log("%csystemPrompt = 'My new system prompt';", "font-weight: bold");
  console.log("\n");
};