/**
 * 透明肥鱼 —— 客户端入口
 *
 * 分工：
 *   · 壁纸文件由宿主侧管理（lib/index.js 的路由），这里只负责显示与上传
 *   · 玻璃的 token 走官方 ctx.theme.overrideTokens()
 *   · 材质（backdrop-filter / 描边 / 文字光晕）走 CSS
 *   · 设置面板挂到 settings.section，与「通用设置」平级
 */

window.__ModuleLoader__.load({
  id: 'dsh-transparent-fish',
  factory: (require) => {
    const react = require('react')
    const h = react.createElement

    const CSS = `/* ============================================================================
   透明肥鱼 —— 固定材质版
   ----------------------------------------------------------------------------
   规则（按用户对苹果玻璃的观察定的）：
   1. 玻璃是**一整块固定颜色**，不随壁纸明暗变化 —— 这样任何一个位置的字对比度都一致
   2. 边缘内缩 + 圆角 + 投影 = 悬浮；最外圈渐隐，壁纸从缝里透出来
   3. 文字纯白 / 近黑，侧栏加粗；选中用 iOS 系统蓝
   ========================================================================== */

/* ------------------------------------------------------------ 1. 材质变量 */

html[data-tf="on"] body {
  /* 不透明度越低，材质底色越靠近壁纸平均色 —— 让"调虚实"不改变整体明暗 */
  --tf-mat-base-mixed: color-mix(
    in srgb,
    var(--tf-mat-base) var(--tf-mat-mix, 100%),
    var(--tf-wall-tint, var(--tf-mat-base))
  );
  /* 浅色：固定浅灰 + 深字 */
  --tf-mat-base: rgb(210 217 229);
  --tf-mat-a: 0.70;
  --tf-mat: color-mix(in srgb, var(--tf-mat-base-mixed) calc(var(--tf-mat-a) * 100%), transparent);
  /* 说话人区分：你=绿，我=蓝，只染 16~18%，保留玻璃感 */
  --tf-mat-user: color-mix(in srgb, #34c759 17%, var(--tf-mat));
  --tf-mat-bot: color-mix(in srgb, var(--tf-accent) 14%, var(--tf-mat));
  --tf-mat-float: color-mix(in srgb, var(--tf-mat-base-mixed) calc(min(1, var(--tf-mat-a) + 0.1) * 100%), transparent);
  --tf-mat-hover: color-mix(in srgb, var(--tf-mat-base-mixed) calc(min(0.97, var(--tf-mat-a) + 0.16) * 100%), transparent);
  --tf-mat-bubble: color-mix(in srgb, var(--tf-mat-base-mixed) calc(min(0.98, var(--tf-mat-a) + 0.22) * 100%), transparent);
  --tf-ink: #10131a;
  --tf-ink-dim: rgb(16 19 26 / 0.62);
  --tf-accent: #007aff;
  --tf-hairline: rgb(15 22 34 / 0.10);
  --tf-divider: rgb(15 22 34 / 0.10);
  --tf-shadow: 0 12px 32px -12px rgb(12 18 32 / 0.35);
  --tf-header-deepen: rgb(0 0 0 / 0.10);
  --tf-radius-side: 20px;
  --tf-radius-card: 32px;
  --tf-gap: 10px;
  /* 整页型面板（自动化任务 / 插件）那一整块薄面的强度 */
  --tf-page-veil: 58%;
}

html[data-tf="on"] body[data-ds-dark-theme] {
  /* 深色：固定深灰 + 白字 */
  --tf-mat-base: rgb(22 24 30);
  --tf-mat-a: 0.50;
  --tf-mat: color-mix(in srgb, var(--tf-mat-base-mixed) calc(var(--tf-mat-a) * 100%), transparent);
  --tf-mat-float: color-mix(in srgb, var(--tf-mat-base-mixed) calc(min(1, var(--tf-mat-a) + 0.12) * 100%), transparent);
  --tf-mat-hover: color-mix(in srgb, var(--tf-mat-base-mixed) calc(min(0.97, var(--tf-mat-a) + 0.18) * 100%), transparent);
  --tf-mat-bubble: color-mix(in srgb, var(--tf-mat-base-mixed) calc(min(0.98, var(--tf-mat-a) + 0.30) * 100%), transparent);
  --tf-ink: #ffffff;
  --tf-ink-dim: rgb(255 255 255 / 0.66);
  --tf-accent: #0a84ff;
  --tf-hairline: rgb(255 255 255 / 0.16);
  --tf-divider: rgb(255 255 255 / 0.14);
  --tf-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.55);
}

/* ------------------------------------------------------------ 2. 壁纸层 */

.tf-wall {
  position: fixed;
  inset: 0;
  z-index: -3;
  pointer-events: none;
  overflow: hidden;
  background: #0a0d14;
}
.tf-wall > img,
.tf-wall > video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ------------------------------------------------------------ 3. 外壳透明 */

html[data-tf="on"] body { background: transparent !important; }
html[data-tf="on"] [class*="_frame"],
html[data-tf="on"] [class*="_centerCol"],
html[data-tf="on"] [class*="_mainPanel"],
html[data-tf="on"] [class*="_overlayLayer"],
html[data-tf="on"] [class*="kiGsTW_root"],
html[data-tf="on"] [class*="_emptyTabHost"] { background: transparent !important; }

/* ------------------------------------------- 4. 侧栏：内缩的悬浮玻璃板 */

html[data-tf="on"] [class*="sidebarCol"] {
  position: relative;
  z-index: 3;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--tf-ink);
}

/* 面板本体：内缩 8px + 圆角 + 投影，四周留出缝隙 */
html[data-tf="on"] [class*="sidebarCol"]::before {
  content: "";
  position: absolute;
  inset: var(--tf-gap);
  z-index: -1;
  border-radius: var(--tf-radius-side, 20px);
  background-color: var(--tf-mat);
  /* 大面板：渐变只到 6%→2%，否则会有色带；高光铺开 140%×90% */
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.06) 0%, rgb(255 255 255 / 0) 30%, rgb(0 0 0 / 0.02) 100%);
  box-shadow:
    0 -3px 10px -2px rgb(6 12 24 / 0.28),    /* 向上淡影：在顶栏上留下浮起的痕迹 */
    0 22px 48px -20px rgb(6 12 24 / 0.60),   /* 主投影：压在底下的顶栏上 */
    0 4px 12px -8px rgb(6 12 24 / 0.30),     /* 接触阴影：贴住底层 */
    inset 0 3px 0 rgb(255 255 255 / 0.40),
    inset 0 -2px 0 rgb(0 0 0 / 0.18),
    inset 0 0 0 1px var(--tf-hairline);
  pointer-events: none;
}

/* 顶栏的向左延伸：画在侧栏"面板之下"（::before 是面板，这里更低一层），
   所以中间部分被面板盖住、只在四周缝隙里露出来 —— 这正是"侧栏在上、顶栏在下"的证据。
   左端 mask 降到 50%，右端接上主区顶栏（100%），交界处材质浓度一致，不会断开。 */
html[data-tf="on"] [class*="sidebarCol"]::after {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: var(--tf-header-h, 40px);
  z-index: -2;
  pointer-events: none;
  background-color: var(--tf-mat-float);
  background-image: linear-gradient(var(--tf-header-deepen), var(--tf-header-deepen));
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.26),
    inset 0 -1px 0 var(--tf-divider);
  /* 暂时不做渐变：整条实心，先把"侧栏压在顶栏上"这个结构立住 */
  -webkit-mask-image: none;
  mask-image: none;
}

/* 侧栏内层不要再铺底色 */
html[data-tf="on"] [class*="kB3qhq_root"] { background: transparent !important; }

/* 文字：跟主题走，侧栏加粗 */
html[data-tf="on"] [class*="sidebarCol"],
html[data-tf="on"] [class*="sidebarCol"] * {
  color: var(--tf-ink);
}
html[data-tf="on"] [class*="sidebarCol"] [class*="Label"],
html[data-tf="on"] [class*="sidebarCol"] [class*="Title"],
html[data-tf="on"] [class*="sidebarCol"] [class*="panelTitle"] {
  font-weight: 600;
}
html[data-tf="on"] [class*="sidebarCol"] [class*="time"],
html[data-tf="on"] [class*="sidebarCol"] [class*="Count"] {
  color: var(--tf-ink-dim);
}

/* 当前项：只在外圈晕蓝，按钮内部保持玻璃本色 */
html[data-tf="on"] [class*="sidebarCol"] [aria-selected="true"],
html[data-tf="on"] [class*="sidebarCol"] [aria-current="true"],
html[data-tf="on"] [class*="sidebarCol"] [aria-current="page"],
html[data-tf="on"] [class*="sidebarCol"] [data-state="active"],
html[data-tf="on"] [class*="sidebarCol"] [class*="panelActive"] {
  color: var(--tf-accent) !important;
  background: transparent !important;
  border-radius: 10px;
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--tf-accent) 62%, transparent),
    inset 0 0 12px -2px color-mix(in srgb, var(--tf-accent) 42%, transparent) !important;
}

/* 当前项里的次要文字（时间等）也偏蓝，避免一半蓝一半灰 */
html[data-tf="on"] [class*="sidebarCol"] [aria-selected="true"] *,
html[data-tf="on"] [class*="sidebarCol"] [aria-current="page"] *,
html[data-tf="on"] [class*="sidebarCol"] [class*="panelActive"] * {
  color: color-mix(in srgb, var(--tf-accent) 78%, #ffffff) !important;
}
html[data-tf="on"] body[data-ds-dark-theme] [class*="sidebarCol"] [aria-selected="true"] *,
html[data-tf="on"] body[data-ds-dark-theme] [class*="sidebarCol"] [aria-current="page"] *,
html[data-tf="on"] body[data-ds-dark-theme] [class*="sidebarCol"] [class*="panelActive"] * {
  color: color-mix(in srgb, var(--tf-accent) 55%, #ffffff) !important;
}
html[data-tf="on"] [class*="sidebarCol"] [aria-selected="true"] svg,
html[data-tf="on"] [class*="sidebarCol"] [aria-current="true"] svg {
  color: var(--tf-accent) !important;
}

/* 滚动渐隐条：DSH 写死了浅色，透明掉 */
html[data-tf="on"] [class*="sidebarCol"] [class*="_fade"] {
  background-image: linear-gradient(to bottom, transparent 0%, var(--tf-mat) 100%) !important;
}

/* ------------------------------------------------ 5. 侧栏控件：小玻璃块 */

html[data-tf="on"] [role="treeitem"],
html[data-tf="on"] [class*="sidebarCol"] button {
  transition: background 150ms ease, transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* 悬停高亮不作用于"当前项"，否则悬停会把蓝色底色顶掉 */
html[data-tf="on"] [role="treeitem"]:not([aria-selected="true"]):hover,
html[data-tf="on"] [class*="sidebarCol"] button:not([aria-current]):not([class*="panelActive"]):hover,
html[data-tf="on"] [role="menuitem"]:hover {
  background: var(--tf-mat-float) !important;
  box-shadow:
    inset 0 0 0 1px var(--tf-hairline),
    inset 0 1px 0 rgb(255 255 255 / 0.3),
    0 4px 14px -8px rgb(0 0 0 / 0.4) !important;
  border-radius: 10px;
}
html[data-tf="on"] [role="treeitem"]:active,
html[data-tf="on"] [class*="sidebarCol"] button:active {
  transform: scale(0.985);
}

/* 新会话按钮：同样材质，稍亮一点 */
html[data-tf="on"] [class*="newSession"] {
  background: var(--tf-mat-float) !important;
  border: none !important;
  outline: none !important;
  /* 圆角对齐侧栏面板 */
  border-radius: var(--tf-radius-side, 20px) !important;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.36),
    inset 0 -1px 0 rgb(0 0 0 / 0.14),
    inset 0 0 0 1px var(--tf-hairline),
    0 8px 18px -16px rgb(8 14 26 / 0.5) !important;
  color: var(--tf-ink) !important;
}
html[data-tf="on"] [class*="newSession"] *,
html[data-tf="on"] [class*="newSession"] *::before,
html[data-tf="on"] [class*="newSession"] *::after {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* 顶栏已经是一整块材质，里面的控件不要再叠一层自己的底色 */
html[data-tf="on"] [class*="kiGsTW_header"] button,
html[data-tf="on"] [class*="kiGsTW_header"] [class*="menuAnchor"],
html[data-tf="on"] [class*="kiGsTW_header"] [class*="seat"],
html[data-tf="on"] [class*="headerCorner"] {
  background: transparent !important;
  box-shadow: none !important;
  border-color: transparent !important;
}

/* 悬停时给一点点反馈，但不要方块 */
html[data-tf="on"] [class*="kiGsTW_header"] button:hover,
html[data-tf="on"] [class*="kiGsTW_header"] [class*="seat"]:hover {
  background: rgb(255 255 255 / 0.07) !important;
  border-radius: 8px;
}

/* ------------------------------------------------------- 6. 正文阅读带 */

.tf-band {
  display: none !important; /* 已改用消息气泡承载，带子停用 */
  position: fixed;
  z-index: -1;
  pointer-events: none;
  border-radius: 0 0 var(--tf-radius-band, 48px) var(--tf-radius-band, 48px);
  corner-shape: squircle;
  background: var(--tf-mat);
  box-shadow:
    var(--tf-shadow),
    inset 0 0 0 1px var(--tf-hairline);
  /* 只柔化左右两侧；上下必须是硬边 —— 顶边要"紧贴"顶栏，底边要露出圆角 */
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
}

/* 正文文字 */
html[data-tf="on"] [class*="kiGsTW_root"] { color: var(--tf-ink); }

/* ------------------------------------------------------- 7. 输入框 */

html[data-tf="on"] [data-composer-card] {
  background-color: var(--tf-mat-float) !important;
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.10) 0%, rgb(255 255 255 / 0) 32%, rgb(0 0 0 / 0.04) 100%);
  border: none !important;
  border-radius: var(--tf-radius-card, 32px) !important;
  corner-shape: squircle;
  /* 输入区背后的内容要"推远"，否则字上叠字会干扰输入 */
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
  box-shadow:
    0 16px 34px -20px rgb(8 14 26 / 0.55),
    inset 0 2px 0 rgb(255 255 255 / 0.36),
    inset 0 -2px 0 rgb(0 0 0 / 0.16),
    inset 0 0 0 1px var(--tf-hairline) !important;
  transition: box-shadow 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
html[data-tf="on"] [data-composer-card]:focus-within {
  transform: translateY(-1px);
  box-shadow:
    var(--tf-shadow),
    inset 0 0 0 1px var(--tf-hairline),
    0 0 0 3px color-mix(in srgb, var(--tf-accent) 35%, transparent) !important;
}

/* 顶栏跟随材质；下沿加一条 1px 细线，把阅读带的"上边界"收归顶栏 */
html[data-tf="on"] [data-slot="conversation.header"],
html[data-tf="on"] [data-slot="conversation.session.header"],
/* 顶栏：主区这一段是实心的 */
html[data-tf="on"] [class*="kiGsTW_header"]:not([class*="headerCorner"]):not([class*="headerUtilities"]):not([class*="headerActions"]) {
  color: var(--tf-ink);
  /* 比侧栏更实 + 更深：浓度和颜色双错开，暗壁纸上也读得出"底下还有一层" */
  background-color: var(--tf-mat-float) !important;
  background-image: linear-gradient(var(--tf-header-deepen), var(--tf-header-deepen)) !important;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.26),
    inset 0 -1px 0 var(--tf-divider) !important;
}

/* 右侧栏面板：给一块底面，否则窗口透明后这块没有任何材质。
   只改 background-color —— 不碰 position（满屏形态靠 DSH 自己的定位），
   不加 backdrop-filter（收起时它仍占着原矩形，filter 会把背后整片吃掉）。 */
/* 面板只有展开时才需要面：收起时它那块矩形仍在（列宽 0 也照样挂到
   right: 0，width 是内联的 648px），原生靠"面板没底色"看不出来，
   我们一补就会在右半边压出一层。用它自己的 open 属性做开关最准。 */
html[data-tf="on"] [data-sidebar-right-panel][data-sidebar-right-open] {
  background-color: var(--tf-mat-float);
}

/* 满屏：width 被内联成 100vw，盖住整窗。
   原生看起来是实心的，是因为被盖住的 centerCol / rightbarCol 自带
   --dsw-alias-bg-base（我们在插件里把它们做透明了，为了露壁纸）。
   所以这里由面板自己补一层实心面；壁纸在满屏时消失，这是接受的取舍。
   z-index 60：原生 .sidebarCol 没有 z-index，天然被面板盖住；
   我们的侧栏为了压住顶栏有 z-index: 3，必须把面板提到它之上。 */
html[data-tf="on"] [data-sidebar-right-panel="fullscreen"][data-sidebar-right-open] {
  background-color: var(--tf-mat-base-mixed);
  z-index: 60;
}

/* 右侧栏顶部：和主顶栏同高同材质，拼成一条贯通的横带。
   注意 data-sidebar-right-open 是真实存在的（源码 sidebar-right 组件
   \`data-sidebar-right-open={expanded || undefined}\`），展开时才有；
   面板本身是 position:absolute，::before 直接以它为定位祖先。 */
html[data-tf="on"] [data-sidebar-right-panel][data-sidebar-right-open]::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: var(--tf-header-h, 40px);
  pointer-events: none;
  background-color: var(--tf-mat-float);
  background-image: linear-gradient(var(--tf-header-deepen), var(--tf-header-deepen));
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.26),
    inset 0 -1px 0 var(--tf-divider);
}

/* 空面板正中的指南针（huge hero icon）。
   原生给它的是 rgb(229,229,229) / rgb(60,60,61) —— 两个值都是配着 DSH
   自己的整窗底色定的；我们的材质明暗不同，深色下它就成了一块深灰、
   浅色下又近白。改成跟 --tf-ink 同源，两端都按同一比例退到背景之后。
   用 [class$="_hero"] 精确匹配类名结尾，避免命中 heroWorkspaceRow 之类。 */
html[data-tf="on"] [class$="_hero"] svg,
html[data-tf="on"] [class*="_hero "] svg {
  color: color-mix(in srgb, var(--tf-ink) 66%, transparent);
}

/* 右侧栏里的工具卡：和输入框同一套材质 */
html[data-tf="on"] button[class*="_entry"],
html[data-tf="on"] div[class*="_entry"],
html[data-tf="on"] [class*="entryCell"] > button {
  background: var(--tf-mat-float) !important;
  border: none !important;
  border-radius: 20px !important;
  box-shadow:
    inset 0 0 0 1px var(--tf-hairline),
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    0 8px 20px -14px rgb(10 20 40 / 0.5) !important;
  transition: background 160ms ease, box-shadow 160ms ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
html[data-tf="on"] button[class*="_entry"]:hover,
html[data-tf="on"] div[class*="_entry"]:hover,
html[data-tf="on"] [class*="entryCell"] > button:hover {
  background: var(--tf-mat-hover) !important;
  transform: translateY(-1px);
}
html[data-tf="on"] button[class*="_entry"]:active,
html[data-tf="on"] div[class*="_entry"]:active,
html[data-tf="on"] [class*="entryCell"] > button:active {
  transform: scale(0.99);
}

/* 右侧的文件导航面板：整个 aside 是透明的，文字直接压在壁纸上 */
html[data-tf="on"] aside[class*="_navigator"],
html[data-tf="on"] [class*="_navigator"][class*="wholePage"] {
  /* 文字面板：比阅读带更实一点，否则文件名压在亮壁纸上看不清 */
  background: var(--tf-mat-hover) !important;
  box-shadow: inset 1px 0 0 var(--tf-divider) !important;
}

/* 文件列表的悬停高亮：DSH 自带那条太白太淡，压不住壁纸 */
html[data-tf="on"] aside[class*="_navigator"] li:hover,
html[data-tf="on"] aside[class*="_navigator"] [class*="_item"]:hover,
html[data-tf="on"] aside[class*="_navigator"] [class*="_row"]:hover {
  background: color-mix(in srgb, var(--tf-ink) 16%, transparent) !important;
  border-radius: 8px;
}

/* 代码/文件预览页：透明的页面容器里放了代码块，字会直接压在壁纸上 */
html[data-tf="on"] [class*="_page"]:has(pre),
html[data-tf="on"] [class*="_content"]:has(pre),
html[data-tf="on"] [class*="_viewer"]:has(pre),
html[data-tf="on"] [class*="_preview"]:has(pre),
html[data-tf="on"] [class*="_code"]:has(pre),
html[data-tf="on"] [class*="codeView"],
html[data-tf="on"] [class*="fileView"],
html[data-tf="on"] [class*="fullPage"],
html[data-tf="on"] [class*="monaco-editor"],
html[data-tf="on"] [class*="CodeMirror"] {
  background: var(--tf-mat-hover) !important;
}

/* 代码块本身不要再叠一层，否则会双重变深 */
html[data-tf="on"] [class*="_page"]:has(pre) pre,
html[data-tf="on"] [class*="_content"]:has(pre) pre {
  background: transparent !important;
}

/* 右侧活动栏的标签页：未选中=小玻璃片，选中=左侧栏那套蓝 */
html[data-tf="on"] [class*="_tabStrip"] [role="tab"] {
  background: var(--tf-mat-float) !important;
  border-radius: 8px !important;
  box-shadow: inset 0 0 0 1px var(--tf-hairline) !important;
  transition: background 150ms ease, box-shadow 150ms ease;
}
html[data-tf="on"] [class*="_tabStrip"] [role="tab"]:hover {
  background: var(--tf-mat-hover) !important;
}
html[data-tf="on"] [class*="_tabStrip"] [role="tab"][aria-selected="true"] {
  /* 不整块染蓝：保持玻璃本体，只在外圈晕一层蓝（和输入框聚焦一致） */
  background: var(--tf-mat-float) !important;
  /* 外发光会被标签栏上下裁掉（左右宽、上下窄），改成内晕 + 等距描边 */
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--tf-accent) 62%, transparent),
    inset 0 0 12px -2px color-mix(in srgb, var(--tf-accent) 42%, transparent),
    0 0 0 1.5px color-mix(in srgb, var(--tf-accent) 18%, transparent) !important;
  color: var(--tf-accent) !important;
}
html[data-tf="on"] [class*="_tabStrip"] [role="tab"][aria-selected="true"] * {
  color: var(--tf-accent) !important;
}

/* ------------------------------------------------------- 8. 浮层 / 模态 */

html[data-tf="on"] [role="menu"],
html[data-tf="on"] [data-menu-material="translucent"] {
  corner-shape: squircle;
  --dsw-menu-surface-fill: var(--tf-mat-float);
  --dsw-menu-backdrop-filter: blur(18px) saturate(160%);
  box-shadow: inset 0 0 0 1px var(--tf-hairline), var(--tf-shadow);
}

html[data-tf="on"] [role="dialog"][aria-modal="true"] {
  corner-shape: squircle;
  background: var(--tf-mat-float) !important;
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  box-shadow: inset 0 0 0 1px var(--tf-hairline), var(--tf-shadow);
}

/* ------------------------------------------------------- 9. 降级 */

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  html[data-tf="on"] body { --tf-mat: rgb(246 247 249 / 0.94); }
  html[data-tf="on"] body[data-ds-dark-theme] { --tf-mat: rgb(22 24 30 / 0.94); }
}

@media (prefers-reduced-motion: reduce) {
  html[data-tf="on"] [data-composer-card],
  html[data-tf="on"] [role="treeitem"] { transition: none; }
}

/* ------------------------------------------------ 10. 壁纸网格的交互 */

.tf-cell { position: relative; }
.tf-cell img,
.tf-cell video { width: 100%; height: 100%; object-fit: cover; display: block; }

/* 删除按钮：悬停才出现，避免每格都挂个红叉 */
.tf-del {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  display: grid;
  place-items: center;
  font-size: 14px;
  line-height: 1;
  color: #fff;
  background: rgb(10 14 22 / 0.72);
  backdrop-filter: blur(6px);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 120ms ease, transform 120ms ease, background 120ms ease;
}
.tf-cell:hover .tf-del { opacity: 1; transform: scale(1); }
.tf-del:hover { background: #e5484d; }

/* 当前使用的标记 */
.tf-badge {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 600;
  color: #fff;
  background: rgb(10 14 22 / 0.62);
  backdrop-filter: blur(6px);
}


/* 对话区 / 输入框里的"三级文字"：DSH 用 #81858c，那是给不透明底配的，
   压在玻璃上就淡了。在**这两个范围内**把 token 换成墨色 ——
   代码块标题同理受益（它的底是近白，深字更清楚）。
   不全局改，是因为设置窗口、浮层等区域各自有自己的底。 */
html[data-tf="on"] [class*="kiGsTW_root"],
html[data-tf="on"] [data-composer-card] {
  --dsw-alias-label-tertiary: color-mix(in srgb, var(--tf-ink) 72%, transparent);
  --dsw-alias-label-secondary: color-mix(in srgb, var(--tf-ink) 84%, transparent);
}

/* 输入框右下角的推理等级（High / Max）：另一档硬编码灰，压在玻璃上同样偏淡 */
html[data-tf="on"] [class*="triggerEffort"] {
  color: color-mix(in srgb, var(--tf-ink) 64%, transparent) !important;
}

/* ------------------------------------------------ 11. 消息气泡 */

html[data-tf="on"] [data-message-bubble] {
  background-color: var(--tf-mat-user) !important;
  /* 体积感：上亮下暗的极轻渐变 + 左上角一点高光 */
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.13) 0%, rgb(255 255 255 / 0) 28%, rgb(0 0 0 / 0.05) 100%);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.32),      /* 顶部亮线，加粗提亮 */
    inset 0 -2px 0 rgb(0 0 0 / 0.20),           /* 底部暗线 = 厚度 */
    inset 0 0 0 1px var(--tf-hairline),
    0 26px 62px -26px rgb(6 12 24 / 0.80),      /* 主投影：加重 + 扩散 */
    0 6px 16px -9px rgb(6 12 24 / 0.5) !important;
  border: none !important;
  border-radius: 20px !important;
  padding: 14px 18px !important;
}


/* 助手回复：正文块本身就是一整段，直接当气泡 */
html[data-tf="on"] [class*="_markdown_"]:not([data-message-bubble] *) {
  background-color: var(--tf-mat-bot) !important;
  /* 体积感：上亮下暗的极轻渐变 + 左上角一点高光 */
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.13) 0%, rgb(255 255 255 / 0) 28%, rgb(0 0 0 / 0.05) 100%);
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.32),      /* 顶部亮线，加粗提亮 */
    inset 0 -2px 0 rgb(0 0 0 / 0.20),           /* 底部暗线 = 厚度 */
    inset 0 0 0 1px var(--tf-hairline),
    0 26px 62px -26px rgb(6 12 24 / 0.80),      /* 主投影：加重 + 扩散 */
    0 6px 16px -9px rgb(6 12 24 / 0.5) !important;
  border-radius: 20px !important;
  padding: 14px 18px !important;
}


/* ------------------------------------------------ 14. 思考过程：贴地的柔边区域

   层级靠"边缘锐度"表达，不靠投影：
     · 气泡 —— 硬边 + 顶部亮线 + 投影 → 浮在上面
     · 思考行 —— 四边羽化、无描边、无投影 → 贴在地面
   羽化用 mask 而不是 filter: blur()：一屏几十条时 blur 会各建一个合成层，
   mask 是纯合成，几乎无开销。 */

html[data-tf="on"] [class*="r52wTW_root"],
html[data-tf="on"] [data-chat-flow-kind="turn-process"] {
  position: relative;
  isolation: isolate;
}

html[data-tf="on"] [class*="r52wTW_root"]::before,
html[data-tf="on"] [data-chat-flow-kind="turn-process"]::before {
  content: "";
  position: absolute;
  inset: -4px -12px;
  z-index: -1;
  border-radius: 14px;
  /* 不用 backdrop-filter：每条思考行都会建合成层，一屏几十条时真机 GPU 压力不可控。
     改用足够实的底色把壁纸纹理盖住 —— mask 是纯合成，零额外层。 */
  background-color: color-mix(in srgb, var(--tf-mat-base-mixed) 80%, transparent);
  /* 左右 14px / 上下 6px 羽化；上下严格小于行距的一半，避免相邻行连成一片 */
  -webkit-mask-image:
    linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%),
    linear-gradient(180deg, transparent 0, #000 6px, #000 calc(100% - 6px), transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%),
    linear-gradient(180deg, transparent 0, #000 6px, #000 calc(100% - 6px), transparent 100%);
  mask-composite: intersect;
  pointer-events: none;
}

/* 折叠状态只有"思考"两个字，羽化后几乎看不见 → 给一个最小可视宽度 */
html[data-tf="on"] [class*="r52wTW_title"] {
  min-width: 76px;
}

/* 状态行（已完成，用时…）原本是硬边胶囊，改成同一套柔边，避免两种语言并存 */
html[data-tf="on"] [data-chat-flow-kind="turn-process"] [class*="summary"] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none !important;
  box-shadow: none !important;
  padding: 5px 12px;
}
/* 外层已经有一块底，里面的 endInfo 不要再叠一层 */
html[data-tf="on"] [class*="scrollBody"] [class*="endInfo"] {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}


/* 状态行没有盒子可刷底，那就把文字本身提到正文墨色，保证可读 */
html[data-tf="on"] [data-chat-flow-kind] [class*="summary"],
html[data-tf="on"] [data-chat-flow-kind] [class*="_text_"],
html[data-tf="on"] [class*="thinking"],
html[data-tf="on"] [class*="reasoning"],
html[data-tf="on"] [class*="thought"],
html[data-tf="on"] [class*="process"] {
  color: var(--tf-ink) !important;
  opacity: 1 !important;
}
html[data-tf="on"] [data-chat-flow-kind] [class*="summary"] svg,
html[data-tf="on"] [data-chat-flow-kind] [class*="_row_"] svg {
  color: var(--tf-ink) !important;
  opacity: 0.9 !important;
}


/* 消息底部那排操作（复制/赞/踩/用量/时间）：也给它一块小玻璃 */
html[data-tf="on"] [class*="scrollBody"] [class*="_actions"] {
  background-color: var(--tf-mat-bubble) !important;
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.10) 0%, rgb(255 255 255 / 0) 30%, rgb(0 0 0 / 0.04) 100%);
  border-radius: 12px !important;
  padding: 3px 10px !important;
  width: fit-content !important;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.34),
    inset 0 -1px 0 rgb(0 0 0 / 0.16),
    inset 0 0 0 1px var(--tf-hairline),
    0 10px 22px -16px rgb(6 12 24 / 0.55) !important;
}


/* 动作栏 / 状态胶囊里的文字和图标：提到正文墨色，去掉衰减 */
html[data-tf="on"] [class*="scrollBody"] [class*="_actions"],
html[data-tf="on"] [class*="scrollBody"] [class*="_actions"] *,
html[data-tf="on"] [data-chat-flow-kind="turn-process"],
html[data-tf="on"] [data-chat-flow-kind="turn-process"] * {
  color: var(--tf-ink) !important;
  opacity: 1 !important;
}
html[data-tf="on"] [class*="scrollBody"] [class*="_actions"] svg,
html[data-tf="on"] [data-chat-flow-kind="turn-process"] svg {
  color: var(--tf-ink) !important;
  opacity: 0.88 !important;
  stroke: currentColor;
}


/* 顶栏里的次级文字（标准模式 / 后台任务 / 轨迹 / …）：提高对比度 */
html[data-tf="on"] [class*="headerActions"] *,
html[data-tf="on"] [class*="kiGsTW_header"] [class*="seat"],
html[data-tf="on"] [class*="kiGsTW_header"] [class*="seatLabel"] {
  color: var(--tf-ink) !important;
  opacity: 1 !important;
}
html[data-tf="on"] [class*="headerActions"] svg,
html[data-tf="on"] [class*="kiGsTW_header"] [class*="seat"] svg {
  color: var(--tf-ink) !important;
  opacity: 0.8 !important;
}

/* 未选中的标签页（轨迹 / 对话切换）也不要太灰 */
html[data-tf="on"] [role="tablist"] [role="tab"]:not([aria-selected="true"]),
html[data-tf="on"] [role="tablist"] [role="tab"]:not([aria-selected="true"]) * {
  color: color-mix(in srgb, var(--tf-ink) 82%, transparent) !important;
  opacity: 1 !important;
}


/* 输入框占位文字：跟着墨色走，否则深色玻璃上那串固定的中灰会糊掉 */
html[data-tf="on"] [data-composer-card] [class*="placeholder"],
html[data-tf="on"] [data-composer-card] textarea::placeholder,
html[data-tf="on"] [data-composer-card] input::placeholder {
  color: var(--tf-ink) !important;
  opacity: 0.58 !important;
}


/* 壁纸库里的视频标记 */
.tf-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  color: #fff;
  background: rgb(10 14 22 / 0.55);
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.tf-dur {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: rgb(10 14 22 / 0.62);
  pointer-events: none;
}
.tf-kind {
  position: absolute;
  left: 5px;
  top: 5px;
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 10px;
  color: #fff;
  background: rgb(10 14 22 / 0.55);
  backdrop-filter: blur(6px);
  pointer-events: none;
}


/* README.md 这类文件用的是大图资源、没有尺寸上限，会撑成大方块。
   用 max-* 而不是固定 width：只压"过大的"，本来正常的图标一点不受影响。 */
html[data-tf="on"] [class*="_navigator"] li img,
html[data-tf="on"] [class*="_navigator"] li svg,
html[data-tf="on"] [class*="_navigator"] li canvas,
html[data-tf="on"] [class*="_navigator"] li [class*="fileIcon"],
html[data-tf="on"] [class*="_navigator"] li [class*="_icon_"] {
  max-width: 22px !important;
  max-height: 22px !important;
  flex: none !important;
  object-fit: contain !important;
}


/* ------------------------------------------- 12. 设置窗口：整体玻璃化 */

/* 对话框本体：和控制档同一套厚度 */
html[data-tf="on"] [role="dialog"][aria-modal="true"] {
  background-color: var(--tf-mat-float) !important;
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.10) 0%, rgb(255 255 255 / 0) 24%, rgb(0 0 0 / 0.03) 100%) !important;
  box-shadow:
    inset 0 2px 0 rgb(255 255 255 / 0.32),
    inset 0 -1px 0 rgb(0 0 0 / 0.14),
    inset 0 0 0 1px var(--tf-hairline),
    0 24px 60px -30px rgb(6 12 24 / 0.7) !important;
}

/* 左侧导航：未选中透明，悬停一层玻璃，选中用左侧栏那套蓝圈 */
html[data-tf="on"] [role="dialog"] [class*="_navCell"] {
  background: transparent !important;
  border-radius: 10px !important;
  transition: background 140ms ease, box-shadow 140ms ease;
}
html[data-tf="on"] [role="dialog"] [class*="_navCell"]:hover {
  background: var(--tf-mat-hover) !important;
}
html[data-tf="on"] [role="dialog"] [class*="_navCell"][class*="_active"],
html[data-tf="on"] [role="dialog"] [class*="_navCell"][aria-current="page"] {
  background: transparent !important;
  color: var(--tf-accent) !important;
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--tf-accent) 60%, transparent),
    inset 0 0 12px -2px color-mix(in srgb, var(--tf-accent) 40%, transparent) !important;
}

/* 设置对话框整体：覆盖 DSH 的次级文字 token。
   对话框内所有分区（通用 / 模型 / Agent 预设 / 插件市场…）都用这两个 token
   表示说明文字，逐个类名补会一直漏，直接在容器上换掉最稳。
   对话框内部没有深色内容区，这条覆盖是安全的；语义色（蓝/绿/金）是硬编码的，不受影响。 */
html[data-tf="on"] [role="dialog"] {
  --dsw-alias-label-tertiary: color-mix(in srgb, var(--tf-ink) 70%, transparent);
  --dsw-alias-label-secondary: color-mix(in srgb, var(--tf-ink) 84%, transparent);
}

/* Agent 预设卡片：内部的分区容器（cardFoot 等）是方角，
   会被卡片的 20px 圆角顶出来。让卡片裁掉内部溢出即可。 */
html[data-tf="on"] [role="dialog"] [class*="gdzZCG_card"] {
  overflow: hidden;
}
html[data-tf="on"] [role="dialog"] [class*="gdzZCG_cardFoot"] {
  border-radius: 0 0 20px 20px;
}

/* 设置窗口里的说明文字：DSH 把它们写死成 rgb(129,133,140)，
   压在玻璃上就看不见了。统一换成跟着表面亮度走的墨色。 */
html[data-tf="on"] [role="dialog"] [class*="_desc"],
html[data-tf="on"] [role="dialog"] [class*="Description"],
html[data-tf="on"] [role="dialog"] [class*="settingDesc"] {
  color: color-mix(in srgb, var(--tf-ink) 74%, transparent) !important;
}

/* 插件市场：整块是硬编码的 Tailwind 灰（#6b7280 / #8b93a1），压在玻璃上看不清。
   只提亮中性灰；蓝色分类、绿色已验证、金色星数等语义色一律不动。
   选中态 tab（qikqja_tabActive）是白字黑胶囊，必须排除。 */
html[data-tf="on"] [role="dialog"] [class*="qikqja_tab"]:not([class*="Active"]):not([class*="Count"]),
html[data-tf="on"] [role="dialog"] [class*="qikqja_segBtn"],
html[data-tf="on"] [role="dialog"] [class*="qikqja_segLabel"],
html[data-tf="on"] [role="dialog"] [class*="qikqja_versionBtn"],
html[data-tf="on"] [role="dialog"] [class*="qikqja_langBtn"],
html[data-tf="on"] [role="dialog"] [class*="qikqja_aboutBtn"],
html[data-tf="on"] [role="dialog"] [class*="qikqja_tagline"],
html[data-tf="on"] [role="dialog"] [class*="qikqja_resultCount"],
html[data-tf="on"] [role="dialog"] [class*="XaZHa_topic"],
html[data-tf="on"] [role="dialog"] [class*="XaZHa_authorBadge"],
html[data-tf="on"] [role="dialog"] [class*="XaZHa_fork"],
html[data-tf="on"] [role="dialog"] [class*="XaZHa_date"],
html[data-tf="on"] [role="dialog"] [class*="XaZHa_detailBtn"],
html[data-tf="on"] [role="dialog"] [class*="XaZHa_versionBadge"] {
  color: color-mix(in srgb, var(--tf-ink) 70%, transparent) !important;
}

/* 插件市场的搜索框占位文字 */
html[data-tf="on"] [role="dialog"] [class*="qikqja_root"] input::placeholder {
  color: color-mix(in srgb, var(--tf-ink) 58%, transparent) !important;
}

/* 分区里的卡片（账号余额、模型卡等）：也给材质 */
/* 只匹配「恰好有 _card 这个类」的元素：
   [class$="_card"] 覆盖单类名，[class*="_card "] 覆盖后面还跟着其它类的情况。
   这样 gdzZCG_cardIdentity / uuMOda_cardContent / xxx_cards 这类子元素都不会被误伤。 */
html[data-tf="on"] [role="dialog"] [class$="_card"],
html[data-tf="on"] [role="dialog"] [class*="_card "],
html[data-tf="on"] [role="dialog"] [class*="balanceCard"] {
  background-color: var(--tf-mat-float) !important;
  background-image: linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(0 0 0 / 0.02)) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.26),
    inset 0 0 0 1px var(--tf-hairline) !important;
}

/* ------------------------------------------------ 13. 插件页 */

/* 「发现」tab 的骨架屏：原本是 rgba(0,0,0,.04)，压在玻璃上会发暗 */
html[data-tf="on"] [class*="nLFHAG_skeleton"] {
  background-color: rgb(255 255 255 / 0.16) !important;
}

/* 「发现」tab 的搜索框：原生是纯白实心，和玻璃风格冲突 */
html[data-tf="on"] [class*="nLFHAG_search"] {
  background-color: var(--tf-mat-float) !important;
  border-color: var(--tf-hairline) !important;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.22) !important;
}

/* 分类胶囊：未选中半透明白，选中更实一档（保持原生"选中更实"的语义） */
html[data-tf="on"] [class*="nLFHAG_section"] [class*="_pill_"] {
  background-color: rgb(255 255 255 / 0.14) !important;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.16) !important;
  color: var(--tf-ink) !important;
}
html[data-tf="on"] [class*="nLFHAG_section"] [class*="_pill_"][class*="_active_"] {
  background-color: rgb(255 255 255 / 0.34) !important;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.36) !important;
}

/* 整页一块薄面：和「自动化任务」同一个做法。
   注意用 [class$=...] 精确匹配页根，否则 pageBody / pageBar / pageHead /
   pageTabs 这些同前缀的类会被一起匹配到。 */
html[data-tf="on"] [class$="w6M7KW_page"],
html[data-tf="on"] [class*="w6M7KW_page "] {
  background-color: color-mix(in srgb, var(--tf-mat-base-mixed) var(--tf-page-veil), transparent);
  color: var(--tf-ink);
}

/* 文字：整页覆盖次级/三级 token（DSH 用 #81858c / #61666b，压在壁纸上就没了） */
html[data-tf="on"] [class*="w6M7KW_page"] {
  --dsw-alias-label-tertiary: color-mix(in srgb, var(--tf-ink) 70%, transparent);
  --dsw-alias-label-secondary: color-mix(in srgb, var(--tf-ink) 84%, transparent);
}

/* 页头：并进页面这一整块里。
   原来给了它独立的 0.8 材质 + 模糊，结果顶部一横条比下面亮一档，
   整页被切成两块。半透明吸顶栏没法同时做到"不露滚动内容"和"没有接缝"，
   所以这里放弃吸顶：整页一块面，标题和标签跟着内容一起走。
   （参考的自动化任务页本来也是这个行为。） */
html[data-tf="on"] [class*="w6M7KW_pageBar"] {
  position: static !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* 分组标题：页面已经是一整块面，标题不再需要自己垫底，直接跟着页面走字。 */

/* 每一组（标题 + 行）成一整块玻璃。
   「已安装」用 w6M7KW_group（section），「发现」用 nLFHAG_section（div）——
   标签不同，所以选择器不能带标签前缀。 */
html[data-tf="on"] [class$="w6M7KW_group"],
html[data-tf="on"] [class*="w6M7KW_group "],
html[data-tf="on"] [class$="nLFHAG_section"],
html[data-tf="on"] [class*="nLFHAG_section "] {
  position: relative;
  /* 层级：页面最暗 < 组块亮一档 < 滑块最亮。
     所以这里不是再叠一块深色材质（那样会比页面更暗），
     而是在页面上压一层白光膜。 */
  background-color: rgb(255 255 255 / 0.13);
  background-image: linear-gradient(180deg, rgb(255 255 255 / 0.10), rgb(255 255 255 / 0.01));
  border-radius: 16px;
  padding: 2px 10px 10px;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.30),
    0 12px 30px -26px rgb(8 14 26 / 0.45);
}

/* 列表：不再自成面板，滑动的玻璃块由 JS 放进组里 */
html[data-tf="on"] ul[class*="w6M7KW_cards"],
html[data-tf="on"] ul[class*="nLFHAG_cards"] {
  margin-left: 0 !important;
  margin-right: 0 !important;
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

/* 悬停时的滑动玻璃块：一块，位置由 JS 推到当前行。
   不能直接用材质色 —— 组块本身就是材质，滑块会和底一样看不出来。
   所以它是一层"白光膜"：浅色下用较高白度（像 iOS 选中的白色胶囊），
   深色下用较低白度（提亮一档即可，太高会吃掉白字的对比）。 */
.tf-row-glide {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: 12px;
  opacity: 0;
  background-color: rgb(255 255 255 / 0.46);
  background-image: linear-gradient(180deg, rgb(255 255 255 / 0.30), rgb(255 255 255 / 0.06));
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.60),
    inset 0 1px 0 rgb(255 255 255 / 0.90),
    0 10px 22px -16px rgb(8 14 26 / 0.35);
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    width 260ms cubic-bezier(0.22, 1, 0.36, 1),
    height 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 150ms ease;
}
html[data-tf="on"] body[data-ds-dark-theme] .tf-row-glide {
  background-color: rgb(255 255 255 / 0.26);
  background-image: linear-gradient(180deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0.03));
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.26),
    inset 0 1px 0 rgb(255 255 255 / 0.38),
    0 10px 22px -16px rgb(0 0 0 / 0.55);
}

/* 行本身透明，只保留悬停反馈 */
html[data-tf="on"] li[class*="w6M7KW_card"],
html[data-tf="on"] li[class*="nLFHAG_card"] {
  position: relative;
  z-index: 1;
  background-color: transparent !important;
  background-image: none !important;
  border-radius: 12px !important;
  box-shadow: none !important;
}
/* 悬停底色交给滑动块，行自己不再变色 */
html[data-tf="on"] li[class*="w6M7KW_card"]:hover,
html[data-tf="on"] li[class*="nLFHAG_card"]:hover {
  background-color: transparent !important;
}

/* 行分隔线：从文字处开始内缩，不贯穿全宽（iOS 分组列表的做法） */
html[data-tf="on"] li[class*="w6M7KW_card"],
html[data-tf="on"] li[class*="nLFHAG_card"] {
  position: relative;
}
html[data-tf="on"] li[class*="w6M7KW_card"] + li[class*="w6M7KW_card"]::before,
html[data-tf="on"] li[class*="nLFHAG_card"] + li[class*="nLFHAG_card"]::before {
  content: "";
  position: absolute;
  top: 0;
  left: 68px;
  right: 0;
  height: 1px;
  background: var(--tf-divider);
  pointer-events: none;
}

/* ------------------------------------------- 15. 整页面板：自动化任务

   这类页面不是对话，没有气泡承载材质，整片直接压在壁纸上：
   标题、筛选、搜索框、空状态、按钮全是裸的。
   分两层处理：页面给一层薄面压住壁纸噪声，控件各自给玻璃。 */

html[data-tf="on"] section[class*="CDG4uW_page"] {
  background-color: color-mix(in srgb, var(--tf-mat-base-mixed) var(--tf-page-veil), transparent);
  color: var(--tf-ink);
}

html[data-tf="on"] [class*="CDG4uW_pageHeading"] h1 {
  color: var(--tf-ink);
}

/* 筛选：一颗通体胶囊，选中项自己再浮一层 */
html[data-tf="on"] [class*="CDG4uW_filterTabs"] {
  background-color: var(--tf-mat-float) !important;
  border-radius: 999px;
  padding: 2px;
  box-shadow:
    inset 0 0 0 1px var(--tf-hairline),
    inset 0 1px 0 rgb(255 255 255 / 0.22);
}
/* 注意：不能用 [class*="..._filterTab"] —— 子串会把容器 _filterTabs 一起匹配到 */
html[data-tf="on"] [class$="CDG4uW_filterTab"],
html[data-tf="on"] [class*="CDG4uW_filterTab "] {
  background: transparent !important;
  border-radius: 999px !important;
  color: var(--tf-ink-dim);
}
html[data-tf="on"] [class*="CDG4uW_filterTabActive"] {
  background-color: var(--tf-mat-bubble) !important;
  color: var(--tf-ink) !important;
  box-shadow:
    inset 0 0 0 1px var(--tf-hairline),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

/* 搜索框 */
html[data-tf="on"] [class*="CDG4uW_searchField"] {
  background-color: var(--tf-mat-float);
  border-radius: 10px;
  box-shadow:
    inset 0 0 0 1px var(--tf-hairline),
    inset 0 1px 0 rgb(255 255 255 / 0.20);
}
html[data-tf="on"] [class*="CDG4uW_searchField"] input {
  color: var(--tf-ink) !important;
  background: transparent !important;
}
html[data-tf="on"] [class*="CDG4uW_searchField"] input::placeholder {
  color: var(--tf-ink-dim) !important;
}

/* 空状态：插画退到背景之后，文字保持可读 */
html[data-tf="on"] [class*="CDG4uW_empty"] svg {
  color: color-mix(in srgb, var(--tf-ink) 32%, transparent);
}
html[data-tf="on"] [class*="CDG4uW_empty"] h2 {
  color: var(--tf-ink-dim);
}

/* 按钮 */
html[data-tf="on"] [class*="CDG4uW_creationActions"] button,
html[data-tf="on"] [class*="CDG4uW_empty"] button {
  border-radius: 10px !important;
  box-shadow:
    inset 0 0 0 1px var(--tf-hairline),
    inset 0 1px 0 rgb(255 255 255 / 0.20),
    0 6px 16px -12px rgb(8 14 26 / 0.5) !important;
}
html[data-tf="on"] [class*="CDG4uW_empty"] button {
  background-color: var(--tf-mat-float) !important;
  color: var(--tf-ink) !important;
}
`
    const FILTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <!--
      液态玻璃折射：低频湍流当作位移图，只让背景在边缘处轻微弯折。
      scale 越大越「液」，但会把文字也搅动，所以控制在 18 左右。
    -->
    <filter id="dsh-lg-refract" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="17" result="noise" />
      <feGaussianBlur in="noise" stdDeviation="1.6" result="soft" />
      <feDisplacementMap in="SourceGraphic" in2="soft" scale="18" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
</svg>
`

    const PREFIX = '/dsh-transparent-fish'
    const KEY = 'dsh-transparent-fish'

    /* ------------------------------------------------------------------ 默认值 */

    const DEFAULTS = {
      enabled: true,
      frost: null,
      radius: null,
      navFrost: 0.03,
      blur: 12,
      tint: 'auto',
      guard: 1,
      themeFollow: true,
      sheen: 0.9,
      volume: 0.5,
      pauseOnHidden: true,
      pauseOnBlur: false,
      pauseOnBattery: false,
    }

    /** 色调预设：值会以 soft-light 叠在壁纸上 */
    const TINTS = {
      neutral: { label: '中性', swatch: 'linear-gradient(135deg, #f2f3f5, #cfd3da)' },
      cool: { label: '冷蓝', swatch: 'linear-gradient(135deg, #a8c4ff, #4f7dff)' },
      purple: { label: '暖紫', swatch: 'linear-gradient(135deg, #d3b4ff, #8b5cf6)' },
      rainbow: { label: '彩光', swatch: 'conic-gradient(from 210deg, #ff5f9e, #7c6cff, #38c7ff, #4ef0c0, #ffd166, #ff5f9e)' },
      auto: { label: '跟随壁纸', swatch: 'linear-gradient(135deg, #9fb4d8, #6f86a8)' },
    }

    const state = { ...DEFAULTS }
    const library = { current: null, items: [] }
    const listeners = new Set()

    let $style = null
    let $defs = null
    let $wall = null
    let $video = null
    let $band = null
    let themeService = null
    let tokenDispose = null
    let autoTint = 'transparent'
    const effective = { frost: DEFAULTS.frost, navFrost: DEFAULTS.navFrost, content: 0.5 }
    /* 可读性兜底是否正在生效、以及实际使用的材质不透明度（供设置页显示，不写 DOM） */
    let matClamped = false
    let matEffective = 0
    let stopPointer = null
    let stopGlide = null
    let stopVideoPolicy = null

    /* ------------------------------------------------------------------ 存取 */

    function load() {
      try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return
        const saved = JSON.parse(raw)
        for (const key of Object.keys(DEFAULTS)) {
          if (saved[key] === undefined) continue
          if (typeof DEFAULTS[key] === 'boolean' && typeof saved[key] !== 'boolean') continue
          if (typeof DEFAULTS[key] === 'number' && !Number.isFinite(Number(saved[key]))) continue
          state[key] = saved[key]
        }
        if (!TINTS[state.tint]) state.tint = DEFAULTS.tint
        /* 旧版本的默认值 0.62 当成"没设过"，回落到主题默认 */
        if (typeof state.frost !== 'number' || state.frost < 0.3 || Math.abs(state.frost - 0.62) < 0.001) {
          state.frost = null
        }
      } catch (_error) {
        /* 坏存档忽略 */
      }
    }

    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch (_error) {
        /* 隐私模式写不进去，不影响本次会话 */
      }
    }

    function notify() {
      for (const fn of listeners) {
        try {
          fn()
        } catch (_error) {
          /* 单个订阅者出错不影响其它 */
        }
      }
    }

    let saveTimer = null
    /** 拖动类操作：只落盘，不重载壁纸 */
    function saveSoon() {
      clearTimeout(saveTimer)
      saveTimer = setTimeout(save, 250)
    }

    function update(patch) {
      Object.assign(state, patch)
      save()
      syncAll()
      notify()
    }


    /* ------------------------------------------------------------------ 透镜 */

    /**
     * 生成一张"径向位移贴图"：中心 R/G 均为 128（不位移），越靠边越强。
     * feDisplacementMap 用 R/G 当作 x/y 位移量，于是背景会被边缘"压弯"——
     * 这就是苹果那种厚玻璃的透镜感，靠模糊是模拟不出来的。
     */
    let lensMapUrl = null

    function buildLensMap(size) {
      if (lensMapUrl) return lensMapUrl
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const img = ctx.createImageData(size, size)
      const c = (size - 1) / 2
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x - c) / c
          const ny = (y - c) / c
          const r = Math.min(1, Math.sqrt(nx * nx + ny * ny))
          /* 中心 0，半径 0.55 之后开始增强，边缘到 1 */
          const t = r <= 0.76 ? 0 : Math.min(1, (r - 0.76) / 0.24)
          const k = t * t * (3 - 2 * t) /* smoothstep */
          const i = (y * size + x) * 4
          img.data[i] = 128 + nx * k * 127
          img.data[i + 1] = 128 + ny * k * 127
          img.data[i + 2] = 128
          img.data[i + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
      lensMapUrl = canvas.toDataURL('image/png')
      return lensMapUrl
    }

    /** 把位移贴图塞进 SVG 滤镜 */
    function installLensFilter() {
      const host = document.querySelector('div[data-plugin="dsh-transparent-fish"]')
      if (!host) return
      const url = buildLensMap(64)
      host.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">
          <defs>
            <filter id="tf-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
              <feImage href="${url}" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" result="map" />
              <feColorMatrix in="SourceGraphic" type="matrix" result="chR"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
              <feColorMatrix in="SourceGraphic" type="matrix" result="chG"
                values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
              <feColorMatrix in="SourceGraphic" type="matrix" result="chB"
                values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
              <feDisplacementMap in="chR" in2="map" scale="62" xChannelSelector="R" yChannelSelector="G" result="dR" />
              <feDisplacementMap in="chG" in2="map" scale="52" xChannelSelector="R" yChannelSelector="G" result="dG" />
              <feDisplacementMap in="chB" in2="map" scale="44" xChannelSelector="R" yChannelSelector="G" result="dB" />
              <feComposite in="dR" in2="dG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="dRG" />
              <feComposite in="dRG" in2="dB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="dAll" />
              <feBlend in="dAll" in2="SourceGraphic" mode="normal" />
            </filter>
            <filter id="tf-lens-soft" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
              <feImage href="${url}" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" result="map2" />
              <feColorMatrix in="SourceGraphic" type="matrix" result="sR"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
              <feColorMatrix in="SourceGraphic" type="matrix" result="sG"
                values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
              <feColorMatrix in="SourceGraphic" type="matrix" result="sB"
                values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
              <feDisplacementMap in="sR" in2="map2" scale="9" xChannelSelector="R" yChannelSelector="G" result="eR" />
              <feDisplacementMap in="sG" in2="map2" scale="8" xChannelSelector="R" yChannelSelector="G" result="eG" />
              <feDisplacementMap in="sB" in2="map2" scale="7" xChannelSelector="R" yChannelSelector="G" result="eB" />
              <feComposite in="eR" in2="eG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="eRG" />
              <feComposite in="eRG" in2="eB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
            </filter>
          </defs>
        </svg>`
    }

    /* ------------------------------------------------------------------ 主题层 */

    const TOKEN_SOURCE = 'dsh-transparent-fish'

    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
    const pct = (n) => `${clamp(Math.round(n), 0, 96)}%`
    const mix = (n) => `color-mix(in srgb, var(--dsw-alias-bg-layer-1) ${pct(n)}, transparent)`

    /** token 必须成对给 {light, dark}；两半同值即可，color-mix 会跟着色板解析 */
    function tokenPairs() {
      const f = effective.frost * 100
      const n = effective.navFrost * 100
      const both = (value) => ({ light: value, dark: value })
      return {
        '--dsw-alias-bg-base': both('transparent'),
        '--dsw-specific-sidebar-fill': both('transparent'),
        '--dsw-specific-input-major': both('transparent'),
        '--dsw-specific-bubble': both(mix(f + 6)),
        '--dsw-specific-menu': both(mix(Math.max(40, f + 40))),
        '--dsw-menu-surface-fill': both(mix(Math.max(40, f + 40))),
        '--dsw-alias-settings-card-fill': both(mix(f + 20)),
        '--dsw-alias-bg-module-platform': both(mix(f + 10)),
        '--dsw-specific-selector': both(mix(f + 20)),
        '--dsw-specific-tip': both(mix(Math.max(30, f + 25))),
        __nav: n,
      }
    }

    function syncThemeLayer() {
      if (!themeService) return
      if (!state.enabled || typeof themeService.overrideTokens !== 'function') {
        if (tokenDispose) {
          tokenDispose()
          tokenDispose = null
        }
        return
      }
      try {
        const pairs = tokenPairs()
        delete pairs.__nav
        const next = themeService.overrideTokens(TOKEN_SOURCE, pairs)
        if (tokenDispose) tokenDispose()
        tokenDispose = next
      } catch (error) {
        console.warn('[transparent-fish] token 层注入失败：', error)
      }
    }

    /* ------------------------------------------------------------------ 壁纸层 */

    function ensureWall() {
      if ($wall && $wall.isConnected) return $wall
      $wall = document.createElement('div')
      $wall.className = 'tf-wall'
      $wall.setAttribute('aria-hidden', 'true')
      document.body.prepend($wall)
      return $wall
    }

    /** 登记所有创建过的 <video>：DOM 里找不到的（已脱离文档的）也要停 */
    const knownVideos = new Set()

    function stopAllVideos() {
      for (const v of knownVideos) stopVideo(v)
      knownVideos.clear()
    }

    /** 从 DOM 移除 <video> 并不会停止播放，必须显式 pause + 清 src + load */
    function stopVideo(el) {
      if (!el) return
      try {
        el.pause()
        el.removeAttribute('src')
        el.load()
      } catch (_error) {
        /* ignore */
      }
      knownVideos.delete(el)
    }

    function teardownWall() {
      stopAllVideos()
      if ($wall && $wall.isConnected) $wall.remove()
      $wall = null
      $video = null
    }

    /** 按区域采样：壁纸左带（侧栏）与中带（正文）的明暗往往差很多 */
    let lumaSide = 0.6
    let lumaMain = 0.6
    let lumaHeader = 0.6

    function sampleWall(url) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const W = 160
          const H = 100
          const canvas = document.createElement('canvas')
          canvas.width = W
          canvas.height = H
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          /* 复刻 object-fit: cover 的裁切，采样的才是屏幕上真正显示的那块 */
          const scale = Math.max(W / img.width, H / img.height)
          const dw = img.width * scale
          const dh = img.height * scale
          ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
          const data = ctx.getImageData(0, 0, W, H).data

          const lumaAt = (x, y) => {
            const i = (y * W + x) * 4
            return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
          }

          let sumAll = 0
          let nAll = 0
          let sumSide = 0
          let nSide = 0
          let sumMain = 0
          let nMain = 0
          let sumHeader = 0
          let nHeader = 0
          let r = 0
          let g = 0
          let b = 0
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const l = lumaAt(x, y)
              const i = (y * W + x) * 4
              sumAll += l
              nAll++
              r += data[i]
              g += data[i + 1]
              b += data[i + 2]
              const fx = x / W
              const fy = y / H
              if (fy < 0.12 && fx > 0.25) {
                sumHeader += l
                nHeader++
              }
              if (fx < 0.2) {
                sumSide += l
                nSide++
              } else if (fx > 0.25) {
                sumMain += l
                nMain++
              }
            }
          }
          lumaSide = nSide ? sumSide / nSide : 0.6
          lumaMain = nMain ? sumMain / nMain : 0.6
          lumaHeader = nHeader ? sumHeader / nHeader : lumaMain
          applyThemeFollow(library.current && library.current.id)
          autoTint = `rgb(${Math.round(r / nAll)} ${Math.round(g / nAll)} ${Math.round(b / nAll)})`
          document.body.style.setProperty('--tf-wall-tint', autoTint)
              applyAdaptive()
        } catch (_error) {
          /* 取色失败就退回默认浓度 */
        }
      }
      img.src = url
    }

    /** 文本色由主题定、壁纸明暗由用户定，冲突时自动补浓度把对比度拉回来 */
    function needFor(luma, dark) {
      const gap = dark ? luma - 0.42 : 0.62 - luma
      return Math.min(0.72, Math.max(0, gap * 1.5))
    }

    /** 圆角：一条滑杆带动三处，比例维持现在的层级关系 */
    function applyRadius() {
      if (typeof state.radius === 'number') {
        const band = Math.max(0, Math.min(64, state.radius))
        document.body.style.setProperty('--tf-radius-band', `${band.toFixed(0)}px`)
        document.body.style.setProperty('--tf-radius-side', `${(band * 0.42).toFixed(0)}px`)
        document.body.style.setProperty('--tf-radius-card', `${(band * 0.67).toFixed(0)}px`)
      } else {
        document.body.style.removeProperty('--tf-radius-band')
        document.body.style.removeProperty('--tf-radius-side')
        document.body.style.removeProperty('--tf-radius-card')
      }
    }

    /** 材质浓度：没动过滑杆时不写内联值，让 CSS 里的主题默认值生效 */
    /**
     * 可读性下限：给定背后亮度，算出"要让文字保持可读，至少需要多不透明"。
     * 浅色主题要求合成后的表面够亮（托住深字），深色主题要求够暗（托住白字）。
     */
    function readableFloor(backdropLuma, dark) {
      const baseLuma = dark ? 0.09 : 0.86
      /* 目标亮度与字色翻转阈值(0.49)同源：亮 0.66 / 暗 0.32 */
      if (dark) {
        if (backdropLuma <= 0.32) return 0.30
        const need = (backdropLuma - 0.32) / Math.max(0.01, backdropLuma - baseLuma)
        return Math.min(0.95, Math.max(0.30, need))
      }
      if (backdropLuma >= 0.66) return 0.30
      const need = (0.66 - backdropLuma) / Math.max(0.01, baseLuma - backdropLuma)
      return Math.min(0.95, Math.max(0.30, need))
    }

    function applyAdaptive() {
      const dark = document.body.hasAttribute('data-ds-dark-theme')
      const fallback = dark ? 0.50 : 0.70
      const wanted = typeof state.frost === 'number'
        ? Math.min(0.95, Math.max(0.30, state.frost))
        : fallback

      /* 兜底：取正文区最坏的一处亮度算下限，滑杆压不到可读线以下 */
      const floor = state.guard ? readableFloor(lumaMain, dark) : 0.30
      const a = Math.max(wanted, floor)
      matClamped = a > wanted + 0.001
      matEffective = a

      if (typeof state.frost === 'number') {
        document.body.style.setProperty('--tf-mat-a', a.toFixed(2))
      } else {
        document.body.style.removeProperty('--tf-mat-a')
      }

      /* 明暗补偿：不透明度越低，材质底色越向壁纸平均色靠拢，
         这样"调虚实"不会顺带把整个界面调亮/调暗 */
      const t = Math.min(1, Math.max(0, (a - 0.30) / 0.65))
      const mix = 0.26 + 0.34 * t
      document.body.style.setProperty('--tf-mat-mix', `${(mix * 100).toFixed(1)}%`)

      /* 字色跟着"合成后的表面亮度"走，而不是只跟主题 ——
         浅色主题 + 暗壁纸 + 低不透明度时，表面其实偏暗，深字会糊 */
      const baseLuma = dark ? 0.09 : 0.86
      const surface = lumaMain * (1 - a) + baseLuma * a
      const useDarkInk = surface > 0.49
      document.body.style.setProperty('--tf-ink', useDarkInk ? '#10131a' : '#ffffff')
      document.body.style.setProperty(
        '--tf-ink-dim',
        useDarkInk ? 'rgb(16 19 26 / 0.68)' : 'rgb(255 255 255 / 0.72)',
      )
    }

    /* ------------------------------------------- 主题跟随壁纸 */

    /* 每张壁纸的判定只算一次并缓存：亮度在临界值附近抖动时不会来回切 */
    const themeVerdictOf = new Map()      /* id → 'light' | 'dark' */
    /* 用户手动改过主题时所在的壁纸：这张不再自动 */
    const themeUserOverrode = new Set()
    let themeWritten = ''
    let themeApplySeq = 0

    /** 判定：亮 > 0.45 → 浅色，暗 < 0.35 → 深色；中间沿用上次判定（滞回） */
    function computeVerdict(previous) {
      if (lumaMain > 0.45) return 'light'
      if (lumaMain < 0.35) return 'dark'
      if (previous === 'light' || previous === 'dark') return previous
      return lumaMain > 0.40 ? 'light' : 'dark'
    }

    function currentPreference() {
      try {
        const snap = themeService && themeService.getTheme && themeService.getTheme()
        return (snap && snap.preference) || ''
      } catch (_error) {
        return ''
      }
    }

    function applyThemeFollow(wallpaperId) {
      if (!state.themeFollow) return
      if (library.current && library.current.kind !== 'image') return
      const svc = themeService
      if (!svc || typeof svc.setTheme !== 'function') return

      const id = String(wallpaperId || '')
      if (!id) return
      if (themeUserOverrode.has(id)) {
        return
      }

      /* 有缓存就用缓存，没有才按当前亮度算一次 */
      let wanted = themeVerdictOf.get(id)
      if (!wanted) {
        wanted = computeVerdict(currentPreference())
        themeVerdictOf.set(id, wanted)
      }

      const cur = currentPreference()
      const alreadyRight = cur === wanted
      if (alreadyRight) {
        themeWritten = wanted
        return
      }

      themeApplySeq += 1
      const seq = themeApplySeq
      themeWritten = wanted
      try {
        svc.setTheme(wanted)
      } catch (_error) {
        /* 服务拒绝：清掉缓存留一次重试机会 */
        themeVerdictOf.delete(id)
        themeWritten = ''
        return
      }
      /* 自己的写入不该被当成"用户改过" */
      setTimeout(() => {
        if (seq === themeApplySeq) themeWritten = wanted
      }, 1200)
    }

    /** 用户手动改主题 → 这张壁纸让位，不再自动 */
    function noticeThemeChange() {
      if (!state.themeFollow) return
      const id = library.current && library.current.id
      if (!id || !themeVerdictOf.has(id)) return
      const cur = currentPreference()
      if (!cur) return
      if (cur !== themeWritten) themeUserOverrode.add(id)
    }

    /** 阅读带：贴在正文列上的一条固定材质 */
    function ensureBand() {
      if ($band && $band.isConnected) return $band
      for (const old of document.querySelectorAll('.tf-band')) old.remove()
      $band = document.createElement('div')
      $band.className = 'tf-band'
      $band.setAttribute('aria-hidden', 'true')
      document.body.appendChild($band)
      return $band
    }

    let watchedCard = null
    let cardWatch = null
    let watchedHeader = null
    let headerWatch = null

    /** 顶栏高度会变（首页 40px / 会话页 76px 含标签行），侧栏面板要让出同样的高度 */
    function syncHeaderHeight() {
      const h = document.querySelector('[class*="kiGsTW_header"]')
      if (!h) return
      const height = Math.round(h.getBoundingClientRect().height)
      if (height > 0) document.body.style.setProperty('--tf-header-h', `${height}px`)
    }

    function watchHeader() {
      const h = document.querySelector('[class*="kiGsTW_header"]')
      if (!h) return
      syncHeaderHeight()
      if (!headerWatch || h === watchedHeader) return
      if (watchedHeader) headerWatch.unobserve(watchedHeader)
      watchedHeader = h
      headerWatch.observe(h)
    }

    /** 输入框宽度变化 = 正文列宽度变化（开关右侧栏不会改变窗口尺寸） */
    function watchCard() {
      const card = document.querySelector('[data-composer-card]')
      if (!card || !cardWatch || card === watchedCard) return
      if (watchedCard) cardWatch.unobserve(watchedCard)
      watchedCard = card
      cardWatch.observe(card)
    }

    function layoutBand() {
      watchCard()
      watchHeader()
      if (!state.enabled) {
        if ($band && $band.isConnected) $band.style.display = 'none'
        return
      }
      const band = ensureBand()
      const card = document.querySelector('[data-composer-card]')
      const main = document.querySelector('[class*="kiGsTW_root"]')
      if (!card || !main) {
        band.style.display = 'none'
        return
      }
      const cr = card.getBoundingClientRect()
      const mr = main.getBoundingClientRect()
      const pad = 30
      band.style.display = 'block'
      band.style.left = `${Math.round(cr.left - pad)}px`
      band.style.width = `${Math.round(cr.width + pad * 2)}px`
      /* 顶栏（标题那一行）下沿就是阅读带的顶边，紧贴着，不留缝。
         顶边不圆角，所以不会切到下面的标签行。 */
      const header = document.querySelector('[class*="kiGsTW_header"]')
      const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : Math.round(mr.top) + 54
      const top = Math.max(Math.round(mr.top), headerBottom)
      band.style.top = `${Math.max(0, top)}px`
      band.style.height = `${Math.max(0, window.innerHeight - top - 14)}px`
    }

    function renderWall() {
      if (!state.enabled || !library.current) {
        if ($band && $band.isConnected) $band.remove()
        $band = null
        teardownWall()
        return
      }
      const item = library.current
      const wall = ensureWall()
      /* 换壁纸时旧的视频还在播（切到图片最明显：只剩声音），全停 */
      stopAllVideos()
      wall.textContent = ''
      const scrim = document.createElement('div')
      scrim.className = 'tf-scrim'
      wall.appendChild(scrim)
      $video = null

      if (item.kind === 'video') {
        const video = document.createElement('video')
        knownVideos.add(video)
        video.src = item.url
        video.loop = true
        video.playsInline = true
        video.autoplay = true
        video.muted = true
        video.volume = clamp(state.volume, 0, 1)
        video.setAttribute('aria-hidden', 'true')
        wall.appendChild(video)
        $video = video
        /* 浏览器不允许带声音的自动播放：先静音起播，首次交互再恢复音量 */
        const tryUnmute = () => {
          try {
            video.muted = false
            video.volume = clamp(state.volume, 0, 1)
            video.play().catch(() => {})
          } catch (_error) {
            /* ignore */
          }
        }
        video.play().catch(() => {})
        window.addEventListener('pointerdown', tryUnmute, { once: true })
        lumaSide = 0.5
        lumaMain = 0.5
        applyAdaptive()
      } else {
        const img = document.createElement('img')
        img.src = item.url
        img.alt = ''
        img.draggable = false
        wall.appendChild(img)
        sampleWall(item.url)
      }
      installVideoPolicy()
      layoutBand()
    }

    /** 视频壁纸的三条暂停策略（照搬 Wallpaper Engine 的思路） */
    function installVideoPolicy() {
      if (stopVideoPolicy) {
        stopVideoPolicy()
        stopVideoPolicy = null
      }
      const video = $video
      if (!video) return

      const resume = () => {
        if (!video.paused) return
        video.play().catch(() => {})
      }
      const pause = () => {
        try {
          video.pause()
        } catch (_error) {
          /* ignore */
        }
      }

      const onVisibility = () => {
        if (!state.pauseOnHidden) return
        if (document.hidden) pause()
        else resume()
      }
      const onBlur = () => {
        if (state.pauseOnBlur) pause()
      }
      const onFocus = () => {
        if (state.pauseOnBlur) resume()
      }

      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('blur', onBlur)
      window.addEventListener('focus', onFocus)

      let battery = null
      const onBatteryChange = () => {
        if (!state.pauseOnBattery || !battery) return
        if (battery.charging) resume()
        else pause()
      }
      if (navigator.getBattery) {
        navigator.getBattery().then((b) => {
          battery = b
          b.addEventListener('chargingchange', onBatteryChange)
          onBatteryChange()
        }).catch(() => {})
      }

      stopVideoPolicy = () => {
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('blur', onBlur)
        window.removeEventListener('focus', onFocus)
        if (battery) battery.removeEventListener('chargingchange', onBatteryChange)
      }
    }

    /* -------------------------------------------------------- 行的滑动玻璃块

       悬停高亮用"一块"元素承担，在行之间滑动 —— 每行各自变色做不出滑动感。
       用事件委托，不挂 MutationObserver：插件页每次挂载/卸载都不用重新绑定。 */

    function installRowGlide() {
      let glide = null
      let group = null

      const ensure = (target) => {
        if (glide === null) {
          glide = document.createElement('span')
          glide.className = 'tf-row-glide'
          glide.setAttribute('aria-hidden', 'true')
        }
        if (glide.parentElement !== target) target.appendChild(glide)
        return glide
      }

      const show = (row) => {
        /* 「已安装」的组是 section，「发现」的组是 div，按类名找更稳 */
        const owner = row.closest('section, [class*="nLFHAG_section"], [class*="w6M7KW_group"]')
        if (owner === null) return
        const g = ensure(owner)
        const gr = owner.getBoundingClientRect()
        const rr = row.getBoundingClientRect()
        if (rr.height === 0) return
        g.style.width = `${rr.width}px`
        g.style.height = `${rr.height}px`
        g.style.transform = `translate3d(${rr.left - gr.left}px, ${rr.top - gr.top}px, 0)`
        g.style.opacity = '1'
        group = owner
      }

      const hide = () => {
        if (glide !== null) glide.style.opacity = '0'
      }

      const onOver = (event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const row = target.closest('li[class*="w6M7KW_card"], li[class*="nLFHAG_card"]')
        if (row !== null) show(row)
      }

      const onOut = (event) => {
        const related = event.relatedTarget
        if (group !== null && related instanceof Node && group.contains(related)) return
        hide()
      }

      /* 滚动时位置会失效，直接收起来，等下一次指针移动再贴回去 */
      const onScroll = () => hide()

      document.addEventListener('pointerover', onOver, { passive: true })
      document.addEventListener('pointerout', onOut, { passive: true })
      document.addEventListener('scroll', onScroll, { passive: true, capture: true })

      return () => {
        document.removeEventListener('pointerover', onOver)
        document.removeEventListener('pointerout', onOut)
        document.removeEventListener('scroll', onScroll, { capture: true })
        if (glide !== null && glide.isConnected) glide.remove()
        glide = null
        group = null
      }
    }

    /* ------------------------------------------------------------------ 指针扫光 */

    function installPointer() {
      let frame = 0
      let x = 0.1
      let y = 0
      const flush = () => {
        frame = 0
        document.documentElement.style.setProperty('--tf-px', `${(x * 40).toFixed(2)}%`)
        document.documentElement.style.setProperty('--tf-py', `${(y * 34).toFixed(2)}%`)
      }
      const onMove = (event) => {
        x = clamp(event.clientX / window.innerWidth, 0, 1)
        y = clamp(event.clientY / window.innerHeight, 0, 1)
        if (frame) return
        frame = requestAnimationFrame(flush)
      }
      window.addEventListener('pointermove', onMove, { passive: true })
      return () => {
        window.removeEventListener('pointermove', onMove)
        if (frame) cancelAnimationFrame(frame)
        document.documentElement.style.removeProperty('--tf-px')
        document.documentElement.style.removeProperty('--tf-py')
      }
    }

    /* ------------------------------------------------------------------ 主同步 */

    function paint() {
      const root = document.documentElement
      if (state.enabled) root.setAttribute('data-tf', 'on')
      else root.removeAttribute('data-tf')
      const body = document.body
      body.style.setProperty('--tf-blur', `${state.blur}px`)
      body.style.setProperty('--tf-nav-blur', `${Math.max(0, state.blur - 1)}px`)
      body.style.setProperty('--tf-guard', String(state.guard))
      body.style.setProperty('--tf-sheen', String(state.sheen))
      applyAdaptive()
      applyRadius()
      layoutBand()
    }

    function syncAll() {
      paint()
      syncThemeLayer()
      renderWall()
    }

    /* ------------------------------------------------------------------ 远端状态 */

    async function fetchState() {
      try {
        const res = await fetch(`${PREFIX}/state`, { credentials: 'same-origin' })
        if (!res.ok) return
        const data = await res.json()
        library.current = data.current || null
        library.items = Array.isArray(data.items) ? data.items : []
        syncAll()
        notify()
      } catch (_error) {
        /* 宿主没起来就先用空库 */
      }
    }

    async function importFile(file) {
      const res = await fetch(`${PREFIX}/import?name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/octet-stream' },
        body: file,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'import-failed')
      library.current = data.state.current || null
      library.items = data.state.items || []
      try {
        syncAll()
      } catch (error) {
        /* 文件已经导入成功，刷新出错不能反过来说"导入失败" */
        console.error('[transparent-fish] 导入后刷新界面失败：', error)
      }
      notify()
      return data.item
    }

    async function selectWallpaper(id) {
      const res = await fetch(`${PREFIX}/select?id=${encodeURIComponent(id)}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) return
      library.current = data.state.current || null
      library.items = data.state.items || []
      syncAll()
      notify()
    }

    async function removeWallpaper(id) {
      /* 先在本地摘掉，UI 立刻响应；失败再放回去 */
      const backup = { items: library.items, current: library.current }
      library.items = library.items.filter((i) => i.id !== id)
      if (library.current && library.current.id === id) {
        library.current = library.items[0] || null
      }
      notify()

      let data = null
      try {
        const res = await fetch(`${PREFIX}/remove?id=${encodeURIComponent(id)}`, {
          method: 'POST',
          credentials: 'same-origin',
        })
        data = await res.json().catch(() => null)
        if (!res.ok || !data || !data.ok) throw new Error('remove failed')
      } catch (_error) {
        library.items = backup.items
        library.current = backup.current
        notify()
        return
      }

      library.current = data.state.current || null
      library.items = data.state.items || []
      syncAll()
      notify()
    }

    /* ------------------------------------------------------------------ 设置页 UI */

    const C = {
      linkBtn: {
        border: 'none',
        background: 'transparent',
        padding: 0,
        font: 'inherit',
        fontSize: '11.5px',
        color: 'var(--dsw-alias-label-accent, #4d6bfe)',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
      },
      page: { display: 'flex', flexDirection: 'column', gap: '26px', paddingBottom: '40px' },
      block: { display: 'flex', flexDirection: 'column', gap: '12px' },
      /* 分组标题与说明文字跟着「表面墨色」走，压在玻璃上才读得清 */
      blockTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--tf-ink, #0f1115)' },
      card: {
        borderRadius: '14px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1))',
        background: 'var(--dsw-alias-settings-card-fill, rgba(255,255,255,.6))',
        overflow: 'hidden',
      },
      preview: {
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 7',
        background: 'var(--dsw-alias-bg-layer-2, #f0f2f5)',
        overflow: 'hidden',
      },
      media: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
      empty: {
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        fontSize: '12.5px',
        color: 'var(--dsw-alias-label-tertiary, #81858c)',
      },
      bar: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 14px',
        borderTop: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08))',
      },
      name: { fontSize: '12.5px', color: 'var(--dsw-alias-label-primary, #0f1115)', marginRight: 'auto' },
      btn: {
        appearance: 'none',
        border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary, #0f1115)',
        borderRadius: '8px',
        padding: '5px 12px',
        fontSize: '12px',
        cursor: 'pointer',
      },
      btnPrimary: {
        appearance: 'none',
        border: 'none',
        background: 'var(--dsw-alias-state-business-primary, #4176e6)',
        color: '#fff',
        borderRadius: '8px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
      },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: '10px' },
      thumb: {
        position: 'relative',
        aspectRatio: '16 / 9',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))',
        background: 'var(--dsw-alias-bg-layer-2, #eef1f5)',
        cursor: 'pointer',
        padding: 0,
      },
      thumbOn: {
        outline: '2px solid var(--dsw-alias-state-business-primary, #4176e6)',
        outlineOffset: '1px',
      },
      cellBtn: {
        display: 'block',
        width: '100%',
        height: '100%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
      },
      addTile: {
        aspectRatio: '16 / 9',
        borderRadius: '10px',
        border: '1px dashed var(--dsw-alias-border-l2, rgba(0,0,0,.18))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary, #61666b)',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        cursor: 'pointer',
      },
      addPlus: { fontSize: '18px', lineHeight: 1 },
      row: { display: 'flex', alignItems: 'center', gap: '12px', minHeight: '30px' },
      label: {
        fontSize: '12.5px',
        color: 'var(--dsw-alias-label-primary, #0f1115)',
        minWidth: '84px',
      },
      hint: { fontSize: '12px', color: 'color-mix(in srgb, var(--tf-ink, #0f1115) 78%, transparent)', lineHeight: '18px' },
      chips: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
      chip: {
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary, #0f1115)',
        borderRadius: '999px',
        padding: '4px 12px 4px 6px',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'background 160ms ease, box-shadow 160ms ease',
      },
      chipOn: {
        background: 'var(--dsw-alias-bg-module-platform, rgba(0,0,0,.06))',
        borderColor: 'var(--dsw-alias-border-l3, rgba(0,0,0,.28))',
        boxShadow: 'inset 0 0 0 1px var(--dsw-alias-border-l3, rgba(0,0,0,.18))',
        fontWeight: 600,
      },
      swatch: {
        width: '16px',
        height: '16px',
        borderRadius: '6px',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.65), 0 1px 2px rgba(0,0,0,.18)',
        flex: '0 0 auto',
      },
      range: { flex: '1 1 auto', maxWidth: '260px', accentColor: 'var(--dsw-alias-state-business-primary, #4176e6)' },
      value: {
        fontSize: '12px',
        color: 'var(--dsw-alias-label-secondary, #61666b)',
        minWidth: '46px',
        fontVariantNumeric: 'tabular-nums',
      },
      toggle: {
        appearance: 'none',
        width: '38px',
        height: '22px',
        borderRadius: '999px',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        background: 'var(--dsw-alias-border-l3, rgba(0,0,0,.2))',
        padding: 0,
      },
      toggleOn: { background: 'var(--dsw-alias-state-business-primary, #4176e6)' },
      knob: {
        position: 'absolute',
        top: '3px',
        left: '3px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        transition: 'transform 180ms cubic-bezier(.22,1,.36,1)',
      },
      knobOn: { transform: 'translateX(16px)' },
    }

    /** 视频缩略图：叠一个播放键和时长，和图片一眼区分 */
    function VideoThumb({ src, name }) {
      const [duration, setDuration] = react.useState('')
      return h(
        'div',
        { style: { position: 'relative', width: '100%', height: '100%' } },
        h('video', {
          src,
          style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          muted: true,
          preload: 'metadata',
          playsInline: true,
          onLoadedMetadata: (e) => {
            const d = e.target.duration
            if (Number.isFinite(d) && d > 0) {
              const m = Math.floor(d / 60)
              const sec = Math.floor(d % 60).toString().padStart(2, '0')
              setDuration(`${m}:${sec}`)
            }
          },
        }),
        h('span', { className: 'tf-play', 'aria-hidden': 'true' }, '▶'),
        duration ? h('span', { className: 'tf-dur' }, duration) : null,
        h('span', { className: 'tf-kind' }, '视频'),
      )
    }

    function Slider({ label, value, min, max, step, display, onChange }) {
      return h(
        'div',
        { style: C.row },
        h('span', { style: C.label }, label),
        h('input', {
          type: 'range',
          style: C.range,
          min,
          max,
          step,
          value,
          onChange: (e) => onChange(Number(e.target.value)),
        }),
        h('span', { style: C.value }, display),
      )
    }

    function Toggle({ label, checked, onChange }) {
      return h(
        'div',
        { style: { ...C.row, cursor: 'pointer' }, onClick: () => onChange(!checked) },
        h(
          'button',
          {
            type: 'button',
            role: 'switch',
            'aria-checked': checked,
            'aria-label': label,
            style: checked ? { ...C.toggle, ...C.toggleOn } : C.toggle,
            onClick: (e) => {
              e.stopPropagation()
              onChange(!checked)
            },
          },
          h('span', { style: checked ? { ...C.knob, ...C.knobOn } : C.knob }),
        ),
        h('span', { style: C.label }, label),
      )
    }

    function SettingsPage() {
      const [, force] = react.useState(0)
      const [busy, setBusy] = react.useState(false)
      const [error, setError] = react.useState('')
      const inputRef = react.useRef(null)

      react.useEffect(() => {
        const fn = () => force((n) => n + 1)
        listeners.add(fn)
        return () => listeners.delete(fn)
      }, [])

      const pick = async (event) => {
        const file = event.target.files && event.target.files[0]
        event.target.value = ''
        if (!file) return
        setBusy(true)
        setError('')
        try {
          await importFile(file)
        } catch (err) {
          setError(`导入失败：${String((err && err.message) || err)}`)
        } finally {
          setBusy(false)
        }
      }

      const current = library.current

      return h(
        'div',
        { style: C.page },
        h(
          'div',
          null,
          h('div', { style: { fontSize: '15px', fontWeight: 700, marginBottom: '4px' } }, '透明肥鱼'),
          h('div', { style: C.hint }, '给自己的 DSH 换一层随壁纸流动的玻璃。壁纸只存在本机，不会离开这台电脑。'),
        ),

        /* 壁纸 */
        h(
          'div',
          { style: C.block },
          h('div', { style: C.blockTitle }, '壁纸'),
          h(
            'div',
            { style: C.card },
            h(
              'div',
              { style: C.preview },
              current
                ? current.kind === 'video'
                  ? h('video', { src: current.url, style: C.media, muted: true, loop: true, autoPlay: true, playsInline: true })
                  : h('img', { src: current.url, style: C.media, alt: current.name })
                : h('div', { style: C.empty }, '还没有壁纸，点下面「添加壁纸」'),
            ),
            h(
              'div',
              { style: C.bar },
              h('span', { style: C.name }, current ? `${current.name}` : '未设置'),
              h(
                'button',
                { type: 'button', style: C.btnPrimary, disabled: busy, onClick: () => inputRef.current && inputRef.current.click() },
                busy ? '导入中…' : '添加壁纸',
              ),
              current
                ? h(
                    'button',
                    {
                      type: 'button',
                      style: C.btn,
                      onClick: () => removeWallpaper(current.id),
                    },
                    '删除',
                  )
                : null,
            ),
          ),
          error ? h('div', { style: { ...C.hint, color: '#c2453a' } }, error) : null,
          h('input', {
            ref: inputRef,
            type: 'file',
            accept: 'image/*,video/*',
            style: { display: 'none' },
            onChange: pick,
          }),
          h(
            'div',
            { style: C.grid },
            library.items.map((item) => {
              const isCurrent = Boolean(current && current.id === item.id)
              return h(
                'div',
                { key: item.id, className: 'tf-cell', style: isCurrent ? { ...C.thumb, ...C.thumbOn } : C.thumb },
                h(
                  'button',
                  {
                    type: 'button',
                    title: `${item.name}${isCurrent ? '（当前）' : ''}`,
                    style: C.cellBtn,
                    onClick: () => selectWallpaper(item.id),
                  },
                  item.kind === 'video'
                    ? h(VideoThumb, { src: `${item.url}#t=0.1`, name: item.name })
                    : h('img', { src: item.url, style: C.media, alt: item.name, loading: 'lazy' }),
                ),
                isCurrent ? h('span', { className: 'tf-badge' }, '当前') : null,
                h(
                  'button',
                  {
                    type: 'button',
                    title: '删除这张壁纸',
                    className: 'tf-del',
                    onClick: (event) => {
                      event.stopPropagation()
                      if (!window.confirm(`删除「${item.name}」？这个操作不可撤销。`)) return
                      removeWallpaper(item.id)
                    },
                  },
                  '×',
                ),
              )
            }),
            h(
              'button',
              { type: 'button', style: C.addTile, onClick: () => inputRef.current && inputRef.current.click() },
              h('span', { style: C.addPlus }, '＋'),
              h('span', null, '添加'),
            ),
          ),
        ),

        /* 材质 */
        h(
          'div',
          { style: C.block },
          h('div', { style: C.blockTitle }, '透明度与圆角'),
          h(Slider, {
            label: '不透明度',
            value: Math.round((typeof state.frost === 'number' ? state.frost : 0.52) * 100),
            min: 30,
            max: 95,
            step: 1,
            display: `${Math.round((typeof state.frost === 'number' ? state.frost : 0.52) * 100)}%`,
            onChange: (v) => {
              state.frost = v / 100
              applyAdaptive()
              notify()
              saveSoon()
            },
          }),
          h(
            'div',
            { style: { ...C.hint, display: 'flex', alignItems: 'center', gap: 8 } },
            h(
              'span',
              null,
              matClamped
                ? `玻璃有多不透明。当前已被可读性兜底抬到 ${Math.round(matEffective * 100)}%。`
                : '玻璃有多不透明。往右越实、文字越稳，往左越透、壁纸越清楚。默认浅色 70%、深色 50%。',
            ),
            typeof state.frost === 'number'
              ? h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => update({ frost: null }),
                    style: C.linkBtn,
                  },
                  '恢复默认',
                )
              : null,
          ),

          h(Toggle, {
            label: '主题跟随壁纸',
            checked: Boolean(state.themeFollow),
            onChange: (v) => {
              update({ themeFollow: v })
              if (v) {
                themeVerdictOf.clear()
                themeUserOverrode.clear()
                themeWritten = ''
                applyThemeFollow(library.current && library.current.id)
              }
            },
          }),
          h(
            'div',
            { style: C.hint },
            '换壁纸后自动切到与画面相配的浅色/深色（暗部主导用深色，亮部主导用浅色）。你手动改过主题后，这张壁纸就不再自动，换下一张恢复。',
          ),

          h(Toggle, {
            label: '可读性兜底',
            checked: Boolean(state.guard),
            onChange: (v) => update({ guard: v ? 1 : 0 }),
          }),
          h(
            'div',
            { style: C.hint },
            '开启后，不透明度低于"文字可读下限"时会被自动抬上去——滑杆可以拉到底，但渲染不会低于可读线。',
          ),

          h(Slider, {
            label: '圆角',
            value: Math.round((typeof state.radius === 'number' ? state.radius : 48)),
            min: 0,
            max: 64,
            step: 2,
            display: `${Math.round(typeof state.radius === 'number' ? state.radius : 48)}px`,
            onChange: (v) => {
              state.radius = v
              applyRadius()
              notify()
              saveSoon()
            },
          }),
          h(
            'div',
            { style: { ...C.hint, display: 'flex', alignItems: 'center', gap: 8 } },
            h('span', null, '阅读带的圆角，侧栏和输入框按比例跟随。默认 48px。'),
            typeof state.radius === 'number'
              ? h(
                  'button',
                  { type: 'button', onClick: () => update({ radius: null }), style: C.linkBtn },
                  '恢复默认',
                )
              : null,
          ),
        ),

        /* 视频与性能 */
        h(
          'div',
          { style: C.block },
          h('div', { style: C.blockTitle }, '视频壁纸'),
          current && current.kind === 'video'
            ? h(Slider, {
                label: '音量',
                value: Math.round(state.volume * 100),
                min: 0,
                max: 100,
                step: 5,
                display: `${Math.round(state.volume * 100)}%`,
                onChange: (v) => {
                  state.volume = v / 100
                  if ($video) $video.volume = v / 100
                  update({ volume: v / 100 })
                },
              })
            : h('div', { style: C.hint }, '选中视频壁纸后，这里会出现音量控制。'),
          h(Toggle, {
            label: '切到其他标签页时暂停',
            checked: state.pauseOnHidden,
            onChange: (v) => update({ pauseOnHidden: v }),
          }),
          h(Toggle, {
            label: '窗口失焦时暂停',
            checked: state.pauseOnBlur,
            onChange: (v) => update({ pauseOnBlur: v }),
          }),
          h(Toggle, {
            label: '电池供电时暂停',
            checked: state.pauseOnBattery,
            onChange: (v) => update({ pauseOnBattery: v }),
          }),
        ),

        /* 总开关 */
        h(Toggle, {
          label: '启用透明肥鱼',
          checked: state.enabled,
          onChange: (v) => update({ enabled: v }),
        }),
      )
    }

    /* ------------------------------------------------------------------ 生命周期 */

    function ensureStyle() {
      if ($style && $style.isConnected) return
      $style = document.createElement('style')
      $style.dataset.plugin = 'dsh-transparent-fish'
      $style.dataset.pluginCss = 'dsh-transparent-fish/glass.css'
      $style.textContent = CSS
      document.head.appendChild($style)
    }

    function ensureDefs() {
      if ($defs && $defs.isConnected) return
      const host = document.createElement('div')
      host.dataset.plugin = 'dsh-transparent-fish'
      host.setAttribute('aria-hidden', 'true')
      host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
      host.innerHTML = FILTER_SVG
      document.body.prepend(host)
      $defs = host
    }

    const name = 'dsh-transparent-fish'

    function apply(ctx) {
      try {
        applyInner(ctx)
      } catch (error) {
        console.error('[transparent-fish] 初始化失败，已降级为不启用：', error)
        try {
          document.documentElement.removeAttribute('data-tf')
        } catch (_e) {}
      }
    }

    function applyInner(ctx) {
      load()
      ensureStyle()
      ensureDefs()
      installLensFilter()
      syncAll()
      stopPointer = installPointer()
      stopGlide = installRowGlide()
      const relayout = () => layoutBand()
      window.addEventListener('resize', relayout)
      const bandWatch = new ResizeObserver(relayout)
      if (document.body) bandWatch.observe(document.body)
      cardWatch = new ResizeObserver(relayout)
      watchCard()
      headerWatch = new ResizeObserver(relayout)
      watchHeader()
      /* 右侧栏开合是改 body 属性，不会触发尺寸回调 */
      const barWatch = new MutationObserver(relayout)
      barWatch.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-sidebar-right-open'],
      })
      ctx.effect(() => () => {
        window.removeEventListener('resize', relayout)
        bandWatch.disconnect()
        barWatch.disconnect()
        if (cardWatch) { cardWatch.disconnect(); cardWatch = null }
        if (headerWatch) { headerWatch.disconnect(); headerWatch = null }
      })
      const themeWatch = new MutationObserver(() => {
        applyAdaptive()
        noticeThemeChange()
      })
      themeWatch.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
      ctx.effect(() => () => themeWatch.disconnect())
      fetchState()

      try {
        ctx.inject(['theme'], (scope) => {
          themeService = scope.theme ?? scope.get('theme')
          syncThemeLayer()
          applyThemeFollow(library.current && library.current.id)
        })
      } catch (error) {
        console.warn('[transparent-fish] 无法注入 theme 服务：', error)
      }

      try {
        ctx.inject(['slots'], (scope) => {
          scope.slots.inject('settings.section', () =>
            scope.slots.register(
              {
                name: 'settings.section',
                id: 'transparent-fish',
                order: 15,
                label: () => '透明肥鱼',
              },
              SettingsPage,
            ),
          )
        })
      } catch (error) {
        console.warn('[transparent-fish] 设置分区注册失败：', error)
      }

      ctx.effect(() => () => {
        if (stopPointer) stopPointer()
        if (stopGlide) stopGlide()
        if (stopVideoPolicy) stopVideoPolicy()
        if (tokenDispose) tokenDispose()
        tokenDispose = null
        themeService = null
        if ($band && $band.isConnected) $band.remove()
        $band = null
        teardownWall()
        listeners.clear()
        const root = document.documentElement
        root.removeAttribute('data-tf')
        for (const v of ['--tf-frost', '--tf-nav-frost', '--tf-blur', '--tf-nav-blur', '--tf-guard', '--tf-sheen']) {
          document.body.style.removeProperty(v)
        }
        if ($style && $style.isConnected) $style.remove()
        if ($defs && $defs.isConnected) $defs.remove()
        $style = null
        $defs = null
      })
    }

    return { name, apply }
  },
})
