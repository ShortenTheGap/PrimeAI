import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { FiHome, FiUsers, FiCalendar, FiPlusCircle } from 'react-icons/fi';
import './App.css';
import Dashboard from './components/Dashboard';
import ContactList from './components/ContactList';
import ContactCapture from './components/ContactCapture';
import FollowUpDashboard from './components/FollowUpDashboard';
import ContactDetail from './components/ContactDetail';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="container">
            <h1 className="app-title">Context CRM</h1>
            <p className="app-subtitle">Voice-First Networking</p>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactList />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="/add-contact" element={<ContactCapture />} />
            <Route path="/follow-ups" element={<FollowUpDashboard />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          <Link to="/" className="nav-item">
            <FiHome />
            <span>Home</span>
          </Link>
          <Link to="/contacts" className="nav-item">
            <FiUsers />
            <span>Contacts</span>
          </Link>
          <Link to="/add-contact" className="nav-item nav-item-primary">
            <FiPlusCircle size={32} />
            <span>Add</span>
          </Link>
          <Link to="/follow-ups" className="nav-item">
            <FiCalendar />
            <span>Follow-ups</span>
          </Link>
        </nav>
      </div>
    </Router>
  );
}

export default App;
