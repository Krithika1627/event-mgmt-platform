import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getOrganizerEvents, cancelEvent } from '../api/events.api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchEvents = () => {
    setLoading(true);
    setError('');
    getOrganizerEvents()
      .then((res) => setEvents(res.data || []))
      .catch(() => setError('Failed to load your events.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this event? This cannot be undone.')) return;
    try {
      await cancelEvent(id);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'CANCELLED' } : e)));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to cancel event.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <h1>My Events</h1>
        <div className="dashboard-header-actions">
          <Link to="/organizer/analytics" className="btn btn-outline">Analytics</Link>
          <Link to="/events/create" className="btn btn-primary">Create Event</Link>
        </div>
      </div>
      <ErrorMessage message={error} onRetry={fetchEvents} />

      {!loading && events.length === 0 && (
        <div className="empty-state">
          <p>You haven't created any events yet.</p>
          <Link to="/events/create" className="btn btn-primary">Create Your First Event</Link>
        </div>
      )}

      <div className="event-table-wrapper">
        <table className="event-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Registrations</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td><span className={`event-status status-${event.status?.toLowerCase()}`}>{event.status}</span></td>
                <td>{event.registrationCount} / {event.capacity}</td>
                <td>{new Date(event.startDate).toLocaleDateString()}</td>
                <td className="actions-cell">
                  {(event.status === 'DRAFT' || event.status === 'PUBLISHED') && (
                    <>
                      <button onClick={() => navigate(`/events/${event.id}/edit`)} className="btn btn-sm btn-outline">Edit</button>
                      <button onClick={() => navigate(`/events/${event.id}/manage`)} className="btn btn-sm btn-outline">Manage</button>
                      {event.status === 'DRAFT' && (
                        <button onClick={() => navigate(`/events/${event.id}/edit?publish=true`)} className="btn btn-sm btn-primary">Publish</button>
                      )}
                      <button onClick={() => handleCancel(event.id)} className="btn btn-sm btn-danger">Cancel</button>
                    </>
                  )}
                  {(event.status === 'CANCELLED' || event.status === 'COMPLETED') && (
                    <span className="text-muted">Read-only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
