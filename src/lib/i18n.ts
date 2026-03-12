import type {
  AccentTheme,
  CloseAction,
  DetectionPreset,
  LanguageCode,
  RemoteProvider,
  RemotePublishStatus,
  RemoteSyncStatus,
  ShortcutConfig,
  ThemeMode,
} from "../types/app";

export type ShortcutField = keyof ShortcutConfig;

export interface UiStrings {
  shellEyebrow: string;
  appName: string;
  loading: string;
  syncing: string;
  commands: {
    start: string;
    pause: string;
    sync: string;
    settings: string;
    newSpace: string;
  };
  workspace: {
    eyebrow: string;
    title: string;
    inbox: string;
    active: string;
    global: string;
    create: string;
    openFolder: string;
  };
  stats: {
    pending: string;
    saved: string;
    monitor: string;
    on: string;
    off: string;
  };
  captures: {
    eyebrow: string;
    title: string;
    empty: string;
    emptyTag: string;
    edit: string;
    note: string;
    byOrder: string;
    byTag: string;
    untagged: string;
    moveUp: string;
    moveDown: string;
    saved: string;
    edited: string;
    syncNow: string;
    publish: string;
    republish: string;
    publishing: string;
    publishUnavailable: string;
    publishCloudOff: string;
    publishSetupNeeded: string;
    publishWorkspaceOff: string;
    publishSuccess: string;
    republishSuccess: string;
    publishFailed: string;
    copyLink: string;
    copyLinkSuccess: string;
    openRemote: string;
  };
  pending: {
    eyebrow: string;
    title: string;
    empty: string;
    to: string;
    note: string;
    save: string;
    edit: string;
    skip: string;
    discard: string;
  };
  popup: {
    eyebrow: string;
    idleTitle: string;
    idleHint: string;
    hide: string;
    ready: string;
    tags: string;
    target: string;
    note: string;
    notePlaceholder: string;
    save: string;
    edit: string;
    skip: string;
  };
  settings: {
    eyebrow: string;
    title: string;
    general: string;
    display: string;
    capture: string;
    tags: string;
    shortcuts: string;
    language: string;
    theme: string;
    accent: string;
    popupTime: string;
    extendPopup: string;
    showWorkspaceTags: string;
    closeAction: string;
    closeActions: Record<CloseAction, string>;
    recognition: string;
    recognitionMode: string;
    detectLabels: string;
    autoNumber: string;
    addTag: string;
    deleteTag: string;
    boundWorkspace: string;
    visible: string;
    inboxTarget: string;
    close: string;
    autoSaved: string;
    pressKeys: string;
    saveKeys: string;
    saving: string;
    tools: string;
    editor: string;
    popup: string;
    remote: string;
    serverUrl: string;
    username: string;
    password: string;
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl: string;
    forcePathStyle: string;
    remoteFolder: string;
    publishPrefix: string;
    workspaceBinding: string;
    test: string;
    retryFailed: string;
    yes: string;
    no: string;
  };
  remote: {
    title: string;
    webdav: string;
    s3: string;
    workspace: string;
    summary: string;
    masterHint: string;
    disabledHint: string;
    webdavHint: string;
    s3Hint: string;
    workspaceHint: string;
    summaryHint: string;
    jobs: string;
    conflicts: string;
    configured: string;
    notConfigured: string;
    saveConnection: string;
    latestResult: string;
    none: string;
    tooltipOff: string;
    tooltipNotConfigured: string;
    tooltipConflict: string;
    tooltipFailed: string;
    tooltipSyncing: string;
    tooltipReady: string;
    resolveKeep: string;
    resolveIncoming: string;
    openConflictFolder: string;
  };
  languages: Record<LanguageCode, string>;
  themes: Record<ThemeMode, string>;
  accents: Record<AccentTheme, string>;
  detections: Record<DetectionPreset, string>;
  remoteProviders: Record<RemoteProvider, string>;
  remoteSyncStatuses: Record<RemoteSyncStatus, string>;
  remotePublishStatuses: Record<RemotePublishStatus, string>;
  shortcutLabels: Record<ShortcutField, string>;
}

const en: UiStrings = {
  shellEyebrow: "Capture utility",
  appName: "TuClip",
  loading: "Starting TuClip…",
  syncing: "Syncing…",
  commands: {
    start: "Start",
    pause: "Pause",
    sync: "Sync",
    settings: "Settings",
    newSpace: "New",
  },
  workspace: {
    eyebrow: "Workspace",
    title: "Projects",
    inbox: "Inbox",
    active: "Active workspace",
    global: "Global inbox",
    create: "Create workspace",
    openFolder: "Open folder",
  },
  stats: {
    pending: "Pending",
    saved: "Saved",
    monitor: "Monitor",
    on: "On",
    off: "Off",
  },
  captures: {
    eyebrow: "Saved",
    title: "Steps",
    empty: "No saved screenshots yet.",
    emptyTag: "No screenshots in this tag yet.",
    edit: "Edit",
    note: "Note",
    byOrder: "List",
    byTag: "Tags",
    untagged: "Untagged",
    moveUp: "Move up",
    moveDown: "Move down",
    saved: "Saved",
    edited: "Edited",
    syncNow: "Sync now",
    publish: "Upload",
    republish: "Upload again",
    publishing: "Uploading…",
    publishUnavailable: "Host unavailable",
    publishCloudOff: "Cloud sync is off. Turn it on before uploading.",
    publishSetupNeeded: "Set up S3 / R2 image hosting before uploading.",
    publishWorkspaceOff: "Image hosting is not enabled for this workspace yet.",
    publishSuccess: "Uploaded to the remote image host.",
    republishSuccess: "Remote image was updated.",
    publishFailed: "Upload failed.",
    copyLink: "Copy link",
    copyLinkSuccess: "Remote link copied.",
    openRemote: "Open remote",
  },
  pending: {
    eyebrow: "Queue",
    title: "Pending",
    empty: "Clipboard watch is idle.",
    to: "To",
    note: "Note",
    save: "Save",
    edit: "Edit",
    skip: "Skip",
    discard: "Discard",
  },
  popup: {
    eyebrow: "Clipboard watch",
    idleTitle: "Listening",
    idleHint: "Take a screenshot and it will appear here.",
    hide: "Hide",
    ready: "New shot",
    tags: "Tags",
    target: "Target",
    note: "Note",
    notePlaceholder: "Add a short note for this screenshot",
    save: "Save",
    edit: "Edit",
    skip: "Skip",
  },
  settings: {
    eyebrow: "Settings",
    title: "Preferences",
    general: "General",
    display: "Display",
    capture: "Capture",
    tags: "Tags",
    shortcuts: "Key map",
    language: "Language",
    theme: "Theme",
    accent: "Accent",
    popupTime: "Popup time",
    extendPopup: "Extend on hover",
    showWorkspaceTags: "Show workspace tags",
    closeAction: "Close button",
    closeActions: {
      tray: "Keep in background",
      quit: "Quit app",
    },
    recognition: "Recognition",
    recognitionMode: "Rule set",
    detectLabels: "Suggest labels",
    autoNumber: "Auto number",
    addTag: "Add tag",
    deleteTag: "Delete",
    boundWorkspace: "Workspace",
    visible: "Visible",
    inboxTarget: "Inbox",
    close: "Close settings",
    autoSaved: "Saved instantly",
    pressKeys: "Press keys",
    saveKeys: "Save keys",
    saving: "Saving…",
    tools: "Tools",
    editor: "Editor",
    popup: "Popup",
    remote: "Cloud sync",
    serverUrl: "Server URL",
    username: "Username",
    password: "Password",
    endpoint: "Endpoint",
    region: "Region",
    bucket: "Bucket",
    accessKeyId: "Access key",
    secretAccessKey: "Secret key",
    publicBaseUrl: "Public base URL",
    forcePathStyle: "Path-style URL",
    remoteFolder: "Remote folder",
    publishPrefix: "Publish prefix",
    workspaceBinding: "Workspace",
    test: "Test",
    retryFailed: "Retry failed",
    yes: "On",
    no: "Off",
  },
  remote: {
    title: "Cloud sync",
    webdav: "Drive sync (WebDAV)",
    s3: "Image hosting (S3 / R2)",
    workspace: "Workspace binding",
    summary: "Summary",
    masterHint: "Keep workspaces in sync across devices, or publish final screenshots to a remote image host.",
    disabledHint: "Cloud sync is off. Turn it on only if you want multi-device sync or remote image links.",
    webdavHint: "Mirror the whole workspace to a WebDAV drive such as Nextcloud, NAS, or Nutstore.",
    s3Hint: "Publish the final exported image to S3 or R2 and keep a stable remote URL for sharing.",
    workspaceHint: "Choose which workspace uses drive sync or image hosting, and set its remote path rules.",
    summaryHint: "Recent remote tasks and conflicts are shown here for this device.",
    jobs: "Jobs",
    conflicts: "Conflicts",
    configured: "Configured",
    notConfigured: "Not configured",
    saveConnection: "Save connection",
    latestResult: "Latest result",
    none: "None",
    tooltipOff: "Cloud sync is off",
    tooltipNotConfigured: "Cloud sync is on, but no remote connection is configured yet",
    tooltipConflict: "Cloud sync has conflicts that need review",
    tooltipFailed: "Cloud sync failed",
    tooltipSyncing: "Cloud sync is running",
    tooltipReady: "Cloud sync is ready",
    resolveKeep: "Keep local",
    resolveIncoming: "Use incoming",
    openConflictFolder: "Open folder",
  },
  languages: {
    en: "English",
    zh: "中文",
  },
  themes: {
    system: "System",
    light: "Light",
    dark: "Dark",
  },
  accents: {
    blue: "Blue",
    graphite: "Graphite",
    mint: "Mint",
    rose: "Rose",
  },
  detections: {
    balanced: "Balanced",
    dense: "Dense",
    focused: "Focused",
  },
  remoteProviders: {
    webdav: "WebDAV",
    s3: "S3 / R2",
  },
  remoteSyncStatuses: {
    idle: "Not synced",
    syncing: "Syncing",
    synced: "Synced",
    failed: "Failed",
    conflict: "Conflict",
  },
  remotePublishStatuses: {
    idle: "Not published",
    publishing: "Publishing",
    published: "Published",
    failed: "Publish failed",
  },
  shortcutLabels: {
    rectTool: "Rect",
    numberTool: "Number",
    textTool: "Label",
    cropTool: "Crop",
    save: "Save",
    cancel: "Cancel",
    deleteSelection: "Delete",
    undo: "Undo",
    redo: "Redo",
    quickSavePending: "Quick save",
    quickAnnotatePending: "Quick edit",
    dismissPopup: "Skip popup",
    toggleMonitoring: "Monitor",
  },
};

const zh: UiStrings = {
  shellEyebrow: "截图工具",
  appName: "TuClip",
  loading: "正在启动 TuClip…",
  syncing: "同步中…",
  commands: {
    start: "开始",
    pause: "暂停",
    sync: "同步",
    settings: "设置",
    newSpace: "新建",
  },
  workspace: {
    eyebrow: "工作区",
    title: "项目",
    inbox: "收集箱",
    active: "当前工作区",
    global: "全局收集箱",
    create: "新建工作区",
    openFolder: "打开文件夹",
  },
  stats: {
    pending: "待处理",
    saved: "已保存",
    monitor: "监听",
    on: "开",
    off: "关",
  },
  captures: {
    eyebrow: "已保存",
    title: "步骤图",
    empty: "当前工作区还没有截图。",
    emptyTag: "这个标签下还没有截图。",
    edit: "编辑",
    note: "备注",
    byOrder: "列表",
    byTag: "标签",
    untagged: "未分类",
    moveUp: "上移",
    moveDown: "下移",
    saved: "已保存",
    edited: "已编辑",
    syncNow: "立即同步",
    publish: "上传图床",
    republish: "重新上传",
    publishing: "上传中…",
    publishUnavailable: "图床未配置",
    publishCloudOff: "云同步未开启，不能上传图床。",
    publishSetupNeeded: "请先配置并启用 S3 / R2 图床。",
    publishWorkspaceOff: "当前工作区还没开启图床发布。",
    publishSuccess: "已上传到图床。",
    republishSuccess: "图床上的图片已更新。",
    publishFailed: "上传图床失败。",
    copyLink: "复制链接",
    copyLinkSuccess: "图床链接已复制。",
    openRemote: "打开远端",
  },
  pending: {
    eyebrow: "队列",
    title: "待处理",
    empty: "剪贴板监听空闲中。",
    to: "目标",
    note: "备注",
    save: "保存",
    edit: "编辑",
    skip: "跳过",
    discard: "删除",
  },
  popup: {
    eyebrow: "剪贴板监听",
    idleTitle: "后台监听中",
    idleHint: "截一张图，它会直接出现在这里。",
    hide: "隐藏",
    ready: "新截图",
    tags: "标签",
    target: "目标",
    note: "备注",
    notePlaceholder: "给这张截图加一句备注",
    save: "保存",
    edit: "编辑",
    skip: "跳过",
  },
  settings: {
    eyebrow: "设置",
    title: "偏好",
    general: "通用",
    display: "显示",
    capture: "截图",
    tags: "标签",
    shortcuts: "快捷键",
    language: "语言",
    theme: "主题",
    accent: "色彩",
    popupTime: "弹窗时长",
    extendPopup: "交互时延长",
    showWorkspaceTags: "显示工作区标签",
    closeAction: "关闭按钮",
    closeActions: {
      tray: "后台运行",
      quit: "直接退出",
    },
    recognition: "识别",
    recognitionMode: "规则",
    detectLabels: "自动建议标签",
    autoNumber: "自动编号",
    addTag: "新建标签",
    deleteTag: "删除",
    boundWorkspace: "对应工作区",
    visible: "显示",
    inboxTarget: "收集箱",
    close: "关闭设置",
    autoSaved: "即时保存",
    pressKeys: "按下组合键",
    saveKeys: "保存快捷键",
    saving: "保存中…",
    tools: "工具",
    editor: "编辑",
    popup: "弹窗",
    remote: "云同步",
    serverUrl: "服务器地址",
    username: "用户名",
    password: "密码",
    endpoint: "端点",
    region: "区域",
    bucket: "桶名",
    accessKeyId: "Access Key",
    secretAccessKey: "Secret Key",
    publicBaseUrl: "公开域名",
    forcePathStyle: "Path Style",
    remoteFolder: "远端目录",
    publishPrefix: "发布前缀",
    workspaceBinding: "工作区",
    test: "测试连接",
    retryFailed: "重试失败项",
    yes: "开",
    no: "关",
  },
  remote: {
    title: "云同步",
    webdav: "云盘同步（WebDAV）",
    s3: "图床发布（S3 / R2）",
    workspace: "工作区绑定",
    summary: "概览",
    masterHint: "把工作区同步到云盘，或者把最终截图发布到图床，两个能力可以分开使用。",
    disabledHint: "云同步当前关闭。只有在你需要多设备同步或远程图片链接时才需要开启。",
    webdavHint: "同步整个工作区到支持 WebDAV 的云盘，例如 Nextcloud、NAS、坚果云等。",
    s3Hint: "只发布最终导出图到 S3 / R2 图床，并生成可分享的稳定远程链接。",
    workspaceHint: "给具体工作区选择是否启用云盘同步或图床发布，并设置对应的远端目录规则。",
    summaryHint: "这里显示当前设备上的远程任务和冲突状态。",
    jobs: "任务",
    conflicts: "冲突",
    configured: "已配置",
    notConfigured: "未配置",
    saveConnection: "保存连接",
    latestResult: "最近结果",
    none: "暂无",
    tooltipOff: "云同步当前关闭",
    tooltipNotConfigured: "云同步已开启，但还没有配置远程连接",
    tooltipConflict: "云同步存在冲突，等待处理",
    tooltipFailed: "云同步失败",
    tooltipSyncing: "云同步正在运行",
    tooltipReady: "云同步已就绪",
    resolveKeep: "保留本地",
    resolveIncoming: "使用来件",
    openConflictFolder: "打开文件夹",
  },
  languages: {
    en: "English",
    zh: "中文",
  },
  themes: {
    system: "跟随系统",
    light: "浅色",
    dark: "深色",
  },
  accents: {
    blue: "蓝",
    graphite: "石墨",
    mint: "薄荷",
    rose: "玫瑰",
  },
  detections: {
    balanced: "平衡",
    dense: "密集",
    focused: "精确",
  },
  remoteProviders: {
    webdav: "WebDAV",
    s3: "S3 / R2",
  },
  remoteSyncStatuses: {
    idle: "未同步",
    syncing: "同步中",
    synced: "已同步",
    failed: "同步失败",
    conflict: "冲突",
  },
  remotePublishStatuses: {
    idle: "未发布",
    publishing: "发布中",
    published: "已发布",
    failed: "发布失败",
  },
  shortcutLabels: {
    rectTool: "框选",
    numberTool: "编号",
    textTool: "文字",
    cropTool: "裁剪",
    save: "保存",
    cancel: "退出",
    deleteSelection: "删除",
    undo: "撤销",
    redo: "重做",
    quickSavePending: "快速保存",
    quickAnnotatePending: "快速编辑",
    dismissPopup: "关闭弹窗",
    toggleMonitoring: "切换监听",
  },
};

const STRINGS: Record<LanguageCode, UiStrings> = {
  en,
  zh,
};

export function getStrings(language: LanguageCode | undefined): UiStrings {
  if (!language) {
    return STRINGS.en;
  }
  return STRINGS[language] ?? STRINGS.en;
}

export function statusLabel(status: string, strings: UiStrings): string {
  if (status === "edited") {
    return strings.captures.edited;
  }
  return strings.captures.saved;
}
