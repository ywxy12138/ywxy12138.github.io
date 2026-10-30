/**
 * Refer to hexo-generator-searchdb
 * https://github.com/next-theme/hexo-generator-searchdb/blob/main/dist/search.js
 * Modified by hexo-theme-butterfly
 */

class LocalSearch {
  constructor ({
    path = '',
    unescape = false,
    top_n_per_article = 1
  }) {
    this.path = path
    this.unescape = unescape
    this.top_n_per_article = top_n_per_article
    this.isfetched = false
    this.datas = null
    // 同一时刻只下载一次索引；失败后清空，允许手动重试。
    this.fetchPromise = null
  }

  getIndexByWord (words, text, caseSensitive = false) {
    const index = []
    const included = new Set()

    if (!caseSensitive) {
      text = text.toLowerCase()
    }
    words.forEach(word => {
      if (this.unescape) {
        const div = document.createElement('div')
        div.innerText = word
        word = div.innerHTML
      }
      const wordLen = word.length
      if (wordLen === 0) return
      let startPosition = 0
      let position = -1
      if (!caseSensitive) {
        word = word.toLowerCase()
      }
      while ((position = text.indexOf(word, startPosition)) > -1) {
        index.push({ position, word })
        included.add(word)
        startPosition = position + wordLen
      }
    })
    // Sort index by position of keyword
    index.sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return right.word.length - left.word.length
    })
    return [index, included]
  }

  // Merge hits into slices
  mergeIntoSlice (start, end, index) {
    let item = index[0]
    let { position, word } = item
    const hits = []
    const count = new Set()
    while (position + word.length <= end && index.length !== 0) {
      count.add(word)
      hits.push({
        position,
        length: word.length
      })
      const wordEnd = position + word.length

      // Move to next position of hit
      index.shift()
      while (index.length !== 0) {
        item = index[0]
        position = item.position
        word = item.word
        if (wordEnd > position) {
          index.shift()
        } else {
          break
        }
      }
    }
    return {
      hits,
      start,
      end,
      count: count.size
    }
  }

  // 结果通过 HTML 模板显示，先转义正文和标题，再插入受控的高亮标签。
  escapeHtml (value) {
    return value.replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char])
  }

  // Highlight title and content
  highlightKeyword (val, slice) {
    let result = ''
    let index = slice.start
    for (const { position, length } of slice.hits) {
      result += this.escapeHtml(val.substring(index, position))
      index = position + length
      result += `<mark class="search-keyword">${this.escapeHtml(val.substr(position, length))}</mark>`
    }
    result += this.escapeHtml(val.substring(index, slice.end))
    return result
  }

  getResultItems (keywords) {
    const resultItems = []
    this.datas.forEach(({ title, content, url }) => {
      // The number of different keywords included in the article.
      const [indexOfTitle, keysOfTitle] = this.getIndexByWord(keywords, title)
      const [indexOfContent, keysOfContent] = this.getIndexByWord(keywords, content)
      const includedCount = new Set([...keysOfTitle, ...keysOfContent]).size

      // Show search results
      const hitCount = indexOfTitle.length + indexOfContent.length
      if (hitCount === 0) return

      const slicesOfTitle = []
      if (indexOfTitle.length !== 0) {
        slicesOfTitle.push(this.mergeIntoSlice(0, title.length, indexOfTitle))
      }

      let slicesOfContent = []
      while (indexOfContent.length !== 0) {
        const item = indexOfContent[0]
        const { position } = item
        // Cut out 120 characters. The maxlength of .search-input is 80.
        const start = Math.max(0, position - 20)
        const end = Math.min(content.length, position + 100)
        slicesOfContent.push(this.mergeIntoSlice(start, end, indexOfContent))
      }

      // Sort slices in content by included keywords' count and hits' count
      slicesOfContent.sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count
        } else if (left.hits.length !== right.hits.length) {
          return right.hits.length - left.hits.length
        }
        return left.start - right.start
      })

      // Select top N slices in content
      const upperBound = parseInt(this.top_n_per_article, 10)
      if (upperBound >= 0) {
        slicesOfContent = slicesOfContent.slice(0, upperBound)
      }

      let resultItem = ''

      url = new URL(url, location.origin)
      url.searchParams.append('highlight', keywords.join(' '))

      if (slicesOfTitle.length !== 0) {
        resultItem += `<div class="local-search-hit-item"><a href="${this.escapeHtml(url.href)}"><span class="search-result-title">${this.highlightKeyword(title, slicesOfTitle[0])}</span>`
      } else {
        resultItem += `<div class="local-search-hit-item"><a href="${this.escapeHtml(url.href)}"><span class="search-result-title">${this.escapeHtml(title)}</span>`
      }

      slicesOfContent.forEach(slice => {
        resultItem += `<p class="search-result">${this.highlightKeyword(content, slice)}...</p>`
      })

      resultItem += '</a></div>'
      resultItems.push({
        item: resultItem,
        id: resultItems.length,
        hitCount,
        includedCount
      })
    })
    return resultItems
  }

  fetchData () {
    if (this.isfetched) return Promise.resolve(true)
    if (this.fetchPromise) return this.fetchPromise

    // 请求和读取响应体共用超时，断网或 CDN 异常时不让搜索框永久等待。
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    window.dispatchEvent(new Event('search:loading'))
    this.fetchPromise = (async () => {
      try {
        const response = await fetch(this.path, { signal: controller.signal })
        if (!response.ok) throw new Error(`Search index HTTP ${response.status}`)
        const text = await response.text()
        const isXml = !new URL(this.path, location.href).pathname.endsWith('.json')
        let data
        if (isXml) {
          const xml = new DOMParser().parseFromString(text, 'text/xml')
          if (xml.querySelector('parsererror') || xml.documentElement.nodeName !== 'search') {
            throw new Error('Invalid search XML')
          }
          data = [...xml.querySelectorAll('entry')].map(entry => ({
            title: entry.querySelector('title')?.textContent,
            content: entry.querySelector('content')?.textContent || '',
            url: entry.querySelector('url')?.textContent
          }))
        } else {
          data = JSON.parse(text)
        }
        if (!Array.isArray(data)) throw new Error('Invalid search index')
        this.datas = data.filter(item => {
          if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' ||
              (item.content !== undefined && typeof item.content !== 'string')) {
            throw new Error('Invalid search entry')
          }
          return item.title.trim()
        }).map(item => {
          // 索引只允许跳转本站；用不插入页面的 template 提取正文，不执行脚本或加载图片。
          const url = new URL(item.url, location.origin)
          if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) {
            throw new Error('Invalid search URL')
          }
          const template = document.createElement('template')
          template.innerHTML = item.content || ''
          template.content.querySelectorAll('script, style, .gutter, .highlight-tools, .code-expand-btn').forEach(node => node.remove())
          template.content.querySelectorAll('br').forEach(node => node.replaceWith('\n'))
          return {
            title: item.title.trim(),
            content: template.content.textContent.trim(),
            url: url.pathname + url.search + url.hash
          }
        })
        // 解析全部成功后才标记就绪，错误页或损坏索引仍可重新加载。
        this.isfetched = true
        window.dispatchEvent(new Event('search:loaded'))
        return true
      } catch (error) {
        this.isfetched = false
        window.dispatchEvent(new Event('search:error'))
        return false
      } finally {
        clearTimeout(timeout)
        this.fetchPromise = null
      }
    })()
    return this.fetchPromise
  }

  // Highlight by wrapping node in mark elements with the given class name
  highlightText (node, slice, className) {
    const val = node.nodeValue
    let index = slice.start
    const children = []
    for (const { position, length } of slice.hits) {
      const text = document.createTextNode(val.substring(index, position))
      index = position + length
      const mark = document.createElement('mark')
      mark.className = className
      mark.appendChild(document.createTextNode(val.substr(position, length)))
      children.push(text, mark)
    }
    node.nodeValue = val.substring(index, slice.end)
    children.forEach(element => {
      node.parentNode.insertBefore(element, node)
    })
  }

  // Highlight the search words provided in the url in the text
  highlightSearchWords (body) {
    const params = new URL(location.href).searchParams.get('highlight')
    const keywords = params ? params.split(' ') : []
    if (!keywords.length || !body) return
    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null)
    const allNodes = []
    while (walk.nextNode()) {
      if (!walk.currentNode.parentNode.matches('button, select, textarea, .mermaid')) allNodes.push(walk.currentNode)
    }
    allNodes.forEach(node => {
      const [indexOfNode] = this.getIndexByWord(keywords, node.nodeValue)
      if (!indexOfNode.length) return
      const slice = this.mergeIntoSlice(0, node.nodeValue.length, indexOfNode)
      this.highlightText(node, slice, 'search-keyword')
    })
  }
}

// DOM 就绪即可初始化，避免等待访客地图或其他外部资源完成加载。
const initLocalSearch = () => {
  const { path, top_n_per_article, unescape, languages } = GLOBAL_CONFIG.localSearch
  const localSearch = new LocalSearch({
    path,
    top_n_per_article,
    unescape
  })

  const input = document.querySelector('#local-search-input input')
  const statsItem = document.getElementById('local-search-stats-wrap')
  const $loadingStatus = document.getElementById('loading-status')

  const inputEventFunction = () => {
    if (!localSearch.isfetched) return
    const searchText = input.value.trim().toLowerCase()
    if (searchText !== '') $loadingStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>'
    const keywords = searchText.split(/[-\s]+/)
    const container = document.getElementById('local-search-results')
    let resultItems = []
    if (searchText.length > 0) {
    // Perform local searching
      resultItems = localSearch.getResultItems(keywords)
    }
    if (keywords.length === 1 && keywords[0] === '') {
      container.textContent = ''
      statsItem.textContent = ''
    } else if (resultItems.length === 0) {
      container.textContent = ''
      const statsDiv = document.createElement('div')
      statsDiv.className = 'search-result-stats'
      statsDiv.textContent = languages.hits_empty.replace(/\$\{query}/, searchText)
      statsItem.innerHTML = statsDiv.outerHTML
    } else {
      resultItems.sort((left, right) => {
        if (left.includedCount !== right.includedCount) {
          return right.includedCount - left.includedCount
        } else if (left.hitCount !== right.hitCount) {
          return right.hitCount - left.hitCount
        }
        return right.id - left.id
      })

      const stats = languages.hits_stats.replace(/\$\{hits}/, resultItems.length)

      container.innerHTML = `<div class="search-result-list">${resultItems.map(result => result.item).join('')}</div>`
      statsItem.innerHTML = `<hr><div class="search-result-stats">${stats}</div>`
      window.pjax && window.pjax.refresh(container)
    }

    $loadingStatus.textContent = ''
  }

  const $searchMask = document.getElementById('search-mask')
  const $searchDialog = document.querySelector('#local-search .search-dialog')
  const $loadDataItem = document.getElementById('loading-database')
  const $retryButton = document.getElementById('local-search-retry')
  const $loadMessage = $loadDataItem.querySelector('span')
  const $loadIcon = $loadDataItem.querySelector('i')

  // fix safari
  const fixSafariHeight = () => {
    if (window.innerWidth < 768) {
      $searchDialog.style.setProperty('--search-height', window.innerHeight + 'px')
    }
  }

  const openSearch = () => {
    const bodyStyle = document.body.style
    bodyStyle.width = '100%'
    bodyStyle.overflow = 'hidden'
    btf.animateIn($searchMask, 'to_show 0.5s')
    btf.animateIn($searchDialog, 'titleScale 0.5s')
    setTimeout(() => { input.focus() }, 300)
    // 失败后重新打开也可再次请求，进行中的请求由 fetchData 合并。
    if (!localSearch.isfetched) localSearch.fetchData()
    document.addEventListener('keydown', onSearchKeydown)

    fixSafariHeight()
    window.addEventListener('resize', fixSafariHeight)
  }

  const closeSearch = () => {
    const bodyStyle = document.body.style
    bodyStyle.width = ''
    bodyStyle.overflow = ''
    btf.animateOut($searchDialog, 'search_close .5s')
    btf.animateOut($searchMask, 'to_hide 0.5s')
    window.removeEventListener('resize', fixSafariHeight)
    document.removeEventListener('keydown', onSearchKeydown)
  }

  const onSearchKeydown = event => {
    if (event.code === 'Escape') closeSearch()
  }

  const searchClickFn = () => {
    btf.addEventListenerPjax(document.querySelector('#search-button > .search'), 'click', openSearch)
  }

  const searchFnOnce = () => {
    input.addEventListener('input', inputEventFunction)
    $retryButton.addEventListener('click', () => localSearch.fetchData())
    document.querySelector('#local-search .search-close-button').addEventListener('click', closeSearch)
    $searchMask.addEventListener('click', closeSearch)
    if (GLOBAL_CONFIG.localSearch.preload) {
      localSearch.fetchData()
    }
    localSearch.highlightSearchWords(document.getElementById('article-container'))
  }

  // 保留加载区域节点，失败时显示错误与重试，成功后再展示搜索输入框。
  window.addEventListener('search:loading', () => {
    $searchDialog.setAttribute('aria-busy', 'true')
    $loadDataItem.hidden = false
    $loadIcon.hidden = false
    $loadMessage.textContent = languages.load_data || 'Loading search index…'
    $retryButton.hidden = true
  })
  window.addEventListener('search:error', () => {
    $searchDialog.setAttribute('aria-busy', 'false')
    $loadIcon.hidden = true
    $loadMessage.textContent = languages.load_error || 'Search index could not be loaded. Please retry.'
    $retryButton.textContent = languages.retry || 'Retry'
    $retryButton.hidden = false
    $retryButton.focus()
  })
  window.addEventListener('search:loaded', () => {
    $searchDialog.setAttribute('aria-busy', 'false')
    $loadDataItem.hidden = true
    $loadDataItem.nextElementSibling.style.display = 'block'
    inputEventFunction()
    if (!btf.isHidden($searchDialog)) input.focus()
  })

  searchClickFn()
  searchFnOnce()

  // pjax
  window.addEventListener('pjax:complete', () => {
    !btf.isHidden($searchMask) && closeSearch()
    localSearch.highlightSearchWords(document.getElementById('article-container'))
    searchClickFn()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLocalSearch, { once: true })
} else {
  initLocalSearch()
}
