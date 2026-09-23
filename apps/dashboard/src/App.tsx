import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.js';
import { useSeo } from './seo/useSeo.js';
import { CookieConsent } from './components/CookieConsent.js';
import { Layout } from './components/Layout.js';
import { PublicLayout } from './components/PublicLayout.js';
import { Landing } from './pages/Landing.js';
import { Pricing } from './pages/Pricing.js';
import { Docs } from './pages/Docs.js';
import { Prompt } from './pages/Prompt.js';
import { GuidesIndex } from './pages/guides/GuidesIndex.js';
import { SupabaseSmtp } from './pages/guides/SupabaseSmtp.js';
import { BoltEmail, LovableEmail, NextjsEmail } from './pages/guides/stacks.js';
import { EmailToSpam } from './pages/guides/EmailToSpam.js';
import { ResendAlternative, SendgridAlternative } from './pages/compare/Comparisons.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { ForgotPassword } from './pages/ForgotPassword.js';
import { ResetPassword } from './pages/ResetPassword.js';
import { VerifyEmail } from './pages/VerifyEmail.js';
import { Terms } from './pages/Terms.js';
import { Privacy } from './pages/Privacy.js';
import { Home } from './pages/Home.js';
import { Domains } from './pages/Domains.js';
import { Credentials } from './pages/Credentials.js';
import { Activity } from './pages/Activity.js';
import { Billing } from './pages/Billing.js';
import { Admin } from './pages/Admin.js';

/**
 * The marketing guides, shared by both trees: signed-in users follow these links from the
 * footer too, and a redirect to the dashboard mid-read would be its own small bug.
 */
const guideRoutes = [
  <Route key="prompt" path="/prompt" element={<Prompt />} />,
  <Route key="guides" path="/guides" element={<GuidesIndex />} />,
  <Route key="supabase" path="/guides/supabase-smtp-settings" element={<SupabaseSmtp />} />,
  <Route key="lovable" path="/guides/send-email-from-lovable" element={<LovableEmail />} />,
  <Route key="bolt" path="/guides/send-email-from-bolt" element={<BoltEmail />} />,
  <Route key="nextjs" path="/guides/send-email-from-nextjs" element={<NextjsEmail />} />,
  <Route key="spam" path="/guides/why-emails-go-to-spam" element={<EmailToSpam />} />,
  <Route
    key="sendgrid"
    path="/compare/sendgrid-alternative-india"
    element={<SendgridAlternative />}
  />,
  <Route key="resend" path="/compare/resend-alternative-india" element={<ResendAlternative />} />,
];

export function App() {
  const { authenticated } = useAuth();
  useSeo();

  if (!authenticated) {
    return (
      <>
        <CookieConsent />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/docs" element={<Docs />} />
            {guideRoutes}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <CookieConsent />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="/pricing" element={<Navigate to="/billing" replace />} />
        {/* Emailed links can be opened while already signed in. */}
        <Route element={<PublicLayout />}>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/docs" element={<Docs />} />
          {guideRoutes}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
