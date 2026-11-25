// The app manifest lists the three commands, so the capability file must allow each one by name.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["press_key", "read_window", "run_action"]),
    ))
    .expect("failed to run the Tauri build script")
}
