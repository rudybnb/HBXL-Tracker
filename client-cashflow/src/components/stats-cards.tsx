interface StatsCardsProps {
  stats?: {
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    activeContractors: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-50 rounded-lg">
            <i className="fas fa-briefcase text-blue-600 text-xl"></i>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Total Jobs</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.totalJobs || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-amber-50 rounded-lg">
            <i className="fas fa-clock text-amber-600 text-xl"></i>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Pending</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.pendingJobs || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <i className="fas fa-check-circle text-emerald-600 text-xl"></i>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Completed</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.completedJobs || 0}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-50 rounded-lg">
            <i className="fas fa-users text-purple-600 text-xl"></i>
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-slate-600">Active Contractors</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.activeContractors || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
