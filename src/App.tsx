import { IOToolbar } from './components/IOToolbar';
import { IOTable } from './components/IOTable';

export default function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <h1 className="text-base font-bold text-white tracking-tight">PLC Autoprogrammer</h1>
          <p className="text-xs text-gray-500 mt-0.5">I/O Configuration</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">Project</p>
          <a href="#" className="flex items-center gap-2 px-3 py-2 rounded text-sm text-white bg-gray-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            I/O List
          </a>
          <a href="#" className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 mt-0.5 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
            Logic (coming soon)
          </a>
          <a href="#" className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 mt-0.5 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
            HMI (coming soon)
          </a>
        </nav>
        <div className="px-5 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-600">v0.1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-4 bg-white border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">I/O List</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage project inputs and outputs</p>
        </header>
        <IOToolbar />
        <div className="flex-1 overflow-auto bg-white">
          <IOTable />
        </div>
      </main>
    </div>
  );
}
