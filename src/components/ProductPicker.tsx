import { useState, useRef, useEffect } from "react";
import { Search, Check, ChevronsUpDown } from "lucide-react";

interface Produto {
  id: number;
  nome: string;
  categoria: string;
  quantidade: number;
  preco_venda: number;
}

interface ProductPickerProps {
  produtos: Produto[];
  value: number | null;
  onChange: (produtoId: number | null) => void;
}

export function ProductPicker({ produtos, value, onChange }: ProductPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = produtos.find((p) => p.id === value);

  const filtered = produtos.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch("");
        }}
        className="flex items-center justify-between h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected
            ? `${selected.nome} — R$ ${selected.preco_venda.toFixed(2)}`
            : "Selecionar produto..."}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              <span className="w-4" />
              <span className="text-muted-foreground">Sem produto (manual)</span>
            </button>
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhum produto encontrado
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  <span className="w-4 flex items-center justify-center">
                    {value === p.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 text-left">
                    <span className="font-medium">{p.nome}</span>
                    <span className="text-muted-foreground ml-2">
                      R$ {p.preco_venda.toFixed(2)} · {p.quantidade} em estoque
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
