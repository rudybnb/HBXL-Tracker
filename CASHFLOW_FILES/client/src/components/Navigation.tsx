import React from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Home, 
  Upload, 
  FileText, 
  PieChart, 
  Users, 
  Settings,
  TrendingUp
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/import', label: 'Import Data', icon: Upload },
  { path: '/weekly-report', label: 'Weekly Report', icon: FileText },
  { path: '/projects', label: 'Projects', icon: PieChart },
  { path: '/contractors', label: 'Contractors', icon: Users },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-amber-400 mr-3" />
            <div>
              <h1 className="text-xl font-bold text-white">ERdesignandbuild</h1>
              <p className="text-slate-400 text-sm">Cash Flow Tracking</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <div className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-amber-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}>
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden mt-4">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <div className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-amber-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}>
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}