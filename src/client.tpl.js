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

    const CSS = `/*__CSS__*/`
    const FILTER_SVG = `/*__SVG__*/`

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
