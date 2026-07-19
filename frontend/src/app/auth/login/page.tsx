'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Fingerprint } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
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
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { setAuth, isAuthenticated } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [supportsPasskey, setSupportsPasskey] = useState(false);

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
  useEffect(() => {
    if (isAuthenticated) {
      window.location.assign('/dashboard');
    }
  }, [isAuthenticated]);

  // WebAuthn is only available in the browser; check after mount.
  useEffect(() => {
    setSupportsPasskey(passkeySupported());
  }, []);

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
