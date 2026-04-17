"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FileUpload } from "../../components/FileUpload";
import { useJobStore } from "../../store/useJobStore";
import { STEP_ORDER } from "../../lib/types";

export default function UploadPage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const addJob = useJobStore((state) => state.addJob);

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const uploadPromises = files.map(async (file) => {
        try {
          // 1. Initiate the upload and get the pre-signed S3 URL
          const response = await fetch("http://localhost:8000/api/v1/task/upload/initiate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              name: file.name,
              files: [
                {
                  filename: file.name,
                  content_type: file.type || "application/pdf"
                }
              ]
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to initiate upload for ${file.name}: ${response.statusText}`);
          }

          const data = await response.json();
          const jobId = data.task_id;
          const documentId = data.documents[0].document_id;
          const uploadUrl = data.documents[0].upload_url;

          // 2. Upload the file to S3 using the pre-signed URL
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/pdf",
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name} to S3`);
          }

          // 3. Notify the backend that the upload is complete
          const completeResponse = await fetch("http://localhost:8000/api/v1/task/upload/complete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              task_id: jobId,
              document_ids: [documentId]
            })
          });

          if (!completeResponse.ok) {
            throw new Error(`Failed to complete upload for ${file.name}`);
          }

          const now = new Date().toISOString();
          
          addJob({
            id: jobId,
            fileName: file.name,
            status: "queued",
            progress: 0,
            currentStep: "queued",
            steps: STEP_ORDER.map(name => ({ name, status: "pending" as const })),
            createdAt: now,
            updatedAt: now,
          });

          return { success: true, fileName: file.name };
        } catch (err) {
          console.error(`Error uploading ${file.name}:`, err);
          return { success: false, fileName: file.name, error: err };
        }
      });

      const results = await Promise.all(uploadPromises);
      const failed = results.filter(r => !r.success);

      if (failed.length > 0) {
        console.error(`${failed.length} uploads failed`, failed);
        // We still redirect to dashboard if some succeeded, or stay here if all failed
        if (failed.length === files.length) {
          setIsUploading(false);
          return;
        }
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Batch upload failed", error);
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Upload Document</h2>
        <p className="text-gray-500 mt-2">Upload a PDF document to start the extraction pipeline.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <FileUpload onUpload={handleUpload} isUploading={isUploading} />
      </div>
    </div>
  );
}
