import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiClock, FiTrendingUp, FiPlus, FiAlertCircle } from 'react-icons/fi';
import { contactAPI } from '../utils/api';
import './Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({
    totalContacts: 0,
    hotFollowUps: 0,
    thisWeekFollowUps: 0,
    recentContacts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all contacts
      const contactsResult = await contactAPI.getAll({ limit: 5 });

      // Fetch follow-ups
      const followUpsResult = await contactAPI.getFollowUps('all');

      if (contactsResult.success && followUpsResult.success) {
        const hotCount = followUpsResult.follow_ups.filter(
          f => f.follow_up_priority === 'hot' && f.follow_up_status !== 'closed'
        ).length;

        const weekCount = followUpsResult.follow_ups.filter(
          f => ['today', 'this_week'].includes(f.follow_up_status)
        ).length;

        setStats({
          totalContacts: contactsResult.contacts.length,
          hotFollowUps: hotCount,
          thisWeekFollowUps: weekCount,
          recentContacts: contactsResult.contacts.slice(0, 5)
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard container">
      <div className="welcome-section">
        <h2 className="dashboard-title">Welcome to Context CRM</h2>
        <p className="dashboard-subtitle">
          Your voice-first networking companion. Never forget a connection.
        </p>
      </div>

      {/* Quick Add Button */}
      <Link to="/add-contact" className="quick-add-card card">
        <div className="quick-add-icon">
          <FiPlus size={32} />
        </div>
        <div className="quick-add-text">
          <h3>Add New Contact</h3>
          <p>Capture context while it's fresh</p>
        </div>
      </Link>

      {/* Stats Grid */}
      <div className="stats-grid">
        <Link to="/contacts" className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
            <FiUsers size={24} color="#6366f1" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalContacts}</div>
            <div className="stat-label">Total Contacts</div>
          </div>
        </Link>

        <Link to="/follow-ups" className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
            <FiAlertCircle size={24} color="#ef4444" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.hotFollowUps}</div>
            <div className="stat-label">Hot Follow-ups</div>
          </div>
        </Link>

        <Link to="/follow-ups" className="stat-card card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)' }}>
            <FiClock size={24} color="#f59e0b" />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.thisWeekFollowUps}</div>
            <div className="stat-label">This Week</div>
          </div>
        </Link>
      </div>

      {/* Recent Contacts */}
      {stats.recentContacts.length > 0 && (
        <div className="recent-section">
          <div className="section-header">
            <h3 className="section-title">
              <FiTrendingUp /> Recent Contacts
            </h3>
            <Link to="/contacts" className="view-all-link">View All</Link>
          </div>

          <div className="recent-contacts-list">
            {stats.recentContacts.map((contact) => (
              <Link
                key={contact.contact_id}
                to={`/contacts/${contact.contact_id}`}
                className="recent-contact-item card"
              >
                <div className="contact-avatar-mini">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="contact-mini-info">
                  <div className="contact-mini-name">{contact.name}</div>
                  {contact.company_name && (
                    <div className="contact-mini-company">{contact.company_name}</div>
                  )}
                </div>
                {contact.follow_up_priority && (
                  <div className={`mini-priority priority-${contact.follow_up_priority}`}></div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Getting Started (if no contacts) */}
      {stats.totalContacts === 0 && (
        <div className="getting-started card">
          <h3>Getting Started with Context CRM</h3>
          <ol className="getting-started-steps">
            <li>
              <strong>Add a Contact:</strong> Tap the "+" button and capture context via voice
            </li>
            <li>
              <strong>AI Magic:</strong> Our AI automatically transcribes and analyzes your notes
            </li>
            <li>
              <strong>Stay Connected:</strong> View your follow-up dashboard to nurture relationships
            </li>
            <li>
              <strong>Generate Messages:</strong> Let AI draft personalized follow-up messages
            </li>
          </ol>
          <Link to="/add-contact" className="btn btn-primary btn-large">
            Add Your First Contact
          </Link>
        </div>
      )}

      {/* Features Overview */}
      <div className="features-grid">
        <div className="feature-card card">
          <div className="feature-icon">🎙️</div>
          <h4>Voice-First</h4>
          <p>Record context instantly with voice notes</p>
        </div>

        <div className="feature-card card">
          <div className="feature-icon">🤖</div>
          <h4>AI Powered</h4>
          <p>Automatic transcription and context analysis</p>
        </div>

        <div className="feature-card card">
          <div className="feature-icon">🔍</div>
          <h4>Smart Search</h4>
          <p>Find contacts by topics, location, or keywords</p>
        </div>

        <div className="feature-card card">
          <div className="feature-icon">📅</div>
          <h4>Follow-ups</h4>
          <p>Never miss an important connection</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
