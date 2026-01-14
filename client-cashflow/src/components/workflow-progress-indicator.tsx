import React from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface WorkflowProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  steps: Array<{
    id: string;
    title: string;
    type?: 'info' | 'help' | 'warning' | 'success';
  }>;
  className?: string;
}

export function WorkflowProgressIndicator({
  currentStep,
  totalSteps,
  completedSteps,
  steps,
  className = ''
}: WorkflowProgressIndicatorProps) {
  const progress = Math.round((completedSteps.length / totalSteps) * 100);

  const getStepIcon = (stepIndex: number, step: any) => {
    const isCompleted = completedSteps.includes(step.id);
    const isCurrent = stepIndex === currentStep;

    if (isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }

    if (isCurrent) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }

    return <Circle className="h-4 w-4 text-slate-400" />;
  };

  const getStepColor = (stepIndex: number, step: any) => {
    const isCompleted = completedSteps.includes(step.id);
    const isCurrent = stepIndex === currentStep;

    if (isCompleted) return 'text-green-500';
    if (isCurrent) return 'text-yellow-500';
    return 'text-slate-400';
  };

  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">Workflow Progress</h4>
        <span className="text-xs text-slate-400">{progress}% Complete</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
        <div 
          className="bg-gradient-to-r from-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Step List */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-2">
            {getStepIcon(index, step)}
            <span className={`text-xs ${getStepColor(index, step)}`}>
              {step.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkflowProgressIndicator;