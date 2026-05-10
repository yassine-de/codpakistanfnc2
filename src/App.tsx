import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Revenue from "./pages/Revenue";
import Expenses from "./pages/Expenses";
import Accounts from "./pages/Accounts";
import SellerDebts from "./pages/SellerDebts";
import UsersPage from "./pages/UsersPage";
import Reports from "./pages/Reports";
import HistoryPage from "./pages/HistoryPage";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Sellers from "./pages/Sellers";
import Sourcing from "./pages/Sourcing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/forgot-password" element={<AuthRoute><ForgotPassword /></AuthRoute>} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/revenue" element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
    <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
    <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
    <Route path="/seller-debts" element={<ProtectedRoute><SellerDebts /></ProtectedRoute>} />
    <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/sellers" element={<ProtectedRoute><Sellers /></ProtectedRoute>} />
    <Route path="/sourcing" element={<ProtectedRoute><Sourcing /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
