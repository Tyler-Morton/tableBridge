import { Navigate, Route, Routes, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { OrderAlert } from "@/components/OrderAlert";
import Login from "@/routes/Login";
import Dashboard from "@/routes/Dashboard";
import ReviewOrder from "@/routes/ReviewOrder";
import KitchenDisplay from "@/routes/KitchenDisplay";
import History from "@/routes/History";
import Reports from "@/routes/Reports";
import Settings from "@/routes/Settings";
import {
  LayoutDashboard, ChefHat, History as HistoryIcon, BarChart3,
  Settings as SettingsIcon, LogOut,
} from "lucide-react";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthed, user, logout } = useAuth();
  useWebSocket();
  const loc = useLocation();
  if (!isAuthed) return <Navigate to="/login" state={{ from: loc }} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-bridge-50">
      <OrderAlert />
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bridge-500 text-white text-sm font-bold tracking-tight shadow-sm">
            TB
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-bridge-900 tracking-tight">TableBridge</div>
            <div className="text-xs text-slate-400 leading-tight">{user?.name} · <span className="capitalize">{user?.role}</span></div>
          </div>
        </div>

        <nav className="flex items-center gap-0.5">
          <NavItem to="/dashboard" icon={<LayoutDashboard size={15} />}>Dashboard</NavItem>
          <NavItem to="/kitchen" icon={<ChefHat size={15} />}>Kitchen</NavItem>
          <NavItem to="/history" icon={<HistoryIcon size={15} />}>History</NavItem>
          <NavItem to="/reports" icon={<BarChart3 size={15} />}>Reports</NavItem>
          <NavItem to="/settings" icon={<SettingsIcon size={15} />}>Settings</NavItem>
          <button
            onClick={logout}
            className="ml-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500
                       transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700
                       active:scale-[0.97] active:transition-transform"
          >
            <LogOut size={14} /> Sign out
          </button>
        </nav>
      </header>
      <main className="tablet-shell flex-1 p-5">{children}</main>
    </div>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold
         transition-all duration-150 ${
           isActive
             ? "bg-bridge-500 text-white shadow-sm"
             : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
         }`
      }
    >
      {icon} {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedShell><Dashboard /></ProtectedShell>} />
      <Route path="/review/:rawId" element={<ProtectedShell><ReviewOrder /></ProtectedShell>} />
      <Route path="/kitchen" element={<ProtectedShell><KitchenDisplay /></ProtectedShell>} />
      <Route path="/history" element={<ProtectedShell><History /></ProtectedShell>} />
      <Route path="/reports" element={<ProtectedShell><Reports /></ProtectedShell>} />
      <Route path="/settings" element={<ProtectedShell><Settings /></ProtectedShell>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
