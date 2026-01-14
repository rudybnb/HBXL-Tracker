// Shared location tracking system for real-time GPS monitoring
export interface ContractorLocation {
  latitude: number;
  longitude: number;
  lastUpdate: Date;
}

// In-memory store for real-time contractor locations
export const contractorLocations = new Map<string, ContractorLocation>();

// Update contractor's current location
export function updateContractorLocation(contractorName: string, latitude: number, longitude: number): void {
  contractorLocations.set(contractorName, {
    latitude,
    longitude,
    lastUpdate: new Date()
  });
  console.log(`📍 Location updated for ${contractorName}: ${latitude}, ${longitude}`);
}

// Get contractor's current location
export function getContractorLocation(contractorName: string): ContractorLocation | undefined {
  return contractorLocations.get(contractorName);
}

// Get all active contractor locations
export function getAllContractorLocations(): Map<string, ContractorLocation> {
  return contractorLocations;
}

// Remove contractor location (when they log out)
export function removeContractorLocation(contractorName: string): void {
  contractorLocations.delete(contractorName);
  console.log(`🗑️ Location tracking removed for ${contractorName}`);
}