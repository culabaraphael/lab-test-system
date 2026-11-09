import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap a route element with this to require login, and optionally restrict
 * it to specific roles.
 *
 * Usage:
 *   <Route path="/medtech/dashboard" element={
 *     <ProtectedRoute allowedRoles={["Medical Technologist"]}>
 *       <MedTechDashboard />
 *     </ProtectedRoute>
 *   } />
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
