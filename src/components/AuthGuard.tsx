import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, UserRole } from "@/context/AuthContext";

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export const AuthGuard = ({ children, allowedRoles }: AuthGuardProps) => {
  const { isAuthenticated, isApproved, user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated || !isApproved || !user || !allowedRoles.includes(user.user_role)) {
    // Redirect to home or a forbidden page if not authorized
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};