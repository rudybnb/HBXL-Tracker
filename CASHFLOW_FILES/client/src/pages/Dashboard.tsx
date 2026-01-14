import React from 'react';
import { Link } from 'wouter';
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  DollarSign,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">Cash Flow Dashboard</h1>
          <p className="text-slate-400 text-lg">
            Track project finances, contractor earnings, and material costs in real-time.
          </p>
        </div>

        {/* Quick Start Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 mb-8">
          <div className="flex items-center mb-6">
            <Upload className="w-8 h-8 text-amber-400 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-white">Get Started</h2>
              <p className="text-slate-400">Import your XLSX file to set up everything automatically</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/import">
              <div className="bg-slate-700 p-6 rounded-lg border-2 border-dashed border-slate-600 hover:border-amber-400 transition-colors cursor-pointer group">
                <div className="flex items-center mb-4">
                  <FileSpreadsheet className="w-12 h-12 text-amber-400 group-hover:scale-110 transition-transform" />
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-white">Import XLSX Data</h3>
                    <p className="text-slate-400 text-sm">Upload your file to extract all data automatically</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-amber-400 text-sm font-medium">👷</div>
                    <div className="text-slate-400 text-xs">Contractors</div>
                  </div>
                  <div>
                    <div className="text-blue-400 text-sm font-medium">🏗️</div>
                    <div className="text-slate-400 text-xs">Jobs</div>
                  </div>
                  <div>
                    <div className="text-green-400 text-sm font-medium">⏱️</div>
                    <div className="text-slate-400 text-xs">Time Data</div>
                  </div>
                  <div>
                    <div className="text-purple-400 text-sm font-medium">🧱</div>
                    <div className="text-slate-400 text-xs">Materials</div>
                  </div>
                </div>
              </div>
            </Link>

            <div className="bg-slate-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-4">What Gets Imported</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  <span className="text-slate-300">Contractor names and pay rates</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  <span className="text-slate-300">Job addresses and budgets</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  <span className="text-slate-300">Work session times and dates</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  <span className="text-slate-300">Material costs and descriptions</span>
                </div>
                <div className="flex items-center mt-4">
                  <AlertCircle className="w-5 h-5 text-amber-400 mr-3" />
                  <span className="text-slate-400 text-sm">Only job quotes need to be added manually</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">This Week Labour</p>
                <p className="text-2xl font-bold text-white">£0.00</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Active Contractors</p>
                <p className="text-2xl font-bold text-white">0</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Hours This Week</p>
                <p className="text-2xl font-bold text-white">0.0</p>
              </div>
              <Calendar className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Material Costs</p>
                <p className="text-2xl font-bold text-white">£0.00</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">Export Data</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <button 
              onClick={() => window.open('/api/export/excel', '_blank')}
              className="bg-green-600 hover:bg-green-700 p-6 rounded-lg transition-colors flex items-center"
            >
              <FileSpreadsheet className="w-8 h-8 text-white mr-4" />
              <div className="text-left">
                <h3 className="text-white font-semibold text-lg">Export to Excel</h3>
                <p className="text-green-100 text-sm">Download complete cash flow data as XLSX</p>
              </div>
            </button>

            <button 
              onClick={() => window.open('/api/export/pdf', '_blank')}
              className="bg-red-600 hover:bg-red-700 p-6 rounded-lg transition-colors flex items-center"
            >
              <FileSpreadsheet className="w-8 h-8 text-white mr-4" />
              <div className="text-left">
                <h3 className="text-white font-semibold text-lg">Export to PDF</h3>
                <p className="text-red-100 text-sm">Generate professional cash flow report</p>
              </div>
            </button>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/weekly-report">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer">
              <FileSpreadsheet className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Weekly Reports</h3>
              <p className="text-slate-400">Generate detailed weekly cash flow reports</p>
            </div>
          </Link>

          <Link href="/projects">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer">
              <TrendingUp className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Project Analysis</h3>
              <p className="text-slate-400">Track project costs and profitability</p>
            </div>
          </Link>

          <Link href="/contractors">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer">
              <Users className="w-12 h-12 text-green-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Contractor Earnings</h3>
              <p className="text-slate-400">Monitor individual contractor performance</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}