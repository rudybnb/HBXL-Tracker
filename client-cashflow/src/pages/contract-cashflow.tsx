import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Calendar, DollarSign, Users, Clock, TrendingUp, TrendingDown, Plus, Upload, FileText, Target, BarChart3, AlertTriangle } from "lucide-react";

// Weekly Cash Flow Tracking Interfaces - MANDATORY RULE: AUTHENTIC DATA ONLY
interface ProjectMaster {
  id: string;
  projectName: string;
  clientName: string;
  projectType: 'labour_only' | 'labour_materials' | 'materials_only';
  startDate: string;
  estimatedEndDate: string;
  actualEndDate?: string;
  totalBudget: string;
  quotedPrice: string;
  labourBudget: string;
  materialBudget: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  completionPercent: string;
  budgetDataSource: string;
  createdBy: string;
  createdAt: string;
}

interface WeeklyCashflow {
  id: string;
  projectId: string;
  projectName: string;
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: string;
  forecastedLabourCost: string;
  forecastedMaterialCost: string;
  forecastedTotalSpend: string;
  actualLabourCost: string;
  actualMaterialCost: string;
  actualTotalSpend: string;
  labourVariance: string;
  materialVariance: string;
  totalVariance: string;
  actualLabourCostCalculated?: number;
  labourVarianceCalculated?: string;
  cumulativeSpend: string;
  remainingBudget: string;
  dataValidated: boolean;
}

interface MaterialPurchase {
  id: string;
  projectId: string;
  projectName: string;
  purchaseWeek: string;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  itemDescription: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
  category: string;
  dataSource: string;
  uploadedBy: string;
}

interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  totalForecastedSpend: string;
  totalActualSpend: string;
  totalVariance: string;
  labourVariance: string;
  materialVariance: string;
  projectProgress: string;
  budgetUsed: string;
}

export default function ContractCashflow() {
  // Main data states - MANDATORY RULE: AUTHENTIC DATA ONLY
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyCashflow[]>([]);
  const [materials, setMaterials] = useState<MaterialPurchase[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  
  // Form states for new entries
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showWeeklyForecastForm, setShowWeeklyForecastForm] = useState(false);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, [selectedProject]);

  // MANDATORY RULE: AUTHENTIC DATA ONLY - Load all dashboard data from database
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load projects first
      const projectsResponse = await fetch('/api/weekly-cashflow/projects');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);
        
        // Auto-select first project if none selected
        if (!selectedProject && projectsData.projects.length > 0) {
          setSelectedProject(projectsData.projects[0].id);
        }
        
        console.log('✅ Loaded', projectsData.projects.length, 'project masters');
      }
      
      // Load dashboard summary
      const dashboardResponse = await fetch(`/api/weekly-cashflow/dashboard${selectedProject ? `?projectId=${selectedProject}` : ''}`);
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setDashboardSummary(dashboardData.summary);
        setWeeklyData(dashboardData.weeklyData || []);
        setMaterials(dashboardData.materials || []);
        
        console.log('✅ Dashboard loaded:', dashboardData.summary?.totalProjects, 'projects,', dashboardData.weeklyData?.length, 'weeks');
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Authentic Data Required", 
        description: "Failed to load cash flow data. Only authentic database sources permitted.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new project master
  const createProject = async (projectData: any) => {
    try {
      setSubmitting(true);
      
      const response = await fetch('/api/weekly-cashflow/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Project Created",
          description: `${result.project.projectName} added to cash flow tracking`,
        });
        setShowNewProjectForm(false);
        loadDashboardData();
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create project. Ensure all required fields are filled.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Create weekly forecast
  const createWeeklyForecast = async (weeklyData: any) => {
    try {
      setSubmitting(true);
      
      const response = await fetch('/api/weekly-cashflow/weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weeklyData)
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Weekly Forecast Created",
          description: `Week ${result.cashflow.weekNumber} forecast saved with authentic labour calculations`,
        });
        setShowWeeklyForecastForm(false);
        loadDashboardData();
      } else {
        throw new Error('Failed to create weekly forecast');
      }
    } catch (error) {
      console.error('Error creating weekly forecast:', error);
      toast({
        title: "Forecast Failed",
        description: "Failed to create weekly forecast. Check all required fields.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Add material purchase
  const addMaterialPurchase = async (materialData: any) => {
    try {
      setSubmitting(true);
      
      const response = await fetch('/api/weekly-cashflow/materials', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(materialData)
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Material Purchase Recorded",
          description: `${result.material.supplierName} - £${result.material.totalCost} added`,
        });
        setShowMaterialForm(false);
        loadDashboardData();
      } else {
        throw new Error('Failed to record material purchase');
      }
    } catch (error) {
      console.error('Error recording material purchase:', error);
      toast({
        title: "Recording Failed",
        description: "Failed to record material purchase. Verify all data is authentic.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Utility functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-600';
      case 'active': return 'bg-blue-600';
      case 'planning': return 'bg-yellow-600';
      case 'on_hold': return 'bg-red-600';
      default: return 'bg-slate-600';
    }
  };

  const getProjectTypeColor = (type: string) => {
    switch (type) {
      case 'labour_only': return 'bg-blue-500';
      case 'labour_materials': return 'bg-purple-500'; 
      case 'materials_only': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(isNaN(num) ? 0 : num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getVarianceColor = (variance: string) => {
    const num = parseFloat(variance);
    if (num > 0) return 'text-red-400';
    if (num < 0) return 'text-green-400';
    return 'text-slate-400';
  };

  const currentWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    return startOfWeek.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
          <p className="text-slate-400">Loading authentic cash flow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Enhanced Header with Project Selection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-yellow-600">WEEKLY CASH FLOW TRACKING</h1>
              <p className="text-slate-400">Automated Labour & Material Cost Integration</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-64 bg-slate-800 border-slate-600" data-testid="select-project">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" data-testid="select-all-projects">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id} data-testid={`select-project-${project.id}`}>
                    {project.projectName} ({project.projectType.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="border-slate-600 hover:bg-slate-700"
              data-testid="button-back"
            >
              ← Back to Admin
            </Button>
          </div>
        </div>

        {/* Enhanced Financial Overview - AUTHENTIC DATA ONLY */}
        {dashboardSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Forecasted Spend</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(dashboardSummary.totalForecastedSpend)}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Actual Spend</p>
                    <p className="text-2xl font-bold text-orange-400">{formatCurrency(dashboardSummary.totalActualSpend)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Variance</p>
                    <p className={`text-2xl font-bold ${getVarianceColor(dashboardSummary.totalVariance)}`}>
                      {formatCurrency(dashboardSummary.totalVariance)}
                    </p>
                  </div>
                  {parseFloat(dashboardSummary.totalVariance) > 0 ? 
                    <AlertTriangle className="h-8 w-8 text-red-400" /> : 
                    <TrendingDown className="h-8 w-8 text-green-400" />
                  }
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Active Projects</p>
                    <p className="text-2xl font-bold text-green-400">{dashboardSummary.activeProjects}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Weekly Cash Flow Tabs - Comprehensive Interface */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly Data</TabsTrigger>
            <TabsTrigger value="materials" data-testid="tab-materials">Materials</TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">Projects</TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">Add New</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab - Summary & Analytics */}
          <TabsContent value="dashboard">
            <div className="space-y-6">
              {/* Project Progress Overview */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-yellow-600 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Project Progress vs Budget Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProject && dashboardSummary && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-8">
                        {/* Project Progress */}
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Project Progress</span>
                            <span className="text-white">{dashboardSummary.projectProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-600 rounded-full h-3">
                            <div 
                              className="bg-green-500 h-3 rounded-full transition-all duration-300"
                              style={{ width: `${dashboardSummary.projectProgress}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        {/* Budget Usage */}
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-400">Budget Used</span>
                            <span className="text-white">{dashboardSummary.budgetUsed}%</span>
                          </div>
                          <div className="w-full bg-slate-600 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-300 ${
                                parseFloat(dashboardSummary.budgetUsed) > 100 ? 'bg-red-500' : 
                                parseFloat(dashboardSummary.budgetUsed) > 80 ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(parseFloat(dashboardSummary.budgetUsed), 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Variance Breakdown */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-slate-400 text-sm">Labour Variance</p>
                              <p className={`text-xl font-bold ${getVarianceColor(dashboardSummary.labourVariance)}`}>
                                {formatCurrency(dashboardSummary.labourVariance)}
                              </p>
                            </div>
                            <Users className="h-6 w-6 text-blue-400" />
                          </div>
                        </div>
                        <div className="bg-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-slate-400 text-sm">Material Variance</p>
                              <p className={`text-xl font-bold ${getVarianceColor(dashboardSummary.materialVariance)}`}>
                                {formatCurrency(dashboardSummary.materialVariance)}
                              </p>
                            </div>
                            <FileText className="h-6 w-6 text-orange-400" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!selectedProject && (
                    <div className="text-center py-8">
                      <p className="text-slate-400">Select a project to view detailed analytics</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Weekly Data Tab - Core Cash Flow Tracking */}
          <TabsContent value="weekly">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-yellow-600 flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Weekly Cash Flow Data
                  </CardTitle>
                  <Button 
                    onClick={() => setShowWeeklyForecastForm(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black"
                    data-testid="button-add-weekly"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Weekly Forecast
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {weeklyData.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">No weekly cash flow data available</p>
                      <p className="text-sm text-slate-500">Add weekly forecasts to track project spending</p>
                    </div>
                  ) : (
                    weeklyData.map((week) => (
                      <div key={week.id} className="bg-slate-700 rounded-lg p-4" data-testid={`week-${week.id}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <Badge className="bg-blue-600 text-white">Week {week.weekNumber}</Badge>
                            <span className="text-white font-medium">{week.projectName}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">
                              {formatDate(week.weekStartDate)} - {formatDate(week.weekEndDate)}
                            </p>
                            {week.dataValidated && (
                              <Badge className="bg-green-600 text-white">Validated</Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-slate-400">Forecast Labour</p>
                            <p className="text-sm font-semibold text-blue-400">{formatCurrency(week.forecastedLabourCost)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Actual Labour</p>
                            <p className="text-sm font-semibold text-green-400">
                              {week.actualLabourCostCalculated ? 
                                formatCurrency(week.actualLabourCostCalculated) : 
                                formatCurrency(week.actualLabourCost)
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Forecast Materials</p>
                            <p className="text-sm font-semibold text-orange-400">{formatCurrency(week.forecastedMaterialCost)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Actual Materials</p>
                            <p className="text-sm font-semibold text-red-400">{formatCurrency(week.actualMaterialCost)}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2 border-t border-slate-600">
                          <div className="flex space-x-6">
                            <div>
                              <p className="text-xs text-slate-400">Labour Variance</p>
                              <p className={`text-sm font-semibold ${getVarianceColor(
                                week.labourVarianceCalculated || week.labourVariance
                              )}`}>
                                {formatCurrency(week.labourVarianceCalculated || week.labourVariance)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">Total Variance</p>
                              <p className={`text-sm font-semibold ${getVarianceColor(week.totalVariance)}`}>
                                {formatCurrency(week.totalVariance)}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-slate-600 text-white">
                            Data Source: {week.labourVarianceCalculated ? "Authentic Work Sessions" : "Database"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Materials Tab - Material Purchases & Tracking */}
          <TabsContent value="materials">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-yellow-600 flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Material Purchases
                  </CardTitle>
                  <Button 
                    onClick={() => setShowMaterialForm(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black"
                    data-testid="button-add-material"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Record Purchase
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {materials.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">No material purchases recorded</p>
                      <p className="text-sm text-slate-500">Add material purchases to track costs accurately</p>
                    </div>
                  ) : (
                    materials.map((material) => (
                      <div key={material.id} className="bg-slate-700 rounded-lg p-4" data-testid={`material-${material.id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Badge className="bg-orange-600 text-white">{material.category || 'General'}</Badge>
                            <span className="text-white font-medium">{material.supplierName}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-orange-400">{formatCurrency(material.totalCost)}</p>
                            <p className="text-sm text-slate-400">#{material.invoiceNumber}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-slate-400">Purchase Date</p>
                            <p className="text-sm text-white">{formatDate(material.purchaseDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Project</p>
                            <p className="text-sm text-white">{material.projectName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Quantity</p>
                            <p className="text-sm text-blue-400">{material.quantity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Unit Cost</p>
                            <p className="text-sm text-green-400">{formatCurrency(material.unitCost)}</p>
                          </div>
                        </div>
                        
                        <div className="bg-slate-600 rounded p-2 mb-3">
                          <p className="text-xs text-slate-400">Description</p>
                          <p className="text-sm text-white">{material.itemDescription}</p>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-slate-400">
                            Week: {material.purchaseWeek} | Uploaded by: {material.uploadedBy}
                          </div>
                          <Badge className={`${material.dataSource === 'excel_import' ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                            {material.dataSource === 'excel_import' ? 'Excel Import' : 'Manual Entry'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab - Master Project List */}
          <TabsContent value="projects">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-yellow-600 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Project Masters
                  </CardTitle>
                  <Button 
                    onClick={() => setShowNewProjectForm(true)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black"
                    data-testid="button-add-project"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400 mb-2">No projects configured</p>
                      <p className="text-sm text-slate-500">Create project masters to begin cash flow tracking</p>
                    </div>
                  ) : (
                    projects.map((project) => (
                      <div key={project.id} className="bg-slate-700 rounded-lg p-4" data-testid={`project-${project.id}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-white">{project.projectName}</h3>
                            <Badge className={`${getStatusColor(project.status)} text-white`}>
                              {project.status.toUpperCase()}
                            </Badge>
                            <Badge className={`${getProjectTypeColor(project.projectType)} text-white`}>
                              {project.projectType.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">Total Budget</p>
                            <p className="text-xl font-bold text-green-400">{formatCurrency(project.totalBudget)}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-slate-400">Client</p>
                            <p className="text-sm text-white">{project.clientName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Start Date</p>
                            <p className="text-sm text-white">{formatDate(project.startDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Est. Completion</p>
                            <p className="text-sm text-white">{formatDate(project.estimatedEndDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Progress</p>
                            <p className="text-sm text-blue-400">{project.completionPercent}%</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-slate-600 rounded p-3">
                            <p className="text-xs text-slate-400">Labour Budget</p>
                            <p className="text-sm font-semibold text-blue-400">{formatCurrency(project.labourBudget)}</p>
                          </div>
                          <div className="bg-slate-600 rounded p-3">
                            <p className="text-xs text-slate-400">Material Budget</p>
                            <p className="text-sm font-semibold text-orange-400">{formatCurrency(project.materialBudget)}</p>
                          </div>
                          <div className="bg-slate-600 rounded p-3">
                            <p className="text-xs text-slate-400">Quoted Price</p>
                            <p className="text-sm font-semibold text-green-400">{formatCurrency(project.quotedPrice)}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-slate-400">
                            Created by: {project.createdBy} | Data Source: {project.budgetDataSource}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 hover:bg-slate-600"
                            onClick={() => setSelectedProject(project.id)}
                            data-testid={`button-select-${project.id}`}
                          >
                            Select Project
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Tab - Forms for Adding New Data */}
          <TabsContent value="create">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white p-6 h-auto"
                onClick={() => setShowNewProjectForm(true)}
                data-testid="button-create-project"
              >
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto mb-3" />
                  <p className="font-semibold text-lg mb-2">New Project</p>
                  <p className="text-sm opacity-90">Set up project master with budgets and timelines</p>
                </div>
              </Button>

              <Button
                className="bg-green-600 hover:bg-green-700 text-white p-6 h-auto"
                onClick={() => setShowWeeklyForecastForm(true)}
                data-testid="button-create-weekly"
              >
                <div className="text-center">
                  <Calendar className="h-8 w-8 mx-auto mb-3" />
                  <p className="font-semibold text-lg mb-2">Weekly Forecast</p>
                  <p className="text-sm opacity-90">Add labour and material forecasts by week</p>
                </div>
              </Button>

              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white p-6 h-auto"
                onClick={() => setShowMaterialForm(true)}
                data-testid="button-create-material"
              >
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-3" />
                  <p className="font-semibold text-lg mb-2">Material Purchase</p>
                  <p className="text-sm opacity-90">Record material costs and supplier invoices</p>
                </div>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Data Authenticity Notice */}
        <Card className="bg-slate-800 border-slate-700 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Badge className="bg-green-600 text-white">AUTHENTIC DATA ONLY</Badge>
              <p className="text-sm text-slate-400">
                All financial data sourced from authentic work sessions and database records. 
                Labour costs calculated from real pay rates: Marius £25/h, Dalwayne £18.75/h.
                No mock or placeholder data permitted per mandatory system rules.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}