import os

# 配置区
CONTENT = """\n
<script src="https://utteranc.es/client.js"
        repo="ywxy12138/ywxy12138.github.io"
        issue-term="pathname"
        label="Comment"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
"""

# 执行脚本
for root, dirs, files in os.walk('.'):
    for filename in files:
        if filename.endswith('md'):
            filepath = os.path.join(root, filename)
            with open(filepath, 'a', encoding='utf-8') as f:
                f.write(CONTENT)
            print(f'已更新: {filepath}')