import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import Success from './pages/Success.jsx';
import BeneficiaryForm from './pages/BeneficiaryForm.jsx';
import Error from './pages/Error.jsx';
import Admin from './pages/Admin.jsx';
import SubscribersDashboard from './pages/SubscribersDashboard.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AgentSetup from './pages/AgentSetup.jsx';
import ProductManagement from './pages/ProductManagement.jsx';
import AdminControlPanel from './pages/AdminControlPanel.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';
import PricingDashboard from './pages/PricingDashboard.jsx';
import UnifiedProductWizard from './pages/UnifiedProductWizard.jsx';
import ReportsDashboard from './pages/ReportsDashboard.jsx';
import ContactManagement from './pages/ContactManagement.jsx';
import OrganizationsDashboard from './pages/OrganizationsDashboard.jsx';
import OrganizationDetailPage from './pages/OrganizationDetailPage.jsx';
import OrgRegisterPage from './pages/OrgRegisterPage.jsx';
import OrganizationJoinRequest from './pages/OrganizationJoinRequest.jsx';
import BeneficiarySuccess from './pages/BeneficiarySuccess.jsx';
import ArchiveDashboard from './pages/ArchiveDashboard.jsx';
import AlertsDashboard from './pages/AlertsDashboard.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/p/:slug" element={<LandingPage />} />
        <Route path="/landing/:priceListId" element={<LandingPage />} />
        <Route path="/success" element={<Success />} />
        <Route path="/beneficiary-form" element={<BeneficiaryForm />} />
        <Route path="/beneficiary-success" element={<BeneficiarySuccess />} />
        <Route path="/organization-join-request" element={<OrganizationJoinRequest />} />
        <Route path="/error" element={<Error />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/subscribers" element={<SubscribersDashboard />} />
        <Route path="/admin/sales-dashboard" element={<Navigate to="/admin/subscribers" replace />} />
        <Route path="/admin/products" element={<ProductManagement />} />
        <Route path="/admin/vendors" element={<VendorDashboard />} />
        <Route path="/admin/price-list" element={<PricingDashboard />} />
        <Route path="/admin/control-panel" element={<AdminControlPanel />} />
        <Route path="/admin/contacts" element={<ContactManagement />} />
        <Route path="/admin/organizations" element={<OrganizationsDashboard />} />
        <Route path="/admin/organizations/:id" element={<OrganizationDetailPage />} />
        <Route path="/register" element={<OrgRegisterPage />} />
        <Route path="/admin/agents" element={<AgentSetup />} />
        <Route path="/admin/product-page-setup" element={<UnifiedProductWizard />} />
        <Route path="/admin/reports" element={<ReportsDashboard />} />
        <Route path="/admin/archive" element={<ArchiveDashboard />} />
        <Route path="/admin/alerts" element={<AlertsDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
