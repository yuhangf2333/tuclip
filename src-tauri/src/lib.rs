mod models;
mod storage;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use arboard::Clipboard;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use chrono::{Duration as ChronoDuration, Utc};
use image::RgbaImage;
use models::{
    AppStatePayload, CaptureItem, CaptureVersion, EditorDocument, GlobalConfig, PendingCapture,
    ShortcutConfig, Workspace,
};
use parking_lot::Mutex;
use sha2::{Digest, Sha256};
use storage::INBOX_ID;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use uuid::Uuid;

struct RuntimeState {
    config: GlobalConfig,
    inbox_root: PathBuf,
    last_clipboard_hash: Option<String>,
    popup_generation: u64,
}

struct SharedState(Mutex<RuntimeState>);

#[derive(Clone)]
struct WorkspaceTarget {
    id: String,
    root_path: PathBuf,
    append_timestamp: bool,
}

fn to_string_error(error: anyhow::Error) -> String {
    format!("{error:#}")
}

fn load_config() -> Result<GlobalConfig> {
    let path = storage::config_path()?;
    if path.exists() {
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("Failed to read {}", path.display()))?;
        let config = serde_json::from_str::<GlobalConfig>(&raw)
            .with_context(|| format!("Invalid JSON in {}", path.display()))?;
        Ok(config)
    } else {
        let config = GlobalConfig::new();
        save_config(&config)?;
        Ok(config)
    }
}

fn save_config(config: &GlobalConfig) -> Result<()> {
    let path = storage::config_path()?;
    storage::write_config_json(
        &path,
        &serde_json::to_string_pretty(config).context("Failed to serialize config")?,
    )
}

fn initialize_runtime_state() -> Result<RuntimeState> {
    let inbox_root = storage::inbox_root()?;
    let mut config = load_config()?;

    storage::ensure_workspace_layout(&inbox_root)?;
    config.pending_captures.retain(|pending| Path::new(&pending.temp_path).exists());

    for workspace in &mut config.workspaces {
        workspace.monitoring_paused = config.monitoring_paused;
        workspace.is_inbox = false;
        storage::ensure_workspace_layout(Path::new(&workspace.root_path))?;
    }

    if let Some(active_id) = &config.active_workspace_id {
        if !config.workspaces.iter().any(|workspace| &workspace.id == active_id) {
            config.active_workspace_id = None;
        }
    }

    save_config(&config)?;

    Ok(RuntimeState {
        config,
        inbox_root,
        last_clipboard_hash: None,
        popup_generation: 0,
    })
}

fn build_inbox_workspace(runtime: &RuntimeState) -> Workspace {
    Workspace {
        id: INBOX_ID.to_string(),
        name: "Inbox".to_string(),
        root_path: runtime.inbox_root.to_string_lossy().to_string(),
        append_timestamp: false,
        monitoring_paused: runtime.config.monitoring_paused,
        created_at: runtime.config.inbox_created_at,
        is_inbox: true,
    }
}

fn list_all_workspaces_inner(runtime: &RuntimeState) -> Vec<Workspace> {
    let mut workspaces = vec![build_inbox_workspace(runtime)];
    workspaces.extend(runtime.config.workspaces.iter().cloned().map(|mut workspace| {
        workspace.monitoring_paused = runtime.config.monitoring_paused;
        workspace.is_inbox = false;
        workspace
    }));
    workspaces
}

fn app_state_payload(runtime: &RuntimeState) -> AppStatePayload {
    AppStatePayload {
        monitoring_paused: runtime.config.monitoring_paused,
        active_workspace_id: runtime.config.active_workspace_id.clone(),
        shortcuts: runtime.config.shortcuts.clone(),
        pending_count: runtime.config.pending_captures.len(),
        editor_target_capture_id: runtime.config.editor_target_capture_id.clone(),
        inbox_root: runtime.inbox_root.to_string_lossy().to_string(),
    }
}

fn resolve_workspace_target(runtime: &RuntimeState, requested_workspace_id: Option<&str>) -> Result<WorkspaceTarget> {
    let workspace_id = requested_workspace_id
        .map(str::to_string)
        .or_else(|| runtime.config.active_workspace_id.clone())
        .unwrap_or_else(|| INBOX_ID.to_string());

    if workspace_id == INBOX_ID {
        return Ok(WorkspaceTarget {
            id: INBOX_ID.to_string(),
            root_path: runtime.inbox_root.clone(),
            append_timestamp: false,
        });
    }

    let workspace = runtime
        .config
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .cloned()
        .ok_or_else(|| anyhow!("Workspace {workspace_id} not found"))?;

    Ok(WorkspaceTarget {
        id: workspace.id,
        root_path: PathBuf::from(workspace.root_path),
        append_timestamp: workspace.append_timestamp,
    })
}

fn set_active_workspace_inner(runtime: &mut RuntimeState, workspace_id: Option<String>) -> Result<AppStatePayload> {
    runtime.config.active_workspace_id = match workspace_id.as_deref() {
        Some(INBOX_ID) | None => None,
        Some(id) => Some(id.to_string()),
    };
    save_config(&runtime.config)?;
    Ok(app_state_payload(runtime))
}

fn show_main_window_inner(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    Ok(())
}

fn hide_popup_window_inner(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("capture-popup") {
        let _ = window.hide();
    }
}

fn show_popup_window_inner(app: &AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window("capture-popup") {
        let _ = window.show();
        let state = app.state::<SharedState>();
        let generation = {
            let mut runtime = state.0.lock();
            runtime.popup_generation += 1;
            runtime.popup_generation
        };

        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_secs(6)).await;
            let should_hide = {
                let state = handle.state::<SharedState>();
                let runtime = state.0.lock();
                runtime.popup_generation == generation
            };
            if should_hide {
                hide_popup_window_inner(&handle);
            }
        });
    }
    Ok(())
}

fn remove_pending_entry(runtime: &mut RuntimeState, pending_id: &str) -> Option<PendingCapture> {
    runtime
        .config
        .pending_captures
        .iter()
        .position(|pending| pending.id == pending_id)
        .map(|index| runtime.config.pending_captures.remove(index))
}

fn stage_pending_capture(
    app: &AppHandle,
    width: usize,
    height: usize,
    bytes: Vec<u8>,
    source_hash: String,
) -> Result<()> {
    let pending = {
        let state = app.state::<SharedState>();
        let mut runtime = state.0.lock();
        let workspace = resolve_workspace_target(&runtime, None)?;
        let pending_id = Uuid::new_v4().to_string();
        let pending_path = workspace
            .root_path
            .join(".noteshot")
            .join("pending")
            .join(format!("{pending_id}.png"));

        let image = RgbaImage::from_raw(width as u32, height as u32, bytes)
            .ok_or_else(|| anyhow!("Clipboard image data is malformed"))?;
        if let Some(parent) = pending_path.parent() {
            fs::create_dir_all(parent)?;
        }
        image
            .save(&pending_path)
            .with_context(|| format!("Failed to save {}", pending_path.display()))?;

        let pending = PendingCapture {
            id: pending_id,
            temp_path: pending_path.to_string_lossy().to_string(),
            detected_at: Utc::now(),
            expires_at: Utc::now() + ChronoDuration::seconds(6),
            source_hash,
            workspace_hint_id: if workspace.id == INBOX_ID {
                None
            } else {
                Some(workspace.id.clone())
            },
        };

        runtime.config.pending_captures.insert(0, pending.clone());
        save_config(&runtime.config)?;
        pending
    };

    show_popup_window_inner(app)?;
    if pending.workspace_hint_id.is_none() {
        show_main_window_inner(app)?;
    }
    Ok(())
}

fn hash_clipboard(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn spawn_clipboard_monitor(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut clipboard = Clipboard::new().ok();
        loop {
            tokio::time::sleep(Duration::from_millis(400)).await;

            let should_skip = {
                let state = app.state::<SharedState>();
                let runtime = state.0.lock();
                runtime.config.monitoring_paused
            };
            if should_skip {
                continue;
            }

            if clipboard.is_none() {
                clipboard = Clipboard::new().ok();
            }

            let image = match clipboard.as_mut().and_then(|clipboard| clipboard.get_image().ok()) {
                Some(image) => image,
                None => continue,
            };

            let bytes = image.bytes.into_owned().to_vec();
            let hash = hash_clipboard(&bytes);
            let should_stage = {
                let state = app.state::<SharedState>();
                let mut runtime = state.0.lock();
                let duplicate_pending = runtime
                    .config
                    .pending_captures
                    .iter()
                    .any(|pending| pending.source_hash == hash);
                let duplicate_last = runtime.last_clipboard_hash.as_ref() == Some(&hash);
                if duplicate_pending || duplicate_last {
                    false
                } else {
                    runtime.last_clipboard_hash = Some(hash.clone());
                    true
                }
            };

            if should_stage {
                if let Err(error) = stage_pending_capture(&app, image.width, image.height, bytes, hash) {
                    eprintln!("clipboard monitor error: {error:#}");
                }
            }
        }
    });
}

fn create_popup_window(app: &tauri::App) -> Result<()> {
    if app.get_webview_window("capture-popup").is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "capture-popup", WebviewUrl::App("index.html?popup=1".into()))
        .title("NoteShot Capture")
        .inner_size(360.0, 240.0)
        .visible(false)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .context("Failed to create popup window")?;

    Ok(())
}

fn build_tray(app: &tauri::App) -> Result<()> {
    let open = MenuItemBuilder::with_id("open", "Open NoteShot").build(app)?;
    let open_inbox = MenuItemBuilder::with_id("open-inbox", "Open Inbox").build(app)?;
    let toggle = MenuItemBuilder::with_id("toggle-monitoring", "Pause / Resume Monitoring").build(app)?;
    let open_pending = MenuItemBuilder::with_id("open-pending", "Show Pending Queue").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&open, &open_inbox, &toggle, &open_pending, &quit])
        .build()?;

    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = show_main_window_inner(app);
            }
            "open-inbox" => {
                {
                    let state = app.state::<SharedState>();
                    let mut runtime = state.0.lock();
                    let _ = set_active_workspace_inner(&mut runtime, None);
                }
                let _ = show_main_window_inner(app);
            }
            "toggle-monitoring" => {
                {
                    let state = app.state::<SharedState>();
                    let mut runtime = state.0.lock();
                    runtime.config.monitoring_paused = !runtime.config.monitoring_paused;
                    let paused = runtime.config.monitoring_paused;
                    for workspace in &mut runtime.config.workspaces {
                        workspace.monitoring_paused = paused;
                    }
                    let _ = save_config(&runtime.config);
                }
            }
            "open-pending" => {
                let _ = show_main_window_inner(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = show_main_window_inner(&app);
            }
        })
        .build(app)?;

    Ok(())
}

fn copy_capture_assets(
    source_root: &Path,
    target_root: &Path,
    capture_id: &str,
    versions: &[CaptureVersion],
) -> Result<Vec<CaptureVersion>> {
    let mut copied = Vec::with_capacity(versions.len());
    for version in versions {
        let archived_target = if version.kind == "original" {
            target_root
                .join(".noteshot")
                .join("originals")
                .join(capture_id)
                .join("original.png")
        } else {
            target_root
                .join(".noteshot")
                .join("versions")
                .join(capture_id)
                .join(format!("{}.png", version.id))
        };
        storage::copy_file(Path::new(&version.archived_path), &archived_target)?;

        let annotation_target = version.annotation_path.as_ref().map(|path| {
            target_root
                .join(".noteshot")
                .join("annotations")
                .join(capture_id)
                .join(
                    Path::new(path)
                        .file_name()
                        .unwrap_or_default(),
                )
        });

        if let (Some(source_annotation), Some(target_annotation)) =
            (version.annotation_path.as_ref(), annotation_target.as_ref())
        {
            storage::copy_file(Path::new(source_annotation), target_annotation)?;
        }

        copied.push(CaptureVersion {
            id: version.id.clone(),
            capture_id: capture_id.to_string(),
            kind: version.kind.clone(),
            archived_path: archived_target.to_string_lossy().to_string(),
            annotation_path: annotation_target
                .map(|path| path.to_string_lossy().to_string()),
            created_at: version.created_at,
        });
    }

    let source_assets = [
        source_root.join(".noteshot").join("originals").join(capture_id),
        source_root.join(".noteshot").join("versions").join(capture_id),
        source_root.join(".noteshot").join("annotations").join(capture_id),
    ];
    for directory in source_assets {
        if directory.exists() {
            let _ = fs::remove_dir_all(directory);
        }
    }

    Ok(copied)
}

#[tauri::command]
fn get_app_state(state: State<'_, SharedState>) -> Result<AppStatePayload, String> {
    let runtime = state.0.lock();
    Ok(app_state_payload(&runtime))
}

#[tauri::command]
fn list_workspaces(state: State<'_, SharedState>) -> Result<Vec<Workspace>, String> {
    let runtime = state.0.lock();
    Ok(list_all_workspaces_inner(&runtime))
}

#[tauri::command]
fn create_workspace(
    name: String,
    root_path: String,
    append_timestamp: bool,
    state: State<'_, SharedState>,
) -> Result<Workspace, String> {
    let mut runtime = state.0.lock();
    if runtime
        .config
        .workspaces
        .iter()
        .any(|workspace| workspace.root_path == root_path)
    {
        return Err("A workspace is already registered for this folder".to_string());
    }

    let root = PathBuf::from(&root_path);
    storage::ensure_workspace_layout(&root).map_err(to_string_error)?;

    let workspace = Workspace {
        id: Uuid::new_v4().to_string(),
        name,
        root_path,
        append_timestamp,
        monitoring_paused: runtime.config.monitoring_paused,
        created_at: Utc::now(),
        is_inbox: false,
    };

    runtime.config.workspaces.push(workspace.clone());
    runtime.config.active_workspace_id = Some(workspace.id.clone());
    save_config(&runtime.config).map_err(to_string_error)?;
    Ok(workspace)
}

#[tauri::command]
fn set_active_workspace(
    workspace_id: Option<String>,
    state: State<'_, SharedState>,
) -> Result<AppStatePayload, String> {
    let mut runtime = state.0.lock();
    set_active_workspace_inner(&mut runtime, workspace_id).map_err(to_string_error)
}

#[tauri::command]
fn update_shortcuts(
    shortcuts: ShortcutConfig,
    state: State<'_, SharedState>,
) -> Result<ShortcutConfig, String> {
    let mut runtime = state.0.lock();
    runtime.config.shortcuts = shortcuts.clone();
    save_config(&runtime.config).map_err(to_string_error)?;
    Ok(shortcuts)
}

#[tauri::command]
fn toggle_monitoring(
    paused: Option<bool>,
    state: State<'_, SharedState>,
) -> Result<AppStatePayload, String> {
    let mut runtime = state.0.lock();
    runtime.config.monitoring_paused = paused.unwrap_or(!runtime.config.monitoring_paused);
    let monitoring_paused = runtime.config.monitoring_paused;
    for workspace in &mut runtime.config.workspaces {
        workspace.monitoring_paused = monitoring_paused;
    }
    save_config(&runtime.config).map_err(to_string_error)?;
    Ok(app_state_payload(&runtime))
}

#[tauri::command]
fn list_pending_captures(state: State<'_, SharedState>) -> Result<Vec<PendingCapture>, String> {
    let runtime = state.0.lock();
    Ok(runtime.config.pending_captures.clone())
}

#[tauri::command]
fn save_pending_capture(
    pending_id: String,
    target_workspace_id: Option<String>,
    open_editor: Option<bool>,
    app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<CaptureItem, String> {
    let capture = {
        let mut runtime = state.0.lock();
        let pending = remove_pending_entry(&mut runtime, &pending_id)
            .ok_or_else(|| anyhow!("Pending capture {pending_id} was not found"))
            .map_err(to_string_error)?;
        let workspace =
            resolve_workspace_target(&runtime, target_workspace_id.as_deref()).map_err(to_string_error)?;
        storage::ensure_workspace_layout(&workspace.root_path).map_err(to_string_error)?;

        let capture_id = Uuid::new_v4().to_string();
        let version_id = Uuid::new_v4().to_string();
        let public_name =
            storage::next_public_filename(&workspace.root_path, workspace.append_timestamp).map_err(to_string_error)?;
        let public_path = workspace.root_path.join(public_name);
        let original_path = workspace
            .root_path
            .join(".noteshot")
            .join("originals")
            .join(&capture_id)
            .join("original.png");
        storage::copy_file(Path::new(&pending.temp_path), &original_path).map_err(to_string_error)?;
        storage::copy_file(Path::new(&pending.temp_path), &public_path).map_err(to_string_error)?;

        let capture = CaptureItem {
            id: capture_id.clone(),
            workspace_id: workspace.id.clone(),
            status: "saved".to_string(),
            public_path: public_path.to_string_lossy().to_string(),
            order_index: storage::next_order_index(&workspace.root_path).map_err(to_string_error)?,
            created_at: Utc::now(),
            current_version_id: version_id.clone(),
            source_hash: pending.source_hash.clone(),
        };
        let version = CaptureVersion {
            id: version_id,
            capture_id: capture_id.clone(),
            kind: "original".to_string(),
            archived_path: original_path.to_string_lossy().to_string(),
            annotation_path: None,
            created_at: Utc::now(),
        };

        storage::insert_capture(&workspace.root_path, &capture).map_err(to_string_error)?;
        storage::insert_version(&workspace.root_path, &version).map_err(to_string_error)?;
        storage::remove_file_if_exists(Path::new(&pending.temp_path)).map_err(to_string_error)?;

        if open_editor.unwrap_or(false) {
            runtime.config.editor_target_capture_id = Some(capture.id.clone());
        }
        save_config(&runtime.config).map_err(to_string_error)?;
        capture
    };

    hide_popup_window_inner(&app);
    if open_editor.unwrap_or(false) {
        let _ = show_main_window_inner(&app);
    }
    Ok(capture)
}

#[tauri::command]
fn discard_pending_capture(
    pending_id: String,
    app: AppHandle,
    state: State<'_, SharedState>,
) -> Result<(), String> {
    let maybe_temp_path = {
        let mut runtime = state.0.lock();
        let pending = remove_pending_entry(&mut runtime, &pending_id)
            .ok_or_else(|| anyhow!("Pending capture {pending_id} was not found"))
            .map_err(to_string_error)?;
        save_config(&runtime.config).map_err(to_string_error)?;
        pending.temp_path
    };

    storage::remove_file_if_exists(Path::new(&maybe_temp_path)).map_err(to_string_error)?;
    hide_popup_window_inner(&app);
    Ok(())
}

#[tauri::command]
fn list_captures(
    workspace_id: Option<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<CaptureItem>, String> {
    let runtime = state.0.lock();
    let workspace = resolve_workspace_target(&runtime, workspace_id.as_deref()).map_err(to_string_error)?;
    storage::list_captures(&workspace.root_path).map_err(to_string_error)
}

#[tauri::command]
fn open_capture_in_editor(
    capture_id: String,
    workspace_id: Option<String>,
    state: State<'_, SharedState>,
) -> Result<EditorDocument, String> {
    let runtime = state.0.lock();
    let workspace = resolve_workspace_target(&runtime, workspace_id.as_deref()).map_err(to_string_error)?;
    let capture = storage::get_capture(&workspace.root_path, &capture_id).map_err(to_string_error)?;
    let versions = storage::list_versions(&workspace.root_path, &capture_id).map_err(to_string_error)?;
    let annotation_document =
        storage::get_annotation_document(&workspace.root_path, &capture).map_err(to_string_error)?;

    Ok(EditorDocument {
        capture,
        versions,
        annotation_document,
    })
}

#[tauri::command]
fn save_capture_edit(
    capture_id: String,
    workspace_id: Option<String>,
    rendered_png_base64: String,
    annotation_document: serde_json::Value,
    state: State<'_, SharedState>,
) -> Result<CaptureItem, String> {
    let runtime = state.0.lock();
    let workspace = resolve_workspace_target(&runtime, workspace_id.as_deref()).map_err(to_string_error)?;
    let mut capture = storage::get_capture(&workspace.root_path, &capture_id).map_err(to_string_error)?;

    let base64_payload = rendered_png_base64
        .split_once(',')
        .map(|(_, payload)| payload.to_string())
        .unwrap_or(rendered_png_base64);
    let bytes = STANDARD
        .decode(base64_payload)
        .map_err(|error| format!("Invalid PNG payload: {error}"))?;

    let version_id = Uuid::new_v4().to_string();
    let archived_path = workspace
        .root_path
        .join(".noteshot")
        .join("versions")
        .join(&capture.id)
        .join(format!("{version_id}.png"));
    storage::copy_file(Path::new(&capture.public_path), &archived_path).map_err(to_string_error)?;
    fs::write(&capture.public_path, bytes)
        .with_context(|| format!("Failed to write {}", capture.public_path))
        .map_err(to_string_error)?;

    let annotation_path = storage::replace_annotation_document(
        &workspace.root_path,
        &version_id,
        &capture.id,
        &annotation_document,
    )
    .map_err(to_string_error)?;

    let version = CaptureVersion {
        id: version_id.clone(),
        capture_id: capture.id.clone(),
        kind: "edited".to_string(),
        archived_path: archived_path.to_string_lossy().to_string(),
        annotation_path: Some(annotation_path),
        created_at: Utc::now(),
    };

    storage::insert_version(&workspace.root_path, &version).map_err(to_string_error)?;
    capture.current_version_id = version_id;
    capture.status = "edited".to_string();
    storage::update_capture(&workspace.root_path, &capture).map_err(to_string_error)?;
    Ok(capture)
}

#[tauri::command]
fn reorder_captures(
    workspace_id: Option<String>,
    capture_ids: Vec<String>,
    state: State<'_, SharedState>,
) -> Result<Vec<CaptureItem>, String> {
    let runtime = state.0.lock();
    let workspace = resolve_workspace_target(&runtime, workspace_id.as_deref()).map_err(to_string_error)?;
    storage::reorder_captures(&workspace.root_path, &capture_ids).map_err(to_string_error)?;
    storage::list_captures(&workspace.root_path).map_err(to_string_error)
}

#[tauri::command]
fn move_capture_to_workspace(
    capture_id: String,
    source_workspace_id: Option<String>,
    target_workspace_id: Option<String>,
    state: State<'_, SharedState>,
) -> Result<CaptureItem, String> {
    let runtime = state.0.lock();
    let source = resolve_workspace_target(&runtime, source_workspace_id.as_deref()).map_err(to_string_error)?;
    let target = resolve_workspace_target(&runtime, target_workspace_id.as_deref()).map_err(to_string_error)?;

    if source.id == target.id {
        return storage::get_capture(&source.root_path, &capture_id).map_err(to_string_error);
    }

    storage::ensure_workspace_layout(&target.root_path).map_err(to_string_error)?;
    let mut capture = storage::get_capture(&source.root_path, &capture_id).map_err(to_string_error)?;
    let versions = storage::list_versions(&source.root_path, &capture_id).map_err(to_string_error)?;
    let target_public_name =
        storage::next_public_filename(&target.root_path, target.append_timestamp).map_err(to_string_error)?;
    let target_public_path = target.root_path.join(target_public_name);
    storage::copy_file(Path::new(&capture.public_path), &target_public_path).map_err(to_string_error)?;
    let copied_versions =
        copy_capture_assets(&source.root_path, &target.root_path, &capture.id, &versions).map_err(to_string_error)?;

    let old_public_path = capture.public_path.clone();
    capture.workspace_id = target.id.clone();
    capture.order_index = storage::next_order_index(&target.root_path).map_err(to_string_error)?;
    capture.public_path = target_public_path.to_string_lossy().to_string();

    storage::insert_capture(&target.root_path, &capture).map_err(to_string_error)?;
    for version in copied_versions {
        storage::insert_version(&target.root_path, &version).map_err(to_string_error)?;
    }

    storage::delete_capture(&source.root_path, &capture_id).map_err(to_string_error)?;
    storage::remove_file_if_exists(Path::new(&old_public_path)).map_err(to_string_error)?;

    Ok(capture)
}

#[tauri::command]
fn take_editor_target(state: State<'_, SharedState>) -> Result<Option<String>, String> {
    let mut runtime = state.0.lock();
    let current = runtime.config.editor_target_capture_id.take();
    save_config(&runtime.config).map_err(to_string_error)?;
    Ok(current)
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    show_main_window_inner(&app).map_err(to_string_error)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let runtime = initialize_runtime_state().expect("failed to initialize runtime state");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SharedState(Mutex::new(runtime)))
        .setup(|app| {
            create_popup_window(app)?;
            build_tray(app)?;
            spawn_clipboard_monitor(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_state,
            list_workspaces,
            create_workspace,
            set_active_workspace,
            update_shortcuts,
            toggle_monitoring,
            list_pending_captures,
            save_pending_capture,
            discard_pending_capture,
            list_captures,
            open_capture_in_editor,
            save_capture_edit,
            reorder_captures,
            move_capture_to_workspace,
            take_editor_target,
            show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
