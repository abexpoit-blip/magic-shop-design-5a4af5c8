import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute, AdminRoute } from "@/components/AppShell";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import ResetPassword from "./pages/ResetPassword";
import AdminSettings from "./pages/AdminSettings";
import AdminSiteSettings from "./pages/AdminSiteSettings";
import Shop from "./pages/Shop";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Recharge from "./pages/Recharge";
import Tickets from "./pages/Tickets";
import Settings from "./pages/Settings";
import SellerPanel from "./pages/SellerPanel";
import SellerApply from "./pages/SellerApply";
import SellerUpload from "./pages/SellerUpload";
import SellerFormat from "./pages/SellerFormat";
import SellerProfile from "./pages/SellerProfile";
import Admin from "./pages/Admin";
import AdminApplications from "./pages/AdminApplications";
import AdminPayouts from "./pages/AdminPayouts";
import AdminCards from "./pages/AdminCards";
import AdminRefunds from "./pages/AdminRefunds";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/admin/site" element={<AdminRoute><AdminSiteSettings /></AdminRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/recharge" element={<ProtectedRoute><Recharge /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/seller" element={<ProtectedRoute><SellerPanel /></ProtectedRoute>} />
            <Route path="/seller/apply" element={<ProtectedRoute><SellerApply /></ProtectedRoute>} />
            <Route path="/seller/upload" element={<ProtectedRoute><SellerUpload /></ProtectedRoute>} />
            <Route path="/seller/format" element={<ProtectedRoute><SellerFormat /></ProtectedRoute>} />
            <Route path="/seller/:id" element={<ProtectedRoute><SellerProfile /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/applications" element={<AdminRoute><AdminApplications /></AdminRoute>} />
            <Route path="/admin/payouts" element={<AdminRoute><AdminPayouts /></AdminRoute>} />
            <Route path="/admin/cards" element={<AdminRoute><AdminCards /></AdminRoute>} />
            <Route path="/admin/refunds" element={<AdminRoute><AdminRefunds /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
