import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiFilter, FiUser, FiMapPin, FiCalendar } from 'react-icons/fi';
import { contactAPI, formatDate, getPriorityColor } from '../utils/api';
import './ContactList.css';

function ContactList() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [searchQuery, filterTag, filterPriority]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (filterTag) params.tag = filterTag;
      if (filterPriority) params.priority = filterPriority;

      const result = await contactAPI.getAll(params);
      if (result.success) {
        setContacts(result.contacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterTag('');
    setFilterPriority('');
  };

  return (
    <div className="contact-list container">
      <div className="list-header">
        <h2 className="page-title">Contacts</h2>
        <p className="page-subtitle">{contacts.length} total contacts</p>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, venue, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`filter-toggle btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FiFilter />
        </button>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="filters-panel card fade-in">
          <div className="filter-group">
            <label className="filter-label">Tag</label>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="form-select"
            >
              <option value="">All Tags</option>
              <option value="Client">Client</option>
              <option value="Investor">Investor</option>
              <option value="Partner">Partner</option>
              <option value="Speaker">Speaker</option>
              <option value="Referral">Referral</option>
              <option value="Personal">Personal</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="form-select"
            >
              <option value="">All Priorities</option>
              <option value="hot">🔥 Hot</option>
              <option value="warm">☀️ Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </div>

          <button onClick={clearFilters} className="btn btn-secondary">
            Clear Filters
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      )}

      {/* Contact Cards */}
      {!loading && contacts.length === 0 && (
        <div className="empty-state card">
          <FiUser size={48} />
          <h3>No contacts found</h3>
          <p>Start adding contacts to build your network!</p>
          <Link to="/add-contact" className="btn btn-primary">
            Add Your First Contact
          </Link>
        </div>
      )}

      {!loading && contacts.length > 0 && (
        <div className="contacts-grid">
          {contacts.map((contact) => (
            <Link
              key={contact.contact_id}
              to={`/contacts/${contact.contact_id}`}
              className="contact-card card"
            >
              <div className="contact-header">
                <div className="contact-avatar">
                  {contact.name.charAt(0).toUpperCase()}
                </div>
                <div className="contact-info">
                  <h3 className="contact-name">{contact.name}</h3>
                  {contact.company_name && (
                    <p className="contact-company">{contact.company_name}</p>
                  )}
                </div>
                {contact.follow_up_priority && (
                  <div
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(contact.follow_up_priority) }}
                  >
                    {contact.follow_up_priority}
                  </div>
                )}
              </div>

              {contact.ai_summary && (
                <p className="contact-summary">{contact.ai_summary}</p>
              )}

              <div className="contact-meta">
                {contact.venue_name && (
                  <div className="meta-item">
                    <FiMapPin size={14} />
                    <span>{contact.venue_name}</span>
                  </div>
                )}
                <div className="meta-item">
                  <FiCalendar size={14} />
                  <span>{formatDate(contact.date_added)}</span>
                </div>
              </div>

              {contact.tags && contact.tags.length > 0 && (
                <div className="contact-tags">
                  {contact.tags.map((tag, idx) => (
                    <span key={idx} className="tag tag-primary">{tag}</span>
                  ))}
                </div>
              )}

              {contact.follow_up_type && (
                <div className="follow-up-info">
                  <strong>Follow-up:</strong> {contact.follow_up_type}
                  {contact.follow_up_date && ` (${formatDate(contact.follow_up_date)})`}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContactList;
