
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export default css`
  :host {
    display: block;
    width: 100vw;
    height: 100dvh;
    position: relative;
    background: #000;
    color: white;
    font-family: 'Google Sans', 'Roboto', sans-serif;
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    --bass-glow: 0px;
    --bass-opacity: 0.2;
  }

  /* --- ACCESSIBILITY FOCUS --- */
  button:focus-visible, 
  input:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  /* --- LIQUID GLASS BASE --- */
  .glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  }

  .material-icons-round {
    font-family: 'Material Icons Round';
    font-size: 24px;
    line-height: 1;
    display: inline-block;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    text-transform: none !important;
    word-wrap: normal;
    white-space: nowrap;
  }

  #video-container {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  
  video, img#uploaded-image-el {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.35;
    transition: opacity 1.5s ease;
  }

  #video-container.analyzing video,
  #video-container.analyzing img#uploaded-image-el {
    opacity: 0.8;
    animation: pulseView 2s infinite ease-in-out;
    filter: blur(var(--bass-glow));
  }

  @keyframes pulseView {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.05); filter: brightness(1.3) contrast(1.1); }
  }

  .analysis-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, transparent 20%, rgba(255,255,255,0.1) 100%);
    z-index: 5;
  }

  .analysis-status {
    background: white;
    color: black;
    padding: 10px 24px;
    border-radius: 30px;
    font-weight: 800;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 2rem;
    box-shadow: 0 0 50px rgba(255,255,255,0.4);
    animation: bounce 1s infinite alternate;
  }

  @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-10px); } }

  .scanline {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 6px;
    background: linear-gradient(to bottom, transparent, #fff, transparent);
    box-shadow: 0 0 40px rgba(255,255,255,1);
    animation: scan 2.5s linear infinite;
    z-index: 6;
  }

  @keyframes scan {
    from { transform: translateY(-100%); }
    to { transform: translateY(100vh); }
  }

  /* --- REFINED AURORA VISUALIZER --- */
  #visualizer {
    position: absolute;
    inset: -5%;
    z-index: 1;
    pointer-events: none;
    mix-blend-mode: lighten;
    filter: blur(80px) saturate(150%);
    opacity: var(--bass-opacity);
    transition: opacity 0.1s ease;
  }

  /* --- UI LAYERING --- */
  #ui-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    pointer-events: none;
  }
  #ui-layer > * { pointer-events: auto; }

  /* --- DYNAMIC TOOLTIP --- */
  .tooltip-bubble {
    position: fixed;
    transform: translate(-50%, -110%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    color: black;
    padding: 10px 18px;
    border-radius: 12px;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    z-index: 2000;
    pointer-events: none;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    border: 1px solid rgba(0,0,0,0.1);
    white-space: nowrap;
    animation: tooltipFade 0.2s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  @keyframes tooltipFade {
    from { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
    to { opacity: 1; transform: translate(-50%, -110%) scale(1); }
  }

  /* --- PAGE: SPLASH --- */
  .splash-page {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem;
    background: radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
  }
  .splash-background {
    position: absolute;
    inset: -50%;
    background: conic-gradient(from 180deg at 50% 50%, #000, #111, #222, #111, #000);
    filter: blur(120px);
    animation: rotate 120s linear infinite;
    opacity: 0.4;
    z-index: -1;
  }
  @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .logo-title {
    font-size: clamp(3.5rem, 15vw, 6rem);
    font-weight: 800;
    letter-spacing: -0.06em;
    background: linear-gradient(135deg, #fff 0%, #aaa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    line-height: 0.9;
  }
  .logo-title .thin { font-weight: 100; opacity: 0.3; }
  .subtitle {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.45);
    margin: 1.5rem 0 3.5rem;
    max-width: 420px;
    line-height: 1.6;
    letter-spacing: 0.01em;
  }

  .source-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
    width: 100%;
    max-width: 380px;
  }
  .source-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 28px;
    padding: 1.75rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
    color: white;
    backdrop-filter: blur(10px);
    border: none;
  }
  .source-card:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-5px);
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .card-icon { color: #fff; font-size: 32px; opacity: 0.9; }
  .card-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.5; }

  /* --- PAGE: MAIN --- */
  .top-bar {
    display: flex;
    padding: 1.25rem;
    align-items: center;
    gap: 0.75rem;
    z-index: 100;
  }

  .icon-button {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(30px) saturate(150%);
    color: white;
    cursor: pointer;
    transition: all 0.25s ease;
    border: none;
  }
  .icon-button:active { transform: scale(0.92); background: rgba(255, 255, 255, 0.15); }

  .create-song-pill {
    flex: 1;
    height: 48px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    color: white;
    border: none;
    transition: background 0.2s;
  }
  .create-song-pill:hover {
    background: rgba(255,255,255,0.15);
  }

  /* --- PROMPT LIST --- */
  #prompts-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 1.25rem;
    gap: 0.85rem;
    overflow-y: auto;
    scrollbar-width: none;
    mask-image: linear-gradient(to bottom, transparent, black 8%, black 92%, transparent);
  }
  #prompts-container::-webkit-scrollbar { display: none; }

  .prompt-tag {
    background: rgba(20, 20, 20, 0.4);
    backdrop-filter: blur(50px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    box-sizing: border-box;
    animation: slideUp 0.6s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

  .prompt-text { font-size: 0.9rem; font-weight: 400; line-height: 1.5; opacity: 0.9; }
  .delete-btn { opacity: 0.3; cursor: pointer; transition: opacity 0.2s; background: none; border: none; padding: 4px; color: inherit; }
  .delete-btn:hover { opacity: 1; color: #ff4d4d; }

  .weight-slider-container { display: flex; align-items: center; }
  .weight-slider {
    flex: 1;
    -webkit-appearance: none;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    outline: none;
  }
  .weight-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
  }

  .add-prompt-box {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-bottom: 3rem;
  }
  .add-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 0.85rem 1.25rem;
    color: white;
    font-size: 0.9rem;
    outline: none;
  }

  /* --- CONTROLS --- */
  #controls-container {
    padding: 1.5rem 1.5rem 3.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
  }

  .main-playback {
    display: flex;
    align-items: center;
    gap: 2.5rem;
  }

  .play-btn {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: white;
    color: black;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    box-shadow: 0 10px 40px rgba(255,255,255,0.15);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .play-btn.playing { background: rgba(255,255,255,0.05); border: 2px solid white; color: white; box-shadow: none; }
  .play-btn:active { transform: scale(0.9); }

  .status-pill {
    background: rgba(255, 255, 255, 0.08);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.5;
    backdrop-filter: blur(10px);
  }

  /* --- VOLUME --- */
  .volume-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 220px;
    opacity: 0.6;
  }

  /* --- SHEET / MODAL --- */
  .sheet {
    position: fixed;
    bottom: 24px;
    left: 24px;
    right: 24px;
    max-width: 440px;
    margin: 0 auto;
    background: rgba(15, 15, 15, 0.9);
    backdrop-filter: blur(60px) saturate(200%);
    -webkit-backdrop-filter: blur(60px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 32px;
    padding: 2.25rem;
    z-index: 1000;
    box-shadow: 0 24px 80px rgba(0,0,0,0.85);
    pointer-events: auto;
    animation: slideSheet 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
  }

  .settings-scroll-area {
    overflow-y: auto;
    padding-right: 10px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .settings-scroll-area::-webkit-scrollbar { width: 4px; }
  .settings-scroll-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  
  .sheet.closing {
    animation: slideSheetOut 0.4s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  @keyframes slideSheet { 
    from { transform: translateY(100%); opacity: 0; } 
    to { transform: translateY(0); opacity: 1; } 
  }
  
  @keyframes slideSheetOut { 
    from { transform: translateY(0); opacity: 1; } 
    to { transform: translateY(100%); opacity: 0; } 
  }

  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.75rem;
    flex-shrink: 0;
  }
  .sheet-header h3 { margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }

  .section-label {
    display: block;
    font-size: 10px; 
    opacity:0.4; 
    text-transform:uppercase; 
    font-weight:800; 
    letter-spacing:0.1em;
    margin-bottom: 0.8rem;
  }

  /* --- FAVORITES --- */
  .favorites-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .favorite-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-radius: 16px;
    cursor: pointer;
    transition: 0.2s;
  }
  .favorite-item:hover { background: rgba(255,255,255,0.1); }
  .fav-info { flex: 1; }
  .fav-name { font-weight: 700; font-size: 0.9rem; margin-bottom: 2px; }
  .fav-meta { font-size: 0.7rem; opacity: 0.4; }
  .fav-delete { 
    font-size: 20px; 
    opacity: 0.3; 
    padding: 8px; 
    background: none; 
    border: none; 
    color: white; 
    cursor: pointer; 
  }
  .fav-delete:hover { opacity: 1; color: #ff4d4d; }
  .empty-list { text-align: center; padding: 2rem; opacity: 0.3; font-size: 0.8rem; border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; }

  .preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .preset-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 20px;
    padding: 1.25rem;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: 0.25s;
    text-align: left;
    width: 100%;
    display: block;
  }
  .preset-card.active { border-color: rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.08); }
  .preset-card h4 { margin: 0; font-size: 0.8rem; color: #fff; text-transform: uppercase; letter-spacing: 0.1em; }
  .preset-card p { margin: 0.3rem 0 0; font-size: 0.75rem; opacity: 0.45; }

  /* --- EXPORT STUFF --- */
  .progress-container {
    width: 100%;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: #fff;
    transition: width 0.1s linear;
  }

  /* --- CAPTURE PREVIEW PAGE --- */
  .preview-image-container {
    width: 100%;
    aspect-ratio: 16/9;
    border-radius: 24px;
    overflow: hidden;
    margin-bottom: 2rem;
    background: #080808;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .preview-image-container img { width: 100%; height: 100%; object-fit: contain; }

  .preview-actions {
    display: flex;
    gap: 12px;
  }
  .btn-cancel {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-radius: 24px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
  }
  .btn-cancel:hover { background: rgba(255, 255, 255, 0.15); }

  .btn-begin {
    flex: 2;
    background: white;
    color: black;
    border-radius: 24px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: transform 0.2s;
  }
  .btn-begin:active { transform: scale(0.96); }

  /* --- LANGUAGE TOGGLE --- */
  .language-toggle {
    display: flex;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 4px;
    margin-top: 1rem;
    gap: 4px;
  }
  .lang-btn {
    flex: 1;
    padding: 8px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
    text-align: center;
    transition: 0.2s;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.3);
  }
  .lang-btn.active { background: rgba(255, 255, 255, 0.1); color: white; }

  #pip-container {
    position: absolute;
    bottom: 180px;
    right: 1.5rem;
    width: 90px;
    height: 90px;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.15);
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
  }
  #pip-container.visible { opacity: 1; transform: translateY(0); }
  #pip-container img { width: 100%; height: 100%; object-fit: cover; opacity: 0.8; }

  /* --- DEBUG CONSOLE --- */
  .debug-console {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 35dvh;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(20px);
    z-index: 10000;
    font-family: 'Fira Code', 'Courier New', monospace;
    font-size: 11px;
    padding: 1rem;
    overflow-y: auto;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    flex-direction: column;
    gap: 4px;
    pointer-events: auto;
    box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
  }
  .debug-line {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding: 2px 0;
    word-break: break-all;
    white-space: pre-wrap;
  }
  .debug-line.error { color: #ff4d4d; }
  .debug-line.warn { color: #ffcc00; }
  .debug-line.log { color: #00ffcc; }

  @media (min-width: 768px) {
    .source-grid { max-width: 500px; gap: 1.5rem; }
    .logo-title { font-size: 7rem; }
    #prompts-container { padding: 0 6rem; }
    #pip-container { right: 6rem; }
    .sheet { bottom: 40px; }
  }
`;
