/**
 * Utilitário de som com Web Audio API nativo para a plataforma POINT. Start
 * Sintetiza um som fofinho, suave e acolhedor (acorde duplo em onda sine)
 * sem depender de arquivos de áudio externos ou requisições de rede.
 */

let audioCtx = null;
const SOUND_STORAGE_KEY = 'point_notification_sound_muted';

/**
 * Retorna se o som está mutado nas preferências do usuário
 */
export function isSoundMuted() {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Salva a preferência de áudio do usuário (mutado ou ativo)
 */
export function setSoundMuted(muted) {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {}
}

/**
 * Toca um acorde duplo suave e fofinho:
 * Nota 1: C6 (1046.5 Hz) ~180ms
 * Nota 2: E6 (1318.5 Hz) ~260ms (overlap suave)
 * Volume baixo e envelope exponencial de fade-out
 */
export function playNotificationChime() {
  if (isSoundMuted()) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;

    // Nota 1: C6 (1046.5 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.18);

    // Nota 2: E6 (1318.5 Hz) com overlap acolhedor
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, now + 0.09);

    gain2.gain.setValueAtTime(0, now + 0.09);
    gain2.gain.linearRampToValueAtTime(0.11, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc2.start(now + 0.09);
    osc2.stop(now + 0.35);
  } catch {
    // Fallback silencioso (ex: autoplay policy bloqueado antes de primeira interação)
  }
}
