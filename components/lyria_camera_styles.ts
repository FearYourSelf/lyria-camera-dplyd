
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
    --bass-shake: 0px;
  }

  button:focus-visible, input:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

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
    transform: translate(var(--bass-shake), var(--bass-shake));
  }
  
  video, img#uploaded-image-el {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.35;
    transition: opacity 1.5s ease;
  }

  #video-container.analyzing video, #video-container.analyzing img#uploaded-image-el {
    opacity: 0.7;
    animation: pulseView 2s infinite ease-in-out;
    filter: blur(var(--bass-glow)) brightness(1.2);
  }

  @keyframes pulseView {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.04); filter: brightness(1.3) contrast(1.1); }
  }

  .analysis-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, transparent 20%, rgba(255,255,255,0.08) 100%);
    z-index: 5;
  }

  .analysis-status {
    background: white;
    color: black;
    padding: 12px 28px;
    border-radius: 40px;
    font-weight: 800;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    box-shadow: 0 0 50px rgba(255,255,255,0.4);
    animation: bounce 0.6s infinite alternate;
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

  @keyframes scan { from { transform: translateY(-100%); } to { transform: translateY(100vh); } }

  #visualizer {
    position: absolute;
    inset: -5%;
    z-index: 1;
    pointer-events: none;
    mix-blend-mode: lighten;
    filter: blur(80px) saturate(180%);
    opacity: var(--bass-opacity);
    transition: opacity 0.1s ease;
  }

  #ui-layer { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; pointer-events: none; }
  #ui-layer > * { pointer-events: auto; }

  .tooltip-bubble {
    position: fixed;
    transform: translate(20px, -50%);
    background: white;
    color: black;
    padding: 10px 16px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    z-index: 3000;
    pointer-events: none;
    box-shadow: 8px 8px 25px rgba(0,0,0,0.4);
    border-left: 4px solid #000;
    white-space: nowrap;
    animation: tooltipIn 0.15s cubic-bezier(0.19, 1, 0.22, 1) forwards;
  }

  .tooltip-bubble.left {
    transform: translate(calc(-100% - 20px), -50%);
    border-left: none;
    border-right: 4px solid #000;
    box-shadow: -8px 8px 25px rgba(0,0,0,0.4);
  }

  @keyframes tooltipIn { from { opacity: 0; transform: scale(0.9) translate(20px, -50%); } to { opacity: 1; transform: scale(1) translate(20px, -50%); } }

  .splash-page { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; }
  .splash-background { position: absolute; inset: -50%; background: conic-gradient(from 180deg at 50% 50%, #000, #111, #222, #111, #000); filter: blur(120px); animation: rotate 120s linear infinite; opacity: 0.4; z-index: -1; }
  @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .logo-title { font-size: clamp(3.5rem, 15vw, 6rem); font-weight: 800; letter-spacing: -0.06em; background: linear-gradient(135deg, #fff 0%, #aaa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; line-height: 0.9; }
  .logo-title .thin { font-weight: 100; opacity: 0.3; }
  .subtitle { font-size: 0.95rem; color: rgba(255, 255, 255, 0.45); margin: 1.5rem 0 3.5rem; max-width: 420px; line-height: 1.6; }

  .source-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; width: 100%; max-width: 380px; }
  .source-card { background: rgba(255, 255, 255, 0.03); border-radius: 28px; padding: 1.75rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; cursor: pointer; transition: 0.3s; border: none; color: white; }
  .source-card:hover { background: rgba(255, 255, 255, 0.1); transform: translateY(-5px); }
  .card-icon { font-size: 32px; opacity: 0.9; }
  .card-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.5; }

  .top-bar { display: flex; padding: 1.25rem; align-items: center; gap: 0.75rem; z-index: 100; }

  .icon-button { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(20px); color: white; cursor: pointer; border: none; transition: 0.2s; }
  .icon-button:active { transform: scale(0.92); }
  .icon-button.mini { width: 36px; height: 36px; background: rgba(255,255,255,0.05); }

  #prompts-container { flex: 1; display: flex; flex-direction: column; padding: 0 1.25rem; gap: 0.85rem; overflow-y: auto; scrollbar-width: none; mask-image: linear-gradient(to bottom, transparent, black 5%, black 95%, transparent); }
  #prompts-container::-webkit-scrollbar { display: none; }

  .prompts-actions { display: flex; justify-content: space-between; padding: 1rem 0 0.5rem; }

  .prompt-tag { background: rgba(20, 20, 20, 0.6); backdrop-filter: blur(50px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .prompt-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .prompt-text { font-size: 0.9rem; line-height: 1.5; opacity: 0.9; }
  .delete-btn { opacity: 0.3; cursor: pointer; background: none; border: none; color: inherit; padding: 4px; }
  .delete-btn:hover { opacity: 1; color: #ff4d4d; }

  .weight-slider { width: 100%; -webkit-appearance: none; height: 2px; background: rgba(255, 255, 255, 0.1); border-radius: 1px; outline: none; }
  .weight-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: white; border-radius: 50%; cursor: pointer; }

  .add-prompt-box { display: flex; gap: 0.75rem; padding-bottom: 3rem; }
  .add-input { flex: 1; background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 0 1.25rem; color: white; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.1); outline: none; }

  #controls-container { padding: 1.5rem 1.5rem 3.5rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); position: relative; }
  .main-playback { display: flex; align-items: center; gap: 2.5rem; }
  .play-btn { width: 76px; height: 76px; border-radius: 50%; background: white; color: black; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; transition: 0.2s; }
  .play-btn.playing { background: rgba(255,255,255,0.1); color: white; border: 2px solid white; }
  .play-btn:active { transform: scale(0.9); }

  .status-pill { background: rgba(255, 255, 255, 0.1); padding: 6px 14px; border-radius: 20px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; opacity: 0.6; }
  .volume-bar { display: flex; align-items: center; gap: 0.75rem; width: 100%; max-width: 220px; opacity: 0.6; }

  .sheet {
    position: fixed;
    bottom: 24px;
    left: 24px;
    right: 24px;
    max-width: 440px;
    margin: 0 auto;
    background: rgba(10, 10, 10, 0.98);
    backdrop-filter: blur(60px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 32px;
    padding: 2.5rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    max-height: 85vh;
    animation: slideUp 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
    overflow: hidden;
  }

  .sheet-header { flex-shrink: 0; margin-bottom: 2rem; }
  .sheet-header h3 { margin: 0; font-size: 1.4rem; letter-spacing: -0.02em; }

  /* PREVIEW SHEET IMAGE FIX: Uses robust containment */
  .preview-sheet { display: flex; flex-direction: column; }
  .preview-image-container {
    flex: 1;
    min-height: 0; 
    width: 100%;
    background: #000;
    border-radius: 20px;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,255,255,0.1);
    overflow: hidden;
  }
  .preview-image-container img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .preview-actions { flex-shrink: 0; display: flex; gap: 12px; }

  .btn-cancel { flex: 1; background: rgba(255, 255, 255, 0.1); height: 52px; border-radius: 26px; border: none; color: white; cursor: pointer; font-weight: 600; }
  .btn-begin { flex: 2; background: white; color: black; height: 52px; border-radius: 26px; border: none; cursor: pointer; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }

  .settings-scroll-area { overflow-y: auto; flex: 1; padding-right: 8px; }
  .section-label { display: block; font-size: 0.6rem; opacity: 0.4; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; margin: 1.5rem 0 1rem; }
  
  .favorites-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .favorite-item { display: flex; align-items: center; padding: 1rem; border-radius: 16px; background: rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; }
  .favorite-item:hover { background: rgba(255,255,255,0.08); }
  .fav-info { flex: 1; overflow: hidden; }
  .fav-name { font-weight: 700; font-size: 0.95rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
  .fav-meta { font-size: 0.7rem; opacity: 0.4; }
  
  .fav-actions { display: flex; gap: 8px; align-items: center; }
  .fav-action-btn { background: none; border: none; color: white; opacity: 0.3; cursor: pointer; padding: 6px; transition: 0.2s; font-size: 20px; }
  .fav-action-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); border-radius: 50%; }
  .fav-action-btn.delete:hover { color: #ff453a; }

  .preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .preset-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 1.25rem; border-radius: 16px; cursor: pointer; text-align: left; color: inherit; }
  .preset-card.active { border-color: white; background: rgba(255,255,255,0.1); }
  .preset-card h4 { margin: 0; font-size: 0.8rem; letter-spacing: 0.1em; }
  .preset-card p { margin: 4px 0 0; font-size: 0.7rem; opacity: 0.4; }

  .progress-container { width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin: 0; }
  .progress-container.mini { 
    position: absolute; 
    top: 10px; 
    left: 2.5rem; 
    right: 2.5rem; 
    width: auto;
    height: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  }
  .progress-bar-fill { 
    height: 100%; 
    background: linear-gradient(90deg, #fff 0%, #aaa 100%);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
    transition: width 0.1s linear; 
  }

  .language-toggle { display: flex; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 4px; gap: 4px; }
  .lang-btn { flex: 1; padding: 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 800; cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.3); }
  .lang-btn.active { background: rgba(255,255,255,0.1); color: white; }

  #pip-container { position: absolute; bottom: 180px; right: 1.5rem; width: 90px; height: 90px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 10px 30px rgba(0,0,0,0.5); opacity: 0; transform: translateY(20px); transition: 0.5s ease; }
  #pip-container.visible { opacity: 1; transform: translateY(0); }
  #pip-container img { width: 100%; height: 100%; object-fit: cover; }

  /* Debug Console Styles */
  .debug-console {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    height: 60vh;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    border-radius: 12px;
    pointer-events: auto;
  }
  .debug-header {
    background: rgba(255,255,255,0.1);
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-weight: bold;
    letter-spacing: 0.05em;
  }
  .debug-btn {
    background: rgba(255,255,255,0.1);
    border: none;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
  }
  .debug-btn:hover { background: rgba(255,255,255,0.2); }
  .debug-body {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(0,0,0,0.4);
  }
  .debug-state {
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: #0f0;
  }
  .debug-log-line { display: flex; gap: 8px; opacity: 0.8; }
  .debug-log-line.error { color: #ff453a; opacity: 1; }
  .debug-log-line.warn { color: #ffd60a; opacity: 1; }
  .log-ts { opacity: 0.5; flex-shrink: 0; }
  .log-msg { word-break: break-all; }

  @media (min-width: 768px) {
    #prompts-container { padding: 0 10rem; }
    #pip-container { right: 10rem; }
    .sheet { border-radius: 0; border: none; border-left: 1px solid rgba(255,255,255,0.1); right: 0; left: auto; height: 100vh; max-height: 100vh; width: 440px; bottom: 0; margin: 0; }
    @keyframes slideUp { from { transform: translateX(100%); } to { transform: translateX(0); } }
  }
`;
