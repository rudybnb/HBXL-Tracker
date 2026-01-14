import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy } from "react";
import Dashboard from "@/pages/dashboard";
import GPSDashboard from "@/pages/gps-dashboard";
import Jobs from "@/pages/jobs";
import UploadJob from "@/pages/upload-job";

import AdminDashboard from "@/pages/admin-dashboard";
import ContractorOnboarding from "@/pages/contractor-onboarding-clean";
import ContractorForm from "@/pages/contractor-form";
import ContractorSuccess from "@/pages/contractor-success";
import AdminApplications from "@/pages/admin-applications";
import JobAssignments from "@/pages/job-assignments";
import Login from "@/pages/login";
import TaskProgress from "@/pages/task-progress";
import More from "@/pages/more";
import ForemanDashboard from "@/pages/foreman-dashboard";
import DirectJobAssignments from "@/pages/direct-job-assignments";
import AdminTaskMonitor from "@/pages/admin-task-monitor";
import SystemCleanupPage from "@/pages/system-cleanup";
import CreateAssignment from "@/pages/create-assignment";
import TelegramTest from "@/pages/telegram-test";
import AdminTimeTracking from "@/pages/admin-time-tracking";
import LiveClockMonitor from "@/pages/live-clock-monitor";

import ContractorIdCapture from "@/pages/contractor-id-capture";
import AdminSettings from "@/pages/admin-settings";
import AdminInspections from "@/pages/admin-inspections";
import AdminInspection from "@/pages/admin-inspection";
import TelegramMessages from "@/pages/telegram-messages";
import ContractCashflow from "@/pages/contract-cashflow";

import NotFound from "@/pages/not-found";
import ProtectedRoute from "@/components/ProtectedRoute";

// Role-based dashboard component
function RoleBased() {
  const userRole = localStorage.getItem('userRole');
  const adminName = localStorage.getItem('adminName');
  const contractorName = localStorage.getItem('contractorName');
  
  // Debug logging to track localStorage contents
  console.log('🔍 RoleBased Debug:', {
    userRole,
    adminName,
    contractorName,
    allLocalStorage: Object.fromEntries(Object.entries(localStorage))
  });
  
  if (userRole === 'admin') {
    console.log(`👑 Admin access for: ${adminName}`);
    return <AdminDashboard />;
  } else if (userRole === 'contractor') {
    console.log(`👷 Contractor access for: ${contractorName}`);
    return <GPSDashboard />;
  } else {
    // Default fallback - redirect to login
    console.log('❌ No valid role found, redirecting to login');
    window.location.href = '/login';
    return <div>Redirecting...</div>;
  }
}

function Router() {
  return (
    <div className="relative">
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => (
          <ProtectedRoute>
            <RoleBased />
          </ProtectedRoute>
        )} />

        <Route path="/upload" component={() => (
          <ProtectedRoute requiredRole="admin">
            <UploadJob />
          </ProtectedRoute>
        )} />

        <Route path="/admin" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        )} />
        <Route path="/admin-dashboard" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        )} />
        <Route path="/admin-task-monitor" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminTaskMonitor />
          </ProtectedRoute>
        )} />
        <Route path="/contractor-onboarding" component={() => (
          <ProtectedRoute requiredRole="admin">
            <ContractorOnboarding />
          </ProtectedRoute>
        )} />
        <Route path="/admin-applications" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminApplications />
          </ProtectedRoute>
        )} />
        <Route path="/contractor-form" component={ContractorForm} />
        <Route path="/contractor-success" component={ContractorSuccess} />
        <Route path="/jobs" component={() => (
          <ProtectedRoute requiredRole="contractor">
            <Jobs />
          </ProtectedRoute>
        )} />
        <Route path="/task-progress" component={() => (
          <ProtectedRoute requiredRole="contractor">
            <TaskProgress />
          </ProtectedRoute>
        )} />
        <Route path="/more" component={() => (
          <ProtectedRoute requiredRole="contractor">
            <More />
          </ProtectedRoute>
        )} />

        <Route path="/foreman" component={() => (
          <ProtectedRoute requiredRole="contractor">
            <ForemanDashboard />
          </ProtectedRoute>
        )} />

        <Route path="/job-assignments" component={() => (
          <ProtectedRoute requiredRole="admin">
            <JobAssignments />
          </ProtectedRoute>
        )} />
        <Route path="/admin/job-assignments" component={() => (
          <ProtectedRoute requiredRole="admin">
            <JobAssignments />
          </ProtectedRoute>
        )} />
        <Route path="/system-cleanup" component={() => (
          <ProtectedRoute requiredRole="admin">
            <SystemCleanupPage />
          </ProtectedRoute>
        )} />
        <Route path="/create-assignment" component={() => (
          <ProtectedRoute requiredRole="admin">
            <CreateAssignment />
          </ProtectedRoute>
        )} />
        <Route path="/admin-time-tracking" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminTimeTracking />
          </ProtectedRoute>
        )} />
        <Route path="/live-clock-monitor" component={() => (
          <ProtectedRoute requiredRole="admin">
            <LiveClockMonitor />
          </ProtectedRoute>
        )} />

        <Route path="/contractor-id-capture" component={() => (
          <ProtectedRoute requiredRole="admin">
            <ContractorIdCapture />
          </ProtectedRoute>
        )} />
        <Route path="/admin-settings" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminSettings />
          </ProtectedRoute>
        )} />
        <Route path="/admin-inspections" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminInspections />
          </ProtectedRoute>
        )} />
        <Route path="/admin-inspection/:id" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminInspection />
          </ProtectedRoute>
        )} />
        <Route path="/admin-telegram" component={() => (
          <ProtectedRoute requiredRole="admin">
            <TelegramMessages />
          </ProtectedRoute>
        )} />
        <Route path="/admin-site-inspections" component={() => (
          <ProtectedRoute requiredRole="admin">
            <AdminInspections />
          </ProtectedRoute>
        )} />
        <Route path="/contract-cashflow" component={() => (
          <ProtectedRoute requiredRole="admin">
            <ContractCashflow />
          </ProtectedRoute>
        )} />

        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
