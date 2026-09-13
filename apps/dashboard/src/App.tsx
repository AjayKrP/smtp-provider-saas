import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.js';
import { Layout } from './components/Layout.js';
import { PublicLayout } from './components/PublicLayout.js';
import { Landing } from './pages/Landing.js';
import { Pricing } from './pages/Pricing.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Home } from './pages/Home.js';
import { Domains } from './pages/Domains.js';
import { Credentials } from './pages/Credentials.js';
import { Activity } from './pages/Activity.js';
import { Billing } from './pages/Billing.js';

export function App() {
  const { authenticated } = useAuth();

  if (!authenticated) {
    return (
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/domains" element={<Domains />} />
        <Route path="/credentials" element={<Credentials />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/billing" element={<Billing />} />
      </Route>
      <Route path="/pricing" element={<Navigate to="/billing" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
