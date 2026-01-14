// System cleanup utilities to remove all temporary test data and caches

export class SystemCleanup {
  /**
   * Clear all localStorage data
   */
  static clearLocalStorage(): void {
    try {
      // Clear specific app data
      const keysToRemove = [
        'uploadedJobs',
        'processedCSVs',
        'createdJobs',
        'csvFiles',
        'jobAssignments',
        'contractorData',
        'tempData',
        'debugLogs',
        'formData',
        'userPreferences',
        'timeTracking',
        'gpsData'
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log('✓ LocalStorage cleared');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  /**
   * Clear all sessionStorage data
   */
  static clearSessionStorage(): void {
    try {
      sessionStorage.clear();
      console.log('✓ SessionStorage cleared');
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  }

  /**
   * Clear browser cache and temporary data
   */
  static clearBrowserCache(): void {
    try {
      // Clear any cached data
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      console.log('✓ Browser cache cleared');
    } catch (error) {
      console.error('Error clearing browser cache:', error);
    }
  }

  /**
   * Reset form states and component data
   */
  static resetComponentStates(): void {
    try {
      // Reset any global state that might be cached
      window.dispatchEvent(new Event('app-reset'));
      console.log('✓ Component states reset');
    } catch (error) {
      console.error('Error resetting component states:', error);
    }
  }

  /**
   * Complete system cleanup
   */
  static performFullCleanup(): void {
    console.log('🧹 Starting system cleanup...');
    
    this.clearLocalStorage();
    this.clearSessionStorage();
    this.clearBrowserCache();
    this.resetComponentStates();
    
    console.log('✅ System cleanup completed');
    
    // Optional: Reload page to ensure clean state
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  /**
   * Check for any remaining temporary data
   */
  static checkForRemainingData(): { localStorage: string[], sessionStorage: string[] } {
    const localStorageKeys = Object.keys(localStorage);
    const sessionStorageKeys = Object.keys(sessionStorage);
    
    console.log('LocalStorage keys:', localStorageKeys);
    console.log('SessionStorage keys:', sessionStorageKeys);
    
    return {
      localStorage: localStorageKeys,
      sessionStorage: sessionStorageKeys
    };
  }
}

// Auto-cleanup on page unload to prevent data accumulation
window.addEventListener('beforeunload', () => {
  SystemCleanup.clearSessionStorage();
});