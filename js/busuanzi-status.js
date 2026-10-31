/* 不蒜子仅负责回填数字；本地补充等待上限，不重试接口或改写真实计数。 */
(() => {
  'use strict'

  const counterIds = ['site_uv', 'site_pv', 'page_pv']
  const unavailableMessage = '统计服务暂不可用，可刷新页面重试。'
  const originalAttributes = new WeakMap()
  let dispose = () => {}

  const init = () => {
    // 局部导航与往返缓存可能复用脚本，先释放上一组节点的观察器和计时器。
    dispose()
    const counters = counterIds.map(id => document.getElementById(`busuanzi_value_${id}`)).filter(Boolean)
    if (!counters.length) return

    let timer
    const states = counters.map(node => {
      // 同一节点从缓存恢复时，不能把上次的失败说明误当成它的原始属性。
      if (!originalAttributes.has(node)) originalAttributes.set(node, {
        title: node.getAttribute('title'),
        label: node.getAttribute('aria-label')
      })
      return { node, ready: false, observer: null, ...originalAttributes.get(node) }
    })
    const restoreAttribute = (node, name, value) => {
      if (value === null) node.removeAttribute(name)
      else node.setAttribute(name, value)
    }
    const acceptNumber = state => {
      // 原接口回填十进制整数；0 是合法计数，空白、undefined 等不能视为成功。
      if (!/^\d+$/.test(state.node.textContent.trim())) return
      state.ready = true
      state.node.dataset.busuanziState = 'ready'
      state.node.setAttribute('aria-busy', 'false')
      restoreAttribute(state.node, 'title', state.title)
      restoreAttribute(state.node, 'aria-label', state.label)
      state.observer?.disconnect()
      if (states.every(item => item.ready)) clearTimeout(timer)
    }

    for (const state of states) {
      state.node.setAttribute('aria-live', 'polite')
      acceptNumber(state)
      if (state.ready) continue
      state.node.dataset.busuanziState = 'loading'
      state.node.setAttribute('aria-busy', 'true')
      state.observer = new MutationObserver(() => acceptNumber(state))
      state.observer.observe(state.node, { childList: true, characterData: true, subtree: true })
    }

    if (states.some(state => !state.ready)) {
      timer = setTimeout(() => {
        for (const state of states) {
          if (state.ready) continue
          state.node.textContent = '暂不可用'
          state.node.dataset.busuanziState = 'unavailable'
          state.node.setAttribute('title', unavailableMessage)
          state.node.setAttribute('aria-label', unavailableMessage)
          state.node.setAttribute('aria-busy', 'false')
          // 超时后仍观察原节点：迟到的真实回调可直接覆盖提示，并清除过期说明。
        }
      }, 10000)
    }

    dispose = () => {
      clearTimeout(timer)
      states.forEach(state => state.observer?.disconnect())
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
  document.addEventListener('pjax:complete', init)
  window.addEventListener('pagehide', () => dispose())
  // pagehide 会清理等待；浏览器从往返缓存恢复时重新接管现有节点。
  window.addEventListener('pageshow', event => { if (event.persisted) init() })
})()
