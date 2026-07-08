import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getEventById, updateEvent, publishEvent } from '../api/events.api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const CATEGORIES = ['CONFERENCE', 'WORKSHOP', 'MEETUP', 'NETWORKING', 'SEMINAR', 'CONCERT', 'SPORTS', 'OTHER'];

export default function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldPublishOnLoad = searchParams.get('publish') === 'true';

  const [form, setForm] = useState({
    title: '', description: '', category: '', location: '',
    startDate: '', endDate: '', registrationDeadline: '', capacity: ''
  });
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEventById(id)
      .then((res) => {
        const e = res.data;
        setEvent(e);
        setForm({
          title: e.title || '',
          description: e.description || '',
          category: e.category || '',
          location: e.location || '',
          startDate: e.startDate ? e.startDate.slice(0, 16) : '',
          endDate: e.endDate ? e.endDate.slice(0, 16) : '',
          registrationDeadline: e.registrationDeadline ? e.registrationDeadline.slice(0, 16) : '',
          capacity: e.capacity?.toString() || ''
        });
      })
      .catch(() => setError('Failed to load event.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && event && shouldPublishOnLoad && event.status === 'DRAFT') {
      handlePublish().catch(console.error);
    }
  }, [loading]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateEvent(id, form);
      navigate('/organizer/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update event.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setError('');
    setSaving(true);
    try {
      await publishEvent(id);
      navigate('/organizer/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to publish event.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return <div className="page-container"><ErrorMessage message="Event not found." /></div>;

  const isReadOnly = event.status === 'CANCELLED' || event.status === 'COMPLETED';

  if (isReadOnly) {
    return (
      <div className="page-container">
        <div className="form-card">
          <h1>Edit Event</h1>
          <div className="error-message">
            <p>This event is {event.status.toLowerCase()} and cannot be edited.</p>
          </div>
          <button onClick={() => navigate('/organizer/dashboard')} className="btn btn-primary">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="form-card">
        <h1>Edit Event</h1>
        <ErrorMessage message={error} />
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={update('title')} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={update('description')} rows={4} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={update('category')}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={update('location')} />
            </div>
          </div>
          <div className="form-group">
            <label>Capacity</label>
            <input type="number" min="1" value={form.capacity} onChange={update('capacity')} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input type="datetime-local" value={form.startDate} onChange={update('startDate')} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="datetime-local" value={form.endDate} onChange={update('endDate')} />
            </div>
          </div>
          <div className="form-group">
            <label>Registration Deadline</label>
            <input type="datetime-local" value={form.registrationDeadline} onChange={update('registrationDeadline')} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-outline" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {event.status === 'DRAFT' && (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handlePublish}>
                {saving ? 'Publishing...' : 'Publish'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
