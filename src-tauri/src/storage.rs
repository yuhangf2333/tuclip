use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde_json::Value;

use crate::models::{CaptureItem, CaptureVersion};

pub const INBOX_ID: &str = "inbox";

pub fn app_support_dir() -> Result<PathBuf> {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| anyhow!("Unable to determine local application data directory"))?;
    let dir = base.join("NoteShot");
    fs::create_dir_all(&dir).with_context(|| format!("Failed to create {}", dir.display()))?;
    Ok(dir)
}

pub fn config_path() -> Result<PathBuf> {
    Ok(app_support_dir()?.join("config.json"))
}

pub fn inbox_root() -> Result<PathBuf> {
    let pictures = dirs::picture_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| anyhow!("Unable to determine pictures directory"))?;
    let root = pictures.join("NoteShot").join("Inbox");
    ensure_workspace_layout(&root)?;
    Ok(root)
}

pub fn ensure_workspace_layout(root: &Path) -> Result<()> {
    fs::create_dir_all(root).with_context(|| format!("Failed to create {}", root.display()))?;
    fs::create_dir_all(root.join(".noteshot").join("pending"))?;
    fs::create_dir_all(root.join(".noteshot").join("originals"))?;
    fs::create_dir_all(root.join(".noteshot").join("versions"))?;
    fs::create_dir_all(root.join(".noteshot").join("annotations"))?;
    init_workspace_db(root)?;
    Ok(())
}

pub fn init_workspace_db(root: &Path) -> Result<()> {
    let conn = open_connection(root)?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS capture_items (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          status TEXT NOT NULL,
          public_path TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          current_version_id TEXT NOT NULL,
          source_hash TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS capture_versions (
          id TEXT PRIMARY KEY,
          capture_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          archived_path TEXT NOT NULL,
          annotation_path TEXT,
          created_at TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}

pub fn open_connection(root: &Path) -> Result<Connection> {
    let db_path = workspace_db_path(root);
    Connection::open(&db_path).with_context(|| format!("Failed to open {}", db_path.display()))
}

pub fn workspace_db_path(root: &Path) -> PathBuf {
    root.join(".noteshot").join("workspace.db")
}

pub fn write_config_json(path: &Path, contents: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, contents).with_context(|| format!("Failed to write {}", path.display()))
}

pub fn list_captures(root: &Path) -> Result<Vec<CaptureItem>> {
    let conn = open_connection(root)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, status, public_path, order_index, created_at, current_version_id, source_hash
         FROM capture_items
         ORDER BY order_index ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CaptureItem {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            status: row.get(2)?,
            public_path: row.get(3)?,
            order_index: row.get(4)?,
            created_at: parse_ts(&row.get::<_, String>(5)?),
            current_version_id: row.get(6)?,
            source_hash: row.get(7)?,
        })
    })?;

    let mut captures = Vec::new();
    for row in rows {
        captures.push(row?);
    }
    Ok(captures)
}

pub fn get_capture(root: &Path, capture_id: &str) -> Result<CaptureItem> {
    let conn = open_connection(root)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, status, public_path, order_index, created_at, current_version_id, source_hash
         FROM capture_items
         WHERE id = ?1",
    )?;
    let capture = stmt.query_row([capture_id], |row| {
        Ok(CaptureItem {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            status: row.get(2)?,
            public_path: row.get(3)?,
            order_index: row.get(4)?,
            created_at: parse_ts(&row.get::<_, String>(5)?),
            current_version_id: row.get(6)?,
            source_hash: row.get(7)?,
        })
    })?;
    Ok(capture)
}

pub fn insert_capture(root: &Path, capture: &CaptureItem) -> Result<()> {
    let conn = open_connection(root)?;
    conn.execute(
        "INSERT INTO capture_items
         (id, workspace_id, status, public_path, order_index, created_at, current_version_id, source_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            capture.id,
            capture.workspace_id,
            capture.status,
            capture.public_path,
            capture.order_index,
            capture.created_at.to_rfc3339(),
            capture.current_version_id,
            capture.source_hash
        ],
    )?;
    Ok(())
}

pub fn update_capture(root: &Path, capture: &CaptureItem) -> Result<()> {
    let conn = open_connection(root)?;
    conn.execute(
        "UPDATE capture_items
         SET workspace_id = ?2, status = ?3, public_path = ?4, order_index = ?5, created_at = ?6,
             current_version_id = ?7, source_hash = ?8
         WHERE id = ?1",
        params![
            capture.id,
            capture.workspace_id,
            capture.status,
            capture.public_path,
            capture.order_index,
            capture.created_at.to_rfc3339(),
            capture.current_version_id,
            capture.source_hash
        ],
    )?;
    Ok(())
}

pub fn delete_capture(root: &Path, capture_id: &str) -> Result<()> {
    let conn = open_connection(root)?;
    conn.execute("DELETE FROM capture_versions WHERE capture_id = ?1", [capture_id])?;
    conn.execute("DELETE FROM capture_items WHERE id = ?1", [capture_id])?;
    Ok(())
}

pub fn list_versions(root: &Path, capture_id: &str) -> Result<Vec<CaptureVersion>> {
    let conn = open_connection(root)?;
    let mut stmt = conn.prepare(
        "SELECT id, capture_id, kind, archived_path, annotation_path, created_at
         FROM capture_versions
         WHERE capture_id = ?1
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map([capture_id], |row| {
        Ok(CaptureVersion {
            id: row.get(0)?,
            capture_id: row.get(1)?,
            kind: row.get(2)?,
            archived_path: row.get(3)?,
            annotation_path: row.get(4)?,
            created_at: parse_ts(&row.get::<_, String>(5)?),
        })
    })?;
    let mut versions = Vec::new();
    for row in rows {
        versions.push(row?);
    }
    Ok(versions)
}

pub fn insert_version(root: &Path, version: &CaptureVersion) -> Result<()> {
    let conn = open_connection(root)?;
    conn.execute(
        "INSERT INTO capture_versions (id, capture_id, kind, archived_path, annotation_path, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            version.id,
            version.capture_id,
            version.kind,
            version.archived_path,
            version.annotation_path,
            version.created_at.to_rfc3339()
        ],
    )?;
    Ok(())
}

pub fn get_annotation_document(root: &Path, capture: &CaptureItem) -> Result<Value> {
    let conn = open_connection(root)?;
    let annotation_path: Option<String> = conn
        .query_row(
            "SELECT annotation_path FROM capture_versions WHERE id = ?1",
            [capture.current_version_id.clone()],
            |row| row.get(0),
        )
        .unwrap_or(None);

    match annotation_path {
        Some(path) => {
            let raw = fs::read_to_string(&path)
                .with_context(|| format!("Failed to read annotation document {}", path))?;
            let value = serde_json::from_str::<Value>(&raw)
                .with_context(|| format!("Invalid annotation JSON in {}", path))?;
            Ok(value)
        }
        None => Ok(default_annotation_document()),
    }
}

pub fn replace_annotation_document(root: &Path, version_id: &str, capture_id: &str, document: &Value) -> Result<String> {
    let annotations_dir = root.join(".noteshot").join("annotations").join(capture_id);
    fs::create_dir_all(&annotations_dir)?;
    let annotation_path = annotations_dir.join(format!("{version_id}.json"));
    write_config_json(
        &annotation_path,
        &serde_json::to_string_pretty(document).context("Failed to serialize annotation JSON")?,
    )?;
    Ok(annotation_path.to_string_lossy().to_string())
}

pub fn next_order_index(root: &Path) -> Result<i64> {
    let conn = open_connection(root)?;
    let current: Option<i64> = conn.query_row("SELECT MAX(order_index) FROM capture_items", [], |row| row.get(0))?;
    Ok(current.unwrap_or(0) + 1)
}

pub fn next_public_filename(root: &Path, append_timestamp: bool) -> Result<String> {
    let captures = list_captures(root)?;
    let next = captures.iter().map(|capture| capture.order_index).max().unwrap_or(0) + 1;
    let prefix = format!("{next:03}");
    if append_timestamp {
        Ok(format!("{}_{}.png", prefix, Utc::now().format("%Y%m%d_%H%M%S")))
    } else {
        Ok(format!("{prefix}.png"))
    }
}

pub fn reorder_captures(root: &Path, capture_ids: &[String]) -> Result<()> {
    let mut conn = open_connection(root)?;
    let tx = conn.transaction()?;
    for (index, capture_id) in capture_ids.iter().enumerate() {
        tx.execute(
            "UPDATE capture_items SET order_index = ?2 WHERE id = ?1",
            params![capture_id, (index as i64) + 1],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn copy_file(source: &Path, target: &Path) -> Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, target).with_context(|| {
        format!(
            "Failed to copy {} to {}",
            source.display(),
            target.display()
        )
    })?;
    Ok(())
}

pub fn remove_file_if_exists(path: &Path) -> Result<()> {
    if path.exists() {
        fs::remove_file(path).with_context(|| format!("Failed to remove {}", path.display()))?;
    }
    Ok(())
}

pub fn parse_ts(value: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(value)
        .map(|ts| ts.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

pub fn default_annotation_document() -> Value {
    serde_json::json!({
        "items": [],
        "crop": null,
        "savedAt": Utc::now(),
    })
}
