/* ClustrMaps 按需加载：首次访问不连接地图服务，第三方文档写入只发生在框架内。 */
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
      // 排除追踪像素和仅创建了空容器的情况，等待可见的地图图形。
      const graphic = [...document.querySelectorAll('canvas, svg, img')].find(element => {
        const rect = element.getBoundingClientRect()
        if (rect.width < 80 || rect.height < 80) return false
        if (element.tagName === 'IMG') return element.complete && element.naturalWidth >= 80
        if (element.tagName.toLowerCase() === 'svg') return !!element.querySelector('path, circle, polygon, image')
        return element.width >= 80 && element.height >= 80
      })
      if (graphic) notify('ready', Math.max(220, Math.min(480, document.body.scrollHeight)))
    }, 250)
    window.addEventListener('error', event => {
      if (event.target instanceof HTMLScriptElement) notify('error')
    }, true)
    return
  }

  const helperURL = ownScript.src
  const states = new WeakMap()
  const escapeAttribute = value => value.replace(/[&"<>]/g, char => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char]))

  const fail = (root, state) => {
    clearTimeout(state.timer)
    state.frame?.remove()
    state.frame = null
    root.dataset.state = 'error'
    state.viewport.setAttribute('aria-busy', 'false')
    state.button.disabled = false
    state.label.textContent = '重新加载地图'
    state.status.textContent = '地图暂时无法连接，可稍后重试。正文浏览不受影响。'
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
      state.button.addEventListener('click', () => {
        // 禁止重复点击并发请求；重试时移除旧框架，旧消息也不能覆盖新状态。
        if (root.dataset.state === 'loading') return
        clearTimeout(state.timer)
        state.frame?.remove()
        root.dataset.state = 'loading'
        state.button.disabled = true
        state.label.textContent = '正在加载…'
        state.status.textContent = '正在连接 ClustrMaps…'
        state.viewport.setAttribute('aria-busy', 'true')

        const vendorURL = new URL('https://clustrmaps.com/globe.js')
        vendorURL.searchParams.set('d', root.dataset.visitorMap)
        const frame = document.createElement('iframe')
        frame.title = 'ClustrMaps 访客分布地图'
        frame.referrerPolicy = 'strict-origin-when-cross-origin'
        // srcdoc 保留原脚本的解析顺序，兼容 document.write；框架本身不代表安全沙箱。
        frame.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent}body{text-align:center;overflow-x:hidden}canvas,svg,img{max-width:100%;height:auto}a{color:#49b1f5}</style><script src="${escapeAttribute(helperURL)}" data-visitor-map-frame data-parent-origin="${escapeAttribute(location.origin)}"></script></head><body><script id="clstr_globe" src="${escapeAttribute(vendorURL.href)}"></script></body></html>`
        state.frame = frame
        state.viewport.replaceChildren(frame)
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
      if (event.data.state === 'error') return fail(root, state)
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
