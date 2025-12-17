
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
    savedEchoes: "Saved Vibes",
    // Tooltips
    backTooltip: "Back to home",
    switchCameraTooltip: "Switch camera",
    createSongTooltip: "Export a high-fidelity render",
    settingsTooltip: "Tune engine & view Vibes",
    refreshTooltip: "Generate new vibe from current view",
    deletePromptTooltip: "Remove this vibe",
    addPromptTooltip: "Add your own musical vibe",
    recordTooltip: "Record the audio stream",
    stopRecordTooltip: "Stop recording and save",
    playTooltip: "Start the symphony",
    pauseTooltip: "Pause the symphony",
    captureTooltip: "Manual snapshot and analysis",
    closeTooltip: "Close",
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
    savedEchoes: "Vibes Salvas",
    // Tooltips
    backTooltip: "Voltar ao início",
    switchCameraTooltip: "Trocar câmera",
    createSongTooltip: "Exportar renderização de alta fidelidade",
    settingsTooltip: "Ajustar motor e ver Vibes",
    refreshTooltip: "Gerar nova vibe da visão atual",
    deletePromptTooltip: "Remover esta vibe",
    addPromptTooltip: "Adicionar sua própria vibe musical",
    recordTooltip: "Gravar o fluxo de áudio",
    stopRecordTooltip: "Parar gravação e salvar",
    playTooltip: "Iniciar a sinfonia",
    pauseTooltip: "Pausar a sinfonia",
    captureTooltip: "Captura manual e análise",
    closeTooltip: "Fechar",
  }
};

export function getT(lang: Language) {
  return translations[lang];
}
