
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

import { html, LitElement, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { when } from "lit/directives/when.js";

import { urlargs } from "../utils/urlargs";
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

@customElement("lyria-camera")
export class LyriaCamera extends LitElement {
  static styles = styles;

  private liveMusicHelper!: LiveMusicHelper;
  private ai!: GoogleGenAI;

  @state() private page: Page = "splash";
  @state() private language: Language = "en";
  @state() private settingsOpen = false;
  @state() private exportOpen = false;
  @state() private appState: AppState = "idle";
  @state() private playbackState: PlaybackState = "stopped";

  @state() private prompts: Prompt[] = [];
  @state() private promptsStale = false;
  @state() private promptsLoading = false;

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
  @state() private isRecording: boolean = false;
  @state() private isCreatingSong: boolean = false;
  @state() private songDurationMinutes: number = 2; 
  @state() private recordingDurationSeconds: number = 0;

  @state() private newPromptText: string = "";

  // Debug Console States
  @state() private debugConsoleOpen = false;
  @state() private debugLogs: { type: 'log' | 'warn' | 'error', text: string }[] = [];

  @query("video") private videoElement!: HTMLVideoElement;
  @query("img#uploaded-image-el") private uploadedImageElement!: HTMLImageElement;
  @query("toast-message") private toastMessageElement!: ToastMessage;
  @query("#file-input") private fileInput!: HTMLInputElement;
  @query("canvas#visualizer") private visualizerCanvas!: HTMLCanvasElement;
  @query(".debug-console") private debugConsoleEl?: HTMLElement;

  private canvasElement: HTMLCanvasElement = document.createElement("canvas");

  private nextCaptureTime = 0;
  private timerRafId: number | null = null;
  private crossfadeIntervalId: number | null = null;
  private visualizerRafId: number | null = null;
  private recordingIntervalId: number | null = null;

  private currentWeightedPrompts: Prompt[] = [];
  private uiAudioCtx: AudioContext | null = null;
  
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;

  async connectedCallback() {
    super.connectedCallback();
    this.setupDebugConsole();
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.liveMusicHelper = new LiveMusicHelper(process.env.API_KEY, "models/lyria-realtime-exp");

    this.liveMusicHelper.addEventListener(
      "playback-state-changed",
      (e: CustomEvent<PlaybackState>) => this.handlePlaybackStateChange(e),
    );

    this.liveMusicHelper.addEventListener("prompts-fresh", () => (this.promptsStale = false));

    this.liveMusicHelper.addEventListener("error", (e: CustomEvent<string>) => {
      this.dispatchError(e.detail);
    });

    this.supportsScreenShare = !!navigator.mediaDevices?.getDisplayMedia;
    void this.updateCameraCapabilities();

    window.addEventListener('keydown', this.handleGlobalKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopTimer();
    this.stopCurrentStream();
    this.stopVisualizer();
    this.stopRecording();
    if (this.uiAudioCtx) this.uiAudioCtx.close();
    window.removeEventListener('keydown', this.handleGlobalKeydown);
  }

  private handleGlobalKeydown = (e: KeyboardEvent) => {
    // CTRL + ' (Quote) shortcut
    if (e.ctrlKey && e.key === "'") {
      this.debugConsoleOpen = !this.debugConsoleOpen;
      if (this.debugConsoleOpen) {
        setTimeout(() => {
          if (this.debugConsoleEl) {
            this.debugConsoleEl.scrollTop = this.debugConsoleEl.scrollHeight;
          }
        }, 50);
      }
    }
  };

  private setupDebugConsole() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      this.pushDebugLog('log', args.join(' '));
      originalLog.apply(console, args);
    };
    console.warn = (...args: any[]) => {
      this.pushDebugLog('warn', args.join(' '));
      originalWarn.apply(console, args);
    };
    console.error = (...args: any[]) => {
      this.pushDebugLog('error', args.join(' '));
      originalError.apply(console, args);
    };
  }

  private pushDebugLog(type: 'log' | 'warn' | 'error', text: string) {
    this.debugLogs = [...this.debugLogs, { type, text }].slice(-50); // Keep last 50
    if (this.debugConsoleOpen) {
      setTimeout(() => {
        if (this.debugConsoleEl) {
          this.debugConsoleEl.scrollTop = this.debugConsoleEl.scrollHeight;
        }
      }, 10);
    }
  }

  private stopCurrentStream() {
    if (!this.videoElement || !this.videoElement.srcObject) return;
    (this.videoElement.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    this.videoElement.srcObject = null;
  }

  private async updateCameraCapabilities() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      this.hasMultipleCameras = videoDevices.length > 1;
    } catch (e) {
      console.warn("Could not enumerate devices", e);
    }
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
    } catch (e: any) {
      this.dispatchError(e.message || "Could not start video source.");
    }
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
    } catch (e: any) {
      this.dispatchError(e.message || "Permission denied by user.");
    }
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
    stream.getVideoTracks()[0].onended = () => {
      this.resetSession();
    };
  }

  private startTimer() {
    this.stopTimer();
    if (this.intervalPreset.captureSeconds === 0) return;
    this.nextCaptureTime = performance.now() + this.intervalPreset.captureSeconds * 1000;
    this.tick();
  }

  private tick = () => {
    if (this.isCreatingSong || this.intervalPreset.captureSeconds === 0) return;
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
    if (this.promptsLoading || this.page === "splash") return;
    this.playFeedbackSound('capture');
    this.promptsLoading = true;
    
    const snapshot = this.getStreamSnapshot();
    if (!snapshot) { this.promptsLoading = false; this.startTimer(); return; }
    
    this.lastCapturedImage = snapshot;
    const base64ImageData = snapshot.split(",")[1];
    try {
      const response = await this.ai.models.generateContent(this.getGenerateContentParams(base64ImageData));
      const json = JSON.parse(response.text);
      const newPrompts = (json.prompts as string[]).map(text => ({ text, weight: 1.0 }));
      
      if (this.appState === "pendingStart") {
        this.prompts = newPrompts;
        this.currentWeightedPrompts = newPrompts;
        this.liveMusicHelper.setWeightedPrompts(newPrompts);
        await this.liveMusicHelper.play();
        this.appState = "playing";
      } else {
        this.startCrossfade(json.prompts);
      }
    } catch (e) {
      console.error("AI Analysis Error:", e);
      this.dispatchError("AI analysis failed.");
    } finally {
      this.promptsLoading = false;
      this.startTimer();
    }
  }

  private getStreamSnapshot() {
    const el = this.currentSource === "image" ? this.uploadedImageElement : this.videoElement;
    if (!el && this.uploadedImageSrc) return this.uploadedImageSrc; 
    if (!el) return null;
    
    let w = 0, h = 0;
    if (el instanceof HTMLImageElement) {
      w = el.naturalWidth;
      h = el.naturalHeight;
    } else {
      w = (el as HTMLVideoElement).videoWidth;
      h = (el as HTMLVideoElement).videoHeight;
    }
    
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
    } else { 
      await this.requestStop(); 
    }
  }

  private async requestStop() {
    this.stopTimer(); 
    this.stopVisualizer(); 
    this.liveMusicHelper.stop();
    this.appState = "idle"; 
    this.hasAudioChunks = false; 
    this.isCreatingSong = false;
  }

  private startRecording() {
    const ctx = this.liveMusicHelper.audioContext;
    this.recordingDestination = ctx.createMediaStreamDestination();
    this.liveMusicHelper.connectRecorder(this.recordingDestination);
    this.mediaRecorder = new MediaRecorder(this.recordingDestination.stream);
    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (e) => this.recordedChunks.push(e.data);
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); 
      a.download = `sonar-${Date.now()}.webm`; a.click();
    };
    this.mediaRecorder.start();
    this.isRecording = true;
  }

  private stopRecording() {
    if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop();
    this.isRecording = false;
    if (this.recordingDestination) this.liveMusicHelper.disconnectRecorder(this.recordingDestination);
  }

  private startVisualizer() {
    this.stopVisualizer();
    const draw = () => {
      if (!this.visualizerCanvas || !this.liveMusicHelper.analyser) return;
      const cvs = this.visualizerCanvas, ctx = cvs.getContext("2d")!;
      if (cvs.width !== cvs.clientWidth) { cvs.width = cvs.clientWidth; cvs.height = cvs.clientHeight; }
      const data = new Uint8Array(this.liveMusicHelper.analyser.frequencyBinCount);
      this.liveMusicHelper.analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      const time = performance.now() * 0.00015;
      
      this.drawAurora(ctx, cvs, time, data, "rgba(255, 255, 255, 0.4)", 200);
      this.drawAurora(ctx, cvs, time * 1.5, data, "rgba(200, 200, 200, 0.3)", 150);
      this.drawAurora(ctx, cvs, time * 0.8, data, "rgba(100, 100, 100, 0.2)", 250);
      
      this.visualizerRafId = requestAnimationFrame(draw);
    };
    draw();
  }

  private drawAurora(ctx: CanvasRenderingContext2D, cvs: any, time: number, data: Uint8Array, color: string, offset: number) {
    ctx.beginPath();
    const gradient = ctx.createLinearGradient(0, cvs.height - offset - 300, 0, cvs.height);
    gradient.addColorStop(0, "transparent"); 
    gradient.addColorStop(0.4, color); 
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient; 
    ctx.moveTo(0, cvs.height);
    for (let x = 0; x <= cvs.width; x += 15) {
      const idx = Math.floor((x / cvs.width) * (data.length / 4));
      const f = (data[idx] || 0) / 255;
      const wave = Math.sin(x * 0.003 + time) * (200 * f + 20);
      ctx.lineTo(x, (cvs.height - offset) - wave);
    }
    ctx.lineTo(cvs.width, cvs.height); ctx.fill();
  }

  private stopVisualizer() { if (this.visualizerRafId) cancelAnimationFrame(this.visualizerRafId); }
  private dispatchError(m: string) { this.toastMessageElement.show(m); }
  private ensureUiAudio() { if (!this.uiAudioCtx) this.uiAudioCtx = new AudioContext(); }
  private playFeedbackSound(t: string) {
    if (!this.uiAudioCtx) return;
    const osc = this.uiAudioCtx.createOscillator(), g = this.uiAudioCtx.createGain();
    osc.connect(g); g.connect(this.uiAudioCtx.destination);
    osc.frequency.setValueAtTime(t === 'capture' ? 440 : 330, this.uiAudioCtx.currentTime);
    g.gain.setValueAtTime(0.015, this.uiAudioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.uiAudioCtx.currentTime + 0.15);
    osc.start(); osc.stop(this.uiAudioCtx.currentTime + 0.15);
  }

  private resetSession() { this.requestStop(); this.stopCurrentStream(); this.page = "splash"; this.currentSource = "none"; }

  render() {
    const t = getT(this.language);
    return html`
      <div id="video-container" aria-hidden="true">
        ${this.currentSource === "image" ? html`<img id="uploaded-image-el" alt="Uploaded source" src=${this.uploadedImageSrc!} />` : html`<video playsinline muted style=${styleMap({transform: this.isVideoFlipped ? "scaleX(-1)" : "none"})}></video>`}
      </div>
      <canvas id="visualizer" aria-hidden="true"></canvas>
      <div id="ui-layer" role="main">
        ${this.renderPage(t)}
        ${this.settingsOpen ? this.renderSettings(t) : nothing}
      </div>
      <toast-message aria-live="polite"></toast-message>
      <input type="file" id="file-input" hidden @change=${this.handleFileChange} accept="image/*" aria-hidden="true" />
      
      ${this.debugConsoleOpen ? html`
        <div class="debug-console" role="log" aria-label="Debug logs">
          ${this.debugLogs.map(log => html`
            <div class="debug-line ${log.type}">${log.type.toUpperCase()}: ${log.text}</div>
          `)}
        </div>
      ` : nothing}
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
          <button class="source-card" @click=${this.setupCamera} aria-label="${t.camera}">
            <span class="material-icons-round card-icon" aria-hidden="true">videocam</span>
            <span class="card-label">${t.camera}</span>
          </button>
          <button class="source-card" @click=${this.setupScreenShare} aria-label="${t.screen}">
            <span class="material-icons-round card-icon" aria-hidden="true">screen_share</span>
            <span class="card-label">${t.screen}</span>
          </button>
          <button class="source-card" @click=${this.triggerImageUpload} aria-label="${t.image}">
            <span class="material-icons-round card-icon" aria-hidden="true">image</span>
            <span class="card-label">${t.image}</span>
          </button>
        </div>
      </div>
    `;
  }

  private renderPreview(t: any) {
    return html`
      <div class="sheet glass" role="dialog" aria-labelledby="preview-heading">
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
        <button class="icon-button" @click=${this.resetSession} aria-label="Go back to splash screen"><span class="material-icons-round" aria-hidden="true">arrow_back</span></button>
        ${this.currentSource === "camera" && this.hasMultipleCameras ? html`<button class="icon-button" @click=${this.switchCamera} aria-label="Switch camera"><span class="material-icons-round" aria-hidden="true">flip_camera_android</span></button>` : nothing}
        <button class="create-song-pill glass" @click=${() => this.exportOpen = true} aria-label="${t.createSong}">
           <span class="material-icons-round" style="opacity: 0.6" aria-hidden="true">auto_fix_high</span>
           <span>${t.createSong}</span>
        </button>
        <button class="icon-button" @click=${() => this.settingsOpen = true} aria-label="Open settings"><span class="material-icons-round" aria-hidden="true">tune</span></button>
      </div>

      <div id="prompts-container" role="list" aria-label="Active musical prompts">
        <div class="prompts-actions" style="display:flex; justify-content:flex-end; padding: 0.5rem 0;">
           <button class="icon-button" @click=${() => this.captureAndGenerate()} style="width:36px; height:36px;" aria-label="${t.refresh}"><span class="material-icons-round" style="font-size:18px;" aria-hidden="true">refresh</span></button>
        </div>
        ${this.prompts.map((p, i) => html`
          <div class="prompt-tag" role="listitem">
            <div class="prompt-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span class="prompt-text">${p.text}</span>
              <button class="material-icons-round delete-btn" style="font-size:18px;" @click=${() => this.deletePrompt(i)} aria-label="Delete prompt: ${p.text}">close</button>
            </div>
            <div class="weight-slider-container">
               <input type="range" class="weight-slider" min="0" max="1" step="0.01" .value=${p.weight.toString()} @input=${(e:any) => this.updatePromptWeight(i, +e.target.value)} aria-label="Weight for prompt: ${p.text}" />
            </div>
          </div>
        `)}
        <div class="add-prompt-box">
          <input class="add-input glass" placeholder="${t.addVibe}" .value=${this.newPromptText} @input=${(e:any)=>this.newPromptText=e.target.value} @keydown=${(e:any)=>e.key==='Enter' && this.addPrompt()} aria-label="${t.addVibe}" />
          <button class="icon-button" @click=${this.addPrompt} aria-label="Add new prompt"><span class="material-icons-round" aria-hidden="true">add</span></button>
        </div>
      </div>

      <div id="pip-container" class=${classMap({visible: !!this.lastCapturedImage})} aria-hidden="true">
        <img src=${this.lastCapturedImage!} alt="Last analyzed frame" />
      </div>

      <div id="controls-container">
        <div class="status-pill" role="status" aria-live="polite">${this.getStatusText(t)}</div>
        <div class="main-playback">
          <button class="icon-button" @click=${() => this.isRecording ? this.stopRecording() : this.startRecording()} style=${styleMap({color: this.isRecording ? '#ff453a' : 'white'})} aria-label="${this.isRecording ? 'Stop recording' : 'Start recording'}">
            <span class="material-icons-round" aria-hidden="true">${this.isRecording ? 'stop' : 'fiber_manual_record'}</span>
          </button>
          <button class="play-btn ${this.appState !== 'idle' ? 'playing' : ''}" @click=${this.handlePlayPause} aria-label="${this.appState !== 'idle' ? 'Pause symphony' : 'Play symphony'}">
            <span class="material-icons-round" style="font-size: 36px;" aria-hidden="true">${this.appState !== 'idle' ? 'pause' : 'play_arrow'}</span>
          </button>
          <button class="icon-button" @click=${() => this.captureAndGenerate()} aria-label="Capture and analyze manually">
            <span class="material-icons-round" aria-hidden="true">camera</span>
          </button>
        </div>
        <div class="volume-bar" role="group" aria-label="Volume control">
          <span class="material-icons-round" style="font-size:14px; opacity:0.4;" aria-hidden="true">volume_down</span>
          <input type="range" class="weight-slider" min="0" max="1" step="0.01" .value=${this.volume.toString()} @input=${(e:any) => { this.volume = +e.target.value; this.liveMusicHelper.setVolume(this.volume); }} aria-label="Volume level" />
          <span class="material-icons-round" style="font-size:14px; opacity:0.4;" aria-hidden="true">volume_up</span>
        </div>
      </div>
    `;
  }

  private getStatusText(t: any) {
    if (this.promptsLoading) return t.synthesizing;
    if (this.promptsStale) return t.modulating;
    if (this.captureCountdown > 0) return `${t.analyzeIn} ${this.captureCountdown}s`;
    return this.appState === "idle" ? t.ready : t.flowing;
  }

  private renderSettings(t: any) {
    return html`
      <div class="sheet glass" role="dialog" aria-labelledby="settings-heading">
        <div class="sheet-header"><h3 id="settings-heading">${t.engineTuning}</h3><button class="material-icons-round" @click=${() => this.settingsOpen = false} style="cursor:pointer; opacity:0.5; background:none; border:none; color:inherit;" aria-label="Close settings">close</button></div>
        <div class="preset-grid" role="group" aria-label="Analysis interval presets">
          ${INTERVAL_PRESETS.map(p => html`
            <button class="preset-card ${this.intervalPreset.labelSub === p.labelSub ? 'active' : ''}" @click=${() => { this.intervalPreset = p; this.startTimer(); this.settingsOpen = false; }} aria-pressed="${this.intervalPreset.labelSub === p.labelSub}">
              <h4>${p.labelSub === 'INFINITE' ? t.infinite : p.labelSub}</h4>
              <p>${p.labelValue === '∞' ? t.staticMood : `${t.analyzeEvery} ${p.labelValue}`}</p>
            </button>
          `)}
        </div>
        <div style="margin-top: 1.5rem;">
            <label id="smoothness-label" style="font-size: 10px; opacity:0.4; text-transform:uppercase; font-weight:800; letter-spacing:0.1em;">${t.transitionSmoothness} (${this.intervalPreset.crossfadeSeconds}s)</label>
            <input type="range" class="weight-slider" style="width:100%; margin-top:0.75rem;" min="0" max="25" .value=${this.intervalPreset.crossfadeSeconds.toString()} @input=${(e:any) => this.intervalPreset = {...this.intervalPreset, crossfadeSeconds: +e.target.value}} aria-labelledby="smoothness-label" />
        </div>
        
        <div style="margin-top: 2rem;">
            <label id="language-label" style="font-size: 10px; opacity:0.4; text-transform:uppercase; font-weight:800; letter-spacing:0.1em;">${t.language}</label>
            <div class="language-toggle" role="group" aria-labelledby="language-label">
                <button class="lang-btn ${this.language === 'en' ? 'active' : ''}" @click=${() => this.language = 'en'} aria-pressed="${this.language === 'en'}">English</button>
                <button class="lang-btn ${this.language === 'pt' ? 'active' : ''}" @click=${() => this.language = 'pt'} aria-pressed="${this.language === 'pt'}">Português</button>
            </div>
        </div>
      </div>
    `;
  }
}
