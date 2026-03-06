export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Welcome</h1>
      <p className="mt-4 text-lg text-gray-600">
        Get started by editing this page.
      </p>
      <section className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold">Documentation</h2>
          <p>Find in-depth information about features.</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold">Learn</h2>
          <p>Learn about the framework in an interactive course.</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold">Templates</h2>
          <p>Explore starter templates.</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold">Deploy</h2>
          <p>Deploy your project in seconds.</p>
        </div>
      </section>
    </main>
  );
}
