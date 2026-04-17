"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Filter, Inbox } from "lucide-react";
import { useJobStore } from "../../store/useJobStore";
import { JobRow } from "../../components/JobRow";
import { JobStatus } from "../../lib/types";

export default function Dashboard() {
  const router = useRouter();
  
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const { jobs, setJobs } = useJobStore((state) => ({
    jobs: state.jobs,
    setJobs: state.setJobs
  }));

  useEffect(() => {
    const fetchTasks = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const response = await fetch("http://localhost:8000/api/v1/task", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error("Failed to fetch tasks");
        const data = await response.json();
        
        // Map backend tasks to frontend Job format
        const mappedJobs = data.map((t: any) => ({
          id: t.id,
          fileName: t.name,
          status: t.status.toLowerCase(),
          progress: t.status === "completed" ? 100 : (t.processed_files / t.total_files * 100) || 0,
          currentStep: t.status === "completed" ? "completed" : "processing",
          steps: [], // Optional: fetch steps if needed
          createdAt: t.created_at,
          updatedAt: t.created_at
        }));
        
        setJobs(mappedJobs);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      }
    };

    fetchTasks();
  }, [setJobs]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

  const jobsList = Object.values(jobs);

  const filteredJobs = useMemo(() => {
    let result = jobsList;
    if (statusFilter !== "all") {
      result = result.filter(job => job.status === statusFilter);
    }
    if (search.trim()) {
      result = result.filter(job => job.fileName.toLowerCase().includes(search.toLowerCase()));
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [jobsList, search, statusFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
          <p className="text-gray-500">Manage and monitor your document processing pipelines.</p>
        </div>
        <Link
          href="/upload"
          className="flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-10 pr-8 py-2 appearance-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {jobsList.length === 0 ? (
            <div className="text-center py-20 px-4">
              <Inbox className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
              <p className="mt-1 text-gray-500">Get started by uploading a new PDF document.</p>
              <div className="mt-6">
                <Link
                  href="/upload"
                  className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Document
                </Link>
              </div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No documents match your search criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
               {/* 
                 Adding key based on ID, assuming React handles reconciliation well 
                 if there are internal updates 
               */}
              {filteredJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onRetry={async () => {
                    const token = localStorage.getItem("auth_token");
                    try {
                      const res = await fetch(`http://localhost:8000/api/v1/task/${job.id}/retry`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${token}` }
                      });
                      if (!res.ok) throw new Error("Retry failed");
                      alert("Retry initiated");
                    } catch (e) {
                      alert("Failed to retry task");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
