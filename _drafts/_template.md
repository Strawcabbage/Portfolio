---
# ── How to publish ──────────────────────────────────────────────────────────
# 1. Copy this file, rename it, and write in Markdown.
# 2. Preview locally:  bundle exec jekyll serve --drafts   (drafts get today's date)
# 3. Publish: move it to _posts/ as YYYY-MM-DD-short-title.md, e.g.
#    _posts/2026-10-15-grokking-weight-decay.md
# 4. First post only: delete the `sitemap: false` line in writing.html.
# ────────────────────────────────────────────────────────────────────────────
title: "Post title"
summary: "One sentence shown under the title and on the Writing page."
description: "Same idea, used for search and link previews."
tags: [tag-one, tag-two]
math: false        # set true to render equations with KaTeX
# image: /assets/img/posts/my-post-card.jpg   # optional custom preview card (1200x630)
---

Opening paragraph: the hook. Lead with the most interesting result.

## Section heading

Body text. **Bold**, *italic*, `inline code`, and [links](https://example.com).

Equations (needs `math: true`): inline $$\eta \nabla_\theta L$$ or on their own line:

$$
\theta_{t+1} = \theta_t - \eta \, \nabla_\theta L(\theta_t)
$$

Code:

```python
optim = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.1)
```

Images (put files in assets/img/posts/):

![Describe the image for screen readers]({{ '/assets/img/posts/example.png' | relative_url }})

Interactive visuals from the site can be embedded, e.g. the grokking chart:

{% raw %}{% include visuals/grokking.html %}{% endraw %}

> Blockquotes work for key takeaways.
