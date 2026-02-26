import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { Layout } from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ConnectionPage from "./pages/ConnectionPage";
import ChatsPage from "./pages/ChatsPage";
import ConfigPage from "./pages/ConfigPage";
import LogsPage from "./pages/LogsPage";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/connect" element={<ConnectionPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
