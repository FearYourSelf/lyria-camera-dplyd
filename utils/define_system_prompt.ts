
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
  // Shorter, punchier prompts are better for the experimental music engine
  window.systemPrompt =
    "You are a music curator. Analyze the scene and output 3 distinct musical 'vibes' as JSON. Each vibe must be 3-5 keywords only. Include Style, Main Instrument, and BPM. Example: 'Lo-fi, Piano, 80bpm', 'Techno, Acid Synth, 130bpm', 'Ambient, Orchestral, 60bpm'. Keep it minimal and atmospheric.";

  if (!isLocal) return;
  console.log("\nSonar System Prompt Initialized.");
};
