// app/page.tsx
// Server Component - 100% AWS Cloud Native

import Dashboard from "./components/Dashboard";

export const revalidate = 0; // Disable server caching for real-time due card evaluations

export default async function Page() {
  return (
    <Dashboard initialNotes={[]} initialCards={[]} />
  );
}
