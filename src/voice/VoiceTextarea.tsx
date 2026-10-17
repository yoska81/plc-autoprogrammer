import { forwardRef, type TextareaHTMLAttributes } from 'react';
import MicButton from './MicButton';
import SpeakButton from './SpeakButton';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Also a speaker button that reads the text aloud. */
  speak?: boolean;
  /** Classes of the wrapper (the textarea keeps `className`). */
  wrapClassName?: string;
};

/** A multi-line text box with a microphone button (speak instead of typing) and, optionally, read aloud. */
const VoiceTextarea = forwardRef<HTMLTextAreaElement, Props>(function VoiceTextarea({ value, onValueChange, speak = false, wrapClassName = '', className = '', disabled, readOnly, ...rest }, ref) {
  return (
    <div className={`relative ${wrapClassName}`}>
      <textarea ref={ref} value={value} disabled={disabled} readOnly={readOnly} onChange={(e) => onValueChange(e.target.value)} className={`${className} ${speak && !readOnly ? 'pr-16' : 'pr-9'}`} {...rest} />
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
        {speak && value.trim() && <SpeakButton text={value} />}
        {!readOnly && <MicButton value={value} onChange={onValueChange} disabled={disabled} />}
      </div>
    </div>
  );
});

export default VoiceTextarea;
