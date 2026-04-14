use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Tenta iniciar o sidecar do backend
            // Em modo dev, o sidecar não existe — o backend roda manualmente
            let shell = app.shell();
            if let Ok(sidecar) = shell.sidecar("backend-api") {
                if let Ok((mut rx, _child)) = sidecar.spawn() {
                    println!("[tauri] Backend sidecar iniciado");
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    println!("[backend] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Stderr(line) => {
                                    eprintln!("[backend] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Terminated(status) => {
                                    println!("[backend] encerrado: {:?}", status);
                                }
                                _ => {}
                            }
                        }
                    });
                } else {
                    eprintln!("[tauri] Sidecar não pôde ser iniciado (modo dev — inicie o backend manualmente)");
                }
            } else {
                eprintln!("[tauri] Sidecar não encontrado (modo dev — inicie o backend manualmente)");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o aplicativo");
}
