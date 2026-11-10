// 使用官方嵌入播放器，不解析或代理音频；关闭时移除 iframe，避免后台继续播放。
(() => {
  const init = () => {
    document.querySelectorAll('.collection-player').forEach(panel => {
      if (panel.dataset.bound) return
      panel.dataset.bound = 'true'
      panel.addEventListener('toggle', () => {
        const mount = panel.querySelector('.collection-player-mount')
        if (!panel.open) {
          mount.replaceChildren()
          return
        }
        // 同时只保留一个播放器，切换专辑时停止上一个；不影响平台外部窗口。
        document.querySelectorAll('.collection-player').forEach(other => {
          if (other !== panel) {
            other.open = false
            other.querySelector('.collection-player-mount').replaceChildren()
          }
        })
        if (mount.firstChild || !/^\d+$/.test(panel.dataset.albumId)) return
        const frame = document.createElement('iframe')
        frame.src = `https://embed.music.apple.com/us/album/${panel.dataset.albumId}`
        frame.title = `《${panel.dataset.albumName}》Apple Music 专辑播放器`
        frame.allow = 'autoplay; encrypted-media'
        frame.referrerPolicy = 'strict-origin-when-cross-origin'
        mount.appendChild(frame)
      })
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
  document.addEventListener('pjax:complete', init)
})()
