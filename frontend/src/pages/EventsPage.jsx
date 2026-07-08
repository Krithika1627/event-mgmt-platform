import { useState, useEffect } from 'react';
import { getPublishedEvents } from '../api/events.api';
import EventCard from '../components/EventCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', category: '', location: '', upcoming: false });

  const fetchEvents = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.location) params.location = filters.location;
    if (filters.upcoming) params.upcoming = 'true';

    getPublishedEvents(params)
      .then((res) => setEvents(res.data || []))
      .catch(() => setError('Failed to load events. Please try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, []);

  const update = (field) => (e) => setFilters({ ...filters, [field]: e.target.value });
  const handleUpcoming = (e) => setFilters({ ...filters, upcoming: e.target.checked });

  return (
    <div className="page-container">
      <h1>Events</h1>
      <div className="filters">
        <input
          type="text"
          placeholder="Search events..."
          value={filters.search}
          onChange={update('search')}
          className="filter-input"
        />
        <input
          type="text"
          placeholder="Location"
          value={filters.location}
          onChange={update('location')}
          className="filter-input"
        />
        <select value={filters.category} onChange={update('category')} className="filter-input">
          <option value="">All Categories</option>
          <option value="CONFERENCE">Conference</option>
          <option value="WORKSHOP">Workshop</option>
          <option value="MEETUP">Meetup</option>
          <option value="NETWORKING">Networking</option>
          <option value="SEMINAR">Seminar</option>
          <option value="CONCERT">Concert</option>
          <option value="SPORTS">Sports</option>
          <option value="OTHER">Other</option>
        </select>
        <label className="filter-checkbox">
          <input type="checkbox" checked={filters.upcoming} onChange={handleUpcoming} />
          Upcoming only
        </label>
        <button onClick={fetchEvents} className="btn btn-primary btn-sm">Search</button>
      </div>

      {loading && <LoadingSpinner />}
      <ErrorMessage message={error} onRetry={fetchEvents} />

      {!loading && !error && events.length === 0 && (
        <div className="empty-state">
          <p>No events found. Try adjusting your filters.</p>
        </div>
      )}

      <div className="event-grid">
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
    </div>
  );
}
