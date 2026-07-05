"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  REVIEW_CATEGORIES,
  isReviewOverdue,
  type LegalReviewItem,
  type ReviewCategory,
  type ReviewStatus,
} from "@/lib/legal/review";

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  changes_requested: "bg-red-500/10 text-red-300 border-red-500/30",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  clause_template: "Clause template",
  regulation: "Regulation",
  disclaimer: "Disclaimer",
  tos: "Terms of Service",
};

export default function LegalReviewView({ items }: { items: LegalReviewItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ReviewCategory>("clause_template");
  const [adding, setAdding] = useState(false);

  async function recordReview(id: string, status: ReviewStatus) {
    const notes = window.prompt(
      status === "changes_requested" ? "What changes are needed?" : "Review notes (optional):",
      ""
    );
    if (notes === null) return; // cancelled
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/legal/review/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? "Request failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the review.");
    } finally {
      setBusyId(null);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message ?? "Request failed");
      setTitle("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the item.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Legal Review Queue</h1>
            <p className="mt-1 text-sm text-gray-500">Quarterly professional review of generated legal content.</p>
          </div>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Dashboard
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        <form
          onSubmit={addItem}
          className="mt-8 flex flex-wrap items-end gap-3 rounded-lg border border-gray-800 bg-gray-900/50 p-4"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GDPR privacy clause set"
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReviewCategory)}
              className="mt-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            >
              {REVIEW_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !title.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add to queue"}
          </button>
        </form>

        <div className="mt-8 space-y-3">
          {items.length === 0 && <p className="text-sm text-gray-500">Nothing queued for review.</p>}
          {items.map((item) => {
            const overdue = isReviewOverdue(item.nextReviewAt);
            return (
              <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {CATEGORY_LABEL[item.category]}
                      {item.contentRef ? ` · ${item.contentRef}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-500">
                  <span className={overdue ? "font-semibold text-red-400" : ""}>
                    Next review: {item.nextReviewAt}
                    {overdue ? " (overdue)" : ""}
                  </span>
                  {item.reviewer && <span>Last reviewed by {item.reviewer}</span>}
                  {item.reviewedAt && <span>on {new Date(item.reviewedAt).toLocaleDateString()}</span>}
                </div>

                {item.notes && <p className="mt-2 text-sm text-gray-400">“{item.notes}”</p>}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => recordReview(item.id, "approved")}
                    disabled={busyId === item.id}
                    className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => recordReview(item.id, "changes_requested")}
                    disabled={busyId === item.id}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Request changes
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
