import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { Contractor, JobWithContractor } from "@shared/schema";

interface ContractorsOverviewProps {
  onAssignJob: (job?: JobWithContractor) => void;
}

export default function ContractorsOverview({ onAssignJob }: ContractorsOverviewProps) {
  const { data: contractors = [], isLoading } = useQuery<Contractor[]>({
    queryKey: ['/api/contractors'],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-100 text-emerald-800';
      case 'busy': return 'bg-amber-100 text-amber-800';
      case 'unavailable': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getContractorInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const colors = ['bg-primary-600', 'bg-emerald-600', 'bg-purple-600', 'bg-blue-600', 'bg-amber-600'];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-4">
                    <div className="h-24 bg-slate-100 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Contractor Overview</h3>
              <p className="text-sm text-slate-600 mt-1">Monitor contractor performance and availability</p>
            </div>
            <Button className="bg-primary-600 text-white hover:bg-primary-700 transition-colors flex items-center">
              <i className="fas fa-plus mr-2"></i>Add Contractor
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contractors.length > 0 ? contractors.map((contractor, index) => (
              <div key={contractor.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 ${getAvatarColor(index)} rounded-full flex items-center justify-center mr-3`}>
                      <span className="text-white text-sm font-medium">
                        {getContractorInitials(contractor.name)}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{contractor.name}</h4>
                      <p className="text-xs text-slate-500">{contractor.specialty}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contractor.status)}`}>
                    {contractor.status.charAt(0).toUpperCase() + contractor.status.slice(1)}
                  </span>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Active Jobs</span>
                    <span className="font-medium text-slate-900">{contractor.activeJobs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Completed</span>
                    <span className="font-medium text-slate-900">{contractor.completedJobs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Rating</span>
                    <div className="flex items-center">
                      <span className="font-medium text-slate-900 mr-1">{contractor.rating}</span>
                      <i className="fas fa-star text-yellow-400 text-xs"></i>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {contractor.status === 'available' ? (
                    <Button
                      onClick={() => onAssignJob()}
                      className="flex-1 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                      size="sm"
                    >
                      Assign Job
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="flex-1 bg-slate-100 text-slate-500 cursor-not-allowed"
                      size="sm"
                    >
                      Unavailable
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Navigate to contractor details page
                      window.location.href = `/contractor/${contractor.name}`;
                    }}
                    className="px-3 py-2 text-slate-600 hover:text-slate-900"
                  >
                    <i className="fas fa-eye"></i>
                  </Button>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-8 text-sm text-slate-500">
                No contractors found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
