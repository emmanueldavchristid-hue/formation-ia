"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  level: string;
  total_slides: number;
}

export default function CoursPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/courses")
      .then(r => r.json())
      .then(d => { setCourses(d.courses || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Mes Cours</h1>
        <Link href="/formateur" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800">
          + Nouveau cours
        </Link>
      </div>
      {loading && <p className="text-center py-20 text-gray-400">Chargement...</p>}
      {!loading && courses.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl shadow">
          <p className="text-gray-500 mb-4">Aucun cours pour l instant</p>
          <Link href="/formateur" className="bg-blue-700 text-white px-6 py-3 rounded-lg">
            Creer mon premier cours
          </Link>
        </div>
      )}
      <div className="grid gap-4">
        {courses.map(c => (
          <Link key={c.id} href={`/cours/${c.id}`}
            className="flex items-center justify-between bg-white rounded-2xl shadow p-6 hover:shadow-md transition-shadow">
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-1">{c.title}</h2>
              <p className="text-sm text-gray-500">{c.level} - {c.total_slides} slides</p>
            </div>
            <span className="text-blue-500 text-2xl">&#9654;</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
