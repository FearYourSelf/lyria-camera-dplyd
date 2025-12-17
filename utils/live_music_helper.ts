
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  type AudioChunk,
  type LiveMusicFilteredPrompt,
  type LiveMusicServerMessage,
  type LiveMusicSession,
  type WeightedPrompt,
} from "@google/genai";
import { decode, decodeAudioData } from "./audio";
import { throttle } from "./throttle";

export type PlaybackState = "stopped" | "playing" | "loading" | "paused";

export class LiveMusicHelper extends EventTarget {
  private session: LiveMusicSession | null = null;
  private sessionPromise: Promise<LiveMusicSession> | null = null;

  private filteredPrompts = new Set<string>();
  private nextStartTime = 0;
  private bufferTime = 1.5; // Reduced slightly for better responsiveness

  public readonly audioContext: AudioContext;
  private outputNode: GainNode; 
  private volumeNode: GainNode; 
  public analyser: AnalyserNode; 

  private playbackState: PlaybackState = "stopped";
  private prompts: WeightedPrompt[] = [];
  private lastSentPrompts: WeightedPrompt[] = [];
  
  private retryCount = 0;
  private maxRetries = 3;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    super();
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
    
    this.outputNode = this.audioContext.createGain();
    this.volumeNode = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();
    
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.85;
    this.volumeNode.gain.value = 0.8;

    this.outputNode.connect(this.volumeNode);
    this.volumeNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  public setVolume(val: number) {
    const volume = Math.max(0, Math.min(1, val));
    this.volumeNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.1);
  }

  public connectRecorder(destination: MediaStreamAudioDestinationNode) {
    this.volumeNode.connect(destination);
  }

  public disconnectRecorder(destination: MediaStreamAudioDestinationNode) {
    this.volumeNode.disconnect(destination);
  }

  private async connect(): Promise<LiveMusicSession> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    
    // Resume context BEFORE connecting to ensure hardware is ready
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      const connectPromise = (ai.live as any).music.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            this.retryCount = 0;
            console.log("Lyria RealTime stream established.");
          },
          onmessage: async (e: LiveMusicServerMessage) => {
            if (e.filteredPrompt) {
              this.filteredPrompts.add(e.filteredPrompt.text!);
              this.dispatchEvent(new CustomEvent("filtered-prompt", { detail: e.filteredPrompt }));
            }
            if (e.serverContent?.audioChunks) {
              await this.processAudioChunks(e.serverContent.audioChunks);
            }
          },
          onclose: () => {
            console.log("Lyria RealTime stream closed.");
            if (this.playbackState !== "stopped") {
              this.handleRetry();
            }
          },
          onerror: (e: any) => {
            console.error("Session Error:", e);
            const isUnavailable = e?.message?.toLowerCase().includes("unavailable") || e?.message?.includes("503");
            
            if (isUnavailable && this.retryCount < this.maxRetries) {
               this.handleRetry();
            } else {
              this.stop();
              const message = isUnavailable
                ? "The music service is currently overloaded. Retrying failed. Please wait a few seconds."
                : "A connection error occurred. Please restart the session.";
              this.dispatchEvent(new CustomEvent("error", { detail: message }));
            }
          },
        },
      });
      
      return await connectPromise;
    } catch (err) {
      this.sessionPromise = null;
      throw err;
    }
  }

  private handleRetry() {
    this.retryCount++;
    console.log(`Attempting reconnection ${this.retryCount}/${this.maxRetries}...`);
    this.session = null;
    this.sessionPromise = null;
    
    // Small delay before retry
    setTimeout(() => {
      if (this.playbackState !== "stopped") {
        this.play().catch(console.error);
      }
    }, 2000 * this.retryCount);
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(new CustomEvent("playback-state-changed", { detail: state }));
  }

  private async processAudioChunks(audioChunks: AudioChunk[]) {
    if (this.playbackState === "paused" || this.playbackState === "stopped") return;

    this.checkPromptFreshness(this.getChunkTexts(audioChunks));

    try {
      const audioBuffer = await decodeAudioData(
        decode(audioChunks[0].data!),
        this.audioContext,
        48000,
        2,
      );

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      const now = this.audioContext.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.1; // Small buffer for immediate start
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      if (this.playbackState === "loading") {
        this.setPlaybackState("playing");
      }
    } catch (e) {
      console.error("Audio processing error:", e);
    }
  }

  private getChunkTexts(chunks: AudioChunk[]): string[] {
    const chunkPrompts = chunks[0].sourceMetadata?.clientContent?.weightedPrompts;
    return chunkPrompts ? chunkPrompts.map((p: any) => p.text) : [];
  }

  private checkPromptFreshness(texts: string[]) {
    const sentPromptTexts = this.lastSentPrompts.map((p) => p.text);
    if (sentPromptTexts.length > 0 && sentPromptTexts.every((text) => texts.includes(text))) {
      this.dispatchEvent(new CustomEvent("prompts-fresh"));
      this.lastSentPrompts = [];
    }
  }

  public get activePrompts(): WeightedPrompt[] {
    return this.prompts
      .filter((p) => !this.filteredPrompts.has(p.text) && p.weight > 0)
      .map((p) => ({ text: p.text, weight: p.weight }));
  }

  public readonly setWeightedPrompts = throttle((prompts: WeightedPrompt[]) => {
    this.prompts = prompts;
    if (this.activePrompts.length === 0 && this.playbackState !== "stopped") return;
    void this.setWeightedPromptsImmediate();
  }, 500); // Throttled more aggressively for server stability

  private async setWeightedPromptsImmediate() {
    if (!this.session) return;
    try {
      this.lastSentPrompts = this.activePrompts;
      await this.session.setWeightedPrompts({ weightedPrompts: this.activePrompts });
    } catch (e: any) {
      console.warn("Failed to set prompts:", e);
    }
  }

  public async play() {
    if (this.session) return;
    this.setPlaybackState("loading");
    
    try {
      this.sessionPromise = this.connect();
      this.session = await this.sessionPromise;
      await this.setWeightedPromptsImmediate();
      this.session.play();
      
      this.outputNode.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
    } catch (e: any) {
      this.stop();
      throw e;
    }
  }

  public stop() {
    this.setPlaybackState("stopped");
    this.nextStartTime = 0;
    this.retryCount = 0;

    if (this.session) {
      try {
        this.outputNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.2);
        const s = this.session;
        setTimeout(() => s.stop(), 300);
      } catch (e) {
        console.warn("Stop error:", e);
      }
    }
    
    this.session = null;
    this.sessionPromise = null;
  }
}
