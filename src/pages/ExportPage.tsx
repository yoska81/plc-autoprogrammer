import { Suspense, lazy, useState } from 'react';
import { useProgramStore } from '../store/useProgramStore';
import { useIOStore } from '../store/useIOStore';
import { Link } from 'react-router-dom';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export default function ExportPage() {
  const { generatedCode, projectName } = useProgramStore();
  const { projectIO } = useIOStore();
  const [readOnly, setReadOnly] = useState(true);

  const downloadFile = (ext: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = 'ID,Type,Category,Description\n';
    const rows = projectIO
      .map((p) => `${p.id},${p.type},${p.category},"${p.description}"`)
      .join('\n');
    downloadFile('csv', header + rows, 'text/csv');
  };

  const handleCopy = () => {
    if (generatedCode) navigator.clipboard.writeText(generatedCode);
  };

  return (
    <>
      <header className="px-6 py-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Export</h2>
        <p className="text-xs text-gray-400 mt-0.5">Download your program and I/O list</p>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!generatedCode ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-sm mb-2">No program generated yet.</p>
              <Link
                to="/program"
                className="text-blue-600 text-sm underline hover:text-blue-800"
              >
                Go to Program Generator first
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => downloadFile('st', generatedCode, 'text/plain')}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Download .st
              </button>
              <button
                onClick={() => downloadFile('txt', generatedCode, 'text/plain')}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Download .txt
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition-colors"
              >
                Copy to Clipboard
              </button>
              <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                  className="rounded"
                />
                Read-only
              </label>
            </div>

            {/* Monaco editor */}
            <div className="h-80 rounded overflow-hidden border border-gray-300">
              <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading editor...</div>}>
                <MonacoEditor
                  height="100%"
                  defaultLanguage="pascal"
                  value={generatedCode}
                  theme="vs-dark"
                  options={{
                    readOnly,
                    fontSize: 12,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </Suspense>
            </div>

            {/* I/O Summary */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                I/O Summary ({projectIO.length} points)
              </h3>
              <button
                onClick={exportCSV}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Export I/O as CSV
              </button>
            </div>

            <div className="overflow-auto border border-gray-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">ID</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectIO.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-bold text-gray-800">{p.id}</td>
                      <td className="px-3 py-2 capitalize text-gray-600">{p.type}</td>
                      <td className="px-3 py-2 text-gray-600">{p.category}</td>
                      <td className="px-3 py-2 text-gray-700">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
