/**
 * Task Progress Manager - Database-backed task progress with localStorage fallback
 * Follows mandatory rules: preserves data integrity, prevents loss, authentic CSV data only
 */

export interface TaskProgressData {
  id: string;
  title: string;
  description: string;
  area: string;
  totalItems: number;
  completedItems: number;
  status: "not started" | "in progress" | "completed";
  taskId?: string;
  completed?: boolean;
}

export class TaskProgressManager {
  private contractorName: string;
  private assignmentId: string;
  private storageKey: string;

  constructor(contractorName: string, assignmentId: string) {
    this.contractorName = contractorName;
    this.assignmentId = assignmentId;
    this.storageKey = `task_progress_${assignmentId}`;
  }

  /**
   * Load task progress from database with localStorage fallback
   */
  async loadTaskProgress(): Promise<TaskProgressData[]> {
    console.log('📁 Loading task progress...');
    
    // Try localStorage first for immediate response
    const localData = this.getFromLocalStorage();
    if (localData.length > 0) {
      console.log('📱 Found localStorage data, syncing with database...');
      // Sync with database in background
      this.syncWithDatabase(localData);
      return localData;
    }

    // If no localStorage, try database
    try {
      const response = await fetch(`/api/task-progress/${encodeURIComponent(this.contractorName)}/${this.assignmentId}`);
      if (response.ok) {
        const dbData = await response.json();
        if (dbData.length > 0) {
          console.log(`📦 Restored ${dbData.length} tasks from database`);
          const convertedTasks = this.convertDbToTaskFormat(dbData);
          this.saveToLocalStorage(convertedTasks);
          return convertedTasks;
        }
      }
    } catch (error) {
      console.error('❌ Database load failed:', error);
    }

    return [];
  }

  /**
   * Save task progress to both localStorage and database
   */
  async saveTaskProgress(tasks: TaskProgressData[]): Promise<void> {
    // Save to localStorage immediately
    this.saveToLocalStorage(tasks);
    
    // Save to database for persistence
    await this.syncWithDatabase(tasks);
  }

  /**
   * Update individual task progress
   */
  async updateTaskCompletion(taskId: string, completed: boolean): Promise<void> {
    try {
      const response = await fetch('/api/task-progress/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorName: this.contractorName,
          assignmentId: this.assignmentId,
          taskId,
          completed
        })
      });

      if (response.ok) {
        console.log(`✅ Task ${taskId} saved to database: ${completed ? 'completed' : 'incomplete'}`);
      } else {
        console.error('❌ Failed to save task to database');
      }
    } catch (error) {
      console.error('❌ Database save failed:', error);
    }
  }

  /**
   * Create tasks from authentic CSV data
   */
  createTasksFromCSVData(csvPhases: string[]): TaskProgressData[] {
    const tasks: TaskProgressData[] = [];
    
    csvPhases.forEach((phase: string, phaseIndex: number) => {
      const cleanPhase = phase.replace(/,+$/, '').trim();
      const items = cleanPhase.split(',').map(item => item.trim()).filter(item => item);
      
      items.forEach((item, itemIndex) => {
        if (item && item !== '') {
          const taskId = `phase-${phaseIndex}-item-${itemIndex}`;
          tasks.push({
            id: taskId,
            title: item,
            description: `${item} - Phase ${phaseIndex + 1}`,
            area: `Phase ${phaseIndex + 1}`,
            totalItems: 1,
            completedItems: 0,
            status: "not started",
            taskId: taskId,
            completed: false
          });
        }
      });
    });

    console.log(`📊 Created ${tasks.length} tasks from authentic CSV data`);
    return tasks;
  }

  /**
   * Merge saved progress with fresh CSV tasks
   */
  mergeProgressWithTasks(newTasks: TaskProgressData[], savedTasks: TaskProgressData[]): TaskProgressData[] {
    return newTasks.map(task => {
      const savedTask = savedTasks.find(saved => 
        saved.id === task.id || saved.title === task.title
      );
      
      if (savedTask) {
        return {
          ...task,
          completedItems: savedTask.completedItems,
          status: savedTask.status,
          completed: savedTask.completed
        };
      }
      
      return task;
    });
  }

  // Private methods
  private getFromLocalStorage(): TaskProgressData[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ LocalStorage read failed:', error);
      return [];
    }
  }

  private saveToLocalStorage(tasks: TaskProgressData[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tasks));
      console.log(`💾 Saved ${tasks.length} tasks to localStorage`);
    } catch (error) {
      console.error('❌ LocalStorage save failed:', error);
    }
  }

  private async syncWithDatabase(tasks: TaskProgressData[]): Promise<void> {
    for (const task of tasks) {
      if (task.taskId) {
        await this.updateTaskCompletion(task.taskId, task.status === 'completed');
      }
    }
  }

  private convertDbToTaskFormat(dbTasks: any[]): TaskProgressData[] {
    return dbTasks.map(dbTask => ({
      id: dbTask.taskId,
      title: dbTask.taskDescription,
      description: `${dbTask.taskDescription} - ${dbTask.phase}`,
      area: dbTask.phase,
      totalItems: 1,
      completedItems: dbTask.completed ? 1 : 0,
      status: dbTask.completed ? "completed" as const : "not started" as const,
      taskId: dbTask.taskId,
      completed: dbTask.completed
    }));
  }
}