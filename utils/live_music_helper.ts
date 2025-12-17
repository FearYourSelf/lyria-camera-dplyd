
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  type AudioChunk,
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
  
  public readonly audioContext: AudioContext;
  private outputNode: GainNode; 
  private volumeNode: GainNode; 
  public analyser: AnalyserNode; 

  private playbackState: PlaybackState = "stopped";
  private prompts: WeightedPrompt[] = [];
  private lastSentPrompts: WeightedPrompt[] = [];
  
  private retryCount = 0;
  private maxRetries = 5;
  private isAttemptingReconnect = false;
  private loadingTimeout: number | null = null;

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
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Set a safety timeout for the loading state
    this.clearLoadingTimeout();
    this.loadingTimeout = window.setTimeout(() => {
      if (this.playbackState === "loading") {
        console.warn("Music connection timed out. Forcing retry...");
        this.handleRetry("Connection timeout");
      }
    }, 8000);

    try {
      const connectPromise = (ai.live as any).music.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            this.retryCount = 0;
            this.isAttemptingReconnect = false;
            this.clearLoadingTimeout();
            console.log("Music session opened.");
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
          onclose: (event: any) => {
            this.clearLoadingTimeout();
            if (this.playbackState !== "stopped" && !this.isAttemptingReconnect) {
              this.handleRetry("Socket closed");
            }
          },
          onerror: (e: any) => {
            this.clearLoadingTimeout();
            if (this.playbackState !== "stopped") {
              this.handleRetry("Socket error");
            }
          },
        },
      });
      
      return await connectPromise;
    } catch (err) {
      this.clearLoadingTimeout();
      this.sessionPromise = null;
      throw err;
    }
  }

  private clearLoadingTimeout() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  private handleRetry(reason: string) {
    if (this.isAttemptingReconnect) return;
    this.isAttemptingReconnect = true;
    
    this.retryCount++;
    this.session = null;
    this.sessionPromise = null;
    this.setPlaybackState("loading");
    this.nextStartTime = 0;
    
    this.dispatchEvent(new CustomEvent("error", { detail: `Retrying connection... (${this.retryCount})` }));
    
    setTimeout(() => {
      if (this.playbackState !== "stopped") {
        this.play().catch(() => { this.isAttemptingReconnect = false; });
      } else {
        this.isAttemptingReconnect = false;
      }
    }, 2000);
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(new CustomEvent("playback-state-changed", { detail: state }));
  }

  private async processAudioChunks(audioChunks: AudioChunk[]) {
    if (this.playbackState === "paused" || this.playbackState === "stopped") return;

    this.checkPromptFreshness(this.getChunkTexts(audioChunks));

    try {
      const data = decode(audioChunks[0].data!);
      const audioBuffer = await decodeAudioData(
        data,
        this.audioContext,
        48000,
        2,
      );

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);

      const now = this.audioContext.currentTime;
      if (this.nextStartTime < now - 0.5) {
        this.nextStartTime = now + 0.1;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      if (this.playbackState === "loading") {
        this.clearLoadingTimeout();
        this.setPlaybackState("playing");
        console.log("First audio chunk received. Playback started.");
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
  }, 1000);

  private async setWeightedPromptsImmediate() {
    if (!this.session) return;
    try {
      this.lastSentPrompts = this.activePrompts;
      await this.session.setWeightedPrompts({ weightedPrompts: this.activePrompts });
    } catch (e: any) {
      console.warn("Prompt update failed:", e);
    }
  }

  public async play() {
    if (this.sessionPromise) {
      await this.sessionPromise;
      return;
    }
    
    if (this.session) return;
    
    this.setPlaybackState("loading");
    
    try {
      this.sessionPromise = this.connect();
      this.session = await this.sessionPromise;
      this.sessionPromise = null;
      
      await this.setWeightedPromptsImmediate();
      this.session.play();
      this.outputNode.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.2);
    } catch (e: any) {
      this.sessionPromise = null;
      this.clearLoadingTimeout();
      this.handleRetry("Play failed");
      throw e;
    }
  }

  public stop() {
    this.setPlaybackState("stopped");
    this.clearLoadingTimeout();
    this.nextStartTime = 0;
    this.retryCount = 0;
    this.isAttemptingReconnect = false;
    this.sessionPromise = null;

    if (this.session) {
      try {
        this.outputNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.2);
        const s = this.session;
        setTimeout(() => {
          try { s.stop(); } catch(e) {}
        }, 300);
      } catch (e) {}
    }
    this.session = null;
  }
}
