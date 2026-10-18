import { Compass, ShieldOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Button, LinkButton } from '@/components/ui';

export function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <Compass className="mx-auto h-12 w-12 text-brand-500" />
        <h1 className="mt-4 text-4xl font-extrabold">Page not found</h1>
        <p className="mt-2 text-ink-500">The page you're looking for doesn't exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-2">
          <LinkButton to="/">Go home</LinkButton>
          <LinkButton to="/courses" variant="outline">
            Browse courses
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

export function Suspended() {
  const { signOut } = useAuth();
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <ShieldOff className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-3xl font-extrabold">Account suspended</h1>
        <p className="mt-2 text-ink-500">Your account has been suspended by an administrator. Please contact Digital Bridge Initiative support for help.</p>
        <div className="mt-6 flex justify-center gap-2">
          <LinkButton to="/about#contact">Contact support</LinkButton>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
