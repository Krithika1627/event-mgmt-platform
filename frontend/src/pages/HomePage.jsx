import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { isAuthenticated, isOrganizer } = useAuth();

  return (
    <div className="page-container">
      <section className="hero">
        <h1>EventHub</h1>
        <p className="hero-subtitle">
          Discover events, connect with your community, and manage registrations seamlessly.
        </p>
        <div className="hero-actions">
          <Link to="/events" className="btn btn-primary">Browse Events</Link>
          {!isAuthenticated && (
            <Link to="/register" className="btn btn-outline">Get Started</Link>
          )}
          {isAuthenticated && isOrganizer && (
            <Link to="/organizer/dashboard" className="btn btn-outline">Dashboard</Link>
          )}
        </div>
      </section>
    </div>
  );
}
