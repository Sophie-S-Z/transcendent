// Release builds on Windows open no console window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use controls::{Kind, Window};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};

// The reader types are used only on Windows and in tests.
#[cfg_attr(not(windows), allow(dead_code))]
mod controls;
#[cfg(windows)]
mod uia;

/// Other systems have no UI Automation, so Predict mode is off there.
#[cfg(not(windows))]
mod uia {
    use crate::controls::{Kind, Window};

    const NEEDS_WINDOWS: &str = "Predict mode needs Windows.";

    pub fn read_window() -> Result<Window, String> {
        Err(NEEDS_WINDOWS.into())
    }

    pub fn run_action(_: &str, _: Kind, _: &str, _: &str) -> Result<(), String> {
        Err(NEEDS_WINDOWS.into())
    }
}

/// The keys that the switch can send. Windows On-Screen Keyboard scan mode selects with Space.
/// Many switch interfaces send Enter.
fn key_for(name: &str) -> Option<Key> {
    match name {
        "Space" => Some(Key::Space),
        "Enter" => Some(Key::Return),
        _ => None,
    }
}

/// Sends one key down and one key up to the system. Rejects a key that is not in the list.
#[tauri::command]
fn press_key(key: String) -> Result<(), String> {
    let k = key_for(&key).ok_or(format!("Key not allowed: {key}"))?;
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(k, Direction::Click).map_err(|e| e.to_string())
}

/// Reads the foreground app window for Predict mode. It runs off the main thread, so the window stays live.
#[tauri::command(async)]
fn read_window() -> Result<Window, String> {
    uia::read_window()
}

/// Runs one control of the window that read_window read. `label` is the label that the user saw.
#[tauri::command(async)]
fn run_action(id: String, kind: Kind, label: String, text: Option<String>) -> Result<(), String> {
    uia::run_action(&id, kind, &label, &text.unwrap_or_default())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![press_key, read_window, run_action])
        .run(tauri::generate_context!())
        .expect("failed to start the app");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_only_listed_keys() {
        assert_eq!(key_for("Space"), Some(Key::Space));
        assert_eq!(key_for("Enter"), Some(Key::Return));
        assert_eq!(key_for("a"), None);
        assert_eq!(key_for("space"), None);
    }
}
