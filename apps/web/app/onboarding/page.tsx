import { redirect } from 'next/navigation';

// Old setup links should never force customers through a mandatory wizard.
export default function Page() {
  redirect('/dashboard');
}
