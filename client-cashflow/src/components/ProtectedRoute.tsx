import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "contractor";
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');

    if (!isLoggedIn) {
      window.location.href = '/login';
      return;
    }

    // Enforce role-based access if requiredRole is specified
    if (requiredRole && userRole !== requiredRole) {
      // Redirect to appropriate dashboard based on user's actual role
      if (userRole === 'admin') {
        window.location.href = '/admin';
      } else if (userRole === 'contractor') {
        window.location.href = '/';
      } else {
        window.location.href = '/login';
      }
      return;
    }
  }, [requiredRole]);

  return <>{children}</>;
}