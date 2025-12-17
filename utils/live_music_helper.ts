
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
  private maxRetries = 5; // Increased for better resilience
  private isAttemptingReconnect = false;

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

    try {
      const connectPromise = (ai.live as any).music.connect({
        model: this.model,
        callbacks: {
          onopen: () => {
            this.retryCount = 0;
            this.isAttemptingReconnect = false;
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
          onclose: (event: any) => {
            console.log("Lyria RealTime stream closed.", event);
            // If we are supposed to be playing, trigger recovery
            if (this.playbackState !== "stopped" && !this.isAttemptingReconnect) {
              this.handleRetry("Connection closed by server.");
            }
          },
          onerror: (e: any) => {
            console.error("Session Error:", e);
            const errorMsg = e?.message || "Unknown socket error";
            
            // Any error during active playback should trigger a retry attempt
            if (this.playbackState !== "stopped" && this.retryCount < this.maxRetries) {
               this.handleRetry(`Socket error: ${errorMsg}`);
            } else if (this.retryCount >= this.maxRetries) {
              this.stop();
              this.dispatchEvent(new CustomEvent("error", { 
                detail: "Maximum reconnection attempts reached. Please check your connection." 
              }));
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

  private handleRetry(reason: string) {
    if (this.isAttemptingReconnect) return;
    this.isAttemptingReconnect = true;
    
    this.retryCount++;
    console.warn(`Reconnecting (${this.retryCount}/${this.maxRetries}): ${reason}`);
    
    this.session = null;
    this.sessionPromise = null;
    this.setPlaybackState("loading");

    // Clean up nodes for a fresh start
    this.nextStartTime = 0;
    
    setTimeout(() => {
      if (this.playbackState !== "stopped") {
        this.play().catch(err => {
          console.error("Retry failed:", err);
          this.isAttemptingReconnect = false;
          // The next cycle or a manual click will try again
        });
      } else {
        this.isAttemptingReconnect = false;
      }
    }, 1500 * this.retryCount);
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
      // If we drifted too far, reset to 'now'
      if (this.nextStartTime < now - 0.5) {
        this.nextStartTime = now + 0.05;
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
  }, 800);

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
    // If already connecting, wait for that promise
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
      
      this.outputNode.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.1);
    } catch (e: any) {
      this.sessionPromise = null;
      console.error("Play failed:", e);
      if (this.retryCount < this.maxRetries) {
        this.handleRetry("Initial play failed.");
      } else {
        this.stop();
        throw e;
      }
    }
  }

  public stop() {
    this.setPlaybackState("stopped");
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
      } catch (e) {
        console.warn("Stop cleanup error:", e);
      }
    }
    
    this.session = null;
  }
}
