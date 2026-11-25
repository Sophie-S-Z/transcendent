// The Windows reader. It reads the foreground window through UI Automation and runs one control with its pattern.
// It never sends a key press for text: a field gets its text through the Value pattern.

use std::sync::atomic::{AtomicIsize, Ordering};
use std::time::{Duration, Instant};

use uiautomation::core::UICacheRequest;
use uiautomation::patterns::{
    UIExpandCollapsePattern, UIInvokePattern, UISelectionItemPattern, UITogglePattern,
    UIValuePattern,
};
use uiautomation::types::{ExpandCollapseState, Handle, UIProperty};
use uiautomation::{UIAutomation, UIElement, UITreeWalker};
use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND};
use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
use windows::Win32::System::Threading::{
    OpenProcess, OpenProcessToken, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, IsWindow,
};

use crate::controls::{
    check, kind_of, region_of, Control, Kind, Patterns, Region, Window, CHANGED, MENU,
};

// The walk stops at about 400 elements or 300 ms, so a large window does not stop the scan.
const MAX_ELEMENTS: usize = 400;
const MAX_TIME: Duration = Duration::from_millis(300);

// One cross-process call per element gets all of these.
const PROPERTIES: [UIProperty; 16] = [
    UIProperty::ProcessId,
    UIProperty::ControlType,
    UIProperty::Name,
    UIProperty::HelpText,
    UIProperty::AutomationId,
    UIProperty::LocalizedControlType,
    UIProperty::IsEnabled,
    UIProperty::IsOffscreen,
    UIProperty::IsPassword,
    UIProperty::IsKeyboardFocusable,
    UIProperty::IsInvokePatternAvailable,
    UIProperty::IsTogglePatternAvailable,
    UIProperty::IsSelectionItemPatternAvailable,
    UIProperty::IsExpandCollapsePatternAvailable,
    UIProperty::IsValuePatternAvailable,
    UIProperty::ValueIsReadOnly,
];

/// The last foreground window that is not this app. The app window can be the foreground when the user clicks it.
static LAST: AtomicIsize = AtomicIsize::new(0);

fn pid_of(hwnd: HWND) -> u32 {
    let mut pid = 0;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    pid
}

/// The window to read and its process: the foreground window, or the last one when this app is the foreground.
fn target() -> Result<(HWND, u32), String> {
    let fg = unsafe { GetForegroundWindow() };
    if !fg.is_invalid() && pid_of(fg) != std::process::id() {
        LAST.store(fg.0 as isize, Ordering::Relaxed);
    }
    let hwnd = HWND(LAST.load(Ordering::Relaxed) as *mut _);
    if hwnd.is_invalid() || !unsafe { IsWindow(Some(hwnd)) }.as_bool() {
        return Err("Open the app that you want to use.".into());
    }
    Ok((hwnd, pid_of(hwnd)))
}

/// The file name of a process, and true when it may run as administrator.
/// A token that this app cannot read also counts as administrator.
fn process_of(pid: u32) -> (String, bool) {
    unsafe {
        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return (String::new(), true);
        };
        let mut path = [0u16; 1024];
        let mut len = path.len() as u32;
        let name = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(path.as_mut_ptr()),
            &mut len,
        )
        .map(|()| String::from_utf16_lossy(&path[..len as usize]))
        .unwrap_or_default();
        let mut token = HANDLE::default();
        let mut elevation = TOKEN_ELEVATION::default();
        let mut size = 0;
        let elevated = OpenProcessToken(process, TOKEN_QUERY, &mut token).is_err()
            || GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut _),
                size_of::<TOKEN_ELEVATION>() as u32,
                &mut size,
            )
            .is_err()
            || elevation.TokenIsElevated != 0;
        if !token.is_invalid() {
            let _ = CloseHandle(token);
        }
        let _ = CloseHandle(process);
        (
            name.rsplit('\\').next().unwrap_or_default().to_string(),
            elevated,
        )
    }
}

/// The state of one read.
struct Walk {
    walker: UITreeWalker,
    cache: UICacheRequest,
    start: Instant,
    seen: usize,
    found: Vec<(Control, UIElement)>,
}

/// Reads the window title and the controls, with the element of each control.
/// Open menus of the same app are separate windows. Their items come first and count as main content, because the user opened them.
fn read(hwnd: HWND, pid: u32) -> uiautomation::Result<(String, Vec<(Control, UIElement)>)> {
    let automation = UIAutomation::new()?;
    let cache = automation.create_cache_request()?;
    for p in PROPERTIES {
        cache.add_property(p)?;
    }
    let mut walk = Walk {
        walker: automation.get_control_view_walker()?,
        cache,
        start: Instant::now(),
        seen: 0,
        found: Vec::new(),
    };
    let root = automation.get_root_element()?;
    let tops = walk
        .walker
        .get_children_build_cache(&root, &walk.cache)
        .unwrap_or_default();
    for top in tops {
        let menu = top
            .get_cached_control_type()
            .is_ok_and(|c| c as i32 == MENU);
        if menu && top.get_cached_process_id().is_ok_and(|p| p as u32 == pid) {
            children(&mut walk, &top, Region::Main);
        }
    }
    let window = automation.element_from_handle_build_cache(Handle::from(hwnd), &walk.cache)?;
    visit(&mut walk, &window, Region::Main);
    Ok((window.get_cached_name().unwrap_or_default(), walk.found))
}

fn full(walk: &Walk) -> bool {
    walk.seen >= MAX_ELEMENTS || walk.start.elapsed() >= MAX_TIME
}

/// Adds the element when a select can run it, then walks its children. An offscreen element hides its children.
fn visit(walk: &mut Walk, el: &UIElement, parent: Region) {
    if full(walk) {
        return;
    }
    walk.seen += 1;
    if el.is_cached_offscreen().unwrap_or(true) {
        return;
    }
    let control_type = el.get_cached_control_type().map_or(0, |c| c as i32);
    let region = region_of(control_type, parent);
    if let Some(c) = control(el, control_type, region) {
        walk.found.push((c, el.clone()));
    }
    children(walk, el, region);
}

fn children(walk: &mut Walk, el: &UIElement, region: Region) {
    let mut child = walk.walker.get_first_child_build_cache(el, &walk.cache);
    while let Ok(c) = child {
        visit(walk, &c, region);
        if full(walk) {
            return;
        }
        child = walk.walker.get_next_sibling_build_cache(&c, &walk.cache);
    }
}

fn control(el: &UIElement, control_type: i32, region: Region) -> Option<Control> {
    let flag = |p| {
        el.get_cached_property_value(p)
            .and_then(|v| v.try_into())
            .unwrap_or(false)
    };
    if !el.is_cached_enabled().unwrap_or(false) {
        return None;
    }
    let patterns = Patterns {
        invoke: flag(UIProperty::IsInvokePatternAvailable),
        toggle: flag(UIProperty::IsTogglePatternAvailable),
        select: flag(UIProperty::IsSelectionItemPatternAvailable),
        expand: flag(UIProperty::IsExpandCollapsePatternAvailable),
        value: flag(UIProperty::IsValuePatternAvailable),
        read_only: flag(UIProperty::ValueIsReadOnly),
        focusable: el.is_cached_keyboard_focusable().unwrap_or(false),
    };
    let kind = kind_of(control_type, patterns)?;
    let name = el.get_cached_name().unwrap_or_default();
    let help = el.get_cached_help_text().unwrap_or_default();
    let label = if name.trim().is_empty() {
        help.clone()
    } else {
        name.clone()
    };
    if label.trim().is_empty() {
        return None;
    }
    let names = [
        name,
        help,
        el.get_cached_automation_id().unwrap_or_default(),
        el.get_cached_localized_control_type().unwrap_or_default(),
    ];
    let password = el.is_cached_password().unwrap_or(false);
    // The value is read only for an empty-field check. A password value is never read.
    let fill = kind == Kind::Type
        && !password
        && el
            .get_pattern::<UIValuePattern>()
            .and_then(|v| v.get_value())
            .is_ok_and(|v| v.is_empty());
    let id = el.get_runtime_id().ok()?;
    Some(Control {
        id: id.iter().map(i32::to_string).collect::<Vec<_>>().join("."),
        kind,
        label,
        names: names.into_iter().filter(|n| !n.is_empty()).collect(),
        region,
        fill,
        password,
    })
}

pub fn read_window() -> Result<Window, String> {
    let (hwnd, pid) = target()?;
    let (process, elevated) = process_of(pid);
    match read(hwnd, pid) {
        Ok((title, found)) => Ok(Window {
            title,
            process,
            elevated,
            controls: found.into_iter().map(|(c, _)| c).collect(),
        }),
        // Windows blocks UI Automation from a normal app into an app that runs as administrator.
        // The frontend then names the window and tells the caregiver.
        Err(_) if elevated => Ok(Window {
            title: String::new(),
            process,
            elevated,
            controls: Vec::new(),
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Finds the control again by its runtime id in the same window, and runs it.
pub fn run_action(id: &str, kind: Kind, label: &str, text: &str) -> Result<(), String> {
    let (hwnd, pid) = target()?;
    let (_, found) = read(hwnd, pid).map_err(|e| e.to_string())?;
    let (control, el) = found.iter().find(|(c, _)| c.id == id).ok_or(CHANGED)?;
    check(control, kind, label)?;
    run(el, kind, text).map_err(|e| e.to_string())
}

fn run(el: &UIElement, kind: Kind, text: &str) -> uiautomation::Result<()> {
    match kind {
        Kind::Invoke => el.get_pattern::<UIInvokePattern>()?.invoke(),
        Kind::Toggle => el.get_pattern::<UITogglePattern>()?.toggle(),
        Kind::Select => el.get_pattern::<UISelectionItemPattern>()?.select(),
        Kind::Expand => {
            let p = el.get_pattern::<UIExpandCollapsePattern>()?;
            if p.get_state()? == ExpandCollapseState::Expanded {
                p.collapse()
            } else {
                p.expand()
            }
        }
        Kind::Type => {
            let p = el.get_pattern::<UIValuePattern>()?;
            if p.is_readonly()? {
                return Err("This field is read-only.".into());
            }
            p.set_value(text)
        }
        Kind::Focus => el.set_focus(),
    }
}
