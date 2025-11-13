import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiPhone, FiMail, FiMapPin, FiCalendar,
  FiMessageSquare, FiTrash2, FiEdit, FiBriefcase
} from 'react-icons/fi';
import { contactAPI, aiAPI, formatDate, formatDateTime } from '../utils/api';
import './ContactDetail.css';

function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMessageGenerator, setShowMessageGenerator] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [messages, setMessages] = useState(null);
  const [selectedTone, setSelectedTone] = useState('formal');

  useEffect(() => {
    fetchContact();
  }, [id]);

  const fetchContact = async () => {
    setLoading(true);
    try {
      const result = await contactAPI.getById(id);
      if (result.success) {
        setContact(result.contact);
      }
    } catch (error) {
      console.error('Error fetching contact:', error);
      alert('Contact not found');
      navigate('/contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${contact.name}?`)) {
      try {
        await contactAPI.delete(id);
        alert('Contact deleted successfully');
        navigate('/contacts');
      } catch (error) {
        console.error('Error deleting contact:', error);
        alert('Failed to delete contact');
      }
    }
  };

  const handleMarkContacted = async () => {
    try {
      const formData = new FormData();
      formData.append('status', 'contacted');
      await contactAPI.update(id, formData);
      alert('Contact marked as contacted');
      fetchContact();
    } catch (error) {
      console.error('Error updating contact:', error);
    }
  };

  const generateMessages = async () => {
    setGeneratingMessage(true);
    try {
      const result = await aiAPI.generateMessage({
        contactName: contact.name,
        summary: contact.ai_summary || contact.transcription,
        topics: contact.topics_discussed,
        venue: contact.venue_name,
        followUpType: contact.follow_up_type,
        company: contact.company_name
      });

      if (result.success) {
        setMessages(result.messages);
      }
    } catch (error) {
      console.error('Error generating message:', error);
      alert('Failed to generate message');
    } finally {
      setGeneratingMessage(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <div className="contact-detail container">
      {/* Header */}
      <div className="detail-header">
        <button onClick={() => navigate(-1)} className="back-button btn btn-secondary">
          <FiArrowLeft />
        </button>
        <div className="header-actions">
          <button className="btn btn-secondary">
            <FiEdit />
          </button>
          <button onClick={handleDelete} className="btn btn-danger">
            <FiTrash2 />
          </button>
        </div>
      </div>

      {/* Contact Info Card */}
      <div className="contact-info-card card">
        <div className="contact-avatar-large">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <h2 className="contact-detail-name">{contact.name}</h2>
        {contact.company_name && (
          <p className="contact-detail-company">
            <FiBriefcase /> {contact.company_name}
          </p>
        )}

        <div className="contact-links">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="contact-link">
              <FiPhone /> {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="contact-link">
              <FiMail /> {contact.email}
            </a>
          )}
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="contact-link">
              LinkedIn Profile
            </a>
          )}
        </div>

        {contact.tags && contact.tags.length > 0 && (
          <div className="contact-tags-detail">
            {contact.tags.map((tag, idx) => (
              <span key={idx} className="tag tag-primary">{tag}</span>
            ))}
          </div>
        )}

        <div className="status-badge-large">
          Status: <span className="status-value">{contact.status}</span>
        </div>
      </div>

      {/* Meeting Context */}
      <div className="card">
        <h3 className="section-title">Meeting Context</h3>

        <div className="context-info">
          {contact.venue_name && (
            <div className="context-item">
              <FiMapPin />
              <div>
                <strong>Location:</strong>
                <p>{contact.venue_name}</p>
              </div>
            </div>
          )}

          <div className="context-item">
            <FiCalendar />
            <div>
              <strong>Date Added:</strong>
              <p>{formatDateTime(contact.date_added)}</p>
            </div>
          </div>
        </div>

        {contact.ai_summary && (
          <div className="ai-summary-section">
            <h4>AI Summary</h4>
            <p>{contact.ai_summary}</p>
          </div>
        )}

        {contact.transcription && (
          <div className="transcription-section">
            <h4>Full Transcription</h4>
            <p className="transcription-text">{contact.transcription}</p>
          </div>
        )}

        {contact.topics_discussed && contact.topics_discussed.length > 0 && (
          <div className="topics-section">
            <h4>Topics Discussed</h4>
            <div className="topics-list">
              {contact.topics_discussed.map((topic, idx) => (
                <span key={idx} className="topic-badge">{topic}</span>
              ))}
            </div>
          </div>
        )}

        {contact.raw_voice_note_path && (
          <div className="audio-section">
            <h4>Voice Note</h4>
            <audio src={`http://localhost:5000/${contact.raw_voice_note_path}`} controls className="audio-player-detail" />
          </div>
        )}
      </div>

      {/* Follow-up Section */}
      {contact.follow_up_type && (
        <div className="card follow-up-card">
          <h3 className="section-title">Follow-up</h3>

          <div className="follow-up-details">
            <div className="follow-up-item">
              <strong>Action:</strong>
              <span>{contact.follow_up_type}</span>
            </div>
            <div className="follow-up-item">
              <strong>Priority:</strong>
              <span className={`priority-badge-detail priority-${contact.follow_up_priority}`}>
                {contact.follow_up_priority}
              </span>
            </div>
            {contact.follow_up_date && (
              <div className="follow-up-item">
                <strong>Date:</strong>
                <span>{formatDate(contact.follow_up_date)}</span>
              </div>
            )}
          </div>

          <div className="follow-up-actions">
            <button
              onClick={() => {
                setShowMessageGenerator(true);
                if (!messages) generateMessages();
              }}
              className="btn btn-primary"
            >
              <FiMessageSquare />
              Generate Draft Message
            </button>
            <button onClick={handleMarkContacted} className="btn btn-secondary">
              Mark as Contacted
            </button>
          </div>
        </div>
      )}

      {/* Message Generator Modal */}
      {showMessageGenerator && (
        <div className="modal-overlay" onClick={() => setShowMessageGenerator(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Draft Follow-up Messages</h3>
              <button
                onClick={() => setShowMessageGenerator(false)}
                className="close-button"
              >
                ×
              </button>
            </div>

            {generatingMessage && (
              <div className="generating-indicator">
                <div className="spinner"></div>
                <p>AI is crafting personalized messages...</p>
              </div>
            )}

            {messages && !generatingMessage && (
              <div className="messages-container">
                <div className="tone-selector">
                  <button
                    onClick={() => setSelectedTone('formal')}
                    className={`tone-button ${selectedTone === 'formal' ? 'tone-active' : ''}`}
                  >
                    Professional
                  </button>
                  <button
                    onClick={() => setSelectedTone('casual')}
                    className={`tone-button ${selectedTone === 'casual' ? 'tone-active' : ''}`}
                  >
                    Friendly
                  </button>
                  <button
                    onClick={() => setSelectedTone('brief')}
                    className={`tone-button ${selectedTone === 'brief' ? 'tone-active' : ''}`}
                  >
                    Brief
                  </button>
                </div>

                <div className="message-preview">
                  <div className="message-subject">
                    <strong>Subject:</strong> {messages[selectedTone]?.subject}
                  </div>
                  <div className="message-body">
                    {messages[selectedTone]?.body}
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      `Subject: ${messages[selectedTone]?.subject}\n\n${messages[selectedTone]?.body}`
                    )}
                    className="btn btn-primary btn-full"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactDetail;
