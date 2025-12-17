
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

import { html, LitElement, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";

import { defineSystemPrompt } from "../utils/define_system_prompt";
import { LiveMusicHelper } from "../utils/live_music_helper";
import { getT } from "../utils/i18n";
import {
  DEFAULT_INTERVAL_PRESET,
  GEMINI_MODEL,
  IMAGE_MIME_TYPE,
  INTERVAL_PRESETS,
  MAX_CAPTURE_DIM,
  PREFERRED_STREAM_PARAMS,
} from "../utils/constants";

import styles from "./lyria_camera_styles";

import type { ToastMessage } from "./toast_message";
import "./toast_message";

import type {
  PlaybackState,
  Prompt,
  AppState,
  FacingMode,
  IntervalPreset,
  StreamSource,
  Page,
  Language,
} from "../utils/types";

defineSystemPrompt();

interface FavoriteVibeRecord {
  id: string;
  name: string;
  prompts: Prompt[];
  timestamp: number;
  blob?: Blob;
  blobUrl?: string; // Runtime only
}

interface DebugLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'warn';
}

@customElement("lyria-camera")
export class LyriaCamera extends LitElement {
  static styles = styles;

  private liveMusicHelper!: LiveMusicHelper;
  private ai!: GoogleGenAI;

  @state() private page: Page = "splash";
  @state() private language: Language = "en";
  @state() private settingsOpen = false;
  @state() private settingsClosing = false;
  @state() private appState: AppState = "idle";
  @state() private playbackState: PlaybackState = "stopped";

  @state() private prompts: Prompt[] = [];
  @state() private promptsStale = false;
  @state() private promptsLoading = false;
  @state() private isCoolingDown = false;

  @state() private hasAudioChunks = false;
  @state() private supportsScreenShare = false;
  @state() private hasMultipleCameras = false;
  @state() private isVideoFlipped = false;

  @state() private lastCapturedImage: string | null = null;
  @state() private currentFacingMode: FacingMode = "environment";
  @state() private currentSource: StreamSource = "none";
  @state() private intervalPreset: IntervalPreset = { ...DEFAULT_INTERVAL_PRESET };
  @state() private captureCountdown = 0;
  @state() private uploadedImageSrc: string | null = null;
  @state() private imagePreviewSrc: string | null = null;

  @state() private volume: number = 0.8;
  @state() private isCapturingVibe: boolean = false;
  @state() private captureProgress: number = 0;
  
  @state() private newPromptText: string = "";
  
  // Dynamic Tooltip State
  @state() private activeTooltip: string | null = null;
  @state() private tooltipX = 0;
  @state() private tooltipY = 0;
  @state() private tooltipSide: 'left' | 'right' = 'right';

  // Favorites
  @state() private favorites: FavoriteVibeRecord[] = [];
  @state() private playingEchoId: string | null = null;
  private vibeAudioEl: HTMLAudioElement | null = null;

  // Debugging Console
  @state() private showDebugConsole = false;
  @state() private debugLogs: DebugLog[] = [];

  @query("video") private videoElement!: HTMLVideoElement;
  @query("img#uploaded-image-el") private uploadedImageElement!: HTMLImageElement;
  @query("toast-message") private toastMessageElement!: ToastMessage;
  @query("#file-input") private fileInput!: HTMLInputElement;
  @query("canvas#visualizer") private visualizerCanvas!: HTMLCanvasElement;

  private canvasElement: HTMLCanvasElement = document.createElement("canvas");

  private nextCaptureTime = 0;
  private timerRafId: number | null = null;
  private crossfadeIntervalId: number | null = null;
  private visualizerRafId: number | null = null;
  private captureIntervalId: number | null = null;

  private currentWeightedPrompts: Prompt[] = [];
  private uiAudioCtx: AudioContext | null = null;
  
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

  private db: IDBDatabase | null = null;

  // Analysis Retry Logic
  private analysisBackoffFactor = 0;

  async connectedCallback() {
    super.connectedCallback();
    this.addLog("Initializing app...", 'info');
    await this.initDB();
    this.loadFavorites();
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.liveMusicHelper = new LiveMusicHelper(process.env.API_KEY, "lyria-realtime-exp");

    this.liveMusicHelper.addEventListener(
      "playback-state-changed",
      (e: CustomEvent<PlaybackState>) => {
        this.addLog(`Playback state: ${e.detail}`, 'info');
        this.handlePlaybackStateChange(e);
      },
    );

    this.liveMusicHelper.addEventListener("prompts-fresh", () => (this.promptsStale = false));
    this.liveMusicHelper.addEventListener("error", (e: CustomEvent<string>) => this.dispatchError(e.detail));

    this.supportsScreenShare = !!navigator.mediaDevices?.getDisplayMedia;
    void this.updateCameraCapabilities();

    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimer();
    this.stopCurrentStream();
    this.stopVisualizer();
    this.stopRecording();
    if (this.uiAudioCtx) this.uiAudioCtx.close();
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    if (this.vibeAudioEl) { this.vibeAudioEl.pause(); }
  }

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "'") {
      e.preventDefault();
      this.toggleDebugConsole();
    }
  };

  private toggleDebugConsole() {
    this.showDebugConsole = !this.showDebugConsole;
    this.addLog(this.showDebugConsole ? "Debug console opened" : "Debug console closed", 'info');
  }

  private addLog(message: string, type: 'info' | 'error' | 'warn' = 'info') {
    const log: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    this.debugLogs = [log, ...this.debugLogs.slice(0, 49)];
  }

  private async initDB() {
    return new Promise<void>((resolve) => {
      const request = indexedDB.open("SonarDB", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("echoes")) {
          db.createObjectStore("echoes", { keyPath: "id" });
        }
      };
      request.onsuccess = (e: any) => {
        this.db = e.target.result;
        resolve();
      };
    });
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (this.activeTooltip) {
      this.tooltipX = e.clientX;
      this.tooltipY = e.clientY;
      const threshold = 180; 
      this.tooltipSide = e.clientX > window.innerWidth - threshold ? 'left' : 'right';
    }
  };

  private async loadFavorites() {
    if (!this.db) return;
    const tx = this.db.transaction("echoes", "readonly");
    const store = tx.objectStore("echoes");
    const request = store.getAll();
    request.onsuccess = () => {
      this.favorites = (request.result || []).map(f => ({
        ...f,
        blobUrl: f.blob ? URL.createObjectURL(f.blob) : undefined
      })).sort((a, b) => b.timestamp - a.timestamp);
    };
  }

  private async saveEchoToDB(echo: FavoriteVibeRecord) {
    if (!this.db) return;
    const tx = this.db.transaction("echoes", "readwrite");
    const store = tx.objectStore("echoes");
    const echoToStore = { ...echo };
    delete echoToStore.blobUrl; // Don't store runtime URL
    store.put(echoToStore);
  }

  private async startVibeCapture() {
    if (this.isCapturingVibe) return;
    if (this.prompts.length === 0) {
      this.dispatchError("No vibe to capture yet.");
      return;
    }
    
    this.isCapturingVibe = true;
    this.captureProgress = 0;
    this.addLog("Starting vibe capture (5m)", 'info');
    this.toastMessageElement.show("Recording a 5-minute Vibe composition...");
    
    const ctx = this.liveMusicHelper.audioContext;
    this.recordingDestination = ctx.createMediaStreamDestination();
    this.liveMusicHelper.connectRecorder(this.recordingDestination);
    this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
    this.recordedChunks = [];
    
    this.mediaRecorder.ondataavailable = (e) => this.recordedChunks.push(e.data);
    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const name = prompt("Name this composition:", `Vibe ${this.favorites.length + 1}`) || `Vibe ${this.favorites.length + 1}`;
      
      const newEcho: FavoriteVibeRecord = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        prompts: [...this.prompts],
        timestamp: Date.now(),
        blob,
        blobUrl: URL.createObjectURL(blob)
      };
      
      await this.saveEchoToDB(newEcho);
      this.favorites = [newEcho, ...this.favorites];
      this.toastMessageElement.show("Composition saved to Vibes.");
      this.addLog(`Vibe saved: ${name}`, 'info');
      this.playFeedbackSound('save');
      this.isCapturingVibe = false;
      if (this.recordingDestination) this.liveMusicHelper.disconnectRecorder(this.recordingDestination);
    };

    this.mediaRecorder.start();

    let duration = 300000; // 300 seconds (5 minutes)
    let start = Date.now();
    this.captureIntervalId = window.setInterval(() => {
      let elapsed = Date.now() - start;
      this.captureProgress = (elapsed / duration) * 100;
      if (elapsed >= duration) {
        clearInterval(this.captureIntervalId!);
        this.mediaRecorder?.stop();
      }
    }, 100);
  }

  private randomizeWeights() {
    this.prompts = this.prompts.map(p => ({ ...p, weight: 0.2 + Math.random() * 0.8 }));
    this.sendWeightedPrompts(this.prompts);
    this.toastMessageElement.show("Prompt weights randomized.");
  }

  private async deleteFavorite(id: string) {
    if (!this.db) return;
    const tx = this.db.transaction("echoes", "readwrite");
    const store = tx.objectStore("echoes");
    store.delete(id);
    this.favorites = this.favorites.filter(f => f.id !== id);
    if (this.playingEchoId === id) this.stopEchoPlayback();
  }

  private toggleEchoPlayback(echo: FavoriteVibeRecord) {
    if (this.playingEchoId === echo.id) {
      this.stopEchoPlayback();
      return;
    }

    this.stopEchoPlayback();
    this.playingEchoId = echo.id;
    this.vibeAudioEl = new Audio(echo.blobUrl);
    this.vibeAudioEl.onended = () => this.stopEchoPlayback();
    this.vibeAudioEl.play();
  }

  private stopEchoPlayback() {
    if (this.vibeAudioEl) {
      this.vibeAudioEl.pause();
      this.vibeAudioEl = null;
    }
    this.playingEchoId = null;
  }

  private downloadEcho(echo: FavoriteVibeRecord) {
    const a = document.createElement('a');
    a.href = echo.blobUrl!;
    a.download = `${echo.name.replace(/\s+/g, '_')}.mp3`;
    a.click();
  }

  private stopCurrentStream() {
    if (!this.videoElement || !this.videoElement.srcObject) return;
    (this.videoElement.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    this.videoElement.srcObject = null;
  }

  private async updateCameraCapabilities() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.hasMultipleCameras = devices.filter((d) => d.kind === "videoinput").length > 1;
    } catch (e) { console.warn(e); }
  }

  private async setupCamera() {
    this.ensureUiAudio();
    this.stopCurrentStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { ...PREFERRED_STREAM_PARAMS, facingMode: this.currentFacingMode } 
      });
      this.page = "main";
      this.currentSource = "camera";
      await (this as any).updateComplete;
      this.setStream(stream, "camera", this.currentFacingMode === "user");
    } catch (e: any) { this.dispatchError(e.message || "Camera error."); }
  }

  private async switchCamera() {
    this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
    await this.setupCamera();
  }

  private async setupScreenShare() {
    this.ensureUiAudio();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      this.page = "main";
      this.currentSource = "screen";
      await (this as any).updateComplete;
      this.setStream(stream, "screen", false);
    } catch (e: any) { this.dispatchError(e.message); }
  }

  private triggerImageUpload() {
    this.ensureUiAudio();
    this.fileInput.click();
  }

  private handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.imagePreviewSrc = ev.target?.result as string;
      this.page = "preview";
      this.fileInput.value = "";
    };
    reader.readAsDataURL(file);
  }

  private async confirmImageUpload() {
    this.uploadedImageSrc = this.imagePreviewSrc;
    this.currentSource = "image";
    this.page = "main";
    this.imagePreviewSrc = null;
    this.appState = "idle"; 
    await (this as any).updateComplete;
  }

  private cancelImageUpload() {
    this.imagePreviewSrc = null;
    this.page = this.currentSource === "none" ? "splash" : "main";
  }

  private setStream(stream: MediaStream, source: StreamSource, flipped: boolean) {
    this.isVideoFlipped = flipped;
    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play();
        void this.updateCameraCapabilities();
      };
    }
    stream.getVideoTracks()[0].onended = () => this.resetSession();
  }

  private startTimer() {
    this.stopTimer();
    if (this.intervalPreset.captureSeconds === 0) return;
    
    // Add extra buffer if we just hit a rate limit
    const backoffMs = this.analysisBackoffFactor * 5000;
    this.nextCaptureTime = performance.now() + (this.intervalPreset.captureSeconds * 1000) + backoffMs;
    this.tick();
  }

  private tick = () => {
    if (this.isCapturingVibe || this.intervalPreset.captureSeconds === 0) return;
    const remainingMs = this.nextCaptureTime - performance.now();
    this.captureCountdown = Math.max(0, Math.ceil(remainingMs / 1000));
    if (remainingMs <= 0) { void this.captureAndGenerate(); } 
    else { this.timerRafId = requestAnimationFrame(this.tick); }
  };

  private stopTimer() {
    if (this.timerRafId) cancelAnimationFrame(this.timerRafId);
    this.timerRafId = null;
  }

  private async captureAndGenerate() {
    if (this.promptsLoading || this.page === "splash" || this.isCoolingDown) return;
    
    this.playFeedbackSound('capture');
    this.promptsLoading = true;
    this.addLog(`Analyzing visual scene using ${GEMINI_MODEL}...`, 'info');
    
    const snapshot = this.getStreamSnapshot();
    if (!snapshot) { 
      this.promptsLoading = false; 
      this.startTimer(); 
      this.addLog("Capture failed: No stream data", 'error');
      return; 
    }
    
    this.lastCapturedImage = snapshot;
    const base64ImageData = snapshot.split(",")[1];
    
    try {
      const response = await this.ai.models.generateContent(this.getGenerateContentParams(base64ImageData));
      const json = JSON.parse(response.text!);
      const newPrompts = (json.prompts as string[]).map(text => ({ text, weight: 1.0 }));
      
      this.addLog(`New prompts generated: ${json.prompts.join(' | ')}`, 'info');
      this.analysisBackoffFactor = 0; // Reset backoff on success

      if (this.appState === "pendingStart") {
        this.prompts = newPrompts;
        this.currentWeightedPrompts = newPrompts;
        this.liveMusicHelper.setWeightedPrompts(newPrompts);
        await this.liveMusicHelper.play();
        this.appState = "playing";
      } else {
        this.startCrossfade(json.prompts);
      }
    } catch (e: any) {
      const errorMsg = e.message || "";
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("Too Many Requests") || errorMsg.includes("rate limit");
      
      if (isRateLimit) {
        this.analysisBackoffFactor = Math.min(this.analysisBackoffFactor + 1, 5);
        this.isCoolingDown = true;
        this.addLog(`Rate limit hit on ${GEMINI_MODEL}. Entering cooldown...`, 'warn');
        this.toastMessageElement.show("AI is resting (Rate Limit). Retrying in a few seconds...", 5000);
        
        setTimeout(() => {
          this.isCoolingDown = false;
          this.addLog("Cooldown finished.", 'info');
        }, 8000);
      } else {
        this.addLog(`AI analysis failed: ${errorMsg}`, 'error');
        this.dispatchError("AI analysis failed.");
      }
    } finally {
      this.promptsLoading = false;
      this.startTimer();
    }
  }

  private getStreamSnapshot() {
    const el = this.currentSource === "image" ? this.uploadedImageElement : this.videoElement;
    if (!el && this.uploadedImageSrc) return this.uploadedImageSrc; 
    if (!el) return null;
    let w = el instanceof HTMLImageElement ? el.naturalWidth : (el as HTMLVideoElement).videoWidth;
    let h = el instanceof HTMLImageElement ? el.naturalHeight : (el as HTMLVideoElement).videoHeight;
    if (w === 0 || h === 0) return null;
    return this.drawToCanvas(el, w, h);
  }

  private drawToCanvas(element: any, width: number, height: number) {
    let dw = width, dh = height;
    if (dw > MAX_CAPTURE_DIM) { dh = (MAX_CAPTURE_DIM / dw) * dh; dw = MAX_CAPTURE_DIM; }
    this.canvasElement.width = dw; this.canvasElement.height = dh;
    const ctx = this.canvasElement.getContext("2d");
    ctx?.drawImage(element, 0, 0, dw, dh);
    return this.canvasElement.toDataURL(IMAGE_MIME_TYPE);
  }

  private getGenerateContentParams(data: string) {
    return {
      model: GEMINI_MODEL,
      contents: { parts: [{ inlineData: { mimeType: IMAGE_MIME_TYPE, data } }, { text: window.systemPrompt }] },
      config: { 
        responseMimeType: "application/json", 
        responseSchema: { type: Type.OBJECT, properties: { prompts: { type: Type.ARRAY, items: { type: Type.STRING } } } } 
      },
    };
  }

  private updatePromptWeight(index: number, weight: number) {
    this.prompts[index].weight = weight;
    this.prompts = [...this.prompts];
    this.sendWeightedPrompts(this.prompts);
  }

  private sendWeightedPrompts(weighted: Prompt[]) {
    this.liveMusicHelper.setWeightedPrompts(weighted);
    this.promptsStale = true;
  }

  private startCrossfade(texts: string[]) {
    this.stopCrossfade();
    const target = texts.map(text => ({ text, weight: 0 }));
    const from = this.currentWeightedPrompts.length > 0 ? [...this.currentWeightedPrompts] : target.map(t => ({...t, weight: 0}));
    const start = performance.now();
    const duration = this.intervalPreset.crossfadeSeconds * 1000;
    
    const update = () => {
      const now = performance.now();
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      const blended = [...from.map(p => ({...p, weight: p.weight * (1-t)})), ...target.map(p => ({...p, weight: t}))];
      this.currentWeightedPrompts = blended;
      this.sendWeightedPrompts(blended);
      if (t >= 1) { 
        this.stopCrossfade(); 
        this.prompts = target.map(p => ({...p, weight: 1.0})); 
        this.currentWeightedPrompts = this.prompts; 
      }
    };
    if (duration > 0) this.crossfadeIntervalId = window.setInterval(update, 60);
    else update();
  }

  private stopCrossfade() { if (this.crossfadeIntervalId) clearInterval(this.crossfadeIntervalId); }

  private deletePrompt(i: number) {
    this.prompts.splice(i, 1);
    this.prompts = [...this.prompts];
    this.sendWeightedPrompts(this.prompts);
  }

  private addPrompt() {
    if (!this.newPromptText.trim()) return;
    this.prompts = [...this.prompts, { text: this.newPromptText.trim(), weight: 1.0 }];
    this.newPromptText = "";
    this.sendWeightedPrompts(this.prompts);
  }

  private handlePlaybackStateChange(e: CustomEvent<PlaybackState>) {
    this.playbackState = e.detail;
    if (this.playbackState === "playing") { 
      this.hasAudioChunks = true; 
      this.startTimer(); 
      this.startVisualizer(); 
    } else {
      this.stopTimer();
      this.stopVisualizer();
    }
  }

  private async handlePlayPause() {
    if (this.appState === "idle") { 
      this.appState = "pendingStart"; 
      await this.captureAndGenerate(); 
    } else { await this.requestStop(); }
  }

  private async requestStop() {
    this.stopTimer(); 
    this.stopVisualizer(); 
    this.liveMusicHelper.stop();
    this.appState = "idle"; 
    this.hasAudioChunks = false; 
    this.isCapturingVibe = false;
  }

  private stopRecording() {
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
  }

  private startVisualizer() {
    this.stopVisualizer();
    this.liveMusicHelper.analyser.fftSize = 1024;
    const draw = () => {
      if (!this.visualizerCanvas || !this.liveMusicHelper.analyser) return;
      const cvs = this.visualizerCanvas, ctx = cvs.getContext("2d")!;
      if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }
      const data = new Uint8Array(this.liveMusicHelper.analyser.frequencyBinCount);
      this.liveMusicHelper.analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const time = performance.now() * 0.00015;
      const lowRange = data.slice(0, 10);
      const avgLow = lowRange.reduce((a, b) => a + b, 0) / lowRange.length;
      const bassImpact = avgLow / 255;
      this.drawAurora(ctx, cvs, time, data, "rgba(255, 255, 255, 0.45)", 180, bassImpact);
      this.drawAurora(ctx, cvs, time * 1.5, data, "rgba(180, 180, 180, 0.3)", 120, bassImpact * 1.6);
      this.drawAurora(ctx, cvs, time * 0.8, data, "rgba(80, 80, 80, 0.2)", 220, bassImpact * 0.7);
      (this as any).style.setProperty('--bass-glow', `${bassImpact * 50}px`);
      (this as any).style.setProperty('--bass-opacity', `${0.1 + bassImpact * 0.65}`);
      (this as any).style.setProperty('--bass-shake', `${bassImpact * 3}px`);
      this.visualizerRafId = requestAnimationFrame(draw);
    };
    draw();
  }

  private drawAurora(ctx: CanvasRenderingContext2D, cvs: any, time: number, data: Uint8Array, color: string, offset: number, bass: number) {
    ctx.beginPath();
    const gradient = ctx.createLinearGradient(0, cvs.height - offset - 450, 0, cvs.height);
    gradient.addColorStop(0, "transparent"); 
    gradient.addColorStop(0.5, color); 
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient; ctx.moveTo(0, cvs.height);
    for (let x = 0; x <= cvs.width; x += 15) {
      const idx = Math.floor(Math.pow(x / cvs.width, 1.8) * (data.length * 0.45));
      const f = (data[idx] || 0) / 255;
      const wave = Math.sin(x * 0.0025 + time) * (450 * f + 80 * bass + 15);
      ctx.lineTo(x, (cvs.height - offset) - wave);
    }
    ctx.lineTo(cvs.width, cvs.height); ctx.fill();
  }

  private stopVisualizer() { if (this.visualizerRafId) cancelAnimationFrame(this.visualizerRafId); }
  private dispatchError(m: string) { 
    this.addLog(m, 'error');
    this.toastMessageElement.show(m); 
  }
  private ensureUiAudio() { if (!this.uiAudioCtx) this.uiAudioCtx = new AudioContext(); }
  private playFeedbackSound(t: string) {
    if (!this.uiAudioCtx) return;
    const osc = this.uiAudioCtx.createOscillator(), g = this.uiAudioCtx.createGain();
    osc.connect(g); g.connect(this.uiAudioCtx.destination);
    osc.frequency.setValueAtTime(t === 'save' ? 660 : 440, this.uiAudioCtx.currentTime);
    g.gain.setValueAtTime(0.015, this.uiAudioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.uiAudioCtx.currentTime + 0.15);
    osc.start(); osc.stop(this.uiAudioCtx.currentTime + 0.15);
  }

  private resetSession() { this.requestStop(); this.stopCurrentStream(); this.page = "splash"; this.currentSource = "none"; }

  private closeSettings() {
    this.settingsClosing = true;
    setTimeout(() => { this.settingsOpen = false; this.settingsClosing = false; }, 400);
  }

  private showTooltip(text: string) { this.activeTooltip = text; }
  private hideTooltip() { this.activeTooltip = null; }

  private getStatusText(t: any) {
    if (this.isCoolingDown) return "AI COOLING DOWN...";
    if (this.appState === "idle") return t.ready;
    if (this.appState === "pendingStart") return t.synthesizing;
    if (this.appState === "playing") return t.flowing;
    return "";
  }

  render() {
    const t = getT(this.language);
    return html`
      <div id="video-container" aria-hidden="true" class=${classMap({ analyzing: this.promptsLoading, cooling: this.isCoolingDown })}>
        ${this.currentSource === "image" ? html`<img id="uploaded-image-el" alt="Uploaded source" src=${this.uploadedImageSrc!} />` : html`<video playsinline muted style=${styleMap({transform: this.isVideoFlipped ? "scaleX(-1)" : "none"})}></video>`}
        ${this.promptsLoading ? html`<div class="analysis-overlay"><div class="scanline"></div><div class="analysis-status">${t.synthesizing}</div></div>` : nothing}
        ${this.isCoolingDown ? html`<div class="analysis-overlay cooldown"><div class="analysis-status" style="background: #ff453a; color: white;">AI OVERLOAD - COOLING DOWN</div></div>` : nothing}
      </div>
      <canvas id="visualizer" aria-hidden="true"></canvas>
      <div id="ui-layer" role="main">
        ${this.renderPage(t)}
        ${this.settingsOpen ? this.renderSettings(t) : nothing}
        ${this.showDebugConsole ? this.renderDebugConsole() : nothing}
      </div>
      <toast-message aria-live="polite"></toast-message>
      <input type="file" id="file-input" hidden @change=${this.handleFileChange} accept="image/*" aria-hidden="true" />
      ${this.activeTooltip ? html`<div class="tooltip-bubble ${this.tooltipSide}" style=${styleMap({ left: `${this.tooltipX}px`, top: `${this.tooltipY}px` })}>${this.activeTooltip}</div>` : nothing}
      
      <!-- Persistent Debug Toggle -->
      <button class="debug-toggle-btn" @click=${this.toggleDebugConsole} aria-label="Toggle Debug Console">
        <span class="material-icons-round" style="font-size: 16px;">terminal</span>
      </button>
    `;
  }

  private renderDebugConsole() {
    return html`
      <div class="debug-console glass">
        <div class="debug-header">
          <span>DEBUG CONSOLE (CTRL + ')</span>
          <button @click=${() => this.debugLogs = []} class="debug-btn">Clear</button>
          <button @click=${() => this.showDebugConsole = false} class="debug-btn">Close</button>
        </div>
        <div class="debug-body">
          <div class="debug-state">
            Model: <strong>${GEMINI_MODEL}</strong> |
            Page: <strong>${this.page}</strong> | 
            AppState: <strong>${this.appState}</strong> | 
            Playback: <strong>${this.playbackState}</strong> |
            Backoff: <strong>${this.analysisBackoffFactor}</strong>
          </div>
          ${this.debugLogs.map(log => html`
            <div class="debug-log-line ${log.type}">
              <span class="log-ts">[${log.timestamp}]</span>
              <span class="log-msg">${log.message}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderPage(t: any) {
    if (this.page === "splash") return this.renderSplash(t);
    if (this.page === "preview") return this.renderPreview(t);
    return this.renderMain(t);
  }

  private renderSplash(t: any) {
    return html`
      <div class="splash-page">
        <div class="splash-background" aria-hidden="true"></div>
        <h1 class="logo-title">${t.logo}<span class="thin" aria-hidden="true">.</span></h1>
        <p class="subtitle">${t.subtitle}</p>
        <div class="source-grid" role="group" aria-label="Select source">
          <button class="source-card" @click=${this.setupCamera} @mouseenter=${() => this.showTooltip(t.camera)} @mouseleave=${this.hideTooltip} aria-label="${t.camera}">
            <span class="material-icons-round card-icon" aria-hidden="true">videocam</span><span class="card-label">${t.camera}</span>
          </button>
          <button class="source-card" @click=${this.setupScreenShare} @mouseenter=${() => this.showTooltip(t.screen)} @mouseleave=${this.hideTooltip} aria-label="${t.screen}">
            <span class="material-icons-round card-icon" aria-hidden="true">screen_share</span><span class="card-label">${t.screen}</span>
          </button>
          <button class="source-card" @click=${this.triggerImageUpload} @mouseenter=${() => this.showTooltip(t.image)} @mouseleave=${this.hideTooltip} aria-label="${t.image}">
            <span class="material-icons-round card-icon" aria-hidden="true">image</span><span class="card-label">${t.image}</span>
          </button>
        </div>
      </div>
    `;
  }

  private renderPreview(t: any) {
    return html`
      <div class="sheet glass preview-sheet" role="dialog" aria-labelledby="preview-heading">
        <div class="sheet-header"><h3 id="preview-heading">${t.confirmIdentity}</h3></div>
        <div class="preview-image-container">
          <img src=${this.imagePreviewSrc!} alt="Preview of uploaded image" />
        </div>
        <div class="preview-actions">
          <button class="btn-cancel" @click=${this.cancelImageUpload}>${t.cancel}</button>
          <button class="btn-begin" @click=${this.confirmImageUpload}>${t.begin}</button>
        </div>
      </div>
    `;
  }

  private renderMain(t: any) {
    return html`
      <div class="top-bar">
        <button class="icon-button" @click=${this.resetSession} @mouseenter=${() => this.showTooltip(t.backTooltip)} @mouseleave=${this.hideTooltip} aria-label="${t.backTooltip}"><span class="material-icons-round" aria-hidden="true">arrow_back</span></button>
        ${this.currentSource === "camera" && this.hasMultipleCameras ? html`<button class="icon-button" @click=${this.switchCamera} @mouseenter=${() => this.showTooltip(t.switchCameraTooltip)} @mouseleave=${this.hideTooltip} aria-label="${t.switchCameraTooltip}"><span class="material-icons-round" aria-hidden="true">flip_camera_android</span></button>` : nothing}
        <div style="flex:1"></div>
        <button class="icon-button" @click=${() => this.settingsOpen = true} @mouseenter=${() => this.showTooltip(t.settingsTooltip)} @mouseleave=${this.hideTooltip} aria-label="${t.settingsTooltip}"><span class="material-icons-round" aria-hidden="true">tune</span></button>
      </div>

      <div id="prompts-container" role="list" aria-label="Active musical prompts">
        <div class="prompts-actions">
           <div style="width: 36px"></div> <!-- Spacing to balance the shuffle button -->
           <button class="icon-button mini" @click=${() => this.randomizeWeights()} @mouseenter=${() => this.showTooltip("Randomize vibe weights")} @mouseleave=${this.hideTooltip} aria-label="Randomize weights"><span class="material-icons-round" style="font-size:18px;" aria-hidden="true">shuffle</span></button>
        </div>
        ${this.prompts.map((p, i) => html`
          <div class="prompt-tag" role="listitem">
            <div class="prompt-header"><span class="prompt-text">${p.text}</span><button class="material-icons-round delete-btn" style="font-size:18px;" @click=${() => this.deletePrompt(i)} @mouseenter=${() => this.showTooltip(t.deletePromptTooltip)} @mouseleave=${this.hideTooltip}>close</button></div>
            <div class="weight-slider-container"><input type="range" class="weight-slider" min="0" max="1" step="0.01" .value=${p.weight.toString()} @input=${(e:any) => this.updatePromptWeight(i, +e.target.value)} /></div>
          </div>
        `)}
        <div class="add-prompt-box">
          <input class="add-input glass" placeholder="${t.addVibe}" .value=${this.newPromptText} @input=${(e:any)=>this.newPromptText=e.target.value} @keydown=${(e:any)=>e.key==='Enter' && this.addPrompt()} /><button class="icon-button" @click=${this.addPrompt} @mouseenter=${() => this.showTooltip(t.addPromptTooltip)} @mouseleave=${this.hideTooltip}><span class="material-icons-round" aria-hidden="true">add</span></button>
        </div>
      </div>

      <div id="pip-container" class=${classMap({visible: !!this.lastCapturedImage})}><img src=${this.lastCapturedImage!} alt="Last analyzed frame" /></div>

      <div id="controls-container">
        ${this.isCapturingVibe ? html`<div class="progress-container mini"><div class="progress-bar-fill" style="width: ${this.captureProgress}%"></div></div>` : nothing}
        <div class="status-pill" role="status" aria-live="polite" style=${styleMap({color: this.isCoolingDown ? '#ff453a' : 'inherit'})}>${this.getStatusText(t)}</div>
        <div class="main-playback">
          <button class="icon-button" @click=${this.startVibeCapture} @mouseenter=${() => this.showTooltip("Capture 5min Vibe")} @mouseleave=${this.hideTooltip} aria-label="Capture vibe" style=${styleMap({background: this.isCapturingVibe ? 'white' : ''})}>
            <span class="material-icons-round" style=${styleMap({color: this.isCapturingVibe ? 'black' : 'white'})} aria-hidden="true">${this.isCapturingVibe ? 'graphic_eq' : 'bookmark_add'}</span>
          </button>
          <button class="play-btn ${this.appState !== 'idle' ? 'playing' : ''}" @click=${this.handlePlayPause} @mouseenter=${() => this.showTooltip(this.appState !== 'idle' ? t.pauseTooltip : t.playTooltip)} @mouseleave=${this.hideTooltip}>
            <span class="material-icons-round" style="font-size: 36px;" aria-hidden="true">${this.appState !== 'idle' ? 'pause' : 'play_arrow'}</span>
          </button>
          <button class="icon-button" @click=${() => this.captureAndGenerate()} ?disabled=${this.isCoolingDown} @mouseenter=${() => this.showTooltip(this.isCoolingDown ? "AI Cooling Down..." : t.captureTooltip)} @mouseleave=${this.hideTooltip} style=${styleMap({opacity: this.isCoolingDown ? '0.2' : '1'})}>
            <span class="material-icons-round" aria-hidden="true">camera</span>
          </button>
        </div>
        <div class="volume-bar" role="group" aria-label="Volume control">
          <span class="material-icons-round" style="font-size:14px; opacity:0.4;">volume_down</span>
          <input type="range" class="weight-slider" min="0" max="1" step="0.01" .value=${this.volume.toString()} @input=${(e:any) => { this.volume = +e.target.value; this.liveMusicHelper.setVolume(this.volume); }} />
          <span class="material-icons-round" style="font-size:14px; opacity:0.4;">volume_up</span>
        </div>
      </div>
    `;
  }

  private renderSettings(t: any) {
    return html`
      <div class="sheet glass ${this.settingsClosing ? 'closing' : ''}" role="dialog">
        <div class="sheet-header"><h3>${t.engineTuning}</h3><button class="material-icons-round" @click=${this.closeSettings} style="cursor:pointer; opacity:0.5; background:none; border:none; color:inherit;">close</button></div>
        <div class="settings-scroll-area">
          <label class="section-label">${t.savedEchoes}</label>
          <div class="favorites-list">
            ${this.favorites.length === 0 ? html`<div class="empty-list">No vibes captured yet.</div>` : this.favorites.map(f => html`
              <div class="favorite-item glass">
                <div class="fav-info" @click=${() => this.toggleEchoPlayback(f)}>
                  <div class="fav-name">
                    ${this.playingEchoId === f.id ? html`<span class="material-icons-round" style="font-size:16px; margin-right:8px; vertical-align:middle;">pause</span>` : html`<span class="material-icons-round" style="font-size:16px; margin-right:8px; vertical-align:middle;">play_arrow</span>`}
                    ${f.name}
                  </div>
                  <div class="fav-meta">${f.prompts.length} Vibes • ${new Date(f.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="fav-actions">
                  <button class="fav-action-btn material-icons-round" @click=${() => this.downloadEcho(f)}>download</button>
                  <button class="fav-action-btn material-icons-round delete" @click=${() => this.deleteFavorite(f.id)}>delete_outline</button>
                </div>
              </div>
            `)}
          </div>
          <label class="section-label" style="margin-top: 2rem;">Analysis Interval</label>
          <div class="preset-grid">${INTERVAL_PRESETS.map(p => html`<button class="preset-card ${this.intervalPreset.labelSub === p.labelSub ? 'active' : ''}" @click=${() => { this.intervalPreset = p; this.startTimer(); }}><h4>${p.labelSub === 'INFINITE' ? t.infinite : p.labelSub}</h4><p>${p.labelValue === '∞' ? t.staticMood : `${t.analyzeEvery} ${p.labelValue}`}</p></button>`)}</div>
          <div style="margin-top: 1.5rem;"><label class="section-label">${t.transitionSmoothness} (${this.intervalPreset.crossfadeSeconds}s)</label><input type="range" class="weight-slider" style="width:100%; margin-top:0.75rem;" min="0" max="25" .value=${this.intervalPreset.crossfadeSeconds.toString()} @input=${(e:any) => this.intervalPreset = {...this.intervalPreset, crossfadeSeconds: +e.target.value}} /></div>
          <div style="margin-top: 2rem;"><label class="section-label">${t.language}</label><div class="language-toggle"><button class="lang-btn ${this.language === 'en' ? 'active' : ''}" @click=${() => this.language = 'en'}>English</button><button class="lang-btn ${this.language === 'pt' ? 'active' : ''}" @click=${() => this.language = 'pt'}>Português</button></div></div>
        </div>
      </div>
    `;
  }
}
