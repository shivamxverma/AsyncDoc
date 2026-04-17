"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Save, CheckCircle } from "lucide-react";
import { Timeline } from "../../../components/Timeline";
import { StatusBadge } from "../../../components/StatusBadge";
import { ProgressBar } from "../../../components/ProgressBar";
import { EditableField } from "../../../components/EditableField";
import { useJobStore } from "../../../store/useJobStore";
import { ExtractedData } from "../../../lib/types";
import { toast } from "sonner";

export default function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const job = useJobStore((state) => state.jobs[id]);
  
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [data, setData] = useState<ExtractedData>({
    title: "",
    category: "",
    summary: "",
    keywords: [],
  });

  useEffect(() => {
    const fetchJobDetails = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      try {
        const response = await fetch(`http://localhost:8000/api/v1/task/${id}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to fetch job");
        const jobData = await response.json();
        
        // Find the first document (assuming 1 doc per task for now)
        if (jobData.documents && jobData.documents.length > 0) {
          const doc = jobData.documents[0];
          setDocumentId(doc.id);
          setIsFinalized(doc.is_finalized);
          if (doc.result) {
            setData({
              title: doc.result.title || doc.file_name.replace(".pdf", ""),
              category: doc.result.category || "",
              summary: doc.result.summary || "",
              keywords: doc.result.extracted_keywords || [],
            });
          }
        }
      } catch (error) {
        console.error("Error fetching job details:", error);
      }
    };

    fetchJobDetails();
  }, [id]);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Job not found</h2>
        <p className="text-gray-500 mb-6">The requested document processing job does not exist.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const handleUpdateField = (field: keyof ExtractedData, value: string | string[]) => {
    if (isFinalized) return;
    setData(prev => ({ ...prev, [field]: value }));
  };

  const saveToServer = async (finalize: boolean) => {
    if (!documentId) return;
    try {
      const token = localStorage.getItem("auth_token");
      
      // 1. Update result
      const payload = {
        title: data.title,
        category: data.category,
        summary: data.summary,
        extracted_keywords: data.keywords 
      };

      const updateRes = await fetch(`http://localhost:8000/api/v1/task/document/${documentId}/result`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!updateRes.ok) throw new Error("Failed to update");

      // 2. Finalize if requested
      if (finalize) {
        const finalizeRes = await fetch(`http://localhost:8000/api/v1/task/document/${documentId}/finalize`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!finalizeRes.ok) throw new Error("Failed to finalize");
        setIsFinalized(true);
      }

      toast.success(finalize ? "Document finalized and locked" : "Changes saved successfully");
    } catch (error) {
      toast.error("Failed to update document.");
    }
  };

  const handleSave = () => saveToServer(false);
  const handleFinalize = () => saveToServer(true);

  const handleExport = async (format: "json" | "csv") => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`http://localhost:8000/api/v1/task/${id}/export/${format}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 truncate max-w-lg">{job.fileName}</h2>
            <p className="text-sm text-gray-500 mt-1">ID: {job.id}</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={job.status} className="px-3 py-1 text-sm" />
            <div className="text-right">
              <span className="text-2xl font-bold text-gray-900">{job.progress}%</span>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50">
          <ProgressBar progress={job.progress} className="h-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Processing Timeline</h3>
            <Timeline steps={job.steps} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 relative min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Extracted Data</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport("csv")} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Export CSV">
                  <span className="text-xs font-medium mr-1 border border-gray-300 rounded px-1">CSV</span>
                  <Download className="h-4 w-4 inline" />
                </button>
                <button onClick={() => handleExport("json")} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Export JSON">
                  <span className="text-xs font-medium mr-1 border border-gray-300 rounded px-1">JSON</span>
                  <Download className="h-4 w-4 inline" />
                </button>
              </div>
            </div>

            {job.progress < 60 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-64">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <h4 className="text-gray-900 font-medium">Waiting for extraction</h4>
                <p className="text-sm text-gray-500 mt-1">Data will appear here once parsing is complete.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-700">
                <EditableField
                  label="Title"
                  type="text"
                  value={data.title}
                  onSave={(val) => handleUpdateField("title", val)}
                  disabled={job.status !== "completed"}
                />
                
                <EditableField
                  label="Category"
                  type="text"
                  value={data.category}
                  onSave={(val) => handleUpdateField("category", val)}
                  disabled={job.status !== "completed"}
                />
                
                <EditableField
                  label="Summary"
                  type="textarea"
                  value={data.summary}
                  onSave={(val) => handleUpdateField("summary", val)}
                  disabled={job.status !== "completed"}
                />
                
                <EditableField
                  label="Keywords"
                  type="tags"
                  value={data.keywords}
                  onSave={(val) => handleUpdateField("keywords", val)}
                  disabled={job.status !== "completed"}
                />

                <div className="pt-6 mt-6 border-t border-gray-100 flex flex-wrap gap-3 justify-end">
                  <button
                    onClick={handleSave}
                    disabled={job.status !== "completed"}
                    className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </button>
                  <button
                    onClick={handleFinalize}
                    disabled={job.status !== "completed"}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalize Result
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
