import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Movimentacao {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  descricao: string;
  valor: number;
  created_at: string;
}

interface Resumo {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
}

const CATEGORIAS_ENTRADA = [
  { value: "VENDA", label: "Venda de Produto" },
  { value: "SERVICO", label: "Prestação de Serviço" },
  { value: "RECEBIMENTO_DIVIDA", label: "Recebimento de Dívida" },
];

const CATEGORIAS_SAIDA = [
  { value: "FORNECEDOR", label: "Pagamento Fornecedor" },
  { value: "CONTA_FIXA", label: "Conta Fixa (Luz, Água...)" },
  { value: "DESPESA_OPERACIONAL", label: "Despesa Operacional" },
];

const LABELS_CATEGORIA: Record<string, string> = {
  VENDA: "Venda",
  SERVICO: "Serviço",
  RECEBIMENTO_DIVIDA: "Receb. Dívida",
  FORNECEDOR: "Fornecedor",
  CONTA_FIXA: "Conta Fixa",
  DESPESA_OPERACIONAL: "Desp. Operacional",
};

export default function FinanceiroPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [form, setForm] = useState({
    tipo: "ENTRADA" as "ENTRADA" | "SAIDA",
    categoria: "VENDA",
    descricao: "",
    valor: 0,
  });

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set("tipo", filtroTipo);
      const query = params.toString();
      const [movs, res] = await Promise.all([
        api.get<Movimentacao[]>(`/financeiro${query ? `?${query}` : ""}`),
        api.get<Resumo>("/financeiro/resumo"),
      ]);
      setMovimentacoes(movs);
      setResumo(res);
    } catch {
      toast.error("Erro ao carregar dados financeiros");
    }
  }, [filtroTipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirNovo() {
    setForm({ tipo: "ENTRADA", categoria: "VENDA", descricao: "", valor: 0 });
    setDialogOpen(true);
  }

  async function salvar() {
    if (!form.descricao || form.valor <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    try {
      await api.post("/financeiro", form);
      toast.success("Movimentação registrada");
      setDialogOpen(false);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function deletar(id: number) {
    if (!confirm("Excluir esta movimentação?")) return;
    try {
      await api.delete(`/financeiro/${id}`);
      toast.success("Movimentação excluída");
      carregar();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  const categorias =
    form.tipo === "ENTRADA" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Financeiro</h2>
        <Button onClick={abrirNovo} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Nova Movimentação
        </Button>
      </div>

      {/* Cards resumo do dia */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas Hoje
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {resumo.total_entradas.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas Hoje
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              R$ {resumo.total_saidas.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo do Dia
            </CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                resumo.saldo >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              R$ {resumo.saldo.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div>
        <Select
          value={filtroTipo || "TODOS"}
          onValueChange={(v) => setFiltroTipo(v === "TODOS" ? "" : v ?? "")}
        >
          <SelectTrigger className="w-48 h-12">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="ENTRADA">Entradas</SelectItem>
            <SelectItem value="SAIDA">Saídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Data/Hora</th>
              <th className="text-left p-3 font-medium">Tipo</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-left p-3 font-medium">Descrição</th>
              <th className="text-right p-3 font-medium">Valor</th>
              <th className="text-center p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center p-8 text-muted-foreground"
                >
                  Nenhuma movimentação registrada
                </td>
              </tr>
            ) : (
              movimentacoes.map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 text-sm">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        m.tipo === "ENTRADA" ? "default" : "destructive"
                      }
                    >
                      {m.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm">
                    {LABELS_CATEGORIA[m.categoria] || m.categoria}
                  </td>
                  <td className="p-3 text-sm">{m.descricao}</td>
                  <td
                    className={`text-right p-3 font-mono font-bold ${
                      m.tipo === "ENTRADA" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {m.tipo === "ENTRADA" ? "+" : "-"} R${" "}
                    {m.valor.toFixed(2)}
                  </td>
                  <td className="text-center p-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deletar(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog nova movimentação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) =>
                  v &&
                  setForm({
                    ...form,
                    tipo: v as "ENTRADA" | "SAIDA",
                    categoria:
                      v === "ENTRADA"
                        ? CATEGORIAS_ENTRADA[0].value
                        : CATEGORIAS_SAIDA[0].value,
                  })
                }
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => v && setForm({ ...form, categoria: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Descreva a movimentação..."
                rows={2}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) =>
                  setForm({
                    ...form,
                    valor: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-11"
              />
            </div>
            <Button onClick={salvar} size="lg" className="w-full">
              Registrar Movimentação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
