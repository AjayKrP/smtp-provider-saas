import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { rememberReferralCode } from '../referral.js';

/**
 * The target of a share link: /r/<code>.
 *
 * It stores the code and sends the visitor to the landing page rather than straight to
 * the signup form — someone arriving from a recommendation still wants to know what the
 * thing is before creating an account, and the code survives the browsing in between.
 */
export function ReferralLanding() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (code) rememberReferralCode(code);
  }, [code]);

  return <Navigate to="/?ref=1" replace />;
}
