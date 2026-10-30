/* MapMyVisitors 按需加载：首次访问不连接地图服务，供应商的 DOM 和样式留在框架内。 */
(() => {
  'use strict'

  const ownScript = document.currentScript
  const messageType = 'blog:visitor-map'

  // 框架复用本地脚本作为状态桥；不能把 iframe 的 load 事件当成地图渲染成功。
  if (ownScript.hasAttribute('data-visitor-map-frame')) {
    let finished = false
    const notify = (state, height = 300) => {
      if (finished) return
      finished = true
      clearInterval(poll)
      parent.postMessage({ type: messageType, state, height }, ownScript.dataset.parentOrigin)
    }
    const poll = setInterval(() => {
      // 供应商通过 CSS 背景绘制地球；新站可以没有访客圆点，不能要求 SVG 内已有图形。
      const globe = document.querySelector('.mmvst_globe')
      const surface = document.querySelector('.mmvst_map_f')
      if (!globe || !surface) return
      const rect = globe.getBoundingClientRect()
      const style = getComputedStyle(globe)
      if (rect.width < 80 || rect.height < 80 || style.visibility === 'hidden' || Number(style.opacity) === 0) return
      if (getComputedStyle(surface).backgroundImage === 'none') return

      // 无效的旧编号也会画出空地球，但链接只指向供应商首页，不能把它当成本站统计。
      const link = document.querySelector('#mmvst_a')
      let registered = false
      try {
        const url = new URL(link?.getAttribute('href') || '', 'https://mapmyvisitors.com')
        registered = url.protocol === 'https:' && url.hostname === 'mapmyvisitors.com' && /^\/web\/[a-z0-9]+\/?$/i.test(url.pathname)
      } catch (_) { /* 缺失或格式错误的统计链接视为未配置成功。 */ }
      if (!registered) return notify('unregistered')
      // 完整统计页在新标签打开，避免被限制在侧栏的小框架中。
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      notify('ready', Math.max(220, Math.min(480, document.body.scrollHeight)))
    }, 250)
    window.addEventListener('error', event => {
      if (event.target instanceof HTMLScriptElement) notify('error')
    }, true)
    return
  }

  const helperURL = ownScript.src
  const states = new WeakMap()

  const fail = (root, state, reason = 'network') => {
    clearTimeout(state.timer)
    state.frame?.remove()
    state.frame = null
    root.dataset.state = 'error'
    state.viewport.setAttribute('aria-busy', 'false')
    state.button.disabled = false
    state.label.textContent = '重新加载地图'
    state.status.textContent = reason === 'unregistered'
      ? '地图编号尚未关联有效统计，请联系站长更新配置。'
      : '地图暂时无法连接，可稍后重试。正文浏览不受影响。'
  }

  const init = () => {
    document.querySelectorAll('[data-visitor-map]').forEach(root => {
      if (states.has(root)) return
      const state = {
        button: root.querySelector('[data-visitor-map-load]'),
        label: root.querySelector('[data-visitor-map-load] span'),
        status: root.querySelector('.visitor-map__status'),
        viewport: root.querySelector('.visitor-map__viewport'),
        frame: null,
        timer: null
      }
      states.set(root, state)
      // 专属编号未填好时不尝试连接供应商，也不复用已失效的 ClustrMaps 编号。
      if (!root.dataset.visitorMap.trim()) {
        state.button.disabled = true
        state.label.textContent = '地图配置中'
        state.status.textContent = '专属地图编号尚未配置。'
        return
      }
      state.button.addEventListener('click', () => {
        // 禁止重复点击并发请求；重试时移除旧框架，旧消息也不能覆盖新状态。
        if (root.dataset.state === 'loading') return
        clearTimeout(state.timer)
        state.frame?.remove()
        root.dataset.state = 'loading'
        state.button.disabled = true
        state.label.textContent = '正在加载…'
        state.status.textContent = '正在连接 MapMyVisitors…'
        state.viewport.setAttribute('aria-busy', 'true')

        const frameURL = new URL('visitor-map-frame.html', helperURL)
        const helperParams = new URL(helperURL).searchParams
        for (const name of ['v', 'rev']) {
          if (helperParams.has(name)) frameURL.searchParams.set(name, helperParams.get(name))
        }
        frameURL.searchParams.set('d', root.dataset.visitorMap)
        const frame = document.createElement('iframe')
        frame.title = 'MapMyVisitors 访客分布地图'
        frame.referrerPolicy = 'strict-origin-when-cross-origin'
        // 真实页面 URL 让旧版 jQuery 正确解析 // 数据接口；about:srcdoc 的协议不兼容。
        frame.src = frameURL.href
        state.frame = frame
        state.viewport.replaceChildren(frame)
        // 供应商只有在整颗地球位于框架视口内才播放；先按侧栏宽度预留高度，避免窄屏卡住。
        frame.style.height = `${Math.max(220, Math.min(480, Math.ceil(state.viewport.clientWidth * 1.15) + 12))}px`
        // 网络阻断或依赖未渲染时均结束等待；失败不会自动重试或持续请求第三方。
        state.timer = setTimeout(() => fail(root, state), 20000)
      })
    })
  }

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.data?.type !== messageType) return
    document.querySelectorAll('[data-visitor-map]').forEach(root => {
      const state = states.get(root)
      if (!state?.frame || event.source !== state.frame.contentWindow || root.dataset.state !== 'loading') return
      if (event.data.state === 'error' || event.data.state === 'unregistered') return fail(root, state, event.data.state)
      if (event.data.state !== 'ready') return
      clearTimeout(state.timer)
      root.dataset.state = 'ready'
      state.viewport.setAttribute('aria-busy', 'false')
      state.button.disabled = false
      state.label.textContent = '重新加载地图'
      state.status.textContent = '访客地图已加载。'
      const height = Number(event.data.height)
      if (Number.isFinite(height)) state.frame.style.height = `${Math.max(220, Math.min(480, height))}px`
    })
  })

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
  document.addEventListener('pjax:complete', init)
})()
