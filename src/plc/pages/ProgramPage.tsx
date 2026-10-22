import ProjectNameInput from '../../components/ProjectNameInput';
import { Link } from 'react-router-dom';
import { useActiveHmiDesign } from '../../hmi/projectPanel';
import { useProgramStore } from '../../store/useProgramStore';
import { useSettingsStore, activeCredentials } from '../../store/useSettingsStore';
import { usePlc } from '../core/usePlc';
import { useElectricalStore } from '../../store/useElectricalStore';
import type { AIConfig } from '../ai/ladderAI';
import LadderWorkspace from '../ui/program/LadderWorkspace';
import StProgramView from '../ui/program/StProgramView';
import LoadIntoPlc from '../ui/LoadIntoPlc';
import SendToPlc from '../ui/SendToPlc';
import HeaderMore from '../../components/HeaderMore';
import { useNarrow } from '../../components/useNarrow';
import { useCollapseOnScroll } from '../../components/useCollapseOnScroll';

export default function ProgramPage() {
  const [folded, setFolded] = useCollapseOnScroll(useNarrow());
  const { lastGeneratedAt } = useProgramStore();
  const settings = useSettingsStore();
  const { profile, cpu, io, addresses, ioAddressSet, labels, analog } = usePlc();
  const ioWiring = useElectricalStore((s) => s.design?.ioWiring);
  const hmiDesign = useActiveHmiDesign();
  const wiring = new Map((ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));

  const { apiKey, model } = activeCredentials(settings);
  const ai: AIConfig = { provider: settings.provider, apiKey, model, effort: settings.effort };
  const ready = Boolean(apiKey);

  return (
    <>
      <header className={`px-4 sm:px-6 ${folded ? 'py-1.5 flex-nowrap' : 'py-3 flex-wrap'} bg-white border-b border-gray-200 flex items-center gap-x-4 gap-y-2`} data-folded={folded || undefined}>
        <div className="min-w-0 flex-[1_1_16rem]">
          <ProjectNameInput className="w-full text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-brand-500 focus:outline-none bg-transparent" />
          {!folded && <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            {lastGeneratedAt && <span>Last generated: {new Date(lastGeneratedAt).toLocaleString()}</span>}
          </div>}
        </div>
        {folded ? <HeaderMore onClick={() => setFolded(false)} /> : <>
          <LoadIntoPlc />
          <SendToPlc profile={profile} />
          <Link to="/plc" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700" title="Change PLC">
            {profile.vendor} {profile.name} · {cpu.id}
          </Link>
          {!ready && <Link to="/settings" className="text-xs px-3 py-1.5 rounded bg-yellow-100 text-yellow-800">Add API key</Link>}
        </>}
      </header>

      {profile.language === 'ladder' ? (
        <LadderWorkspace
          ai={ai}
          ctx={{ profile, cpu, io, addresses, wiring, hmi: hmiDesign ?? undefined }}
          ioAddressSet={ioAddressSet}
          labels={labels}
          ready={ready}
          analog={analog}
        />
      ) : (
        <StProgramView ai={ai} io={io} ready={ready} />
      )}
    </>
  );
}
