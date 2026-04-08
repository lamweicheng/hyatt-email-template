import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <p className="section-label">Hyatt Email Template</p>
          <div className="mt-3 text-4xl font-semibold leading-none text-[rgb(var(--page-foreground))] font-[family:var(--font-display)]">
            Page not found
          </div>
          <div className="mt-3 max-w-xl text-sm text-[rgba(64,35,37,0.72)] sm:text-base">
            This route is not part of the email template builder. Use the homepage to manage your
            default template, topics, and generated email preview.
          </div>
          <div>
            <Link
              href="/"
              className="mt-6 inline-flex items-center rounded-full border border-[rgba(118,31,47,0.18)] bg-[rgba(118,31,47,0.05)] px-5 py-2.5 text-sm font-semibold text-[rgb(var(--wine))] transition hover:-translate-y-0.5 hover:bg-[rgba(118,31,47,0.08)]"
            >
              Return to template builder
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
