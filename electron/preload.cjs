const { contextBridge, ipcRenderer } = require("electron");
const { pathToFileURL } = require("url");

function fileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

contextBridge.exposeInMainWorld("gleandex", {
  getAppState: () => ipcRenderer.invoke("gleandex:getAppState"),
  listWorkspaces: () => ipcRenderer.invoke("gleandex:listWorkspaces"),
  pickDirectory: () => ipcRenderer.invoke("gleandex:pickDirectory"),
  createWorkspace: (name, rootPath, appendTimestamp) =>
    ipcRenderer.invoke("gleandex:createWorkspace", name, rootPath, appendTimestamp),
  showWorkspaceContextMenu: (rootPath, workspaceLabel, openFolderLabel) =>
    ipcRenderer.invoke(
      "gleandex:showWorkspaceContextMenu",
      rootPath,
      workspaceLabel,
      openFolderLabel,
    ),
  setActiveWorkspace: (workspaceId) =>
    ipcRenderer.invoke("gleandex:setActiveWorkspace", workspaceId),
  updateShortcuts: (shortcuts) => ipcRenderer.invoke("gleandex:updateShortcuts", shortcuts),
  updatePreferences: (preferences) =>
    ipcRenderer.invoke("gleandex:updatePreferences", preferences),
  updateTags: (tags) => ipcRenderer.invoke("gleandex:updateTags", tags),
  toggleMonitoring: (paused) => ipcRenderer.invoke("gleandex:toggleMonitoring", paused),
  listPendingCaptures: () => ipcRenderer.invoke("gleandex:listPendingCaptures"),
  selectPendingTag: (pendingId, tagId) => ipcRenderer.invoke("gleandex:selectPendingTag", pendingId, tagId),
  updatePendingNote: (pendingId, note) => ipcRenderer.invoke("gleandex:updatePendingNote", pendingId, note),
  extendPopupCountdown: () => ipcRenderer.invoke("gleandex:extendPopupCountdown"),
  savePendingCapture: (pendingId, targetWorkspaceId, openEditor) =>
    ipcRenderer.invoke(
      "gleandex:savePendingCapture",
      pendingId,
      targetWorkspaceId,
      openEditor,
    ),
  discardPendingCapture: (pendingId) =>
    ipcRenderer.invoke("gleandex:discardPendingCapture", pendingId),
  listCaptures: (workspaceId) => ipcRenderer.invoke("gleandex:listCaptures", workspaceId),
  openCaptureInEditor: (captureId, workspaceId) =>
    ipcRenderer.invoke("gleandex:openCaptureInEditor", captureId, workspaceId),
  updateCaptureNote: (captureId, workspaceId, note) =>
    ipcRenderer.invoke("gleandex:updateCaptureNote", captureId, workspaceId, note),
  updateCaptureTag: (captureId, workspaceId, tagId) =>
    ipcRenderer.invoke("gleandex:updateCaptureTag", captureId, workspaceId, tagId),
  saveCaptureEdit: (captureId, workspaceId, renderedPngBase64, annotationDocument) =>
    ipcRenderer.invoke(
      "gleandex:saveCaptureEdit",
      captureId,
      workspaceId,
      renderedPngBase64,
      annotationDocument,
    ),
  reorderCaptures: (workspaceId, captureIds) =>
    ipcRenderer.invoke("gleandex:reorderCaptures", workspaceId, captureIds),
  moveCaptureToWorkspace: (captureId, sourceWorkspaceId, targetWorkspaceId) =>
    ipcRenderer.invoke(
      "gleandex:moveCaptureToWorkspace",
      captureId,
      sourceWorkspaceId,
      targetWorkspaceId,
    ),
  takeEditorTarget: () => ipcRenderer.invoke("gleandex:takeEditorTarget"),
  showMainWindow: () => ipcRenderer.invoke("gleandex:showMainWindow"),
  hideCurrentWindow: () => ipcRenderer.invoke("gleandex:hideCurrentWindow"),
  fileUrl,
});
