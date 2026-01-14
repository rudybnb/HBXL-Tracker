import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

export default function AccountSwitcher() {
  const [location, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState(() => {
    // Initialize based on current route
    return location.startsWith('/admin') ? "admin" : "contractor";
  });

  // Update currentUser when location changes
  useEffect(() => {
    if (location.startsWith('/admin')) {
      setCurrentUser("admin");
    } else {
      setCurrentUser("contractor");
    }
  }, [location]);

  const switchToAdmin = () => {
    setLocation("/admin");
  };

  const switchToContractor = () => {
    setLocation("/");
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-slate-800 rounded-lg p-2 border border-slate-600 shadow-lg">
      <div className="flex items-center space-x-2">
        <span className="text-yellow-400 text-sm font-medium">Account:</span>
        <div className="flex space-x-1">
          <Button
            onClick={switchToContractor}
            size="sm"
            className={`text-xs px-2 py-1 ${
              currentUser === "contractor"
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Contractor
          </Button>
          <Button
            onClick={switchToAdmin}
            size="sm"
            className={`text-xs px-2 py-1 ${
              currentUser === "admin"
                ? "bg-orange-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            Admin
          </Button>
        </div>
      </div>
    </div>
  );
}