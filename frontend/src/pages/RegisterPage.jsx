import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register as registerApi } from '../api/auth.api';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';

const AGE_GROUPS = ['UNDER_18', '18_25', '26_35', '36_50', 'ABOVE_50'];

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'ATTENDEE',
    ageGroup: '', gender: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('Name, email, and password are required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.role === 'ATTENDEE' && (!form.ageGroup || !form.gender)) {
      setError('Age group and gender are required for attendees.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerApi(form);
      login(res.data.token, res.data.user);
      navigate('/events', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="form-card">
        <h1>Register</h1>
        <ErrorMessage message={error} />
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input id="name" value={form.name} onChange={update('name')} placeholder="Your name" />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" type="password" value={form.password} onChange={update('password')} placeholder="At least 6 characters" />
          </div>
          <div className="form-group">
            <label htmlFor="role">I want to</label>
            <select id="role" value={form.role} onChange={update('role')}>
              <option value="ATTENDEE">Attend Events</option>
              <option value="ORGANIZER">Organize Events</option>
            </select>
          </div>
          {form.role === 'ATTENDEE' && (
            <>
              <div className="form-group">
                <label htmlFor="ageGroup">Age Group</label>
                <select id="ageGroup" value={form.ageGroup} onChange={update('ageGroup')}>
                  <option value="">Select age group</option>
                  {AGE_GROUPS.map((g) => <option key={g} value={g}>{g.replace(/_/g, '-')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender} onChange={update('gender')}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="form-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
