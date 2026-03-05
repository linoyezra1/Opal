import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Success from './pages/Success.jsx';
import BeneficiaryForm from './pages/BeneficiaryForm.jsx';
import Error from './pages/Error.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/success" element={<Success />} />
        <Route path="/beneficiary-form" element={<BeneficiaryForm />} />
        <Route path="/error" element={<Error />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
