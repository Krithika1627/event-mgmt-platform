import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import EventDetailsPage from './pages/EventDetailsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyEventsPage from './pages/MyEventsPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateEventPage from './pages/CreateEventPage';
import EditEventPage from './pages/EditEventPage';
import ManageEventPage from './pages/ManageEventPage';
import AttendeeListPage from './pages/AttendeeListPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Attendee routes */}
            <Route
              path="/my-events"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={['ATTENDEE']}>
                    <MyEventsPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Organizer routes */}
            <Route
              path="/organizer/dashboard"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={['ORGANIZER']}>
                    <OrganizerDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/create"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={['ORGANIZER']}>
                    <CreateEventPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/:id/edit"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={['ORGANIZER']}>
                    <EditEventPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/:id/manage"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={['ORGANIZER']}>
                    <ManageEventPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/events/:id/attendees"
              element={
                <ProtectedRoute>
                  <RoleRoute allowedRoles={['ORGANIZER']}>
                    <AttendeeListPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route
              path="*"
              element={
                <div className="page-container">
                  <div className="empty-state">
                    <h2>Page Not Found</h2>
                    <p>The page you're looking for doesn't exist.</p>
                    <a href="/" className="btn btn-primary">Go Home</a>
                  </div>
                </div>
              }
            />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
