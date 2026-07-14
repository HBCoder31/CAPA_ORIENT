import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ActivatePortal from './pages/ActivatePortal';
import Dashboard from './pages/Dashboard';
import ComplaintForm from './pages/ComplaintForm';
import ComplaintDetail from './pages/ComplaintDetail';
import Account from './pages/Account';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/activate-portal" element={<ActivatePortal />} />
        
        {/* Protected Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Complaint Intake Form Route */}
        <Route 
          path="/complaints/new" 
          element={
            <ProtectedRoute>
              <ComplaintForm />
            </ProtectedRoute>
          } 
        />

        {/* Protected Complaint Detail Route */}
        <Route 
          path="/complaints/:id" 
          element={
            <ProtectedRoute>
              <ComplaintDetail />
            </ProtectedRoute>
          } 
        />

        {/* Protected Account Settings Route */}
        <Route 
          path="/account" 
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } 
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
