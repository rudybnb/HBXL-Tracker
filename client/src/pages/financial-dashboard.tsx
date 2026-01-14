import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, DollarSign, Hammer, Package, Truck, Users, BarChart3 } from "lucide-react";

interface FinancialSummary {
  labour: number;
  material: number;
  plant: number;
  subcontractor: number;
  total: number;
}

interface JobWithFinancials {
  id: string;
  title: string;
  status: string;
  clientName: string | null;
  location: string;
  quotedAmount: string | null;
  financialSummary: FinancialSummary | null;
}

interface FinancialSummaryResponse {
  success: boolean;
  data: {
    jobs: JobWithFinancials[];
    overallTotals: {
      labour: number;
      material: number;
      plant: number;
      subcontractor: number;
      total: number;
      jobCount: number;
      jobsWithFinancials: number;
    };
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2
  }).format(amount);
}

function CategoryCard({ 
  title, 
  amount, 
  total, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  amount: number; 
  total: number; 
  icon: typeof Hammer; 
  color: string;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;
  
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-slate-300 font-medium">{title}</span>
          </div>
          <Badge variant="outline" className={`${color} border-current`}>
            {percentage.toFixed(1)}%
          </Badge>
        </div>
        <div className="text-2xl font-bold text-white mb-2">
          {formatCurrency(amount)}
        </div>
        <Progress 
          value={percentage} 
          className="h-2 bg-slate-700"
        />
      </CardContent>
    </Card>
  );
}

function JobFinancialCard({ job }: { job: JobWithFinancials }) {
  if (!job.financialSummary) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="pt-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-white truncate flex-1">{job.title}</h3>
            <Badge variant="outline" className="text-slate-400 border-slate-600 ml-2">
              No financials
            </Badge>
          </div>
          <p className="text-sm text-slate-400 truncate">{job.location}</p>
        </CardContent>
      </Card>
    );
  }

  const { financialSummary } = job;
  
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-white truncate">{job.title}</h3>
            <p className="text-sm text-slate-400 truncate">{job.location}</p>
          </div>
          <Badge 
            variant="outline" 
            className={
              job.status === 'completed' 
                ? 'text-green-400 border-green-400' 
                : job.status === 'in_progress' 
                ? 'text-blue-400 border-blue-400'
                : 'text-yellow-400 border-yellow-400'
            }
          >
            {job.status}
          </Badge>
        </div>
        
        <div className="text-xl font-bold text-amber-400 mb-3">
          {formatCurrency(financialSummary.total)}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Hammer className="h-3 w-3 text-blue-400" />
            <span className="text-slate-400">Labour:</span>
            <span className="text-white">{formatCurrency(financialSummary.labour)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-green-400" />
            <span className="text-slate-400">Material:</span>
            <span className="text-white">{formatCurrency(financialSummary.material)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Truck className="h-3 w-3 text-purple-400" />
            <span className="text-slate-400">Plant:</span>
            <span className="text-white">{formatCurrency(financialSummary.plant)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3 text-orange-400" />
            <span className="text-slate-400">Subcon:</span>
            <span className="text-white">{formatCurrency(financialSummary.subcontractor)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancialDashboard() {
  const { data, isLoading, error } = useQuery<FinancialSummaryResponse>({
    queryKey: ["/api/v1/jobs/financial-summary"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="text-center text-red-400">
          Failed to load financial data
        </div>
      </div>
    );
  }

  const { jobs, overallTotals } = data.data;
  const jobsWithFinancials = jobs.filter(j => j.financialSummary !== null);

  return (
    <div className="min-h-screen bg-slate-900 p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Financial Dashboard</h1>
            <p className="text-slate-400 text-sm">
              Manus-n8n Construction Intelligence
            </p>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 border-amber-700 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Total Project Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-2">
              {formatCurrency(overallTotals.total)}
            </div>
            <div className="flex gap-4 text-sm text-slate-300">
              <span>{overallTotals.jobCount} total jobs</span>
              <span>{overallTotals.jobsWithFinancials} with cost data</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CategoryCard
            title="Labour"
            amount={overallTotals.labour}
            total={overallTotals.total}
            icon={Hammer}
            color="text-blue-400"
          />
          <CategoryCard
            title="Material"
            amount={overallTotals.material}
            total={overallTotals.total}
            icon={Package}
            color="text-green-400"
          />
          <CategoryCard
            title="Plant"
            amount={overallTotals.plant}
            total={overallTotals.total}
            icon={Truck}
            color="text-purple-400"
          />
          <CategoryCard
            title="Subcontractor"
            amount={overallTotals.subcontractor}
            total={overallTotals.total}
            icon={Users}
            color="text-orange-400"
          />
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Job Financials</span>
              <Badge variant="outline" className="text-amber-400 border-amber-400">
                {jobsWithFinancials.length} jobs with data
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map(job => (
                <JobFinancialCard key={job.id} job={job} data-testid={`job-financial-card-${job.id}`} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <h3 className="text-white font-medium mb-2">Import API Endpoint</h3>
          <code className="text-sm text-green-400 bg-slate-900 p-2 rounded block overflow-x-auto">
            POST /api/v1/n/import-job
          </code>
          <p className="text-slate-400 text-sm mt-2">
            Use this endpoint to import HBXL jobs with cost breakdowns via n8n/Manus automation.
          </p>
        </div>
      </div>
    </div>
  );
}
