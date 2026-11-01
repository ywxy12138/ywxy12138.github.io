/* 仅增强文章分享栏：无第三方依赖，复制失败时保留原生手动复制入口。 */
(() => {
  'use strict'

  document.querySelectorAll('[data-article-share]').forEach(root => {
    const controls = root.querySelector('[data-share-controls]')
    const copy = root.querySelector('[data-share-copy]')
    const system = root.querySelector('[data-share-system]')
    const status = root.querySelector('[data-share-status]')
    const manual = root.querySelector('[data-share-manual]')
    const input = root.querySelector('[data-share-input]')
    if (!controls || !copy || !system || !status || !manual || !input || root.dataset.shareReady) return

    let url
    try {
      // 模板已给正式地址；再次限制协议并去掉预览参数/片段，不使用 location.href。
      const target = new URL(root.dataset.shareUrl)
      if (!['https:', 'http:'].includes(target.protocol)) return
      target.search = ''
      target.hash = ''
      url = target.href
    } catch (_) { return }

    const data = { title: root.dataset.shareTitle || document.title, url }
    let canShare = typeof navigator.share === 'function'
    if (canShare && typeof navigator.canShare === 'function') {
      try { canShare = navigator.canShare(data) } catch (_) { canShare = false }
    }
    system.hidden = !canShare
    input.value = url
    root.dataset.shareReady = 'true'
    controls.hidden = false

    // 同一时刻只允许一个复制/分享操作，防止重复点击并发打开系统面板。
    let busy = false
    const setBusy = value => {
      busy = value
      copy.disabled = value
      system.disabled = value
    }
    const showManual = message => {
      status.textContent = message
      manual.open = true
      input.focus()
      input.select()
    }
    input.addEventListener('click', () => input.select())

    copy.addEventListener('click', async () => {
      if (busy) return
      setBusy(true)
      status.textContent = ''
      try {
        if (typeof navigator.clipboard?.writeText !== 'function') {
          showManual('自动复制不可用，请复制下方地址。')
          return
        }
        await navigator.clipboard.writeText(url)
        status.textContent = '链接已复制。'
      } catch (_) {
        // 不伪报成功，也不用已弃用的复制命令绕过权限；让读者手动复制。
        showManual('未能自动复制，请复制下方地址。')
      } finally { setBusy(false) }
    })

    system.addEventListener('click', async () => {
      if (busy || !canShare) return
      setBusy(true)
      status.textContent = ''
      try {
        // 在点击处理内立即调用，以保留原生分享所需的用户激活状态。
        await navigator.share(data)
        status.textContent = '已交给系统分享。'
      } catch (error) {
        if (error?.name === 'AbortError') {
          // 取消或没有可用目标都可能返回 AbortError，不报故障、不擅自复制。
          status.textContent = '未完成分享，可复制链接。'
        } else {
          showManual('系统分享暂不可用，请复制下方地址。')
        }
      } finally { setBusy(false) }
    })
  })
})()
