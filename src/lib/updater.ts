import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

/**
 * Verifica se há uma nova versão publicada no GitHub Releases e, se houver,
 * oferece ao usuário baixar + instalar. Ao concluir, reinicia o app.
 *
 * É seguro chamar sempre no start: em modo dev (sem bundle do Tauri) a
 * checagem simplesmente falha silenciosamente.
 */
export async function checkForUpdates(options: { silent?: boolean } = {}) {
  const { silent = true } = options;

  let update;
  try {
    update = await check();
  } catch (err) {
    // Sem contexto Tauri (navegador/dev) ou sem rede — ignora quando silencioso.
    if (!silent) {
      toast.error("Não foi possível verificar atualizações", {
        description: String(err),
      });
    }
    return;
  }

  if (!update) {
    if (!silent) {
      toast.success("Você já está na versão mais recente.");
    }
    return;
  }

  toast.info(`Nova versão disponível: ${update.version}`, {
    description: update.body?.trim()
      ? update.body
      : "Clique para baixar e instalar a atualização.",
    duration: Infinity,
    action: {
      label: "Atualizar agora",
      onClick: () => installUpdate(update),
    },
  });
}

async function installUpdate(update: NonNullable<Awaited<ReturnType<typeof check>>>) {
  const progressId = toast.loading("Baixando atualização...", {
    duration: Infinity,
  });

  try {
    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength ?? 0;
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            const pct = Math.round((downloaded / contentLength) * 100);
            toast.loading(`Baixando atualização... ${pct}%`, {
              id: progressId,
              duration: Infinity,
            });
          }
          break;
        case "Finished":
          toast.loading("Instalando atualização...", {
            id: progressId,
            duration: Infinity,
          });
          break;
      }
    });

    toast.success("Atualização instalada. Reiniciando...", {
      id: progressId,
      duration: 3000,
    });

    // Dá um instante para o toast aparecer antes de reiniciar.
    setTimeout(() => {
      void relaunch();
    }, 1200);
  } catch (err) {
    toast.error("Falha ao instalar a atualização", {
      id: progressId,
      description: String(err),
      duration: 8000,
    });
  }
}
