import React from 'react';
import { Router, Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './pages/Dashboard';
import { WeeklyReport } from './pages/WeeklyReport';
import { ProjectAnalysis } from './pages/ProjectAnalysis';
import { ContractorEarnings } from './pages/ContractorEarnings';
import { ImportData } from './pages/ImportData';
import { Settings } from './pages/Settings';
import { Navigation } from './components/Navigation';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-slate-900">
          <Navigation />
          
          <main className="pb-20">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/import" component={ImportData} />
              <Route path="/weekly-report" component={WeeklyReport} />
              <Route path="/projects" component={ProjectAnalysis} />
              <Route path="/contractors" component={ContractorEarnings} />
              <Route path="/settings" component={Settings} />
              <Route>
                <div className="flex items-center justify-center min-h-screen">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">Page Not Found</h1>
                    <p className="text-slate-400">The page you're looking for doesn't exist.</p>
                  </div>
                </div>
              </Route>
            </Switch>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;