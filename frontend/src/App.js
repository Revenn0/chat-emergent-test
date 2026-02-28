import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ConnectionPage from "./pages/ConnectionPage";
import ChatsPage from "./pages/ChatsPage";
import ConfigPage from "./pages/ConfigPage";
import LogsPage from "./pages/LogsPage";
import KnowledgePage from "./pages/KnowledgePage";
import ActionsPage from "./pages/ActionsPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import WorkflowPage from "./pages/WorkflowPage";
import ChatTestPage from "./pages/ChatTestPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/connect" element={<ConnectionPage />} />
              <Route path="/chats" element={<ChatsPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/actions" element={<ActionsPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/workflow" element={<WorkflowPage />} />
              <Route path="/chat-test" element={<ChatTestPage />} />
              <Route path="/config" element={<ConfigPage />} />
              <Route path="/logs" element={<LogsPage />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster theme="light" />
    </div>
  );
}

export default App;
