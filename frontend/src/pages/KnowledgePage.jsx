import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Upload,
  Trash2,
  FileText,
  FileType,
  Eye,
  ToggleLeft,
  ToggleRight,
  Loader2,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ACCEPTED = ".pdf,.docx,.txt,.md";
const MAX_MB = 10;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }) {
  const map = { pdf: "PDF", docx: "DOC", txt: "TXT", md: "MD" };
  const colors = { pdf: "bg-red-100 text-red-600", docx: "bg-blue-100 text-blue-600", txt: "bg-gray-100 text-gray-600", md: "bg-purple-100 text-purple-600" };
  return (
    <div className={`w-9 h-9 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${colors[type] || "bg-muted text-muted-foreground"}`}>
      {map[type] || "?"}
    </div>
  );
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileRef = useRef(null);

  const loadDocs = async () => {
    try {
      const resp = await axios.get(`${API}/knowledge`, { withCredentials: true });
      setDocs(resp.data);
    } catch {}
  };

  useEffect(() => { loadDocs(); }, []);

  const uploadFile = async (file) => {
    if (!file) return;
    const ext = file.name.rsplit ? file.name.rsplit(".", 1)[1] : file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt", "md"].includes(ext.toLowerCase())) {
      toast.error(`Unsupported file type: .${ext}. Please use PDF, DOCX, TXT, or MD.`);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API}/knowledge/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`"${file.name}" uploaded and indexed successfully.`);
      await loadDocs();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const handleFileChange = (e) => {
    Array.from(e.target.files || []).forEach(uploadFile);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files || []).forEach(uploadFile);
  };

  const handleDelete = async (doc) => {
    setDeletingId(doc.id);
    try {
      await axios.delete(`${API}/knowledge/${doc.id}`, { withCredentials: true });
      toast.success(`"${doc.filename}" removed from knowledge base.`);
      await loadDocs();
    } catch {
      toast.error("Failed to delete document.");
    }
    setDeletingId(null);
  };

  const handleToggle = async (doc) => {
    try {
      const resp = await axios.patch(`${API}/knowledge/${doc.id}/toggle`, { withCredentials: true });
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, enabled: resp.data.enabled } : d));
      toast.success(resp.data.enabled ? `"${doc.filename}" enabled.` : `"${doc.filename}" disabled.`);
    } catch {
      toast.error("Failed to update document status.");
    }
  };

  const handlePreview = async (doc) => {
    setPreviewLoading(true);
    setPreviewDoc({ ...doc, preview: null });
    try {
      const resp = await axios.get(`${API}/knowledge/${doc.id}/preview`, { withCredentials: true });
      setPreviewDoc({ ...doc, preview: resp.data.preview });
    } catch {
      setPreviewDoc({ ...doc, preview: "Failed to load preview." });
    }
    setPreviewLoading(false);
  };

  const totalChars = docs.reduce((s, d) => s + (d.char_count || 0), 0);
  const enabledCount = docs.filter((d) => d.enabled).length;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Upload documents the AI will use to answer questions</p>
        </div>
        <div className="flex items-center gap-3">
          {docs.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{docs.length} document{docs.length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{enabledCount} active</span>
              <span>·</span>
              <span>{(totalChars / 1000).toFixed(1)}k chars indexed</span>
            </div>
          )}
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Upload size={13} className="mr-1.5" />}
            {uploading ? "Uploading..." : "Upload file"}
          </Button>
          <input ref={fileRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-150 ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
        data-testid="drop-zone"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="text-primary animate-spin" />
            <p className="text-sm font-medium">Processing file...</p>
            <p className="text-xs text-muted-foreground">Extracting and indexing text</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Upload size={18} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">Supports PDF, DOCX, TXT, MD — up to {MAX_MB} MB each</p>
            </div>
          </div>
        )}
      </div>

      {/* Supported formats info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { ext: "PDF", desc: "Documents, manuals, reports", color: "bg-red-50 border-red-100" },
          { ext: "DOCX", desc: "Word documents", color: "bg-blue-50 border-blue-100" },
          { ext: "TXT", desc: "Plain text files", color: "bg-gray-50 border-gray-100" },
          { ext: "MD", desc: "Markdown files", color: "bg-purple-50 border-purple-100" },
        ].map((f) => (
          <div key={f.ext} className={`p-3 rounded-lg border text-center ${f.color}`}>
            <p className="text-xs font-semibold">.{f.ext}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Documents list */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen size={14} className="text-muted-foreground" />
            Indexed documents
          </CardTitle>
          {docs.length > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">{docs.length} total</Badge>
          )}
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText size={28} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No documents yet</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a file above to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors duration-100 ${!doc.enabled ? "opacity-50" : ""}`}
                  data-testid={`kb-doc-${doc.id}`}
                >
                  <FileIcon type={doc.file_type} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      {!doc.enabled && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.size_bytes)}</span>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <span className="text-xs text-muted-foreground">{(doc.char_count || 0).toLocaleString()} chars</span>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      title={doc.enabled ? "Disable" : "Enable"}
                      onClick={() => handleToggle(doc)}
                      data-testid={`toggle-doc-${doc.id}`}
                    >
                      {doc.enabled
                        ? <ToggleRight size={15} className="text-primary" />
                        : <ToggleLeft size={15} className="text-muted-foreground" />
                      }
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      title="Preview"
                      onClick={() => handlePreview(doc)}
                      data-testid={`preview-doc-${doc.id}`}
                    >
                      <Eye size={14} className="text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      title="Delete"
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      data-testid={`delete-doc-${doc.id}`}
                    >
                      {deletingId === doc.id
                        ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
                        : <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="bg-muted/40 border-muted">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-medium">How the knowledge base works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Uploaded documents are extracted and injected into the AI's context on every conversation. 
                The bot will use this content to answer questions accurately. 
                Disable a document to exclude it temporarily without deleting it. 
                Up to 6,000 characters per document are included per response.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              {previewDoc && <FileIcon type={previewDoc.file_type} />}
              {previewDoc?.filename}
            </DialogTitle>
            <DialogDescription className="text-xs">
              First 3,000 characters of extracted text
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <ScrollArea className="h-80 mt-2">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed px-1">
                {previewDoc?.preview || "No preview available."}
              </pre>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
