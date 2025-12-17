
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("toast-message")
export class ToastMessage extends LitElement {
  static styles = css`
    .toast {
      line-height: 1.6;
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(20px);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      width: min(450px, 80vw);
      transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.5s;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      z-index: 10000;
    }
    button {
      border-radius: 50%;
      width: 28px;
      height: 28px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      cursor: pointer;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: 0.2s;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .toast:not(.showing) {
      pointer-events: none;
      transform: translate(-50%, -150%);
      opacity: 0;
    }
    a {
      color: #a7c5ff;
      text-decoration: underline;
    }
    .message {
      font-size: 0.9rem;
      font-weight: 500;
    }
  `;

  @property({ type: String }) message = "";
  @property({ type: Boolean }) showing = false;

  private hideTimeout: any = null;

  private renderMessageWithLinks() {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = this.message.split(urlRegex);
    return parts.map((part, i) => {
      if (i % 2 === 0) return part;
      return html`<a href=${part} target="_blank" rel="noopener">${part}</a>`;
    });
  }

  render() {
    return html`<div class=${classMap({ showing: this.showing, toast: true })}>
      <div class="message">${this.renderMessageWithLinks()}</div>
      <button @click=${this.hide}>✕</button>
    </div>`;
  }

  show(message: string, duration = 4000) {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.message = message;
    this.showing = true;
    this.hideTimeout = setTimeout(() => this.hide(), duration);
  }

  hide() {
    this.showing = false;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toast-message": ToastMessage;
  }
}
