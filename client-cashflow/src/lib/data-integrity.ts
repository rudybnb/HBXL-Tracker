/**
 * Data Integrity Service
 * Ensures all data comes from authentic sources and prevents static/mock data
 */

export class DataIntegrityService {
  private static instance: DataIntegrityService;
  
  static getInstance(): DataIntegrityService {
    if (!DataIntegrityService.instance) {
      DataIntegrityService.instance = new DataIntegrityService();
    }
    return DataIntegrityService.instance;
  }

  /**
   * Clear all potentially stale localStorage data on app initialization
   */
  clearStaleData(): void {
    const keysToRemove = [
      'task_progress_default',
      'task_progress_DA17 5DB', 
      'task_progress_ME5 9GX',
      'gps_timer_current',
      'gps_timer_active',
      'gps_timer_start'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear all task progress keys that might contain static data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('task_progress_') && !key.includes('c2d5a575')) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('🧹 Cleared all stale data from localStorage');
  }

  /**
   * Validate that assignment data is from database, not static
   */
  validateAssignmentData(assignment: any): boolean {
    if (!assignment) return false;
    
    // Must have database-generated ID
    if (!assignment.id || assignment.id.length < 10) {
      console.error('❌ Invalid assignment: missing database ID');
      return false;
    }

    // Must have required fields from database
    const requiredFields = ['contractorName', 'hbxlJob', 'buildPhases', 'workLocation'];
    for (const field of requiredFields) {
      if (!assignment[field]) {
        console.error(`❌ Invalid assignment: missing ${field}`);
        return false;
      }
    }

    // Reject known static data patterns
    const staticPhases = ['Masonry Shell', 'Foundation', 'Block Work', 'Garden Layout'];
    if (assignment.buildPhases?.some((phase: string) => 
      staticPhases.some(staticPhase => phase.includes(staticPhase)))) {
      console.error('❌ Detected static phase data - rejecting');
      return false;
    }

    return true;
  }

  /**
   * Validate task data comes from authentic assignment
   */
  validateTaskData(tasks: any[], assignmentId?: string): boolean {
    if (!tasks.length) return true; // Empty is fine
    
    // If we have an assignment ID, tasks must be derived from it
    if (assignmentId) {
      const storageKey = `task_progress_${assignmentId}`;
      const validKey = localStorage.getItem(storageKey);
      if (!validKey && tasks.length > 0) {
        console.error('❌ Tasks exist without valid assignment source');
        return false;
      }
    }

    // Check for static task patterns
    const staticTitles = ['Masonry Shell', 'Foundation', 'Block Work', 'Garden Layout', 'Landscaping'];
    const hasStaticData = tasks.some(task => 
      staticTitles.some(staticTitle => task.title?.includes(staticTitle))
    );

    if (hasStaticData) {
      console.error('❌ Detected static task data - clearing');
      return false;
    }

    return true;
  }

  /**
   * Force data refresh from authentic sources
   */
  forceDataRefresh(): void {
    // Clear all localStorage
    localStorage.clear();
    
    // Force page reload to get fresh data
    window.location.reload();
  }
}

export const dataIntegrity = DataIntegrityService.getInstance();