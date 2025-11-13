import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Contact API
export const contactAPI = {
  // Get all contacts with optional filters
  getAll: async (params = {}) => {
    const response = await api.get('/contacts', { params });
    return response.data;
  },

  // Get single contact by ID
  getById: async (id) => {
    const response = await api.get(`/contacts/${id}`);
    return response.data;
  },

  // Create new contact
  create: async (formData) => {
    const response = await api.post('/contacts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Update contact
  update: async (id, formData) => {
    const response = await api.put(`/contacts/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Delete contact
  delete: async (id) => {
    const response = await api.delete(`/contacts/${id}`);
    return response.data;
  },

  // Get follow-ups
  getFollowUps: async (timeframe = 'all') => {
    const response = await api.get('/contacts/follow-ups/list', {
      params: { timeframe }
    });
    return response.data;
  }
};

// AI API
export const aiAPI = {
  // Transcribe audio to text
  transcribe: async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await api.post('/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Analyze context from transcription
  analyzeContext: async (transcription, contactName, venue) => {
    const response = await api.post('/analyze-context', {
      transcription,
      contactName,
      venue
    });
    return response.data;
  },

  // Generate follow-up message
  generateMessage: async (contactData) => {
    const response = await api.post('/generate-message', contactData);
    return response.data;
  }
};

// Utility functions
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getPriorityColor = (priority) => {
  switch (priority) {
    case 'hot':
      return '#ef4444';
    case 'warm':
      return '#f59e0b';
    case 'cold':
      return '#06b6d4';
    default:
      return '#94a3b8';
  }
};

export default api;
