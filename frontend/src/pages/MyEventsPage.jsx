import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyRegistrations, cancelRegistration } from '../api/registrations.api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function MyEventsPage() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const fetchRegs = () => {
    setLoading(true);
    setError('');
    getMyRegistrations()
      .then((res) => setRegistrations(res.data || []))
      .catch(() => setError('Failed to load your registrations.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRegs(); }, []);

  const handleCancel = async (eventId) => {
    if (!window.confirm('Cancel your registration for this event?')) return;
    setCancelling(eventId);
    try {
      await cancelRegistration(eventId);
      setRegistrations((prev) => prev.filter((r) => r.eventId !== eventId));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Cancellation failed.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1>My Events</h1>
      <ErrorMessage message={error} onRetry={fetchRegs} />

      {!loading && registrations.length === 0 && (
        <div className="empty-state">
          <p>You are not registered for any events.</p>
          <Link to="/events" className="btn btn-primary">Browse Events</Link>
        </div>
      )}

      <div className="registration-list">
        {registrations.map((reg) => (
          <div key={reg.registrationId} className="registration-card">
            {reg.event ? (
              <>
                <h3>
                  <Link to={`/events/${reg.eventId}`}>{reg.event.title}</Link>
                </h3>
                <p className="text-muted">{reg.event.location} — {new Date(reg.event.startDate).toLocaleDateString()}</p>
                <p className="text-muted">Status: {reg.attendanceStatus}</p>
              </>
            ) : (
              <p className="text-muted">Event details unavailable (may have been removed).</p>
            )}
            <button
              onClick={() => handleCancel(reg.eventId)}
              className="btn btn-danger btn-sm"
              disabled={cancelling === reg.eventId}
            >
              {cancelling === reg.eventId ? 'Cancelling...' : 'Cancel Registration'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
