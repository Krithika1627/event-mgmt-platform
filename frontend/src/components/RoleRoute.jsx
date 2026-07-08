import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function RoleRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="page-container">
        <div className="error-message">
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return children;
}
