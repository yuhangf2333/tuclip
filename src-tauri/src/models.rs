use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub append_timestamp: bool,
    pub monitoring_paused: bool,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub is_inbox: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureItem {
    pub id: String,
    pub workspace_id: String,
    pub status: String,
    pub public_path: String,
    pub order_index: i64,
    pub created_at: DateTime<Utc>,
    pub current_version_id: String,
    pub source_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureVersion {
    pub id: String,
    pub capture_id: String,
    pub kind: String,
    pub archived_path: String,
    pub annotation_path: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingCapture {
    pub id: String,
    pub temp_path: String,
    pub detected_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub source_hash: String,
    pub workspace_hint_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    pub rect_tool: String,
    pub number_tool: String,
    pub text_tool: String,
    pub crop_tool: String,
    pub save: String,
    pub cancel: String,
    pub delete_selection: String,
    pub undo: String,
    pub redo: String,
    pub quick_save_pending: String,
    pub quick_annotate_pending: String,
    pub dismiss_popup: String,
    pub toggle_monitoring: String,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            rect_tool: "R".to_string(),
            number_tool: "N".to_string(),
            text_tool: "T".to_string(),
            crop_tool: "C".to_string(),
            save: "Mod+S".to_string(),
            cancel: "Escape".to_string(),
            delete_selection: "Delete".to_string(),
            undo: "Mod+Z".to_string(),
            redo: "Mod+Shift+Z".to_string(),
            quick_save_pending: "Enter".to_string(),
            quick_annotate_pending: "Mod+Enter".to_string(),
            dismiss_popup: "Escape".to_string(),
            toggle_monitoring: "Mod+Shift+M".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalConfig {
    pub workspaces: Vec<Workspace>,
    pub active_workspace_id: Option<String>,
    pub monitoring_paused: bool,
    pub shortcuts: ShortcutConfig,
    pub pending_captures: Vec<PendingCapture>,
    pub editor_target_capture_id: Option<String>,
    pub inbox_created_at: DateTime<Utc>,
}

impl GlobalConfig {
    pub fn new() -> Self {
        Self {
            workspaces: Vec::new(),
            active_workspace_id: None,
            monitoring_paused: false,
            shortcuts: ShortcutConfig::default(),
            pending_captures: Vec::new(),
            editor_target_capture_id: None,
            inbox_created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatePayload {
    pub monitoring_paused: bool,
    pub active_workspace_id: Option<String>,
    pub shortcuts: ShortcutConfig,
    pub pending_count: usize,
    pub editor_target_capture_id: Option<String>,
    pub inbox_root: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorDocument {
    pub capture: CaptureItem,
    pub versions: Vec<CaptureVersion>,
    pub annotation_document: Value,
}
