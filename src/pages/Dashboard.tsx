import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

interface DashboardData {
  entradas_hoje: number;
  saidas_hoje: number;
  saldo_hoje: number;
  total_produtos: number;
  produtos_alerta: number;
  total_clientes: number;
  dividas_pendentes: number;
  valor_total_dividas: number;
  valor_recebido_dividas: number;
}

interface FluxoSemanal {
  dia: string;
  dia_semana: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tooltipFormatter(value: any, name: any) {
  return [
    formatCurrency(Number(value)),
    name === "entradas" ? "Entradas" : "Saídas",
  ];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fluxo, setFluxo] = useState<FluxoSemanal[]>([]);
  const [periodoFluxo, setPeriodoFluxo] = useState(7);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setData);
  }, []);

  useEffect(() => {
    api
      .get<FluxoSemanal[]>(`/dashboard/fluxo-semanal?dias=${periodoFluxo}`)
      .then(setFluxo);
  }, [periodoFluxo]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const valorRestanteDividas =
    data.valor_total_dividas - data.valor_recebido_dividas;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Cards KPI - linha 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/financeiro")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas Hoje
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">
              {formatCurrency(data.entradas_hoje)}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/financeiro")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas Hoje
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-500">
              {formatCurrency(data.saidas_hoje)}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/financeiro")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo do Dia
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                data.saldo_hoje >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {formatCurrency(data.saldo_hoje)}
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/fiado")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fiado Pendente
            </CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">
              {formatCurrency(valorRestanteDividas)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.dividas_pendentes} dívida(s) — {data.total_clientes}{" "}
              cliente(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards KPI - linha 2 */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/estoque")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produtos Cadastrados
            </CardTitle>
            <Package className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.total_produtos}</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover:shadow-md transition-shadow ${
            data.produtos_alerta > 0 ? "border-rose-200" : ""
          }`}
          onClick={() => navigate("/estoque")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alertas de Estoque
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                data.produtos_alerta > 0
                  ? "text-rose-500"
                  : "text-muted-foreground"
              }`}
            />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                data.produtos_alerta > 0 ? "text-rose-500" : ""
              }`}
            >
              {data.produtos_alerta}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Fluxo de Caixa</CardTitle>
          <div className="flex gap-1">
            {[
              { label: "7D", value: 7 },
              { label: "15D", value: 15 },
              { label: "30D", value: 30 },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodoFluxo(p.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  periodoFluxo === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={fluxo}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
              <XAxis
                dataKey={(d: FluxoSemanal) => `${d.dia_semana} ${d.dia}`}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e5e5" }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${v}`}
                width={70}
              />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e5e5",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "13px",
                }}
              />
              <Legend
                formatter={(value) =>
                  value === "entradas" ? "Entradas" : "Saídas"
                }
                iconType="circle"
                wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }}
              />
              <Line
                type="monotone"
                dataKey="entradas"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="saidas"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "#f43f5e", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
