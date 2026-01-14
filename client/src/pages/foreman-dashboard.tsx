import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parse, isAfter, isBefore } from 'date-fns';
import { CalendarIcon, ClockIcon, MapPinIcon, UserIcon, AlertTriangleIcon } from 'lucide-react';

interface JobAssignment {
  id: string;
  contractorName: string;
  email: string;
  phone: string;
  workLocation: string;
  hbxlJob: string;
  buildPhases: string[];
  startDate: string;
  endDate: string;
  specialInstructions?: string;
  status: string;
  latitude?: string;
  longitude?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ForemanDashboard() {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'endDate' | 'startDate' | 'contractor'>('endDate');

  // Fetch all job assignments
  const { data: assignments = [], isLoading } = useQuery<JobAssignment[]>({
    queryKey: ['/api/job-assignments'],
  });

  // Filter and sort assignments
  const filteredAndSortedAssignments = assignments
    .filter(assignment => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'overdue') {
        const endDate = parse(assignment.endDate, 'dd/MM/yyyy', new Date());
        return isAfter(new Date(), endDate) && assignment.status !== 'completed';
      }
      if (filterStatus === 'upcoming') {
        const startDate = parse(assignment.startDate, 'dd/MM/yyyy', new Date());
        return isAfter(startDate, new Date());
      }
      return assignment.status === filterStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'endDate') {
        const dateA = parse(a.endDate, 'dd/MM/yyyy', new Date());
        const dateB = parse(b.endDate, 'dd/MM/yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      }
      if (sortBy === 'startDate') {
        const dateA = parse(a.startDate, 'dd/MM/yyyy', new Date());
        const dateB = parse(b.startDate, 'dd/MM/yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      }
      if (sortBy === 'contractor') {
        return a.contractorName.localeCompare(b.contractorName);
      }
      return 0;
    });

  const getStatusColor = (assignment: JobAssignment) => {
    const endDate = parse(assignment.endDate, 'dd/MM/yyyy', new Date());
    const startDate = parse(assignment.startDate, 'dd/MM/yyyy', new Date());
    const today = new Date();

    if (assignment.status === 'completed') return 'bg-green-100 text-green-800 border-green-200';
    if (isAfter(today, endDate)) return 'bg-red-100 text-red-800 border-red-200';
    if (isAfter(startDate, today)) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getStatusText = (assignment: JobAssignment) => {
    const endDate = parse(assignment.endDate, 'dd/MM/yyyy', new Date());
    const startDate = parse(assignment.startDate, 'dd/MM/yyyy', new Date());
    const today = new Date();

    if (assignment.status === 'completed') return 'Completed';
    if (isAfter(today, endDate)) return 'Overdue';
    if (isAfter(startDate, today)) return 'Upcoming';
    return 'In Progress';
  };

  const overdueTasks = assignments.filter(assignment => {
    const endDate = parse(assignment.endDate, 'dd/MM/yyyy', new Date());
    return isAfter(new Date(), endDate) && assignment.status !== 'completed';
  });

  const activeTasks = assignments.filter(assignment => assignment.status === 'assigned');
  const completedTasks = assignments.filter(assignment => assignment.status === 'completed');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading foreman dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-yellow-400">Jobs Assigned</h1>
            <p className="text-slate-400 text-sm mt-1">All team assignments and deadlines</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Dalwayne Diedericks</div>
              <div className="text-xs text-yellow-400">Site Foreman</div>
            </div>
            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
              <span className="text-slate-900 font-semibold">DD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-white">{assignments.length}</div>
                <div className="text-slate-400 text-sm">Total Assignments</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-white">{activeTasks.length}</div>
                <div className="text-slate-400 text-sm">Active Tasks</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                <AlertTriangleIcon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-white">{overdueTasks.length}</div>
                <div className="text-slate-400 text-sm">Overdue</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-white">{completedTasks.length}</div>
                <div className="text-slate-400 text-sm">Completed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  filterStatus === 'all' 
                    ? 'bg-yellow-500 text-slate-900' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid="filter-all"
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('assigned')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  filterStatus === 'assigned' 
                    ? 'bg-yellow-500 text-slate-900' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid="filter-assigned"
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('overdue')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  filterStatus === 'overdue' 
                    ? 'bg-yellow-500 text-slate-900' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid="filter-overdue"
              >
                Overdue
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-3 py-1 rounded-md text-sm font-medium ${
                  filterStatus === 'completed' 
                    ? 'bg-yellow-500 text-slate-900' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                data-testid="filter-completed"
              >
                Completed
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'endDate' | 'startDate' | 'contractor')}
                className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 text-sm"
                data-testid="sort-select"
              >
                <option value="endDate">Due Date</option>
                <option value="startDate">Start Date</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          {filteredAndSortedAssignments.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
              <div className="text-slate-400">No assignments found for the selected filter.</div>
            </div>
          ) : (
            filteredAndSortedAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors"
                data-testid={`assignment-card-${assignment.id}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{assignment.hbxlJob}</h3>
                        <div className="flex items-center text-slate-400 text-sm mt-1">
                          <UserIcon className="w-4 h-4 mr-1" />
                          {assignment.contractorName}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(assignment)}`}
                        data-testid={`status-${assignment.id}`}
                      >
                        {getStatusText(assignment)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-400 mb-3">
                      <div className="flex items-center">
                        <MapPinIcon className="w-4 h-4 mr-1" />
                        {assignment.workLocation}
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {assignment.startDate} - {assignment.endDate}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {assignment.buildPhases.map((phase, index) => (
                        <span
                          key={index}
                          className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs"
                          data-testid={`phase-${assignment.id}-${index}`}
                        >
                          {phase}
                        </span>
                      ))}
                    </div>

                    {assignment.specialInstructions && (
                      <div className="text-sm text-slate-300 bg-slate-700 rounded p-3">
                        <strong>Special Instructions:</strong> {assignment.specialInstructions}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:ml-4">
                    <a
                      href={`tel:${assignment.phone}`}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm text-center transition-colors"
                      data-testid={`call-${assignment.id}`}
                    >
                      Call {assignment.contractorName.split(' ')[0]}
                    </a>
                    <a
                      href={`mailto:${assignment.email}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm text-center transition-colors"
                      data-testid={`email-${assignment.id}`}
                    >
                      Email
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700">
        <div className="grid grid-cols-4 text-center">
          <button 
            onClick={() => window.location.href = '/'}
            className="py-3 px-4 text-slate-400 hover:text-white"
            data-testid="nav-dashboard"
          >
            <i className="fas fa-home block mb-1"></i>
            <span className="text-xs">Dashboard</span>
          </button>
          <button 
            onClick={() => window.location.href = '/jobs'}
            className="py-3 px-4 text-slate-400 hover:text-white"
            data-testid="nav-jobs"
          >
            <i className="fas fa-briefcase block mb-1"></i>
            <span className="text-xs">Jobs</span>
          </button>
          <button 
            onClick={() => window.location.href = '/foreman'}
            className="py-3 px-4 text-yellow-400"
            data-testid="nav-foreman"
          >
            <i className="fas fa-users block mb-1"></i>
            <span className="text-xs">Jobs Assigned</span>
          </button>
          <button 
            onClick={() => window.location.href = '/more'}
            className="py-3 px-4 text-slate-400 hover:text-white"
            data-testid="nav-more"
          >
            <i className="fas fa-ellipsis-h block mb-1"></i>
            <span className="text-xs">More</span>
          </button>
        </div>
      </div>
      
      {/* Add bottom padding to account for fixed navigation */}
      <div className="h-20"></div>
    </div>
  );
}