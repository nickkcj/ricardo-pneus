import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";
import EstoquePage from "@/pages/Estoque";
import FinanceiroPage from "@/pages/Financeiro";
import FiadoPage from "@/pages/Fiado";
import BackupPage from "@/pages/Backup";
import DashboardPage from "@/pages/Dashboard";

function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="/fiado" element={<FiadoPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
