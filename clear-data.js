// Clear all localStorage data
localStorage.clear();
sessionStorage.clear();

// Clear any cached data
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
    }
  });
}

console.log('✅ All client data cleared');