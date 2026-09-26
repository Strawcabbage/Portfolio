# Jackson Hull — Portfolio

Personal portfolio site built with [Jekyll](https://jekyllrb.com/) and hosted on
GitHub Pages at **https://strawcabbage.github.io/Portfolio/**.

## Publishing

1. Merge into `main`.
2. In the repo on GitHub: **Settings → Pages → Build and deployment**, set
   *Source* to **Deploy from a branch**, branch **main**, folder **/ (root)**.
3. The site will be live at the URL above within a minute or two.

## Editing content

Most edits don't touch HTML:

| What | Where |
|------|-------|
| Name, tagline, email, LinkedIn, résumé link | `_config.yml` |
| Projects (order, text, links, tags) | `_data/projects.yml` |
| Education & experience | `_data/experience.yml` |
| Skills | `_data/skills.yml` |
| Intro / About text | `index.html` |
| Colors & layout | `assets/css/main.css` |

**Résumé:** put the PDF at `assets/resume.pdf` and set `resume: /assets/resume.pdf`
in `_config.yml`.

**Blog posts:** add Markdown files to `_posts/` named `YYYY-MM-DD-title.md` with
front matter:

```yaml
---
layout: post
title: "What grokking taught me about weight decay"
---
```

A **Writing** link appears in the nav automatically once the first post exists.

**Grokking chart:** the data in `assets/data/grokking.json` is downsampled from
`logs/log_wd0.1_tf0.3_d128.json` in the grokking repo. It's drawn by
`assets/js/main.js`.

## Running locally

```bash
bundle install
bundle exec jekyll serve
# open http://localhost:4000/Portfolio/
```

## Using the short URL

To serve the site at `https://strawcabbage.github.io/` instead, rename this repo
to `strawcabbage.github.io` and set `baseurl: ""` in `_config.yml`.
