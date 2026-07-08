import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent, publishEvent } from '../api/events.api';
import ErrorMessage from '../components/ErrorMessage';

const CATEGORIES = ['CONFERENCE', 'WORKSHOP', 'MEETUP', 'NETWORKING', 'SEMINAR', 'CONCERT', 'SPORTS', 'OTHER'];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', description: '', category: '', location: '',
    startDate: '', endDate: '', registrationDeadline: '', capacity: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e, shouldPublish) => {
    e.preventDefault();
    setError('');

    if (!form.title || !form.description || !form.category || !form.location ||
        !form.startDate || !form.endDate || !form.registrationDeadline || !form.capacity) {
      setError('All fields are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await createEvent(form);
      if (shouldPublish) {
        try {
          await publishEvent(res.data.id);
        } catch {
          navigate(`/events/${res.data.id}/edit`);
          return;
        }
      }
      navigate('/organizer/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="form-card">
        <h1>Create Event</h1>
        <ErrorMessage message={error} />
        <form onSubmit={(e) => handleSubmit(e, false)}>
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={update('title')} placeholder="Event title" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={update('description')} placeholder="Event description" rows={4} />
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
              <input value={form.location} onChange={update('location')} placeholder="City, State" />
            </div>
          </div>
          <div className="form-group">
            <label>Capacity</label>
            <input type="number" min="1" value={form.capacity} onChange={update('capacity')} placeholder="100" />
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
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={(e) => handleSubmit(e, true)}
            >
              {saving ? 'Publishing...' : 'Save & Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
