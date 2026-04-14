import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Cliente {
  id: number;
  nome: string;
  telefone: string | null;
}

interface Divida {
  id: number;
  cliente_id: number;
  descricao: string;
  valor_total: number;
  valor_pago: number;
  quitada: boolean;
  created_at: string;
}

export default function FiadoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<number | null>(null);
  const [dividas, setDividas] = useState<Divida[]>([]);

  // Dialogs
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [dividaDialogOpen, setDividaDialogOpen] = useState(false);
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState<number | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(
    null
  );
  const [selectedDividaId, setSelectedDividaId] = useState<number | null>(null);
  const [selectedDividaRestante, setSelectedDividaRestante] = useState(0);

  const [clienteForm, setClienteForm] = useState({ nome: "", telefone: "" });
  const [dividaForm, setDividaForm] = useState({
    descricao: "",
    valor_total: 0,
  });
  const [pagamentoValor, setPagamentoValor] = useState(0);

  const carregarClientes = useCallback(async () => {
    try {
      const params = busca ? `?busca=${encodeURIComponent(busca)}` : "";
      const data = await api.get<Cliente[]>(`/clientes${params}`);
      setClientes(data);
    } catch {
      toast.error("Erro ao carregar clientes");
    }
  }, [busca]);

  useEffect(() => {
    const timer = setTimeout(carregarClientes, 300);
    return () => clearTimeout(timer);
  }, [carregarClientes]);

  async function carregarDividas(clienteId: number) {
    try {
      const data = await api.get<Divida[]>(`/clientes/${clienteId}/dividas`);
      setDividas(data);
    } catch {
      toast.error("Erro ao carregar dívidas");
    }
  }

  function toggleExpandir(clienteId: number) {
    if (expandido === clienteId) {
      setExpandido(null);
      setDividas([]);
    } else {
      setExpandido(clienteId);
      carregarDividas(clienteId);
    }
  }

  // --- Clientes ---
  function abrirNovoCliente() {
    setEditingClienteId(null);
    setClienteForm({ nome: "", telefone: "" });
    setClienteDialogOpen(true);
  }

  function abrirEditarCliente(c: Cliente) {
    setEditingClienteId(c.id);
    setClienteForm({ nome: c.nome, telefone: c.telefone || "" });
    setClienteDialogOpen(true);
  }

  async function salvarCliente() {
    if (!clienteForm.nome) {
      toast.error("Informe o nome do cliente");
      return;
    }
    try {
      const payload = {
        ...clienteForm,
        telefone: clienteForm.telefone || null,
      };
      if (editingClienteId) {
        await api.put(`/clientes/${editingClienteId}`, payload);
        toast.success("Cliente atualizado");
      } else {
        await api.post("/clientes", payload);
        toast.success("Cliente cadastrado");
      }
      setClienteDialogOpen(false);
      carregarClientes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function deletarCliente(id: number) {
    if (!confirm("Excluir este cliente e todas as suas dívidas?")) return;
    try {
      await api.delete(`/clientes/${id}`);
      toast.success("Cliente excluído");
      if (expandido === id) setExpandido(null);
      carregarClientes();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  // --- Dívidas ---
  function abrirNovaDivida(clienteId: number) {
    setSelectedClienteId(clienteId);
    setDividaForm({ descricao: "", valor_total: 0 });
    setDividaDialogOpen(true);
  }

  async function salvarDivida() {
    if (!dividaForm.descricao || dividaForm.valor_total <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    try {
      await api.post(`/clientes/${selectedClienteId}/dividas`, dividaForm);
      toast.success("Dívida registrada");
      setDividaDialogOpen(false);
      if (selectedClienteId) carregarDividas(selectedClienteId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function deletarDivida(dividaId: number) {
    if (!confirm("Excluir esta dívida?")) return;
    try {
      await api.delete(`/clientes/dividas/${dividaId}`);
      toast.success("Dívida excluída");
      if (expandido) carregarDividas(expandido);
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  // --- Pagamentos ---
  function abrirPagamento(divida: Divida) {
    setSelectedDividaId(divida.id);
    const restante = divida.valor_total - divida.valor_pago;
    setSelectedDividaRestante(restante);
    setPagamentoValor(restante);
    setPagamentoDialogOpen(true);
  }

  async function registrarPagamento() {
    if (pagamentoValor <= 0) {
      toast.error("Informe um valor");
      return;
    }
    try {
      await api.post(`/clientes/dividas/${selectedDividaId}/pagamento`, {
        valor: pagamentoValor,
      });
      toast.success("Pagamento registrado");
      setPagamentoDialogOpen(false);
      if (expandido) carregarDividas(expandido);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar");
    }
  }

  function totalDivida(clienteId: number): { total: number; pago: number } {
    if (expandido !== clienteId)
      return { total: 0, pago: 0 };
    return dividas.reduce(
      (acc, d) => ({
        total: acc.total + d.valor_total,
        pago: acc.pago + d.valor_pago,
      }),
      { total: 0, pago: 0 }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Fiado</h2>
        <Button onClick={abrirNovoCliente} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Novo Cliente
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Lista de clientes */}
      <div className="space-y-2">
        {clientes.length === 0 ? (
          <p className="text-center p-8 text-muted-foreground">
            Nenhum cliente encontrado
          </p>
        ) : (
          clientes.map((c) => (
            <div key={c.id} className="border rounded-lg overflow-hidden">
              {/* Header do cliente */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleExpandir(c.id)}
              >
                <div className="flex items-center gap-3">
                  {expandido === c.id ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{c.nome}</p>
                    {c.telefone && (
                      <p className="text-sm text-muted-foreground">
                        {c.telefone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEditarCliente(c);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletarCliente(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Dívidas expandidas */}
              {expandido === c.id && (
                <div className="border-t bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Total: R$ {totalDivida(c.id).total.toFixed(2)} | Pago: R${" "}
                      {totalDivida(c.id).pago.toFixed(2)} |{" "}
                      <span className="font-bold text-foreground">
                        Restante: R${" "}
                        {(
                          totalDivida(c.id).total - totalDivida(c.id).pago
                        ).toFixed(2)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => abrirNovaDivida(c.id)}
                    >
                      <Plus className="h-4 w-4" />
                      Nova Dívida
                    </Button>
                  </div>

                  {dividas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma dívida registrada
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dividas.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-3 bg-background rounded border"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {d.descricao}
                              </p>
                              {d.quitada ? (
                                <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                  <Check className="h-3 w-3" />
                                  Quitada
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="gap-1">
                                  Pendente
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(d.created_at).toLocaleDateString(
                                "pt-BR"
                              )}{" "}
                              — Total: R$ {d.valor_total.toFixed(2)} | Pago: R${" "}
                              {d.valor_pago.toFixed(2)} | Restante: R${" "}
                              {(d.valor_total - d.valor_pago).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {!d.quitada && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => abrirPagamento(d)}
                              >
                                <CircleDollarSign className="h-4 w-4" />
                                Pagar
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deletarDivida(d.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Dialog cliente */}
      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClienteId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={clienteForm.nome}
                onChange={(e) =>
                  setClienteForm({ ...clienteForm, nome: e.target.value })
                }
                placeholder="Nome do cliente"
                className="h-11"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={clienteForm.telefone}
                onChange={(e) =>
                  setClienteForm({ ...clienteForm, telefone: e.target.value })
                }
                placeholder="(11) 99999-9999"
                className="h-11"
              />
            </div>
            <Button onClick={salvarCliente} size="lg" className="w-full">
              {editingClienteId ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog dívida */}
      <Dialog open={dividaDialogOpen} onOpenChange={setDividaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Dívida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={dividaForm.descricao}
                onChange={(e) =>
                  setDividaForm({ ...dividaForm, descricao: e.target.value })
                }
                placeholder="Descreva a compra..."
                rows={2}
              />
            </div>
            <div>
              <Label>Valor Total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={dividaForm.valor_total}
                onChange={(e) =>
                  setDividaForm({
                    ...dividaForm,
                    valor_total: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-11"
              />
            </div>
            <Button onClick={salvarDivida} size="lg" className="w-full">
              Registrar Dívida
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pagamento */}
      <Dialog
        open={pagamentoDialogOpen}
        onOpenChange={setPagamentoDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Valor restante: R$ {selectedDividaRestante.toFixed(2)}
            </p>
            <div>
              <Label>Valor do Pagamento (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={pagamentoValor}
                onChange={(e) =>
                  setPagamentoValor(parseFloat(e.target.value) || 0)
                }
                className="h-11"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPagamentoValor(selectedDividaRestante)}
              >
                Quitar Total
              </Button>
              <Button
                onClick={registrarPagamento}
                size="lg"
                className="flex-1"
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
