import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import Success from './pages/Success.jsx';
import BeneficiaryForm from './pages/BeneficiaryForm.jsx';
import Error from './pages/Error.jsx';
import Admin from './pages/Admin.jsx';
import SalesDashboard from './pages/SalesDashboard.jsx';
import OrganizationPricing from './pages/OrganizationPricing.jsx';
import AgentSetup from './pages/AgentSetup.jsx';
import ProductManagement from './pages/ProductManagement.jsx';
import AdminControlPanel from './pages/AdminControlPanel.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/success" element={<Success />} />
        <Route path="/beneficiary-form" element={<BeneficiaryForm />} />
        <Route path="/error" element={<Error />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/sales-dashboard" element={<SalesDashboard />} />
        <Route path="/admin/pricing" element={<OrganizationPricing />} />
        <Route path="/admin/products" element={<ProductManagement />} />
        <Route path="/admin/control-panel" element={<AdminControlPanel />} />
        <Route path="/admin/agents" element={<AgentSetup />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
