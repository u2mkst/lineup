import { useAuth } from '../lib/auth';
import { cloudEnabled } from '../lib/supabase';
import { AdminRoster } from './AdminRoster';
import { RosterEditor } from './RosterEditor';
import { RosterView } from './RosterView';

/** One entry point: local editor offline, admin editor for admins, read-only list for everyone else. */
export function RosterManager({ onClose }: { onClose: () => void }) {
  const isAdmin = useAuth(s => s.isAdmin);
  if (!cloudEnabled) return <RosterEditor onClose={onClose} />;
  return isAdmin ? <AdminRoster onClose={onClose} /> : <RosterView onClose={onClose} />;
}
