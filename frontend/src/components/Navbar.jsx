import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, isAuthenticated, isOrganizer, isAttendee, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">EventHub</Link>
        <button className="navbar-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/events" className="nav-link" onClick={() => setMenuOpen(false)}>
            Events
          </Link>
          {isAuthenticated && isAttendee && (
            <Link to="/my-events" className="nav-link" onClick={() => setMenuOpen(false)}>
              My Events
            </Link>
          )}
          {isAuthenticated && isOrganizer && (
            <>
              <Link to="/organizer/dashboard" className="nav-link" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              <Link to="/events/create" className="nav-link" onClick={() => setMenuOpen(false)}>
                Create Event
              </Link>
            </>
          )}
          <div className="nav-right">
            {isAuthenticated ? (
              <>
                <span className="nav-user">{user?.name}</span>
                <button onClick={handleLogout} className="btn btn-outline btn-sm">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
