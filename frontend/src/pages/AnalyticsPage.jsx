import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { getOverview } from '../api/analytics.api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = () => {
    setLoading(true);
    setError('');
    getOverview()
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(err.response?.data?.error?.message || 'Failed to load analytics.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <h1>Analytics Overview</h1>
        <button onClick={fetchData} className="btn btn-outline btn-sm">Refresh</button>
      </div>

      <ErrorMessage message={error} onRetry={fetchData} />

      {!data ? (
        <div className="empty-state">
          <p>No analytics data available.</p>
        </div>
      ) : data.totalEvents === 0 ? (
        <div className="empty-state">
          <h2>No Events Yet</h2>
          <p>Create your first event to see analytics.</p>
          <Link to="/events/create" className="btn btn-primary">Create Event</Link>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="analytics-cards">
            <div className="analytics-card">
              <span className="analytics-card-label">Total Events</span>
              <span className="analytics-card-value">{data.totalEvents}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card-label">Total Registrations</span>
              <span className="analytics-card-value">{data.totalRegistrations}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card-label">Total Attendance</span>
              <span className="analytics-card-value">{data.totalAttendance}</span>
            </div>
            <div className="analytics-card">
              <span className="analytics-card-label">Attendance Rate</span>
              <span className="analytics-card-value">{data.averageAttendanceRate}%</span>
            </div>
            <div className="analytics-card analytics-card-accent">
              <span className="analytics-card-label">Most Popular Event</span>
              <span className="analytics-card-value analytics-card-small">
                {data.mostPopularEvent ? (
                  <Link to={`/events/${data.mostPopularEvent.eventId}`}>
                    {data.mostPopularEvent.title}
                  </Link>
                ) : '—'}
              </span>
              {data.mostPopularEvent && (
                <span className="analytics-card-sub">
                  {data.mostPopularEvent.registrationCount} registration{data.mostPopularEvent.registrationCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* No registrations yet — show guidance */}
          {data.totalEvents > 0 && data.totalRegistrations === 0 && (
            <div className="empty-state" style={{ marginBottom: '24px' }}>
              <h2>No Registrations Yet</h2>
              <p>You have events, but no attendees have registered yet. Analytics charts will appear once registrations come in.</p>
            </div>
          )}

          {/* Charts Grid */}
          <div className="analytics-charts">
            {/* Registrations Over Time */}
            {data.registrationsOverTime.length > 0 && (
              <div className="analytics-chart-card">
                <h3>Registrations Over Time</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.registrationsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="registrations"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Demographics — Age Groups */}
            {Object.keys(data.demographics.ageGroups).length > 0 && (
              <div className="analytics-chart-card">
                <h3>Age Groups</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.demographics.ageGroups).map(([name, value]) => ({ name, value }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.entries(data.demographics.ageGroups).map((_, index) => (
                        <Cell key={`age-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Demographics — Gender */}
            {Object.keys(data.demographics.genders).length > 0 && (
              <div className="analytics-chart-card">
                <h3>Gender Distribution</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.demographics.genders).map(([name, value]) => ({ name, value }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.entries(data.demographics.genders).map((_, index) => (
                        <Cell key={`gender-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Popularity Ranking */}
            {data.popularityRanking.length > 0 && (
              <div className="analytics-chart-card analytics-chart-wide">
                <h3>Popularity Ranking</h3>
                <ResponsiveContainer width="100%" height={Math.max(200, data.popularityRanking.length * 50)}>
                  <BarChart
                    data={data.popularityRanking}
                    layout="vertical"
                    margin={{ left: 120, right: 20, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="title"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    />
                    <Bar dataKey="registrationCount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
