import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Trash2,
  X,
  Eye,
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
import { PageLoader } from "@/components/PageLoader";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ProductPicker } from "@/components/ProductPicker";

interface Movimentacao {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  descricao: string;
  valor: number;
  cliente_nome?: string | null;
  placa?: string | null;
  telefone?: string | null;
  created_at: string;
}

interface ItemMov {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  tipo: "PRODUTO" | "SERVICO";
}

interface MovDetalhe extends Movimentacao {
  itens: ItemMov[];
}

interface Resumo {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
}

interface Produto {
  id: number;
  nome: string;
  categoria: string;
  quantidade: number;
  preco_venda: number;
}

interface ItemForm {
  produto_id: number | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

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

function itemVazio(): ItemForm {
  return { produto_id: null, descricao: "", quantidade: 1, valor_unitario: 0 };
}

export default function FinanceiroPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
  });
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [detalhe, setDetalhe] = useState<MovDetalhe | null>(null);

  // Formulário: cabeçalho + campos da saída simples
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("ENTRADA");
  const [cliente, setCliente] = useState({ nome: "", placa: "", telefone: "" });
  const [itens, setItens] = useState<ItemForm[]>([itemVazio()]);
  const [saida, setSaida] = useState({
    categoria: "FORNECEDOR",
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
    } finally {
      setLoading(false);
    }
  }, [filtroTipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrirNovo() {
    setTipo("ENTRADA");
    setCliente({ nome: "", placa: "", telefone: "" });
    setItens([itemVazio()]);
    setSaida({ categoria: "FORNECEDOR", descricao: "", valor: 0 });
    try {
      const prods = await api.get<Produto[]>("/produtos");
      setProdutos(prods);
    } catch {
      setProdutos([]);
    }
    setDialogOpen(true);
  }

  function atualizarItem(index: number, patch: Partial<ItemForm>) {
    setItens((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    );
  }

  function selecionarProdutoLinha(index: number, produtoId: number | null) {
    if (produtoId === null) {
      atualizarItem(index, { produto_id: null });
      return;
    }
    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto) return;
    atualizarItem(index, {
      produto_id: produtoId,
      descricao: produto.nome,
      valor_unitario: produto.preco_venda,
    });
  }

  function adicionarItem() {
    setItens((prev) => [...prev, itemVazio()]);
  }

  function removerItem(index: number) {
    setItens((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  const totalGeral = itens.reduce(
    (acc, it) => acc + it.quantidade * it.valor_unitario,
    0
  );

  async function salvar() {
    setSalvando(true);
    try {
      if (tipo === "ENTRADA") {
        const validos = itens.filter(
          (it) => it.descricao.trim() && it.valor_unitario > 0 && it.quantidade > 0
        );
        if (validos.length === 0) {
          toast.error("Adicione ao menos um item com descrição e valor");
          return;
        }
        await api.post("/financeiro", {
          tipo: "ENTRADA",
          cliente_nome: cliente.nome.trim() || null,
          placa: cliente.placa.trim() || null,
          telefone: cliente.telefone.trim() || null,
          itens: validos.map((it) => ({
            produto_id: it.produto_id,
            descricao: it.descricao.trim(),
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
          })),
        });
      } else {
        if (!saida.descricao.trim() || saida.valor <= 0) {
          toast.error("Preencha descrição e valor");
          return;
        }
        await api.post("/financeiro", {
          tipo: "SAIDA",
          categoria: saida.categoria,
          descricao: saida.descricao.trim(),
          valor: saida.valor,
        });
      }
      toast.success("Movimentação registrada");
      setDialogOpen(false);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function verDetalhe(id: number) {
    try {
      const det = await api.get<MovDetalhe>(`/financeiro/${id}`);
      setDetalhe(det);
    } catch {
      toast.error("Erro ao carregar detalhes");
    }
  }

  async function deletar(id: number) {
    try {
      await api.delete(`/financeiro/${id}`);
      toast.success("Movimentação excluída");
      carregar();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  if (loading) return <PageLoader />;

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
            <SelectValue placeholder="Todos">
              {filtroTipo === "ENTRADA"
                ? "Entradas"
                : filtroTipo === "SAIDA"
                  ? "Saídas"
                  : "Todos"}
            </SelectValue>
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
                  <td className="p-3 text-sm">
                    {m.descricao}
                    {m.cliente_nome && (
                      <span className="block text-xs text-muted-foreground">
                        Cliente: {m.cliente_nome}
                        {m.placa ? ` · ${m.placa}` : ""}
                      </span>
                    )}
                  </td>
                  <td
                    className={`text-right p-3 font-mono font-bold ${
                      m.tipo === "ENTRADA" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {m.tipo === "ENTRADA" ? "+" : "-"} R${" "}
                    {m.valor.toFixed(2)}
                  </td>
                  <td className="text-center p-3">
                    <div className="flex items-center justify-center gap-1">
                      {m.tipo === "ENTRADA" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => verDetalhe(m.id)}
                          title="Ver itens"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setConfirmDelete(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog nova movimentação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={tipo}
                onValueChange={(v) => v && setTipo(v as "ENTRADA" | "SAIDA")}
              >
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {tipo === "ENTRADA" ? "Entrada (venda/serviço)" : "Saída"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada (venda/serviço)</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === "ENTRADA" ? (
              <>
                {/* Dados do cliente/veículo */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Cliente</Label>
                    <Input
                      value={cliente.nome}
                      onChange={(e) =>
                        setCliente({ ...cliente, nome: e.target.value })
                      }
                      placeholder="Nome (opcional)"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label>Placa</Label>
                    <Input
                      value={cliente.placa}
                      onChange={(e) =>
                        setCliente({ ...cliente, placa: e.target.value })
                      }
                      placeholder="Opcional"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={cliente.telefone}
                      onChange={(e) =>
                        setCliente({ ...cliente, telefone: e.target.value })
                      }
                      placeholder="Opcional"
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Itens do pedido */}
                <div className="space-y-3">
                  <Label>Itens (produtos e serviços)</Label>
                  {itens.map((it, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <ProductPicker
                            produtos={produtos}
                            value={it.produto_id}
                            onChange={(id) => selecionarProdutoLinha(i, id)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive shrink-0"
                          onClick={() => removerItem(i)}
                          disabled={itens.length === 1}
                          title="Remover item"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            Discriminação
                          </Label>
                          <Input
                            value={it.descricao}
                            onChange={(e) =>
                              atualizarItem(i, { descricao: e.target.value })
                            }
                            placeholder="Produto ou serviço"
                            className="h-11"
                          />
                        </div>
                        <div className="w-16">
                          <Label className="text-xs text-muted-foreground">
                            Qtd
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantidade}
                            onChange={(e) =>
                              atualizarItem(i, {
                                quantidade: parseInt(e.target.value) || 1,
                              })
                            }
                            className="h-11"
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs text-muted-foreground">
                            Unitário (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={it.valor_unitario}
                            onChange={(e) =>
                              atualizarItem(i, {
                                valor_unitario: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="h-11"
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs text-muted-foreground">
                            Total
                          </Label>
                          <div className="h-11 flex items-center px-2 font-mono text-sm">
                            R$ {(it.quantidade * it.valor_unitario).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={adicionarItem}
                    className="gap-2 w-full"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar item
                  </Button>
                </div>

                {/* Total Geral */}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="font-medium">Total Geral</span>
                  <span className="text-xl font-bold text-green-600 font-mono">
                    R$ {totalGeral.toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={saida.categoria}
                    onValueChange={(v) =>
                      v && setSaida({ ...saida, categoria: v })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue>
                        {CATEGORIAS_SAIDA.find((c) => c.value === saida.categoria)
                          ?.label ?? saida.categoria}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_SAIDA.map((c) => (
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
                    value={saida.descricao}
                    onChange={(e) =>
                      setSaida({ ...saida, descricao: e.target.value })
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
                    value={saida.valor}
                    onChange={(e) =>
                      setSaida({ ...saida, valor: parseFloat(e.target.value) || 0 })
                    }
                    className="h-11"
                  />
                </div>
              </>
            )}

            <Button
              onClick={salvar}
              size="lg"
              className="w-full"
              disabled={salvando}
            >
              {salvando ? "Salvando..." : "Registrar Movimentação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog detalhe do pedido */}
      <Dialog open={detalhe !== null} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4 pt-2">
              {(detalhe.cliente_nome || detalhe.placa || detalhe.telefone) && (
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {detalhe.cliente_nome && <p>Cliente: {detalhe.cliente_nome}</p>}
                  {detalhe.placa && <p>Placa: {detalhe.placa}</p>}
                  {detalhe.telefone && <p>Telefone: {detalhe.telefone}</p>}
                </div>
              )}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-center p-2 font-medium w-12">Qtd</th>
                      <th className="text-left p-2 font-medium">Discriminação</th>
                      <th className="text-right p-2 font-medium">Unitário</th>
                      <th className="text-right p-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.itens.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="text-center p-2">{it.quantidade}</td>
                        <td className="p-2">
                          {it.descricao}
                          {it.tipo === "SERVICO" && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Serviço
                            </Badge>
                          )}
                        </td>
                        <td className="text-right p-2 font-mono">
                          R$ {it.valor_unitario.toFixed(2)}
                        </td>
                        <td className="text-right p-2 font-mono">
                          R$ {it.valor_total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="font-medium">Total Geral</span>
                <span className="text-xl font-bold text-green-600 font-mono">
                  R$ {detalhe.valor.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Excluir movimentação"
        description="Tem certeza que deseja excluir esta movimentação?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (confirmDelete) deletar(confirmDelete);
        }}
      />
    </div>
  );
}
