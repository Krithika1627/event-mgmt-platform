import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getEventAttendees, markAttendance } from '../api/registrations.api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const STATUS_OPTIONS = ['NOT_MARKED', 'PRESENT', 'ABSENT'];

export default function AttendeeListPage() {
  const { id } = useParams();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);

  const fetchAttendees = () => {
    setLoading(true);
    setError('');
    getEventAttendees(id)
      .then((res) => setAttendees(res.data || []))
      .catch((err) => {
        if (err.response?.status === 403) setError('You do not own this event.');
        else if (err.response?.status === 404) setError('Event not found.');
        else setError('Failed to load attendees.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAttendees(); }, [id]);

  const handleAttendance = async (registrationId, status) => {
    setUpdating(registrationId);
    try {
      await markAttendance(id, registrationId, status);
      setAttendees((prev) =>
        prev.map((a) =>
          a.registrationId === registrationId ? { ...a, attendanceStatus: status } : a
        )
      );
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update attendance.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <h1>Attendees</h1>
      <ErrorMessage message={error} onRetry={fetchAttendees} />

      {!loading && attendees.length === 0 && (
        <div className="empty-state">
          <p>No attendees registered for this event yet.</p>
        </div>
      )}

      <div className="attendee-table-wrapper">
        <table className="attendee-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Registration</th>
              <th>Attendance</th>
              <th>Registered At</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((a) => (
              <tr key={a.registrationId}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>
                  <span className={`event-status status-${a.registrationStatus?.toLowerCase()}`}>
                    {a.registrationStatus}
                  </span>
                </td>
                <td>
                  <div className="attendance-controls">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        className={`btn btn-xs ${a.attendanceStatus === opt ? 'btn-primary' : 'btn-outline'}`}
                        disabled={updating === a.registrationId}
                        onClick={() => handleAttendance(a.registrationId, opt)}
                      >
                        {opt === 'NOT_MARKED' ? 'Pending' : opt.charAt(0) + opt.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </td>
                <td>{new Date(a.registeredAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
