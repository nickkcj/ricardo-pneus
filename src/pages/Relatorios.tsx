import { useCallback, useEffect, useState } from "react";
import {
  FileBarChart,
  Download,
  Package,
  DollarSign,
  Users,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "@/lib/api";

interface RelatorioGeral {
  estoque: {
    total_produtos: number;
    quantidade_total: number;
    valor_custo: number;
    valor_venda: number;
    itens_em_alerta: number;
    por_categoria: {
      categoria: string;
      itens: number;
      quantidade: number;
      valor_custo: number;
      valor_venda: number;
    }[];
  };
  faturamento: {
    entradas: number;
    saidas: number;
    saldo: number;
    entradas_por_categoria: { categoria: string; valor: number }[];
    saidas_por_categoria: { categoria: string; valor: number }[];
  };
  fiado: {
    total_clientes: number;
    dividas_pendentes: number;
    valor_pendente: number;
  };
  periodo: { inicio: string; fim: string };
}

const CATEGORIA_FIN_LABELS: Record<string, string> = {
  VENDA: "Vendas",
  SERVICO: "Serviços",
  RECEBIMENTO_DIVIDA: "Recebimento de fiado",
  FORNECEDOR: "Fornecedores",
  CONTA_FIXA: "Contas fixas",
  DESPESA_OPERACIONAL: "Despesas operacionais",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function primeiroDiaDoMes(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
}

function hojeISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;
}

export default function RelatoriosPage() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hojeISO());
  const [data, setData] = useState<RelatorioGeral | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await api.get<RelatorioGeral>(
        `/relatorios/geral?inicio=${inicio}&fim=${fim}`
      );
      setData(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar relatório");
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function exportar() {
    const pasta = await open({
      directory: true,
      multiple: false,
      title: "Escolha a pasta para salvar os relatórios",
    });
    if (!pasta) return;

    setExportando(true);
    try {
      const res = await api.post<{ ok: boolean; arquivos: string[]; pasta: string }>(
        "/relatorios/exportar",
        { pasta_destino: pasta, inicio, fim }
      );
      toast.success(
        `${res.arquivos.length} arquivos exportados em ${res.pasta}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileBarChart className="h-6 w-6" />
          Relatórios
        </h2>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <Label htmlFor="inicio">Data inicial</Label>
            <Input
              id="inicio"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label htmlFor="fim">Data final</Label>
            <Input
              id="fim"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="w-44"
            />
          </div>
          <Button variant="outline" onClick={carregar} disabled={carregando} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <div className="ml-auto">
            <Button onClick={exportar} disabled={exportando || !data} size="lg" className="gap-2">
              {exportando ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {!data ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Valor em Estoque (venda)
                </CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(data.estoque.valor_venda)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  custo {formatCurrency(data.estoque.valor_custo)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Faturamento (entradas)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-500">
                  {formatCurrency(data.faturamento.entradas)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  saídas {formatCurrency(data.faturamento.saidas)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saldo do Período
                </CardTitle>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    data.faturamento.saldo >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {formatCurrency(data.faturamento.saldo)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fiado a Receber
                </CardTitle>
                <Users className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-500">
                  {formatCurrency(data.fiado.valor_pendente)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.fiado.dividas_pendentes} dívida(s)
                </p>
              </CardContent>
            </Card>
          </div>

          {data.estoque.itens_em_alerta > 0 && (
            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2">
              <AlertTriangle className="h-4 w-4" />
              {data.estoque.itens_em_alerta} item(ns) abaixo do estoque mínimo.
            </div>
          )}

          {/* Estoque por categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estoque por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor (custo)</TableHead>
                    <TableHead className="text-right">Valor (venda)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.estoque.por_categoria.map((c) => (
                    <TableRow key={c.categoria}>
                      <TableCell className="font-medium">{c.categoria}</TableCell>
                      <TableCell className="text-right">{c.itens}</TableCell>
                      <TableCell className="text-right">{c.quantidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.valor_custo)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.valor_venda)}</TableCell>
                    </TableRow>
                  ))}
                  {data.estoque.por_categoria.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum produto cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Faturamento por categoria */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-emerald-600">Entradas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {data.faturamento.entradas_por_categoria.map((c) => (
                      <TableRow key={c.categoria}>
                        <TableCell>
                          {CATEGORIA_FIN_LABELS[c.categoria] ?? c.categoria}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(c.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.faturamento.entradas_por_categoria.length === 0 && (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground">
                          Sem entradas no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-rose-600">Saídas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {data.faturamento.saidas_por_categoria.map((c) => (
                      <TableRow key={c.categoria}>
                        <TableCell>
                          {CATEGORIA_FIN_LABELS[c.categoria] ?? c.categoria}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(c.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.faturamento.saidas_por_categoria.length === 0 && (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground">
                          Sem saídas no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
