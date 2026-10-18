import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROJECT_NAME_MAX, useProjectsStore } from '../store/useProjectsStore';
import { useProjectStore, type Region } from '../store/useProjectStore';
import { isIec, NEMA_TO_IP, REGIONS, regionSpec, SUPPLY_INFO } from '../standards/regions';
import { useElectricalStore } from '../store/useElectricalStore';
import { useSpecStore } from '../store/useSpecStore';
import { useHmiStore } from '../store/useHmiStore';
import { useStages } from '../spec/useStages';
import { SPEC_SECTIONS } from '../spec/types';
import { getHmi } from '../hmi/hmiCatalog';
import type { EnclosureRating, SupplyVoltage } from '../electrical/types';
import SpecIntake from '../components/SpecIntake';
import EquipmentPanel from '../components/EquipmentPanel';
import { useUi, useUiStore } from '../store/useUiStore';
import { usePendingEquipment } from '../spec/equipment';
import QuestionList from '../components/questions/QuestionList';
import { useQuestions } from '../components/questions/useQuestionStore';

const STEPS = ['Project data', 'Describe the machine', 'Equipment', 'Summary'];

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

  const [step, setStep] = useUi('wizard.step', 0, { global: true });
  // Furthest step reached: the step tabs jump back and forward again up to it.
  const [reached, setReached] = useUi('wizard.reached', 0, { global: true });
  const pendingEquipment = usePendingEquipment();
  const specQuestions = useQuestions('spec');
  // The project this wizard run created (remembered across pages and reloads). If another project
  // is open now, the run was abandoned: start a new one rather than write into that project.
  const activeId = useProjectsStore((s) => s.activeId);
  const [wizardProject, setWizardProject] = useUi<string | null>('wizard.project', null, { global: true });
  const created = Boolean(wizardProject) && wizardProject === activeId;
  const setCreated = (v: boolean) => setWizardProject(v ? useProjectsStore.getState().activeId : null);
  useEffect(() => {
    if (wizardProject && wizardProject !== activeId) {
      const ui = useUiStore.getState();
      ui.clearUi('_global', Object.keys(ui.byProject._global ?? {}).filter((k) => k.startsWith('wizard.')));
    }
  }, [wizardProject, activeId]);
  const [name, setName] = useUi('wizard.name', '', { global: true });
  const [customer, setCustomer] = useUi('wizard.customer', '', { global: true });
  const [site, setSite] = useUi('wizard.site', '', { global: true });
  const [company, setCompany] = useUi('wizard.company', 'ISA', { global: true });
  const [projectNumber, setProjectNumber] = useUi('wizard.projectNumber', '', { global: true });
  const [prefix, setPrefix] = useUi('wizard.prefix', '', { global: true });
  const [preparedBy, setPreparedBy] = useUi('wizard.preparedBy', '', { global: true });
  const [region, setRegion] = useUi<Region>('wizard.region', 'US', { global: true });
  const [supply, setSupply] = useUi<SupplyVoltage>('wizard.supply', '480VAC-3PH', { global: true });
  const [enclosure, setEnclosure] = useUi<EnclosureRating>('wizard.enclosure', 'NEMA 12', { global: true });
  const [standards, setStandards] = useUi<string[]>('wizard.standards', ['NFPA 79', 'UL 508A'], { global: true });
  // How the project starts: a new machine described here, or an existing machine read from its drawings.
  const [start, setStart] = useUi<'describe' | 'drawings'>('wizard.start', 'describe', { global: true });

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
      useProjectStore.getState().setInfo({ region, customer, site, standards, company, projectNumber, drawingPrefix: prefix.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8), preparedBy });
      const el = useElectricalStore.getState();
      el.setInputs({ ...el.inputs, supply, enclosureRating: enclosure });
      if (start === 'drawings') {
        // The drawings / program write the description, I/O and motors: continue on the Import page.
        const ui = useUiStore.getState();
        ui.clearUi('_global', Object.keys(ui.byProject._global ?? {}).filter((k) => k.startsWith('wizard.')));
        navigate('/import');
        return;
      }
    }
    // A selection on the Equipment step that was not applied with "Use this selection": apply it now,
    // so the summary and the electrical design use what the user saw.
    if (step === 2 && pendingEquipment.apply) pendingEquipment.apply();
    if (step === STEPS.length - 1) {
      // Done: the next "New project" starts with an empty wizard.
      const ui = useUiStore.getState();
      ui.clearUi('_global', Object.keys(ui.byProject._global ?? {}).filter((k) => k.startsWith('wizard.')));
      navigate('/io');
      return;
    }
    setStep((s) => s + 1);
    setReached((r) => Math.max(r, step + 1));
  };
  // Leaving the wizard goes to the app (navigate(-1) left a fresh tab off the app).
  const close = () => navigate('/spec');

  // An equipment selection that does not fit the I/O can't be applied: change it (or clear it) first.
  const equipmentBlocked = step === 2 && Boolean(pendingEquipment.label) && !pendingEquipment.apply;
  const canNext = step === 0 ? Boolean(name.trim()) : step === 1 ? filled.length > 0 : step === 2 ? !equipmentBlocked : true;

  return (
    <div className="flex flex-col h-screen bg-steel-50 font-sans text-steel-900">
      <header className="h-12 flex-shrink-0 bg-white border-b border-steel-200 flex items-center px-4 gap-3">
        <span className="h-5 px-1 flex items-center bg-brand-600 text-white text-[10px] font-bold tracking-wider rounded-[3px]" aria-hidden>ISA</span>
        <span className="font-semibold tracking-[0.14em] text-steel-900" aria-label="ISA AUTO PROGRAMMER">AUTO PROGRAMMER</span>
        <span className="text-steel-500 text-sm">New project</span>
        <button onClick={close} className="ml-auto text-sm text-steel-600 hover:text-steel-900">Close ✕</button>
      </header>

      {/* Step indicator */}
      <nav aria-label="Wizard steps" className="bg-white border-b border-steel-200 px-4 sm:px-6 overflow-x-auto">
        <ol className="flex min-w-max sm:min-w-0">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button type="button" disabled={i > Math.max(step, reached) || (i > 0 && !created)} onClick={() => setStep(i)}
                className={`w-full flex items-center gap-2 py-3 border-b-4 text-sm ${i === step ? 'border-brand-600 text-brand-800 font-semibold' : i < step ? 'border-brand-200 text-steel-700' : 'border-transparent text-steel-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i < step ? 'bg-brand-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-steel-100 text-steel-500'}`}>
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
                <section className="space-y-2" data-testid="start-option">
                  <h3 className="text-sm font-semibold text-steel-800">How do you want to start?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Choice selected={start === 'describe'} onClick={() => setStart('describe')} title="Describe a new machine" hint="Write (or say) what the machine does; the app designs everything from it." />
                    <Choice selected={start === 'drawings'} onClick={() => setStart('drawings')} title="From existing drawings / program" hint="Upload an existing machine's electrical drawings (PDF, scans, DXF) or program printouts; the app reads them, you check the readings, it writes the description and converts the design to the standard chosen below." />
                  </div>
                </section>
                <section className="bg-white border border-steel-200 rounded-md p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Project name *"><input autoFocus value={name} maxLength={PROJECT_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="e.g. Line 3 case packer" className={input} /></Field>
                  <Field label="Customer"><input value={customer} onChange={(e) => setCustomer(e.target.value)} className={input} /></Field>
                  <Field label="Site / location"><input value={site} onChange={(e) => setSite(e.target.value)} className={input} /></Field>
                  <Field label="Your company"><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Shown on drawings and documents" className={input} /></Field>
                  <Field label="Project / job number"><input value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="e.g. 24-117" className={input} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Drawing prefix"><input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} placeholder="e.g. WCC" maxLength={8} className={`${input} uppercase placeholder:normal-case`} /></Field>
                    <Field label="Engineer (initials)"><input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} placeholder="e.g. Y.S." className={input} /></Field>
                  </div>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Where the machine will be installed</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {REGIONS.map((r) => (
                      <Choice key={r.value} selected={region === r.value} title={r.label} hint={r.hint}
                        onClick={() => { setRegion(r.value); setStandards(r.standards); setSupply(r.supply); }} />
                    ))}
                  </div>
                  <p className="text-xs text-steel-500">Sets the electrical code: US designs protect circuits with UL 489 breakers, Canadian designs with HRC fuses, IEC designs (Europe, Israel, other IEC countries) follow IEC 60204-1 with MCBs, mm² wiring and IEC colours.</p>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Power available at the machine</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {regionSpec(region).supplies.map((v) => <Choice key={v} selected={supply === v} onClick={() => setSupply(v)} title={SUPPLY_INFO[v].label} hint={SUPPLY_INFO[v].hint} />)}
                  </div>
                  <p className="text-xs text-steel-500">Not sure? Ask the plant electrician, or check the nameplate of a similar machine.</p>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Where the control cabinet will stand</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {ENCLOSURES.map((e) => <Choice key={e.value} selected={enclosure === e.value} onClick={() => setEnclosure(e.value)} title={isIec(region) ? `${NEMA_TO_IP[e.value] ?? e.label} (${e.label})` : e.label} hint={e.hint} />)}
                  </div>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-steel-800">Standards</h3>
                  <div className="flex flex-wrap gap-4">
                    {(isIec(region) ? regionSpec(region).standards : STANDARDS).map((s) => (
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
                {created && specQuestions.length > 0 && (
                  <QuestionList questions={specQuestions} title="Questions about the description"
                    intro="Answer what you know now (or later on the Machine description page); answers are part of the spec." />
                )}
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
            <div><dt className="text-steel-500 text-xs">Power · enclosure</dt><dd>{SUPPLY_INFO[supply].label} · {isIec(region) ? `${NEMA_TO_IP[enclosure] ?? enclosure} (${enclosure})` : enclosure}</dd></div>
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
            <div><dt className="text-steel-500 text-xs">Electrical</dt><dd>{created && electrical.inputs.requiredParts.length ? `${electrical.inputs.requiredParts.length} part${electrical.inputs.requiredParts.length === 1 ? '' : 's'} chosen so far` : '—'}</dd></div>
          </dl>
        </aside>
      </div>

      <footer className="h-16 flex-shrink-0 bg-white border-t border-steel-200 flex items-center justify-between px-6">
        <button onClick={() => (step === 0 ? close() : setStep((s) => s - 1))} className="px-4 py-2 text-sm border border-steel-300 rounded hover:bg-steel-50">
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        <div className="flex items-center gap-3">
          {step === 2 && stages.equipment.status === 'empty' && !pendingEquipment.label && <span className="text-xs text-steel-500">You can also choose equipment later.</span>}
          {step === 2 && pendingEquipment.apply && <span className="text-xs text-steel-600">Next applies {pendingEquipment.label} to the project.</span>}
          {equipmentBlocked && <span className="text-xs text-amber-800">{pendingEquipment.label} does not fit the I/O: change the selection before going on.</span>}
          <button onClick={next} disabled={!canNext}
            className="px-5 py-2 text-sm font-medium bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40">
            {step === STEPS.length - 1 ? 'Open project →' : step === 0 && start === 'drawings' ? 'Continue to the import →' : 'Next →'}
          </button>
        </div>
      </footer>
    </div>
  );
}
