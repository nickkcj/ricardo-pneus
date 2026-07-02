import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";
import { checkForUpdates } from "@/lib/updater";
import EstoquePage from "@/pages/Estoque";
import FinanceiroPage from "@/pages/Financeiro";
import FiadoPage from "@/pages/Fiado";
import BackupPage from "@/pages/Backup";
import DashboardPage from "@/pages/Dashboard";
import RelatoriosPage from "@/pages/Relatorios";

function App() {
  useEffect(() => {
    // Verifica atualizações ao abrir o app (silencioso se já estiver atualizado).
    void checkForUpdates();
  }, []);

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/financeiro" element={<FinanceiroPage />} />
          <Route path="/fiado" element={<FiadoPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
