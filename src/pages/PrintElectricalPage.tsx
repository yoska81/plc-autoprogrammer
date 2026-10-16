import { useDrawingContext } from '../electrical/useDrawingContext';
import DrawingSet from '../electrical/drawings/DrawingSet';

/** All drawing sheets stacked for printing / Save as PDF (17x11 landscape). */
export default function PrintElectricalPage() {
  const ctx = useDrawingContext();
  if (!ctx) return <p className="p-8 text-sm text-gray-600">No electrical design yet.</p>;
  return (
    <div className="print-page bg-white min-h-screen">
      <div className="no-print flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <span className="text-sm text-gray-600">Set the printer to Tabloid / 11x17 landscape, or choose "Save as PDF".</span>
        <button onClick={() => window.print()} className="px-4 py-2 bg-petrol-600 text-white text-sm rounded hover:bg-petrol-700">Print / Save as PDF</button>
      </div>
      <DrawingSet ctx={ctx} printMode />
    </div>
  );
}
