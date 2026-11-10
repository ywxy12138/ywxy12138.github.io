// 使用官方嵌入播放器，不解析或代理音频；关闭时移除 iframe，避免后台继续播放。
(() => {
  const init = () => {
    document.querySelectorAll('.collection-player').forEach(panel => {
      if (panel.dataset.bound) return
      panel.dataset.bound = 'true'
      const mount = panel.querySelector('.collection-player-mount')
      const status = panel.querySelector('.collection-player-status')
      const retry = panel.querySelector('.collection-player-retry')
      let timer
      const dispose = () => {
        clearTimeout(timer)
        mount.replaceChildren()
        status.textContent = ''
        retry.hidden = true
      }
      const load = () => {
        dispose()
        if (!panel.open || !/^\d+$/.test(panel.dataset.albumId)) return
        const frame = document.createElement('iframe')
        status.textContent = '正在连接 Apple Music…'
        // 跨域 load 仅表示页面响应，不能证明曲目已获播放授权。
        frame.addEventListener('load', () => {
          if (!panel.open || frame.parentNode !== mount) return
          clearTimeout(timer)
          status.textContent = '若播放器空白或无法播放，可重新加载或前往平台。'
          retry.hidden = false
        })
        frame.addEventListener('error', () => {
          if (!panel.open || frame.parentNode !== mount) return
          clearTimeout(timer)
          status.textContent = '播放器连接异常，请重试或前往平台。'
          retry.hidden = false
        })
        frame.src = `https://embed.music.apple.com/us/album/${panel.dataset.albumId}`
        frame.title = `《${panel.dataset.albumName}》Apple Music 专辑播放器`
        frame.allow = 'autoplay; encrypted-media'
        frame.referrerPolicy = 'strict-origin-when-cross-origin'
        mount.appendChild(frame)
        // 不自动循环请求；网络慢时给出可操作的退路，也允许迟到的响应正常显示。
        timer = setTimeout(() => {
          status.textContent = '连接时间较长，请重试或前往平台。'
          retry.hidden = false
        }, 15000)
      }
      retry.addEventListener('click', load)
      panel.addEventListener('collection:close', dispose)
      panel.addEventListener('toggle', () => {
        if (!panel.open) {
          dispose()
          return
        }
        // 同时只保留一个播放器，切换专辑时停止上一个；不影响平台外部窗口。
        document.querySelectorAll('.collection-player').forEach(other => {
          if (other !== panel) {
            other.open = false
            other.dispatchEvent(new Event('collection:close'))
          }
        })
        if (!mount.firstChild) load()
      })
    })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
  document.addEventListener('pjax:complete', init)
})()
