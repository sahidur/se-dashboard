'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Fingerprint } from 'lucide-react';
import api from '@/lib/api';
import {
  useAuthStore,
  hasSessionCookie,
  setSessionCookie,
} from '@/store/auth-store';
import { loginWithPasskey, passkeySupported } from '@/lib/passkey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  // No minimum: the server answers with a uniform 401, and a client-side rule
  // would only lock legacy accounts out of the form.
  password: z.string().min(1, 'Password is required').max(128),
});

type LoginForm = z.infer<typeof loginSchema>;

// Marks that this tab has already sent an authenticated-looking visitor to the
// dashboard. If we end up back on the login page with the flag still set, the
// middleware bounced us straight back and another redirect would loop forever.
const REDIRECT_ATTEMPT_KEY = 'se360-login-redirect-attempt';

// Reading a browser-only value through useSyncExternalStore (with a no-op
// subscription) returns the server snapshot during SSR/hydration and the client
// snapshot on every render afterwards — same result as a mount effect that calls
// setState, without the extra render pass.
const NEVER_CHANGES = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

export default function LoginPage() {
  const { setAuth, logout, isAuthenticated, accessToken } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  // WebAuthn is only available in the browser.
  const supportsPasskey = useSyncExternalStore(NEVER_CHANGES, passkeySupported, serverFalse);
  // Zustand rehydrates from localStorage on the client only. Acting on
  // `isAuthenticated` before that happens would read the SSR default (false).
  const hydrated = useSyncExternalStore(NEVER_CHANGES, clientTrue, serverFalse);
  // Whether a *previous* page load already tried the dashboard, captured once
  // before we write our own flag so a repeated effect run (React StrictMode
  // double-invoke) can't mistake our own flag for evidence of a bounce.
  const bouncedBackRef = useRef<boolean | null>(null);
  const navigatedRef = useRef(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Whenever the user becomes authenticated — whether from submitting the form
  // below or from arriving here already logged in — send them to the dashboard.
  // We use a full-page navigation (window.location) rather than a client-side
  // router push on purpose: a soft navigation kept the in-memory auth store but
  // raced with Next.js' RSC prefetch/transition, which occasionally aborted and
  // left the dashboard stuck on its loading spinner until a manual hard reload.
  // A full navigation guarantees the dashboard mounts fresh with the auth store
  // rehydrated from localStorage (the same path a hard reload takes).
  //
  // Dashboard routes are guarded twice: by the `se360-session` cookie in the edge
  // middleware and by the persisted store in the dashboard layout. When those
  // two disagree (cookie expired/blocked/cleared while localStorage still says
  // "authenticated") this redirect and the middleware's redirect back to the
  // login page ping-pong forever and the form becomes impossible to use. The
  // guards below keep the two signals in sync and stop after a single failed
  // attempt.
  useEffect(() => {
    if (!hydrated) return;

    if (bouncedBackRef.current === null) {
      bouncedBackRef.current =
        sessionStorage.getItem(REDIRECT_ATTEMPT_KEY) === '1';
    }

    // Cookie sessions keep no persisted access token, so an in-memory token
    // OR the `se360-session` middleware cookie counts as "probably logged in".
    const authed = isAuthenticated && (!!accessToken || hasSessionCookie());

    if (!authed) {
      // Nothing stale left to redirect with; allow a future successful login
      // to navigate normally.
      sessionStorage.removeItem(REDIRECT_ATTEMPT_KEY);
      return;
    }

    if (bouncedBackRef.current) {
      // A previous load already sent this tab to the dashboard and it landed
      // back here, so the session is not actually usable. Clear the stale
      // client state and let the user sign in again instead of looping.
      bouncedBackRef.current = false;
      sessionStorage.removeItem(REDIRECT_ATTEMPT_KEY);
      logout();
      // The bounce can only be detected from sessionStorage after mount, so
      // surfacing it has to happen here; it runs at most once per page load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      setPasskeyLoading(false);
      return;
    }

    if (navigatedRef.current) return;
    navigatedRef.current = true;

    // Re-issue the middleware's session cookie so a cookie that expired (or was
    // cleared) while localStorage survived doesn't bounce us back here.
    if (!hasSessionCookie()) setSessionCookie();

    sessionStorage.setItem(REDIRECT_ATTEMPT_KEY, '1');
    // A hard navigation is deliberate here (see the comment above): router.push
    // races with Next.js' RSC transition and leaves the dashboard stuck on its
    // spinner. Do not "fix" this by switching back to the router.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/data-collection/programme-overview');
  }, [hydrated, isAuthenticated, accessToken, logout]);

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = response.data;
      // setAuth flips isAuthenticated -> the effect above performs the redirect.
      // Keep `loading` true so the button stays disabled until the page unloads.
      setAuth(user, accessToken, refreshToken);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  };

  const onPasskeyLogin = async () => {
    try {
      setPasskeyLoading(true);
      setError('');
      // Pass the typed email (if any) to scope the credential list; otherwise
      // the browser offers any discoverable passkey for this site.
      const email = getValues('email')?.trim() || undefined;
      const { user, accessToken, refreshToken } = await loginWithPasskey(email);
      // setAuth flips isAuthenticated -> the effect above performs the redirect.
      setAuth(user, accessToken, refreshToken);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        setError('Passkey sign-in was cancelled.');
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Passkey sign-in failed',
        );
      }
      setPasskeyLoading(false);
    }
  };

  return (
    <Card className="shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
          SE
        </div>
        <CardTitle className="text-2xl">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to your Social Enterprise Platform account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* method/action are defense-in-depth: if JS ever fails to attach the
            React submit handler, this avoids a GET fallback that would leak
            the password into the URL query string. */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          method="post"
          action="/auth/login"
          className="space-y-4"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="admin@bep.org"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>

          {supportsPasskey && (
            <>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium text-gray-400">OR</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                loading={passkeyLoading}
                onClick={onPasskeyLogin}
              >
                <Fingerprint size={16} className="mr-2" />
                Sign in with a passkey
              </Button>
            </>
          )}

          <p className="text-center text-sm text-gray-500">
            Contact your administrator to get an account.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
