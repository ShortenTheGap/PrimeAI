import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMic, FiStopCircle, FiSave, FiMapPin } from 'react-icons/fi';
import { contactAPI, aiAPI } from '../utils/api';
import './ContactCapture.css';

function ContactCapture() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    venue_name: '',
    transcription: '',
    ai_summary: '',
    topics_discussed: [],
    follow_up_type: '',
    follow_up_priority: 'warm',
    follow_up_date: '',
    tags: [],
    company_name: '',
    status: 'new'
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Get user's location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            long: position.coords.longitude
          });
        },
        (error) => console.log('Location access denied:', error)
      );
    }
  }, []);

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Auto-transcribe
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Transcribe audio using API
  const transcribeAudio = async (blob) => {
    setIsProcessing(true);
    try {
      const result = await aiAPI.transcribe(blob);

      if (result.success) {
        setFormData(prev => ({
          ...prev,
          transcription: result.transcription
        }));

        // Auto-analyze context
        await analyzeContext(result.transcription);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Analyze context using AI
  const analyzeContext = async (transcription) => {
    try {
      const result = await aiAPI.analyzeContext(
        transcription,
        formData.name,
        formData.venue_name
      );

      if (result.success) {
        const analysis = result.analysis;
        setFormData(prev => ({
          ...prev,
          ai_summary: analysis.summary || '',
          topics_discussed: analysis.topics_discussed || [],
          follow_up_type: analysis.suggested_follow_up || '',
          follow_up_priority: analysis.follow_up_priority || 'warm',
          follow_up_date: analysis.suggested_follow_up_date || '',
          company_name: analysis.company_name || prev.company_name
        }));
      }
    } catch (error) {
      console.error('Context analysis error:', error);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle tag selection
  const handleTagToggle = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  // Submit contact
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter a contact name');
      return;
    }

    setIsProcessing(true);

    try {
      const submitData = new FormData();

      // Add form fields
      Object.keys(formData).forEach(key => {
        if (Array.isArray(formData[key])) {
          submitData.append(key, JSON.stringify(formData[key]));
        } else if (formData[key]) {
          submitData.append(key, formData[key]);
        }
      });

      // Add location if available
      if (location) {
        submitData.append('location_lat', location.lat);
        submitData.append('location_long', location.long);
      }

      // Add audio file if exists
      if (audioBlob) {
        submitData.append('voiceNote', audioBlob, 'recording.webm');
      }

      const result = await contactAPI.create(submitData);

      if (result.success) {
        alert('Contact saved successfully!');
        navigate('/contacts');
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save contact. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const tagOptions = ['Client', 'Investor', 'Partner', 'Speaker', 'Referral', 'Personal'];

  return (
    <div className="contact-capture container">
      <h2 className="page-title">Add Contact with Context</h2>

      <form onSubmit={handleSubmit} className="capture-form">
        {/* Voice Recording Section */}
        <div className="recording-section card">
          <h3 className="section-title">
            <FiMic /> Voice Context Capture
          </h3>
          <p className="section-subtitle">
            Record your thoughts while they're fresh: Where did you meet? What did you discuss?
          </p>

          <div className="recording-controls">
            {!isRecording && !audioBlob && (
              <button
                type="button"
                onClick={startRecording}
                className="btn btn-primary btn-large btn-full record-btn"
              >
                <FiMic size={24} />
                Press to Record
              </button>
            )}

            {isRecording && (
              <div className="recording-active">
                <div className="recording-indicator pulse">
                  <div className="recording-dot"></div>
                  Recording... {formatTime(recordingTime)}
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="btn btn-danger btn-large btn-full"
                >
                  <FiStopCircle size={24} />
                  Stop Recording
                </button>
              </div>
            )}

            {audioBlob && !isRecording && (
              <div className="recording-complete">
                <p className="success-message">✓ Recording saved ({formatTime(recordingTime)})</p>
                <audio src={URL.createObjectURL(audioBlob)} controls className="audio-player" />
                <button
                  type="button"
                  onClick={() => {
                    setAudioBlob(null);
                    setFormData(prev => ({ ...prev, transcription: '' }));
                  }}
                  className="btn btn-secondary"
                >
                  Re-record
                </button>
              </div>
            )}
          </div>

          {isProcessing && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <p>Processing audio with AI...</p>
            </div>
          )}

          {formData.transcription && (
            <div className="transcription-box">
              <h4>Transcription:</h4>
              <p>{formData.transcription}</p>
            </div>
          )}
        </div>

        {/* Contact Details */}
        <div className="card">
          <h3 className="section-title">Contact Details</h3>

          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Sarah Chen"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-input"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="form-input"
                placeholder="sarah@company.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Company</label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Acme Corp"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <FiMapPin /> Where did you meet?
            </label>
            <input
              type="text"
              name="venue_name"
              value={formData.venue_name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="AI Summit 2024, Booth #42"
            />
          </div>
        </div>

        {/* Quick Tags */}
        <div className="card">
          <h3 className="section-title">Quick Tags</h3>
          <div className="tag-selector">
            {tagOptions.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={`tag-option ${formData.tags.includes(tag) ? 'tag-option-active' : ''}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Follow-up Settings */}
        <div className="card">
          <h3 className="section-title">Follow-up</h3>

          <div className="form-group">
            <label className="form-label">Follow-up Action</label>
            <select
              name="follow_up_type"
              value={formData.follow_up_type}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="">Select action...</option>
              <option value="Send proposal">Send proposal</option>
              <option value="Coffee meeting">Coffee meeting</option>
              <option value="Intro to someone">Intro to someone</option>
              <option value="Send resources">Send resources</option>
              <option value="Add to newsletter">Add to newsletter</option>
              <option value="No immediate action">No immediate action</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                name="follow_up_priority"
                value={formData.follow_up_priority}
                onChange={handleInputChange}
                className="form-select"
              >
                <option value="hot">🔥 Hot (24hrs)</option>
                <option value="warm">☀️ Warm (Week)</option>
                <option value="cold">❄️ Cold (Later)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Follow-up Date</label>
              <input
                type="date"
                name="follow_up_date"
                value={formData.follow_up_date}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* AI Summary (if generated) */}
        {formData.ai_summary && (
          <div className="card ai-summary-card">
            <h3 className="section-title">AI Summary</h3>
            <p className="ai-summary">{formData.ai_summary}</p>
            {formData.topics_discussed.length > 0 && (
              <div className="topics">
                <strong>Topics:</strong>
                {formData.topics_discussed.map((topic, idx) => (
                  <span key={idx} className="tag tag-primary">{topic}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing || !formData.name}
          className="btn btn-success btn-large btn-full"
        >
          <FiSave />
          {isProcessing ? 'Saving...' : 'Save Contact'}
        </button>
      </form>
    </div>
  );
}

export default ContactCapture;
