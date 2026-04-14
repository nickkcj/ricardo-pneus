import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Minus,
  AlertTriangle,
  Pencil,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Produto {
  id: number;
  nome: string;
  categoria: string;
  subcategoria: string | null;
  quantidade: number;
  quantidade_minima: number;
  preco_compra: number;
  preco_venda: number;
}

const CATEGORIAS = [
  { value: "PNEU", label: "Pneu" },
  { value: "OLEO", label: "Óleo" },
  { value: "BATERIA", label: "Bateria" },
  { value: "FILTRO", label: "Filtro" },
  { value: "CAMARA", label: "Câmara" },
  { value: "VALVULA", label: "Válvula" },
];

const SUBCATEGORIAS = [
  { value: "CARRO", label: "Carro" },
  { value: "MOTO", label: "Moto" },
  { value: "CAMINHAO", label: "Caminhão" },
  { value: "EMPILHADEIRA", label: "Empilhadeira" },
];

const emptyForm = {
  nome: "",
  categoria: "PNEU",
  subcategoria: "",
  quantidade: 0,
  quantidade_minima: 0,
  preco_compra: 0,
  preco_venda: 0,
};

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const carregarProdutos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      if (filtroCategoria) params.set("categoria", filtroCategoria);
      const query = params.toString();
      const data = await api.get<Produto[]>(
        `/produtos${query ? `?${query}` : ""}`
      );
      setProdutos(data);
    } catch {
      toast.error("Erro ao carregar produtos");
    }
  }, [busca, filtroCategoria]);

  useEffect(() => {
    const timer = setTimeout(carregarProdutos, 300);
    return () => clearTimeout(timer);
  }, [carregarProdutos]);

  function abrirNovo() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function abrirEdicao(p: Produto) {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      categoria: p.categoria,
      subcategoria: p.subcategoria || "",
      quantidade: p.quantidade,
      quantidade_minima: p.quantidade_minima,
      preco_compra: p.preco_compra,
      preco_venda: p.preco_venda,
    });
    setDialogOpen(true);
  }

  async function salvar() {
    try {
      const payload = {
        ...form,
        subcategoria: form.subcategoria || null,
      };
      if (editingId) {
        await api.put(`/produtos/${editingId}`, payload);
        toast.success("Produto atualizado");
      } else {
        await api.post("/produtos", payload);
        toast.success("Produto cadastrado");
      }
      setDialogOpen(false);
      carregarProdutos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function deletar(id: number) {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      await api.delete(`/produtos/${id}`);
      toast.success("Produto excluído");
      carregarProdutos();
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  async function ajustarEstoque(
    id: number,
    tipo: "ENTRADA" | "SAIDA",
    quantidade: number
  ) {
    try {
      await api.post(`/produtos/${id}/movimentacao`, { tipo, quantidade });
      carregarProdutos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao ajustar estoque");
    }
  }

  const estoqueAlerta = (p: Produto) => p.quantidade <= p.quantidade_minima;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Estoque</h2>
        <Button onClick={abrirNovo} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Novo Produto
        </Button>
      </div>

      {/* Barra de busca e filtro */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Select
          value={filtroCategoria}
          onValueChange={(v) => setFiltroCategoria(!v || v === "TODAS" ? "" : v)}
        >
          <SelectTrigger className="w-48 h-12">
            <SelectValue placeholder="Todas categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de produtos */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Produto</th>
              <th className="text-left p-3 font-medium">Categoria</th>
              <th className="text-center p-3 font-medium">Qtd</th>
              <th className="text-right p-3 font-medium">Preço Venda</th>
              <th className="text-center p-3 font-medium">Estoque</th>
              <th className="text-center p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-muted-foreground">
                  Nenhum produto encontrado
                </td>
              </tr>
            ) : (
              produtos.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{p.nome}</div>
                    {p.subcategoria && (
                      <span className="text-xs text-muted-foreground">
                        {p.subcategoria}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary">{p.categoria}</Badge>
                  </td>
                  <td className="text-center p-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => ajustarEstoque(p.id, "SAIDA", 1)}
                        disabled={p.quantidade <= 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-10 text-center font-mono font-bold">
                        {p.quantidade}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => ajustarEstoque(p.id, "ENTRADA", 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="text-right p-3 font-mono">
                    R$ {p.preco_venda.toFixed(2)}
                  </td>
                  <td className="text-center p-3">
                    {estoqueAlerta(p) && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Baixo
                      </Badge>
                    )}
                  </td>
                  <td className="text-center p-3">
                    <div className="flex justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => abrirEdicao(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deletar(p.id)}
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

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Pneu 175/70 R13"
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subcategoria</Label>
                <Select
                  value={form.subcategoria || "NENHUMA"}
                  onValueChange={(v) =>
                    setForm({ ...form, subcategoria: !v || v === "NENHUMA" ? "" : v })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                    {SUBCATEGORIAS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  value={form.quantidade}
                  onChange={(e) =>
                    setForm({ ...form, quantidade: parseInt(e.target.value) || 0 })
                  }
                  className="h-11"
                  disabled={!!editingId}
                />
              </div>
              <div>
                <Label>Qtd Mínima</Label>
                <Input
                  type="number"
                  value={form.quantidade_minima}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quantidade_minima: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-11"
                />
              </div>
              <div>
                <Label>Preço Compra</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preco_compra}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      preco_compra: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-11"
                />
              </div>
            </div>
            <div>
              <Label>Preço Venda</Label>
              <Input
                type="number"
                step="0.01"
                value={form.preco_venda}
                onChange={(e) =>
                  setForm({
                    ...form,
                    preco_venda: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-11"
              />
            </div>
            <Button onClick={salvar} size="lg" className="w-full">
              {editingId ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
