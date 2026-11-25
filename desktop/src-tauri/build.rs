// The app manifest lists the one command, so the capability file must allow it by name.
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["press_key"])),
    )
    .expect("failed to run the Tauri build script")
}
