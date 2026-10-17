import { sequenceTable, type CycleSequence } from '../../engine/sequence';

/** The automatic cycle as a readable table (step, what happens, waits for, timeout) above the ladder. */
export default function SequenceTable({ sequence, labels }: { sequence: CycleSequence; labels?: Map<string, string> }) {
  const rows = sequenceTable(sequence);
  const named = (text: string) => text.replace(/\b([XY]\d{3})\b/g, (a) => (labels?.get(a) ? `${a} ${labels.get(a)}` : a));
  return (
    <details open className="border-b border-gray-200 bg-white text-xs" data-testid="cycle-steps">
      <summary className="px-4 py-2 cursor-pointer font-medium text-gray-700">
        Automatic cycle: {rows.length} step{rows.length === 1 ? '' : 's'} ({sequence.source === 'ai' ? 'from the description' : 'default from the I/O list'}) — step register DS1150, after the last step back to step 10
      </summary>
      <table className="mx-4 mb-2 w-[calc(100%-2rem)]">
        <thead className="text-gray-500 uppercase"><tr>{['Step', 'Name', 'What happens', 'Waits for', 'Timeout'].map((h) => <th key={h} className="text-left py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={r.step}>
              <td className="py-1 pr-3 font-mono">{r.step}</td>
              <td className="py-1 pr-3">{sequence.steps[i].name}</td>
              <td className="py-1 pr-3">{r.does}</td>
              <td className="py-1 pr-3">{named(r.waits)}</td>
              <td className="py-1 pr-3">{r.timeout}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sequence.questions.length > 0 && <ul className="mx-4 mb-2 list-disc pl-4 text-amber-800">{sequence.questions.map((q) => <li key={q}>{q}</li>)}</ul>}
    </details>
  );
}
