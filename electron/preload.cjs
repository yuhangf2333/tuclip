const { contextBridge, ipcRenderer } = require("electron");
const { pathToFileURL } = require("url");

function fileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

contextBridge.exposeInMainWorld("tuclip", {
  getAppState: () => ipcRenderer.invoke("tuclip:getAppState"),
  listWorkspaces: () => ipcRenderer.invoke("tuclip:listWorkspaces"),
  pickDirectory: () => ipcRenderer.invoke("tuclip:pickDirectory"),
  createWorkspace: (name, rootPath, appendTimestamp) =>
    ipcRenderer.invoke("tuclip:createWorkspace", name, rootPath, appendTimestamp),
  showWorkspaceContextMenu: (rootPath, workspaceLabel, openFolderLabel) =>
    ipcRenderer.invoke(
      "tuclip:showWorkspaceContextMenu",
      rootPath,
      workspaceLabel,
      openFolderLabel,
    ),
  setActiveWorkspace: (workspaceId) =>
    ipcRenderer.invoke("tuclip:setActiveWorkspace", workspaceId),
  updateShortcuts: (shortcuts) => ipcRenderer.invoke("tuclip:updateShortcuts", shortcuts),
  updatePreferences: (preferences) =>
    ipcRenderer.invoke("tuclip:updatePreferences", preferences),
  getRemoteState: () => ipcRenderer.invoke("tuclip:getRemoteState"),
  updateRemoteConnections: (patch) =>
    ipcRenderer.invoke("tuclip:updateRemoteConnections", patch),
  testRemoteConnection: (provider, patch) =>
    ipcRenderer.invoke("tuclip:testRemoteConnection", provider, patch),
  updateWorkspaceRemoteSettings: (workspaceId, patch) =>
    ipcRenderer.invoke("tuclip:updateWorkspaceRemoteSettings", workspaceId, patch),
  runWorkspaceSync: (workspaceId) => ipcRenderer.invoke("tuclip:runWorkspaceSync", workspaceId),
  retryRemoteJobs: () => ipcRenderer.invoke("tuclip:retryRemoteJobs"),
  publishCaptureNow: (captureId, workspaceId) =>
    ipcRenderer.invoke("tuclip:publishCaptureNow", captureId, workspaceId),
  copyCaptureRemoteUrl: (captureId, workspaceId) =>
    ipcRenderer.invoke("tuclip:copyCaptureRemoteUrl", captureId, workspaceId),
  openCaptureRemoteUrl: (captureId, workspaceId) =>
    ipcRenderer.invoke("tuclip:openCaptureRemoteUrl", captureId, workspaceId),
  resolveSyncConflict: (conflictId, action) =>
    ipcRenderer.invoke("tuclip:resolveSyncConflict", conflictId, action),
  updateTags: (tags) => ipcRenderer.invoke("tuclip:updateTags", tags),
  toggleMonitoring: (paused) => ipcRenderer.invoke("tuclip:toggleMonitoring", paused),
  listPendingCaptures: () => ipcRenderer.invoke("tuclip:listPendingCaptures"),
  selectPendingTag: (pendingId, tagId) => ipcRenderer.invoke("tuclip:selectPendingTag", pendingId, tagId),
  updatePendingNote: (pendingId, note) => ipcRenderer.invoke("tuclip:updatePendingNote", pendingId, note),
  extendPopupCountdown: () => ipcRenderer.invoke("tuclip:extendPopupCountdown"),
  savePendingCapture: (pendingId, targetWorkspaceId, openEditor) =>
    ipcRenderer.invoke(
      "tuclip:savePendingCapture",
      pendingId,
      targetWorkspaceId,
      openEditor,
    ),
  discardPendingCapture: (pendingId) =>
    ipcRenderer.invoke("tuclip:discardPendingCapture", pendingId),
  listCaptures: (workspaceId) => ipcRenderer.invoke("tuclip:listCaptures", workspaceId),
  openCaptureInEditor: (captureId, workspaceId) =>
    ipcRenderer.invoke("tuclip:openCaptureInEditor", captureId, workspaceId),
  updateCaptureNote: (captureId, workspaceId, note) =>
    ipcRenderer.invoke("tuclip:updateCaptureNote", captureId, workspaceId, note),
  updateCaptureTag: (captureId, workspaceId, tagId) =>
    ipcRenderer.invoke("tuclip:updateCaptureTag", captureId, workspaceId, tagId),
  saveCaptureEdit: (captureId, workspaceId, renderedPngBase64, annotationDocument) =>
    ipcRenderer.invoke(
      "tuclip:saveCaptureEdit",
      captureId,
      workspaceId,
      renderedPngBase64,
      annotationDocument,
    ),
  reorderCaptures: (workspaceId, captureIds) =>
    ipcRenderer.invoke("tuclip:reorderCaptures", workspaceId, captureIds),
  moveCaptureToWorkspace: (captureId, sourceWorkspaceId, targetWorkspaceId) =>
    ipcRenderer.invoke(
      "tuclip:moveCaptureToWorkspace",
      captureId,
      sourceWorkspaceId,
      targetWorkspaceId,
    ),
  takeEditorTarget: () => ipcRenderer.invoke("tuclip:takeEditorTarget"),
  showMainWindow: () => ipcRenderer.invoke("tuclip:showMainWindow"),
  hideCurrentWindow: () => ipcRenderer.invoke("tuclip:hideCurrentWindow"),
  fileUrl,
});
