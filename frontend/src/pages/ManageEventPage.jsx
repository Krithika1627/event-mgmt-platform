import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEventById } from '../api/events.api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function ManageEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getEventById(id)
      .then((res) => setEvent(res.data))
      .catch((err) => {
        if (err.response?.status === 403) {
          setError('You do not have permission to manage this event.');
        } else if (err.response?.status === 404) {
          setError('Event not found.');
        } else {
          setError('Failed to load event.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="page-container"><ErrorMessage message={error} /></div>;
  if (!event) return <div className="page-container"><ErrorMessage message="Event not found." /></div>;

  const remaining = Math.max(0, event.capacity - event.registrationCount);

  return (
    <div className="page-container">
      <h1>Manage Event</h1>
      <div className="manage-card">
        <h2>{event.title}</h2>
        <div className="manage-stats">
          <div className="stat-box">
            <strong>Status</strong>
            <span className={`event-status status-${event.status?.toLowerCase()}`}>{event.status}</span>
          </div>
          <div className="stat-box">
            <strong>Registrations</strong>
            <span>{event.registrationCount} / {event.capacity}</span>
          </div>
          <div className="stat-box">
            <strong>Available Seats</strong>
            <span>{remaining}</span>
          </div>
          <div className="stat-box">
            <strong>Location</strong>
            <span>{event.location}</span>
          </div>
        </div>
        <div className="manage-actions">
          <button onClick={() => navigate(`/events/${id}/edit`)} className="btn btn-outline">Edit Event</button>
          <button onClick={() => navigate(`/events/${id}/attendees`)} className="btn btn-primary">
            View Attendees ({event.registrationCount})
          </button>
        </div>
      </div>
    </div>
  );
}
