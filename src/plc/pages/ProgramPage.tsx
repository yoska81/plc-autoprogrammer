import { Link } from 'react-router-dom';
import { useProgramStore } from '../../store/useProgramStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useSettingsStore, activeCredentials } from '../../store/useSettingsStore';
import { usePlc } from '../core/usePlc';
import { useElectricalStore } from '../../store/useElectricalStore';
import { useHmiStore } from '../../store/useHmiStore';
import type { AIConfig } from '../ai/ladderAI';
import LadderWorkspace from '../ui/program/LadderWorkspace';
import StProgramView from '../ui/program/StProgramView';
import LoadIntoPlc from '../ui/LoadIntoPlc';

export default function ProgramPage() {
  const { projectName, lastGeneratedAt } = useProgramStore();
  const renameProject = useProjectsStore((s) => s.renameActive);
  const settings = useSettingsStore();
  const { profile, cpu, io, addresses, ioAddressSet, labels, analog } = usePlc();
  const ioWiring = useElectricalStore((s) => s.design?.ioWiring);
  const hmiDesign = useHmiStore((s) => s.design);
  const wiring = new Map((ioWiring ?? []).map((w) => [w.address, { deviceTag: w.deviceTag, deviceType: w.deviceType }]));

  const { apiKey, model } = activeCredentials(settings);
  const ai: AIConfig = { provider: settings.provider, apiKey, model, effort: settings.effort };
  const ready = Boolean(apiKey);

  return (
    <>
      <header className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <input
            value={projectName}
            onChange={(e) => renameProject(e.target.value)}
            aria-label="Project name"
            className="text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-brand-500 focus:outline-none bg-transparent"
          />
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            {lastGeneratedAt && <span>Last generated: {new Date(lastGeneratedAt).toLocaleString()}</span>}
          </div>
        </div>
        <LoadIntoPlc />
        <Link to="/plc" className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700" title="Change PLC">
          {profile.vendor} {profile.name} · {cpu.id}
        </Link>
        {!ready && <Link to="/settings" className="text-xs px-3 py-1.5 rounded bg-yellow-100 text-yellow-800">Add API key</Link>}
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
