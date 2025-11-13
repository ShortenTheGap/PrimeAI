import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiAlertCircle, FiCheckCircle, FiMessageSquare } from 'react-icons/fi';
import { contactAPI, formatDate } from '../utils/api';
import './FollowUpDashboard.css';

function FollowUpDashboard() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');

  useEffect(() => {
    fetchFollowUps();
  }, [selectedTimeframe]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const result = await contactAPI.getFollowUps(selectedTimeframe);
      if (result.success) {
        setFollowUps(result.follow_ups);
      }
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByStatus = () => {
    return {
      overdue: followUps.filter(f => f.follow_up_status === 'overdue'),
      today: followUps.filter(f => f.follow_up_status === 'today'),
      this_week: followUps.filter(f => f.follow_up_status === 'this_week'),
      upcoming: followUps.filter(f => f.follow_up_status === 'upcoming')
    };
  };

  const grouped = groupByStatus();

  const getStatusIcon = (status) => {
    switch (status) {
      case 'overdue':
        return <FiAlertCircle color="#ef4444" />;
      case 'today':
        return <FiClock color="#f59e0b" />;
      case 'this_week':
        return <FiCheckCircle color="#10b981" />;
      default:
        return <FiClock color="#94a3b8" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'overdue':
        return 'Overdue';
      case 'today':
        return "Today's Follow-ups";
      case 'this_week':
        return 'This Week';
      case 'upcoming':
        return 'Upcoming';
      default:
        return 'All';
    }
  };

  const renderFollowUpGroup = (title, items, status) => {
    if (items.length === 0) return null;

    return (
      <div className="follow-up-group">
        <div className="group-header">
          {getStatusIcon(status)}
          <h3 className="group-title">{title}</h3>
          <span className="group-count">{items.length}</span>
        </div>

        <div className="follow-up-list">
          {items.map((item) => (
            <Link
              key={item.contact_id}
              to={`/contacts/${item.contact_id}`}
              className="follow-up-card card"
            >
              <div className="follow-up-header">
                <div className="contact-avatar-small">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="follow-up-info">
                  <h4 className="follow-up-name">{item.name}</h4>
                  <p className="follow-up-date">
                    {formatDate(item.follow_up_date)}
                  </p>
                </div>
                <span className={`priority-pill priority-${item.follow_up_priority}`}>
                  {item.follow_up_priority}
                </span>
              </div>

              {item.ai_summary && (
                <p className="follow-up-summary">{item.ai_summary}</p>
              )}

              {item.venue_name && (
                <p className="follow-up-venue">
                  Met at: {item.venue_name}
                </p>
              )}

              {item.follow_up_type && (
                <div className="follow-up-action">
                  <FiMessageSquare size={16} />
                  <span>{item.follow_up_type}</span>
                </div>
              )}

              {item.topics_discussed && (
                <div className="topics-list">
                  {JSON.parse(item.topics_discussed).slice(0, 3).map((topic, idx) => (
                    <span key={idx} className="topic-tag">{topic}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="follow-up-dashboard container">
      <div className="dashboard-header">
        <h2 className="page-title">Follow-up Dashboard</h2>
        <p className="page-subtitle">
          {followUps.length} contacts need follow-up
        </p>
      </div>

      {/* Timeframe Filter */}
      <div className="timeframe-tabs">
        {['all', 'overdue', 'today', 'this_week', 'upcoming'].map((timeframe) => (
          <button
            key={timeframe}
            onClick={() => setSelectedTimeframe(timeframe)}
            className={`tab-button ${selectedTimeframe === timeframe ? 'tab-active' : ''}`}
          >
            {getStatusLabel(timeframe)}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && followUps.length === 0 && (
        <div className="empty-state card">
          <FiCheckCircle size={48} color="#10b981" />
          <h3>All caught up!</h3>
          <p>No follow-ups needed right now. Great work staying on top of your network!</p>
        </div>
      )}

      {/* Follow-up Groups */}
      {!loading && followUps.length > 0 && (
        <div className="follow-up-groups">
          {selectedTimeframe === 'all' ? (
            <>
              {renderFollowUpGroup('🚨 Overdue', grouped.overdue, 'overdue')}
              {renderFollowUpGroup("🔥 Today's Follow-ups", grouped.today, 'today')}
              {renderFollowUpGroup('📅 This Week', grouped.this_week, 'this_week')}
              {renderFollowUpGroup('📆 Upcoming', grouped.upcoming, 'upcoming')}
            </>
          ) : (
            <div className="follow-up-list">
              {followUps.map((item) => (
                <Link
                  key={item.contact_id}
                  to={`/contacts/${item.contact_id}`}
                  className="follow-up-card card"
                >
                  <div className="follow-up-header">
                    <div className="contact-avatar-small">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="follow-up-info">
                      <h4 className="follow-up-name">{item.name}</h4>
                      <p className="follow-up-date">
                        {formatDate(item.follow_up_date)}
                      </p>
                    </div>
                    <span className={`priority-pill priority-${item.follow_up_priority}`}>
                      {item.follow_up_priority}
                    </span>
                  </div>

                  {item.ai_summary && (
                    <p className="follow-up-summary">{item.ai_summary}</p>
                  )}

                  {item.follow_up_type && (
                    <div className="follow-up-action">
                      <FiMessageSquare size={16} />
                      <span>{item.follow_up_type}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FollowUpDashboard;
