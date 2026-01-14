import { useState, useEffect } from 'react';

interface WorkflowStep {
  id: string;
  title: string;
  content: string;
  type?: 'info' | 'help' | 'warning' | 'success';
  completed?: boolean;
}

interface WorkflowHelpConfig {
  workflow: string;
  steps: WorkflowStep[];
  currentStep?: number;
}

export function useWorkflowHelp(config: WorkflowHelpConfig) {
  const [currentStep, setCurrentStep] = useState(config.currentStep || 0);
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    const saved = localStorage.getItem(`workflow-${config.workflow}-completed`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(
      `workflow-${config.workflow}-completed`, 
      JSON.stringify(completedSteps)
    );
  }, [completedSteps, config.workflow]);

  const markStepCompleted = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps(prev => [...prev, stepId]);
    }
  };

  const resetWorkflow = () => {
    setCompletedSteps([]);
    setCurrentStep(0);
    localStorage.removeItem(`workflow-${config.workflow}-completed`);
  };

  const nextStep = () => {
    if (currentStep < config.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const isStepCompleted = (stepId: string) => {
    return completedSteps.includes(stepId);
  };

  const getCurrentStep = () => {
    return config.steps[currentStep];
  };

  const getProgress = () => {
    return Math.round((completedSteps.length / config.steps.length) * 100);
  };

  return {
    currentStep,
    setCurrentStep,
    completedSteps,
    markStepCompleted,
    resetWorkflow,
    nextStep,
    previousStep,
    isStepCompleted,
    getCurrentStep,
    getProgress,
    totalSteps: config.steps.length
  };
}

// Predefined workflow configurations
export const WORKFLOW_CONFIGS = {
  csvUpload: {
    workflow: 'csv-upload',
    steps: [
      {
        id: 'file-selection',
        title: 'Select CSV File',
        content: 'Choose a CSV file with required headers: Name, Address, Post code, Project Type, Build Phase. Files must be under 10MB.',
        type: 'info' as const
      },
      {
        id: 'file-validation',
        title: 'File Validation',
        content: 'System validates file format, size, and structure. Only authentic CSV data is accepted.',
        type: 'help' as const
      },
      {
        id: 'data-processing',
        title: 'Data Processing',
        content: 'Extract job information from CSV rows. GPS coordinates are automatically generated from postcodes.',
        type: 'help' as const
      },
      {
        id: 'job-creation',
        title: 'Job Creation',
        content: 'Jobs created with build phases and location data. Ready for contractor assignment.',
        type: 'success' as const
      }
    ]
  },
  gpsTracking: {
    workflow: 'gps-tracking',
    steps: [
      {
        id: 'location-check',
        title: 'GPS Location Check',
        content: 'Verify GPS signal strength and accuracy. Location services must be enabled.',
        type: 'info' as const
      },
      {
        id: 'proximity-validation',
        title: 'Work Site Proximity',
        content: 'Must be within 1km of assigned work site. Distance calculated using GPS coordinates.',
        type: 'help' as const
      },
      {
        id: 'time-validation',
        title: 'Working Hours Check',
        content: 'Valid working hours: 7:45 AM - 5:00 PM. Late arrivals after 8:15 AM incur £0.50/minute deductions.',
        type: 'warning' as const
      },
      {
        id: 'session-start',
        title: 'Start Time Tracking',
        content: 'GPS-verified time tracking begins. Session data saved to database with coordinates.',
        type: 'success' as const
      },
      {
        id: 'session-end',
        title: 'End Session',
        content: 'Stop tracking and calculate pay. CIS deductions applied automatically.',
        type: 'warning' as const
      }
    ]
  },
  contractorOnboarding: {
    workflow: 'contractor-onboarding',
    steps: [
      {
        id: 'personal-info',
        title: 'Personal Information',
        content: 'Enter your basic personal details including name, email, phone, and Telegram ID for notifications.',
        type: 'info' as const
      },
      {
        id: 'address-info',
        title: 'Address Details',
        content: 'Provide your full address including postcode. This helps us match you to nearby job sites.',
        type: 'info' as const
      },
      {
        id: 'right-to-work',
        title: 'Right to Work',
        content: 'Confirm your right to work in the UK and provide passport details. This is legally required.',
        type: 'warning' as const
      },
      {
        id: 'cis-tax',
        title: 'CIS & Tax Information',
        content: 'Provide your CIS status and UTR number. This determines how your taxes are handled.',
        type: 'help' as const
      },
      {
        id: 'banking-details',
        title: 'Banking Information',
        content: 'Enter your bank account details for payment processing. All information is securely stored.',
        type: 'warning' as const
      },
      {
        id: 'emergency-contact',
        title: 'Emergency Contact',
        content: 'Provide emergency contact details for safety compliance on construction sites.',
        type: 'info' as const
      },
      {
        id: 'trade-tools',
        title: 'Trade & Tools',
        content: 'Specify your primary trade, experience, and available tools to match you to suitable jobs.',
        type: 'success' as const
      }
    ]
  },
  csvDataUpload: {
    workflow: 'csv-upload',
    steps: [
      {
        id: 'file-selection',
        title: 'File Selection',
        content: 'Select a CSV file containing job data. The file must have specific headers: Name, Address, Post code, Project Type, and Build Phase.',
        type: 'info' as const
      },
      {
        id: 'file-validation',
        title: 'File Validation',
        content: 'The system validates your CSV format and checks for required data fields before processing.',
        type: 'help' as const
      },
      {
        id: 'data-processing',
        title: 'Data Processing',
        content: 'CSV data is extracted and jobs are created automatically. Only authentic CSV data is used - no assumptions made.',
        type: 'warning' as const
      },
      {
        id: 'job-creation',
        title: 'Job Creation',
        content: 'Successfully processed CSV data creates jobs that can be assigned to contractors.',
        type: 'success' as const
      }
    ]
  },
  jobAssignment: {
    workflow: 'job-assignment',
    steps: [
      {
        id: 'job-selection',
        title: 'Job Selection',
        content: 'Choose a pending job from the list. Jobs come from CSV uploads and contain authentic project data.',
        type: 'info' as const
      },
      {
        id: 'contractor-selection',
        title: 'Contractor Selection',
        content: 'Select an available contractor based on their skills and current workload.',
        type: 'help' as const
      },
      {
        id: 'due-date',
        title: 'Due Date',
        content: 'Set a realistic completion date based on project scope and contractor availability.',
        type: 'warning' as const
      },
      {
        id: 'special-notes',
        title: 'Special Instructions',
        content: 'Add any specific requirements, safety notes, or special instructions for the contractor.',
        type: 'info' as const
      },
      {
        id: 'assignment-confirmation',
        title: 'Assignment Confirmation',
        content: 'Review all details before confirming. The contractor will be notified via Telegram if configured.',
        type: 'success' as const
      }
    ]
  },
  gpsTimeTracking: {
    workflow: 'gps-tracking',
    steps: [
      {
        id: 'location-verification',
        title: 'Location Verification',
        content: 'GPS coordinates are checked to ensure you are within 1km of the assigned work site.',
        type: 'warning' as const
      },
      {
        id: 'working-hours',
        title: 'Working Hours',
        content: 'Clock-in is only allowed between 7:45 AM - 5:00 PM. Automatic logout occurs at 5:00 PM sharp.',
        type: 'help' as const
      },
      {
        id: 'time-tracking',
        title: 'Time Tracking',
        content: 'Your work session is automatically tracked with GPS coordinates stored for verification.',
        type: 'info' as const
      },
      {
        id: 'pay-calculation',
        title: 'Pay Calculation',
        content: 'Daily pay (£150) with deductions for late arrivals after 8:15 AM (£0.50/minute). 20% CIS deduction applied.',
        type: 'success' as const
      }
    ]
  }
};