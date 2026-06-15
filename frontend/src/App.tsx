import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, NavLink, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { OrderAlert } from "@/components/OrderAlert";
import Login from "@/routes/Login";
import {
  LayoutDashboard, ChefHat, History as HistoryIcon, BarChart3,
  Settings as SettingsIcon, LogOut,
} from "lucide-react";

// Code-split routes so heavy dependencies (e.g. Recharts on Reports) stay out
// of the initial bundle and load only when the route is first visited.
const Dashboard = lazy(() => import("@/routes/Dashboard"));
const ReviewOrder = lazy(() => import("@/routes/ReviewOrder"));
const KitchenDisplay = lazy(() => import("@/routes/KitchenDisplay"));
const History = lazy(() => import("@/routes/History"));
const Reports = lazy(() => import("@/routes/Reports"));
const Settings = lazy(() => import("@/routes/Settings"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthed, user, logout } = useAuth();
  useWebSocket();
  const loc = useLocation();
  const reduce = useReducedMotion();
  if (!isAuthed) return <Navigate to="/login" state={{ from: loc }} replace />;

  return (
    <div className="flex min-h-screen flex-col bg-bridge-50">
      <OrderAlert />
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 py-3 backdrop-blur-md">
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
      <main className="tablet-shell flex-1 p-5">
        <motion.div
          key={loc.pathname}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </motion.div>
      </main>
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
