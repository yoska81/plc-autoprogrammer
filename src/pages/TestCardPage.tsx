import { LOGS_FOLDER, TEST_CARD } from '../plc/deploy/testCard';

/**
 * Help › Test card: one page for the owner trying "Send to PLC software" on a Windows PC: per PLC brand what to
 * install, the clicks, and which log to send us (src/plc/deploy/testCard.ts). Prints on its own.
 */
export default function TestCardPage() {
  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-steel-200 bg-white px-4 py-2.5 print:hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-steel-800">Test card</h2>
          <p className="mt-0.5 text-xs text-steel-500">Try Send to PLC software on a Windows PC with the desktop app: what to install for your PLC, the clicks, and which log to send us.</p>
        </div>
        <button type="button" onClick={() => window.print()} className="rounded border border-steel-300 bg-white px-3 py-1.5 text-sm hover:bg-steel-50">Print</button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" data-testid="test-card">
        <div className="rounded border border-brand-200 bg-brand-50 p-3 text-brand-950">
          <p><span className="font-semibold">If something goes wrong,</span> the app says it in one sentence and shows <span className="font-semibold">Open log folder</span>. Press it and send us the log named on your card below, with that sentence.</p>
          <p className="mt-1 text-xs">The logs are in <span className="select-all font-mono">{LOGS_FOLDER}</span>. They never hold passwords.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {TEST_CARD.map((c) => (
            <section key={c.brand} className="break-inside-avoid rounded border border-steel-200 bg-white p-3" data-brand={c.brand}>
              <h3 className="font-semibold text-steel-900">{c.brand} <span className="font-normal text-steel-500">· {c.software}</span></h3>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-steel-500">Install</p>
              <ul className="ml-4 list-disc text-steel-800">{c.install.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-steel-500">Clicks</p>
              <ol className="ml-4 list-decimal text-steel-800">{c.clicks.map((x) => <li key={x}>{x}</li>)}</ol>
              <p className="mt-2 text-steel-700"><span className="text-xs font-semibold uppercase tracking-wide text-steel-500">Log to send: </span>
                {c.log ? <span className="font-mono">{c.log}</span> : 'none (nothing is sent to the software)'}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
