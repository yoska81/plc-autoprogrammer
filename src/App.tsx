import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/io', label: 'I/O List', icon: '⊞' },
  { to: '/program', label: 'Program Generator', icon: '⚡' },
  { to: '/export', label: 'Export', icon: '↓' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <h1 className="text-base font-bold text-white tracking-tight">PLC Autoprogrammer</h1>
          <p className="text-xs text-gray-500 mt-0.5">AI-Powered PLC Toolchain</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 mb-2">Project</p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm font-medium mt-0.5 transition-colors ${
                  isActive
                    ? 'text-white bg-gray-700'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base leading-none w-4 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-600">v0.2.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
