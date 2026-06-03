// Notification sound + browser notification utilities

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a short, subtle notification "ding" using the Web Audio API.
 * No external sound file needed.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();

    // Resume if suspended (browsers require user gesture first)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Primary tone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(1174.66, now + 0.08); // D6

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.3);

    // Secondary shimmer tone for richness
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.05); // E6

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.08, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.05);
    osc2.stop(now + 0.25);
  } catch {
    // Silently fail — audio is best-effort
  }
}

/**
 * Request browser notification permission.
 * Should be called after a user interaction (e.g. on login).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a native browser notification (only when tab is not focused).
 */
export function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return; // Only show when tab is in background

  const notification = new Notification(title, {
    body,
    icon: '/logo-dark.png',
    tag: 'xrm-notification', // Collapses multiple into one if rapid-fire
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}
