import AppointmentsTable from '../../components/AppointmentsTable';

export default function AdminDashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Appointments
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage patient appointment requests
        </p>
      </div>
      <AppointmentsTable />
    </main>
  );
}
