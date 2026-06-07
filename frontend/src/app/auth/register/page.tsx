import { redirect } from 'next/navigation';

// Public registration is disabled.
// Users can only be created by authorised administrators from the admin panel.
export default function RegisterPage() {
  redirect('/auth/login');
}
