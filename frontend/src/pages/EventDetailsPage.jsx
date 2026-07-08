import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEventById } from '../api/events.api';
import { registerForEvent, cancelRegistration, getMyRegistrations } from '../api/registrations.api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function EventDetailsPage() {
  const { id } = useParams();
  const { user, isAuthenticated, isAttendee } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registration, setRegistration] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      getEventById(id),
      isAuthenticated && isAttendee ? getMyRegistrations() : Promise.resolve({ data: [] })
    ])
      .then(([eventRes, regRes]) => {
        setEvent(eventRes.data);
        if (regRes?.data) {
          const reg = regRes.data.find((r) => r.eventId === id && r.status === 'REGISTERED');
          setRegistration(reg || null);
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) setError('Event not found.');
        else setError('Failed to load event details.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleRegister = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const res = await registerForEvent(id);
      setRegistration(res.data);
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Registration failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your registration?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      await cancelRegistration(id);
      setRegistration(null);
    } catch (err) {
      setActionError(err.response?.data?.error?.message || 'Cancellation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="page-container"><ErrorMessage message={error} /></div>;
  if (!event) return <div className="page-container"><ErrorMessage message="Event not found." /></div>;

  const remaining = Math.max(0, event.capacity - event.registrationCount);
  const deadlinePassed = event.registrationDeadline && new Date() > new Date(event.registrationDeadline);
  const eventStarted = event.startDate && new Date() > new Date(event.startDate);
  const isFull = remaining === 0;

  const renderRegisterButton = () => {
    if (!isAuthenticated) {
      return <Link to="/login" className="btn btn-primary">Login to Register</Link>;
    }
    if (!isAttendee) return null;
    if (event.status === 'CANCELLED') return <button className="btn btn-disabled" disabled>Cancelled</button>;
    if (event.status !== 'PUBLISHED') return <button className="btn btn-disabled" disabled>Not Available</button>;
    if (eventStarted) return <button className="btn btn-disabled" disabled>Event Started</button>;
    if (deadlinePassed) return <button className="btn btn-disabled" disabled>Registration Closed</button>;
    if (isFull) return <button className="btn btn-disabled" disabled>Event Full</button>;
    if (registration) {
      return (
        <div className="registration-actions">
          <span className="badge badge-success">Already Registered</span>
          <button onClick={handleCancel} className="btn btn-danger btn-sm" disabled={actionLoading}>
            {actionLoading ? 'Cancelling...' : 'Cancel Registration'}
          </button>
        </div>
      );
    }
    return (
      <button onClick={handleRegister} className="btn btn-primary" disabled={actionLoading}>
        {actionLoading ? 'Registering...' : 'Register'}
      </button>
    );
  };

  return (
    <div className="page-container">
      <div className="event-detail">
        <div className="event-detail-header">
          <span className="event-category">{event.category}</span>
          <span className={`event-status status-${event.status?.toLowerCase()}`}>{event.status}</span>
        </div>
        <h1>{event.title}</h1>
        <p className="event-detail-desc">{event.description}</p>

        <div className="event-detail-info">
          <div className="info-row"><strong>Location:</strong> {event.location}</div>
          <div className="info-row">
            <strong>Date:</strong> {new Date(event.startDate).toLocaleString()} — {new Date(event.endDate).toLocaleString()}
          </div>
          <div className="info-row">
            <strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}
          </div>
          <div className="info-row">
            <strong>Capacity:</strong> {event.registrationCount} / {event.capacity} registered
            ({remaining > 0 ? `${remaining} seat${remaining !== 1 ? 's' : ''} left` : 'Full'})
          </div>
          {event.materialUrls?.length > 0 && (
            <div className="info-row">
              <strong>Materials:</strong>
              <ul>{event.materialUrls.map((url, i) => <li key={i}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul>
            </div>
          )}
        </div>

        <ErrorMessage message={actionError} />
        <div className="event-detail-actions">{renderRegisterButton()}</div>
      </div>
    </div>
  );
}
