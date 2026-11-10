// 只增强订阅说明页；复制失败或禁用 JS 时仍保留可选择的完整地址。
(() => {
  const initSubscribe = () => {
    const panel = document.querySelector('[data-rss-subscribe]')
    if (!panel || panel.dataset.bound) return
    panel.dataset.bound = 'true'
    const input = panel.querySelector('input')
    const button = panel.querySelector('[data-rss-copy]')
    const status = panel.querySelector('[role="status"]')
    button.hidden = false
    button.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(input.value)
        status.textContent = '已复制，请粘贴到 RSS 阅读器中添加订阅。'
      } catch {
        // 权限拒绝、非安全上下文等情况不假报成功，选中后交给用户手动复制。
        input.focus()
        input.select()
        status.textContent = '自动复制未成功，已选中地址，请手动复制。'
      }
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSubscribe, { once: true })
  else initSubscribe()
  document.addEventListener('pjax:complete', initSubscribe)
})()
