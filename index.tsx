
/**
 * @fileoverview Generates real-time music based on a webcam feed.
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import "./components/lyria_camera";

document.body.appendChild(document.createElement("lyria-camera") as unknown as HTMLElement);
