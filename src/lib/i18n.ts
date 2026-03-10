import type {
  AccentTheme,
  CloseAction,
  DetectionPreset,
  LanguageCode,
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
    yes: string;
    no: string;
  };
  languages: Record<LanguageCode, string>;
  themes: Record<ThemeMode, string>;
  accents: Record<AccentTheme, string>;
  detections: Record<DetectionPreset, string>;
  shortcutLabels: Record<ShortcutField, string>;
}

const en: UiStrings = {
  shellEyebrow: "Capture utility",
  appName: "GleanDex",
  loading: "Starting GleanDex…",
  syncing: "Syncing…",
  commands: {
    start: "Start",
    pause: "Pause",
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
    yes: "On",
    no: "Off",
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
  appName: "GleanDex",
  loading: "正在启动 GleanDex…",
  syncing: "同步中…",
  commands: {
    start: "开始",
    pause: "暂停",
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
    yes: "开",
    no: "关",
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
