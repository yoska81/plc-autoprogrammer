import { useId } from 'react';
import { SpeakerWaveIcon, StopIcon } from '@heroicons/react/24/outline';
import { canSpeak, speak, stopSpeaking, useSpeaking } from './tts';

/** Speaker button: reads the text aloud; pressed again (or another one) stops. */
export default function SpeakButton({ text, label = 'Read aloud', className = '', size = 'sm' }: {
  text: string | (() => string); label?: string; className?: string; size?: 'sm' | 'xs';
}) {
  const id = useId();
  const speaking = useSpeaking((s) => s.id === id);
  if (!canSpeak()) return null;
  const icon = size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <button
      type="button"
      data-testid="speak"
      aria-label={speaking ? 'Stop reading' : label}
      title={speaking ? 'Stop reading' : label}
      aria-pressed={speaking}
      onClick={(e) => {
        e.stopPropagation();
        if (speaking) stopSpeaking();
        else void speak(typeof text === 'function' ? text() : text, id);
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded p-1 ${speaking ? 'bg-brand-600 text-brand-950' : 'text-steel-500 hover:bg-steel-100 hover:text-steel-800'} ${className}`}
    >
      {speaking ? <StopIcon className={icon} /> : <SpeakerWaveIcon className={icon} />}
    </button>
  );
}
