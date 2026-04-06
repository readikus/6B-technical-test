import LoginForm from '../../../components/LoginForm';

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          SixBee HealthTech
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Admin portal</p>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <LoginForm />
      </div>
    </main>
  );
}
