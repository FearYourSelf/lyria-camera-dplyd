
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IntervalPreset } from "./types";
import { urlargs } from "./urlargs";

export const MAX_CAPTURE_DIM = 256;
export const IMAGE_MIME_TYPE = "image/png";
// Fix: Use correct full model name for flash lite as per guidelines
export const GEMINI_MODEL = "gemini-flash-lite-latest";

export const INTERVAL_PRESETS: IntervalPreset[] = [
  {
    captureSeconds: 0,
    crossfadeSeconds: 4,
    labelValue: "∞",
    labelSub: "INFINITE",
  },
  {
    captureSeconds: 15,
    crossfadeSeconds: 4,
    labelValue: "15s",
    labelSub: "FAST",
  },
  {
    captureSeconds: 45,
    crossfadeSeconds: 10,
    labelValue: "45s",
    labelSub: "SLOW",
  },
];

export const DEFAULT_INTERVAL_PRESET = INTERVAL_PRESETS[0];

export const PREFERRED_STREAM_PARAMS = {
  width: { ideal: urlargs.streamWidth },
  height: { ideal: urlargs.streamHeight },
};
