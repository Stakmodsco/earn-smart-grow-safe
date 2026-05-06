import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UpgradeNagModal } from "@/components/UpgradeNagModal";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Upgrade from "./pages/Upgrade.tsx";
import Withdraw from "./pages/Withdraw.tsx";
import Admin from "./pages/Admin.tsx";
import Referrals from "./pages/Referrals.tsx";
import Receipts from "./pages/Receipts.tsx";
import CheckinHistory from "./pages/CheckinHistory.tsx";
import Requests from "./pages/Requests.tsx";
import BecomeAdmin from "./pages/BecomeAdmin.tsx";
import Activities from "./pages/Activities.tsx";
import Profile from "./pages/Profile.tsx";
import Earnings from "./pages/Earnings.tsx";
import Payment from "./pages/Payment.tsx";
import DailyCheckin from "./pages/DailyCheckin.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import { SupportBot } from "@/components/SupportBot";
import { IdleLogoutGuard } from "@/components/IdleLogoutGuard";
import { AuthNudgeModal } from "@/components/AuthNudgeModal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <IdleLogoutGuard />
        <UpgradeNagModal />
        <AuthNudgeModal />
        <SupportBot />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/payment/:level" element={<Payment />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/become-admin" element={<BecomeAdmin />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/checkin-history" element={<CheckinHistory />} />
          <Route path="/daily-checkin" element={<DailyCheckin />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
