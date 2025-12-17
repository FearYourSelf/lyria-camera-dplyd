
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IntervalPreset } from "./types";
import { urlargs } from "./urlargs";

export const MAX_CAPTURE_DIM = 256;
export const IMAGE_MIME_TYPE = "image/png";
// Using 2.5 Flash for its extreme stability and generous rate limits
export const GEMINI_MODEL = "gemini-2.5-flash-latest";

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
