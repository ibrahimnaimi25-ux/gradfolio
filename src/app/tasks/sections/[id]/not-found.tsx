import Link from "next/link";

export default function SectionNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Section Not Found
        </h1>
        <p className="text-gray-500 mb-6">
          This section doesn&apos;t exist or may have been deleted.
        </p>
        <Link
          href="/tasks"
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          Back to Tasks
        </Link>
      </div>
    </div>
  );
}
