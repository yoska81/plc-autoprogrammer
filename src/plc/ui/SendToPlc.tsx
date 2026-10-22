import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InformationCircleIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/20/solid';
import type { PlcProfile } from '../core/profile';
import { desktopBridge } from '../../desktop/bridge';
import { connectHelper, HELPER_DOWNLOAD_URL, usePlcBridges } from '../../desktop/plcHelper';
import { IS_PREVIEW } from '../../preview/mode';
import { noSendAdvice, sendRoute, softwareFor, type SendRoute } from '../deploy/sendRoutes';
import SendToTia from './SendToTia';
import SendToClick from './SendToClick';
import SendToCodesys from './SendToCodesys';
import SendToStudio5000 from './SendToStudio5000';

const ROUTES: SendRoute[] = ['tia', 'click', 'codesys', 'studio5000'];

/**
 * "Send to PLC software", the one button on the Program page: the flow for the project's PLC (TIA Portal, CLICK,
 * CODESYS, Studio 5000; each flow's own button, under this one name), or, where the app cannot send (another
 * brand, the web version, an older desktop app, a read-only program), a short window that says what to do instead
 * (src/plc/deploy/sendRoutes.ts).
 * On the web page (the claude.ai artifact) the flows run on the ISA PLC Helper (src/desktop/plcHelper.ts): the
 * first press looks for it (the Claude app may ask to allow it) and goes on to the flow, or says what to do.
 */
export default function SendToPlc({ profile }: { profile: PlcProfile }) {
  const [open, setOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [helperError, setHelperError] = useState<string | null>(null);
  const plc = usePlcBridges();
  const bridges = plc ? new Set(ROUTES.filter((r) => plc[r])) : null;
  const advice = noSendAdvice({ profileId: profile.id, vendor: profile.vendor, readOnly: profile.readOnly }, bridges);
  const route = sendRoute(profile.id);
  // the web page: a flow the helper can run, not found yet
  const viaHelper = IS_PREVIEW && !desktopBridge() && !plc && route !== null && !profile.readOnly;

  const press = async () => {
    if (!viaHelper) { setOpen(true); return; }
    setLooking(true); setHelperError(null);
    const r = await connectHelper();
    setLooking(false);
    if ('error' in r) { setHelperError(r.error); setOpen(true); return; }
    // connected: the flow's own button is there from the next frame; this press goes on to it
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-testid="send-to-${route}"]`)?.click());
  };

  if (!advice) {
    return (
      <>
        <SendToTia profileId={profile.id} />
        <SendToClick profileId={profile.id} />
        <SendToCodesys profileId={profile.id} />
        <SendToStudio5000 profileId={profile.id} />
      </>
    );
  }
  return (
    <>
      <button onClick={() => void press()} disabled={looking} data-testid="send-to-plc" title={`Put the program into ${softwareFor(profile.id, profile.vendor)}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-brand-300 bg-white text-brand-800 hover:bg-brand-50 disabled:opacity-60">
        <PaperAirplaneIcon className="h-4 w-4" /> {looking ? 'Looking for the ISA PLC Helper…' : 'Send to PLC software'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-label="Send to PLC software" className="w-full max-w-lg rounded bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-steel-200 px-5 py-3">
              <h2 className="flex-1 text-base font-semibold text-steel-900">Send to PLC software — {profile.vendor} {profile.name}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-steel-400 hover:bg-steel-100 hover:text-steel-700"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="flex gap-2 text-steel-800" data-testid="send-to-plc-advice"><InformationCircleIcon className="mt-0.5 h-4 w-4 flex-none text-brand-600" />{viaHelper ? helperError : advice}</p>
              {viaHelper && <p><a href={HELPER_DOWNLOAD_URL} target="_blank" rel="noreferrer" data-testid="send-to-plc-helper-download" className="inline-flex rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Install the ISA PLC Helper</a></p>}
              <p className="text-xs text-steel-500">What to install and which clicks to try, brand by brand: <Link to="/test-card" onClick={() => setOpen(false)} className="underline">Test card</Link>.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
