import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../store/useProjectsStore';
import { useProjectStore, type Region } from '../store/useProjectStore';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSpecStore } from '../store/useSpecStore';
import { useHmiStore } from '../store/useHmiStore';
import { useStages } from '../spec/useStages';
import { SPEC_SECTIONS } from '../spec/types';
import { getHmi } from '../hmi/hmiCatalog';
import type { EnclosureRating, SupplyVoltage } from '../electrical/types';
import SpecIntake from '../components/SpecIntake';
import EquipmentPanel from '../components/EquipmentPanel';

const STEPS = ['Project data', 'Describe the machine', 'Equipment', 'Summary'];

const REGIONS: { value: Region; label: string; hint: string; standards: string[]; supply: SupplyVoltage }[] = [
  { value: 'US', label: 'United States', hint: 'NEC, NFPA 79, UL 508A · circuit breakers', standards: ['NFPA 79', 'UL 508A', 'NEC'], supply: '480VAC-3PH' },
  { value: 'Canada', label: 'Canada', hint: 'CEC, CSA C22.2 No. 14 · fuses', standards: ['CSA C22.2 No. 14', 'CEC'], supply: '600VAC-3PH' },
];
const SUPPLIES: { value: SupplyVoltage; label: string; hint: string }[] = [
  { value: '600VAC-3PH', label: '600 V 3-phase', hint: 'Most Canadian factories' },
  { value: '480VAC-3PH', label: '480 V 3-phase', hint: 'Most US factories' },
  { value: '240VAC-3PH', label: '240 V 3-phase', hint: 'Smaller plants, shops' },
  { value: '208VAC-3PH', label: '208 V 3-phase', hint: 'Commercial buildings' },
  { value: '120VAC-1PH', label: '120 V single-phase', hint: 'Small machines, plug-in' },
];
const ENCLOSURES: { value: EnclosureRating; label: string; hint: string }[] = [
  { value: 'NEMA 12', label: 'NEMA 12', hint: 'Indoor, dust and drips' },
  { value: 'NEMA 4', label: 'NEMA 4', hint: 'Hose-down, outdoor' },
  { value: 'NEMA 4X', label: 'NEMA 4X', hint: 'Washdown, corrosive (stainless)' },
  { value: 'NEMA 1', label: 'NEMA 1', hint: 'Clean indoor only' },
];
const STANDARDS = ['NFPA 79', 'UL 508A', 'NEC', 'CSA C22.2 No. 14', 'CEC'];

function Choice({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left rounded-md border p-3 transition-colors ${selected ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-steel-200 bg-white hover:border-brand-300'}`}>
      <div className="text-sm font-medium text-steel-900">{title}</div>
      <div className="text-xs text-steel-500">{hint}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm text-steel-700"><span className="block mb-1 font-medium">{label}</span>{children}</label>;
}

const input = 'w-full border border-steel-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const createProject = useProjectsStore((s) => s.createProject);
  const project = useProjectStore();
  const electrical = useElectricalStore();
  const sections = useSpecStore((s) => s.sections);
  const hmiPart = useHmiStore((s) => s.hmiPartNumber);
  const stages = useStages();

  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(false);
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState('');
  const [site, setSite] = useState('');
  const [company, setCompany] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [prefix, setPrefix] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [region, setRegion] = useState<Region>('US');
  const [supply, setSupply] = useState<SupplyVoltage>('480VAC-3PH');
  const [enclosure, setEnclosure] = useState<EnclosureRating>('NEMA 12');
  const [standards, setStandards] = useState<string[]>(['NFPA 79', 'UL 508A']);

  // Until the new project exists the stores still hold the open project: show nothing of it here.
  const filled = created ? SPEC_SECTIONS.filter((s) => sections[s.id]?.trim()) : [];
  const hmi = created && hmiPart ? getHmi(hmiPart) : undefined;
  const equipmentChosen = created && stages.equipment.status !== 'empty';

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return;
      // The project is created when its basic data is confirmed; later steps fill it in.
      if (!created) {
        // Never write the wizard's data into the project that is still open.
        if (!createProject(name.trim())) return;
        setCreated(true);
      }
      useProjectStore.getState().setInfo({ region, customer, site, standards, company, projectNumber, drawingPrefix: prefix.trim().toUpperCase(), preparedBy });
      const el = useElectricalStore.getState();
      el.setInputs({ ...el.inputs, supply, enclosureRating: enclosure });
    }
    if (step === STEPS.length - 1) {
      navigate('/io');
      return;
    }
    setStep((s) => s + 1);
  };

  const canNext = step === 0 ? Boolean(name.trim()) : step === 1 ? filled.length > 0 : true;

  return (
    <div className="flex flex-col h-screen bg-steel-50 font-sans text-steel-900">
      <header className="h-12 flex-shrink-0 bg-brand-950 text-white flex items-center px-4 gap-4">
        <span className="font-semibold tracking-[0.18em] text-brand-600">ISA AUTO PROGRAMMER</span>
        <span className="text-brand-200 text-sm">New project</span>
        <button onClick={() => navigate(-1)} className="ml-auto text-sm text-brand-100 hover:text-white">Close ✕</button>
      </header>

      {/* Step indicator */}
      <nav aria-label="Wizard steps" className="bg-white border-b border-steel-200 px-6">
        <ol className="flex">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button type="button" disabled={i > step || (i > 0 && !created)} onClick={() => setStep(i)}
                className={`w-full flex items-center gap-2 py-3 border-b-4 text-sm ${i === step ? 'border-brand-600 text-brand-800 font-semibold' : i < step ? 'border-brand-200 text-steel-700' : 'border-transparent text-steel-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i < step ? 'bg-brand-500 text-brand-950' : i === step ? 'bg-brand-600 text-brand-950' : 'bg-steel-100 text-steel-500'}`}>
                  {i < step ? '✓' : i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl space-y-6">
            {step === 0 && (
              <>
                <section className="bg-white border border-steel-200 rounded-md p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Project name *"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Line 3 case packer" className={input} /></Field>
                  <Field label="Customer"><input value={customer} onChange={(e) => setCustomer(e.target.value)} className={input} /></Field>
                  <Field label="Site / location"><input value={site} onChange={(e) => setSite(e.target.value)} className={input} /></Field>
                  <Field label="Your company"><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Shown on drawings and documents" className={input} /></Field>
                  <Field label="Project / job number"><input value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="e.g. 24-117" className={input} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Drawing prefix"><input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. WCC" maxLength={8} className={`${input} uppercase placeholder:normal-case`} /></Field>
                    <Field label="Engineer (initials)"><input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="e.g. Y.S." className={input} /></Field>
                  </div>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Where the machine will be installed</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {REGIONS.map((r) => (
                      <Choice key={r.value} selected={region === r.value} title={r.label} hint={r.hint}
                        onClick={() => { setRegion(r.value); setStandards(r.standards); setSupply(r.supply); }} />
                    ))}
                  </div>
                  <p className="text-xs text-steel-500">Sets the electrical code: US designs protect circuits with UL 489 breakers, Canadian designs with HRC fuses.</p>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Power available at the machine</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {SUPPLIES.map((s) => <Choice key={s.value} selected={supply === s.value} onClick={() => setSupply(s.value)} title={s.label} hint={s.hint} />)}
                  </div>
                  <p className="text-xs text-steel-500">Not sure? Ask the plant electrician, or check the nameplate of a similar machine.</p>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Where the control cabinet will stand</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {ENCLOSURES.map((e) => <Choice key={e.value} selected={enclosure === e.value} onClick={() => setEnclosure(e.value)} title={e.label} hint={e.hint} />)}
                  </div>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Standards</h3>
                  <div className="flex flex-wrap gap-4">
                    {STANDARDS.map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm text-steel-700">
                        <input type="checkbox" checked={standards.includes(s)} onChange={(e) => setStandards((cur) => e.target.checked ? [...cur, s] : cur.filter((x) => x !== s))} />
                        {s}
                      </label>
                    ))}
                  </div>
                </section>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-sm text-steel-600">Tell it what the machine does in your own words: the sequence, safety (E-stops, doors, light curtains), homing, modes, motors and air cylinders. Upload a spec document if you have one. You can change everything later.</p>
                <SpecIntake />
              </>
            )}

            {step === 2 && <EquipmentPanel />}

            {step === 3 && (
              <section className="bg-white border border-steel-200 rounded-md p-5 space-y-4">
                <h3 className="font-semibold text-steel-900">Ready to build {name}</h3>
                <p className="text-sm text-steel-600">Next the app will, step by step and with your review at each step:</p>
                <ol className="list-decimal pl-5 text-sm text-steel-700 space-y-1">
                  <li>List every input and output with its PLC address.</li>
                  <li>Design the control cabinet and the machine wiring, with drawings, a picture of the cabinet and the bill of materials.</li>
                  <li>Design the operator screens.</li>
                  <li>Write the PLC program, which you can then run in the simulator.</li>
                  <li>Produce the full document package: drawings, BOM, cable schedule, calculations, test checklist and manual.</li>
                </ol>
              </section>
            )}
          </div>
        </main>

        {/* Configuration summary */}
        <aside className="w-80 flex-shrink-0 bg-white border-l border-steel-200 p-5 overflow-y-auto hidden lg:block">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-steel-500 mb-3">Configuration summary</h3>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-steel-500 text-xs">Project</dt><dd className="font-medium">{name || '—'}</dd></div>
            <div><dt className="text-steel-500 text-xs">Customer · site</dt><dd>{[customer, site].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt className="text-steel-500 text-xs">Power · enclosure</dt><dd>{SUPPLIES.find((s) => s.value === supply)?.label} · {enclosure}</dd></div>
            <div>
              <dt className="text-steel-500 text-xs">Description</dt>
              <dd>{filled.length ? `${filled.length} of ${SPEC_SECTIONS.length} sections` : '—'}</dd>
              {filled.length > 0 && <dd className="text-xs text-steel-500 mt-0.5">{filled.map((s) => s.title).join(', ')}</dd>}
            </div>
            <div>
              <dt className="text-steel-500 text-xs">Controller</dt>
              <dd className="font-mono">{equipmentChosen ? project.cpuId : '—'}</dd>
              {equipmentChosen && project.modules.length > 0 && <dd className="text-xs font-mono text-steel-600">{project.modules.join(', ')}</dd>}
            </div>
            <div><dt className="text-steel-500 text-xs">Operator panel</dt><dd className="font-mono">{hmi ? `${hmi.partNumber} (${hmi.sizeIn}")` : '—'}</dd></div>
            <div><dt className="text-steel-500 text-xs">Electrical</dt><dd>{created && electrical.inputs.requiredParts.length ? `${electrical.inputs.requiredParts.length} parts chosen so far` : '—'}</dd></div>
          </dl>
        </aside>
      </div>

      <footer className="h-16 flex-shrink-0 bg-white border-t border-steel-200 flex items-center justify-between px-6">
        <button onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))} className="px-4 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50">
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        <div className="flex items-center gap-3">
          {step === 2 && stages.equipment.status === 'empty' && <span className="text-xs text-steel-500">You can also choose equipment later.</span>}
          <button onClick={next} disabled={!canNext}
            className="px-5 py-2 text-sm font-medium bg-brand-600 text-brand-950 rounded hover:bg-brand-700 disabled:opacity-40">
            {step === STEPS.length - 1 ? 'Open project →' : 'Next →'}
          </button>
        </div>
      </footer>
    </div>
  );
}
