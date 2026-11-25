// Release builds on Windows open no console window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use enigo::{Direction, Enigo, Key, Keyboard, Settings};

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![press_key])
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
