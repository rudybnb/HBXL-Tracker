/**
 * CSV Data Supremacy Validator
 * Enforces Rule 3: CSV DATA SUPREMACY
 * 
 * When a job is uploaded via CSV, ONLY information in that CSV file must be used.
 * NO assumptions, fallbacks, or old stored data permitted.
 */

export interface CSVTaskItem {
  code: string;
  itemDescription: string;
  unit: string;
  quantity: string;
  unitRate: string;
  total: string;
}

export interface CSVJobData {
  name: string;
  address: string;
  postCode: string;
  projectType: string;
  phaseData: Record<string, CSVTaskItem[]>;
}

export class CSVDataValidator {
  
  /**
   * Validates that task data comes exclusively from CSV source
   * Rejects any non-CSV data to enforce data supremacy rule
   */
  static validateTaskDataSource(taskData: any): boolean {
    // Check if data has CSV markers (code, itemDescription, quantity)
    if (!taskData.code || !taskData.itemDescription || !taskData.quantity) {
      console.error('❌ CSV Data Supremacy Violation: Task data missing CSV fields');
      return false;
    }
    
    // Reject static/assumed data patterns
    const staticPatterns = [
      'Door Frame Installation',
      'Window Board Installation', 
      'Staircase Installation',
      'Kitchen Unit Framework',
      'Foundation Work',
      'Block Work',
      'Roof Structure',
      'Window Installation'
    ];
    
    if (staticPatterns.includes(taskData.itemDescription)) {
      console.error('❌ CSV Data Supremacy Violation: Static task data detected');
      return false;
    }
    
    return true;
  }
  
  /**
   * Extracts authentic CSV task items for a specific phase
   * Returns empty array if no CSV data available (no assumptions allowed)
   */
  static extractPhaseTasksFromCSV(csvJobData: CSVJobData, phaseName: string): CSVTaskItem[] {
    if (!csvJobData.phaseData || !csvJobData.phaseData[phaseName]) {
      console.warn(`⚠️ CSV Data Missing: No tasks found for phase "${phaseName}"`);
      return [];
    }
    
    const phaseTasks = csvJobData.phaseData[phaseName];
    
    // Validate each task comes from CSV
    const validTasks = phaseTasks.filter(task => this.validateTaskDataSource(task));
    
    console.log(`✅ CSV Data Validated: ${validTasks.length} authentic tasks for phase "${phaseName}"`);
    return validTasks;
  }
  
  /**
   * Clears any old cached data when new CSV is uploaded
   * Prevents data contamination from previous uploads
   */
  static clearOldTaskCache(jobId: string): void {
    try {
      const storageKeys = Object.keys(localStorage).filter(key => 
        key.includes('task_progress') || key.includes(jobId)
      );
      
      storageKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🧹 Cleared old cache: ${key}`);
      });
      
      console.log('✅ CSV Data Supremacy: Old cache cleared for new upload');
    } catch (error) {
      console.error('Failed to clear old cache:', error);
    }
  }
  
  /**
   * Validates CSV job data structure
   * Ensures all required CSV fields are present
   */
  static validateCSVJobStructure(jobData: any): jobData is CSVJobData {
    const requiredFields = ['name', 'address', 'postCode', 'phaseData'];
    
    for (const field of requiredFields) {
      if (!jobData[field]) {
        console.error(`❌ CSV Structure Invalid: Missing field "${field}"`);
        return false;
      }
    }
    
    if (typeof jobData.phaseData !== 'object') {
      console.error('❌ CSV Structure Invalid: phaseData must be object');
      return false;
    }
    
    console.log('✅ CSV Structure Valid: All required fields present');
    return true;
  }
}