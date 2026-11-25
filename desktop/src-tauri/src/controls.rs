// Pure parts of the window reader: the records that the frontend gets, and the rules that map one control
// to a kind and a region. They take plain values, not COM objects, so the tests run on every system.

use serde::{Deserialize, Serialize};

/// What a select does with a control. Each kind uses one UI Automation pattern.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Invoke,
    Toggle,
    Select,
    Expand,
    Type,
    Focus,
}

/// Menus, toolbars, and the title bar are "nav". Status bars and scroll bars are "other".
#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Region {
    Main,
    Nav,
    Other,
}

/// One control that the user can run. `fill` marks an empty field.
/// A password field has the kind Type, and `password` tells the frontend never to type into it.
#[derive(Serialize, Debug)]
pub struct Control {
    pub id: String,
    pub kind: Kind,
    pub label: String,
    pub names: Vec<String>,
    pub region: Region,
    pub fill: bool,
    pub password: bool,
}

/// The window that the reader read. `elevated` is true when the app may run as administrator.
#[derive(Serialize, Debug)]
pub struct Window {
    pub title: String,
    pub process: String,
    pub elevated: bool,
    pub controls: Vec<Control>,
}

/// The patterns that a control has. `read_only` is the state of its value.
#[derive(Default, Clone, Copy)]
pub struct Patterns {
    pub invoke: bool,
    pub toggle: bool,
    pub select: bool,
    pub expand: bool,
    pub value: bool,
    pub read_only: bool,
    pub focusable: bool,
}

// UI Automation control type ids (UIA_*ControlTypeId).
const EDIT: i32 = 50004;
pub const MENU: i32 = 50009;
const MENU_BAR: i32 = 50010;
const SCROLL_BAR: i32 = 50014;
const STATUS_BAR: i32 = 50017;
const TOOL_BAR: i32 = 50021;
const DOCUMENT: i32 = 50030;
const TITLE_BAR: i32 = 50037;

/// The kind of a control, or None when a select cannot do anything with it.
/// A text field that takes a value is Type. A text field without one only gets the cursor.
pub fn kind_of(control_type: i32, p: Patterns) -> Option<Kind> {
    let field = matches!(control_type, EDIT | DOCUMENT);
    if field && p.value && !p.read_only {
        Some(Kind::Type)
    } else if p.invoke {
        Some(Kind::Invoke)
    } else if p.toggle {
        Some(Kind::Toggle)
    } else if p.select {
        Some(Kind::Select)
    } else if p.expand {
        Some(Kind::Expand)
    } else if field && p.focusable {
        Some(Kind::Focus)
    } else {
        None
    }
}

/// The region of a control. A control without its own region takes the region of its parent.
pub fn region_of(control_type: i32, parent: Region) -> Region {
    match control_type {
        MENU | MENU_BAR | TOOL_BAR | TITLE_BAR => Region::Nav,
        STATUS_BAR | SCROLL_BAR => Region::Other,
        _ => parent,
    }
}

pub const CHANGED: &str = "The app changed, so that item is gone. Look at the new list.";

/// Checks a run request against the control as the reader finds it now.
/// The frontend sends the label that it showed. Focus is allowed on every control.
pub fn check(found: &Control, kind: Kind, label: &str) -> Result<(), &'static str> {
    if found.label != label || (kind != Kind::Focus && kind != found.kind) {
        return Err(CHANGED);
    }
    if kind == Kind::Type && found.password {
        return Err("Transcendent does not type passwords.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const BUTTON: i32 = 50000;
    const CHECK_BOX: i32 = 50002;
    const COMBO_BOX: i32 = 50003;
    const LIST_ITEM: i32 = 50007;
    const TEXT: i32 = 50020;
    const TREE_ITEM: i32 = 50024;

    fn control(kind: Kind, password: bool) -> Control {
        Control {
            id: "1.2".into(),
            kind,
            label: "Name".into(),
            names: vec![],
            region: Region::Main,
            fill: false,
            password,
        }
    }

    #[test]
    fn maps_patterns_to_kinds() {
        let p = Patterns::default();
        let invoke = Patterns { invoke: true, ..p };
        assert_eq!(kind_of(BUTTON, invoke), Some(Kind::Invoke));
        assert_eq!(
            kind_of(CHECK_BOX, Patterns { toggle: true, ..p }),
            Some(Kind::Toggle)
        );
        assert_eq!(
            kind_of(
                COMBO_BOX,
                Patterns {
                    expand: true,
                    value: true,
                    ..p
                }
            ),
            Some(Kind::Expand)
        );
        // A tree item can select and expand. Select comes first.
        assert_eq!(
            kind_of(
                TREE_ITEM,
                Patterns {
                    select: true,
                    expand: true,
                    ..p
                }
            ),
            Some(Kind::Select)
        );
        assert_eq!(
            kind_of(LIST_ITEM, Patterns { select: true, ..p }),
            Some(Kind::Select)
        );
        assert_eq!(kind_of(TEXT, p), None);
        assert_eq!(
            kind_of(
                TEXT,
                Patterns {
                    focusable: true,
                    ..p
                }
            ),
            None
        );
    }

    #[test]
    fn maps_text_fields() {
        let p = Patterns::default();
        assert_eq!(
            kind_of(EDIT, Patterns { value: true, ..p }),
            Some(Kind::Type)
        );
        assert_eq!(
            kind_of(
                DOCUMENT,
                Patterns {
                    value: true,
                    invoke: true,
                    ..p
                }
            ),
            Some(Kind::Type)
        );
        // A read-only field or a field without a value only gets the cursor.
        let read_only = Patterns {
            value: true,
            read_only: true,
            focusable: true,
            ..p
        };
        assert_eq!(kind_of(EDIT, read_only), Some(Kind::Focus));
        assert_eq!(
            kind_of(
                DOCUMENT,
                Patterns {
                    focusable: true,
                    ..p
                }
            ),
            Some(Kind::Focus)
        );
        assert_eq!(kind_of(EDIT, p), None);
    }

    #[test]
    fn maps_regions() {
        assert_eq!(region_of(MENU_BAR, Region::Main), Region::Nav);
        assert_eq!(region_of(TOOL_BAR, Region::Main), Region::Nav);
        assert_eq!(region_of(TITLE_BAR, Region::Main), Region::Nav);
        assert_eq!(region_of(STATUS_BAR, Region::Main), Region::Other);
        assert_eq!(region_of(BUTTON, Region::Main), Region::Main);
        // A button in a toolbar stays in the toolbar region.
        assert_eq!(region_of(BUTTON, Region::Nav), Region::Nav);
    }

    #[test]
    fn checks_run_requests() {
        let button = control(Kind::Invoke, false);
        assert_eq!(check(&button, Kind::Invoke, "Name"), Ok(()));
        assert_eq!(check(&button, Kind::Invoke, "Other name"), Err(CHANGED));
        assert_eq!(check(&button, Kind::Toggle, "Name"), Err(CHANGED));
        assert_eq!(check(&button, Kind::Focus, "Name"), Ok(()));
        let password = control(Kind::Type, true);
        assert!(check(&password, Kind::Type, "Name").is_err());
        assert_eq!(check(&password, Kind::Focus, "Name"), Ok(()));
    }

    #[test]
    fn sends_lowercase_names() {
        let json = serde_json::to_string(&control(Kind::Type, false)).unwrap();
        assert!(json.contains(r#""kind":"type""#) && json.contains(r#""region":"main""#));
        assert_eq!(
            serde_json::from_str::<Kind>(r#""expand""#).unwrap(),
            Kind::Expand
        );
    }
}
