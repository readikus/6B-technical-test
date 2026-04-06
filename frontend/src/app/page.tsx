import BookingForm from '../components/BookingForm';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 sm:py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-4xl">
          SixBee HealthTech
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Request a patient appointment
        </p>
      </div>
      <BookingForm />
    </main>
  );
}
