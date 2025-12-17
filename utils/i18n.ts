
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Language } from "./types";

export const translations = {
  en: {
    logo: "Sonar",
    subtitle: "Experience music generated in real-time by your surroundings. Immersive, responsive, artistic.",
    camera: "Camera",
    screen: "Screen",
    image: "Image",
    confirmIdentity: "Confirm Identity",
    cancel: "Cancel",
    begin: "Begin symphony",
    createSong: "Create Song",
    analyzeIn: "Analyze in",
    synthesizing: "Synthesizing Environment...",
    modulating: "Modulating Flow...",
    ready: "Ready",
    flowing: "Flowing",
    engineTuning: "Engine Tuning",
    infinite: "INFINITE",
    staticMood: "Static mood cycle",
    analyzeEvery: "Analyze every",
    transitionSmoothness: "Transition Smoothness",
    language: "Language",
    addVibe: "Add vibe...",
    refresh: "Refresh",
  },
  pt: {
    logo: "Sonar",
    subtitle: "Sinta a música gerada em tempo real pelo ambiente ao seu redor. Imersivo, responsivo e artístico.",
    camera: "Câmera",
    screen: "Tela",
    image: "Imagem",
    confirmIdentity: "Confirmar Identidade",
    cancel: "Cancelar",
    begin: "Iniciar sinfonia",
    createSong: "Criar Música",
    analyzeIn: "Analisar em",
    synthesizing: "Sintetizando Ambiente...",
    modulating: "Modulando Fluxo...",
    ready: "Pronto",
    flowing: "Fluindo",
    engineTuning: "Ajuste do Motor",
    infinite: "INFINITO",
    staticMood: "Ciclo de humor estático",
    analyzeEvery: "Analisar a cada",
    transitionSmoothness: "Suavidade de Transição",
    language: "Idioma",
    addVibe: "Adicionar vibe...",
    refresh: "Atualizar",
  }
};

export function getT(lang: Language) {
  return translations[lang];
}