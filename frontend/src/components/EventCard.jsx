import { Link } from 'react-router-dom';

export default function EventCard({ event }) {
  const remaining = Math.max(0, (event.capacity || 0) - (event.registrationCount || 0));
  const date = new Date(event.startDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div className="event-card">
      <div className="event-card-header">
        <span className="event-category">{event.category}</span>
        <span className={`event-status status-${event.status?.toLowerCase()}`}>
          {event.status}
        </span>
      </div>
      <h3 className="event-card-title">{event.title}</h3>
      <p className="event-card-date">{date}</p>
      <p className="event-card-location">{event.location}</p>
      <p className="event-card-seats">
        {remaining > 0 ? `${remaining} seat${remaining !== 1 ? 's' : ''} remaining` : 'Event Full'}
      </p>
      <Link to={`/events/${event.id}`} className="btn btn-primary btn-sm">
        View Details
      </Link>
    </div>
  );
}
