---
title: "Grokking, weight decay, and the dip at step 55k"
summary: "My transformer memorized modular addition in 200 steps and generalized 38,000 steps later. Here's what weight decay had to do with it."
description: "Reproducing grokking on (a + b) mod 97 with a from-scratch transformer, sweeping weight decay, and investigating a sudden collapse in validation accuracy."
tags: [grokking, optimization, pytorch]
math: true
---
{% comment %}
  OUTLINE — replace each prompt with your own writing. ~800–1,500 words total.
  Numbers below are from logs/log_wd0.1_tf0.3_d128.json; update after the sweep.
  Send me the new logs and I'll add the weight-decay slider chart.
{% endcomment %}

{% comment %}HOOK (2–3 sentences): lead with the surprising result.{% endcomment %}
My transformer passed 99% training accuracy at step 200. On held-out data it stayed near
chance until step 38,200, when it suddenly generalized.

## What is grokking?
{% comment %}
  Explain delayed generalization in plain words. Cite Power et al. (2022),
  "Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets".
  Why is it surprising? (Classic intuition says overfitting is the end of the story.)
{% endcomment %}

## Setup
{% comment %}
  Task: (a + b) mod 97, 30% of the 9,409 pairs for training.
  Model: 2-layer transformer, 4 heads, written from scratch (link the repo).
  Optimizer: AdamW, lr 1e-3, weight decay swept over {0, 0.03, 0.1, 0.3, 1.0}.
  Loss, with weight decay shown explicitly (decoupled in AdamW):
{% endcomment %}

$$
\theta_{t+1} = \theta_t - \eta\left(\hat m_t / (\sqrt{\hat v_t} + \epsilon) + \lambda\,\theta_t\right)
$$

## Results
{% include visuals/grokking.html %}

{% comment %}
  - Describe the curve: memorization at step ~200, generalization at ~38k.
  - Weight-decay sweep: does grokking happen without it? Does more decay make it faster?
    (Slider chart goes here once the runs are in.)
{% endcomment %}

### The dip at step 55k
{% comment %}
  Validation accuracy collapsed to ~0% around step 55k, then recovered.
  What happened to the training loss at the same moment? Is it reproducible across seeds?
  Related reading: "slingshot" instabilities with adaptive optimizers (Thilak et al., 2022).
{% endcomment %}

## Why does weight decay matter?
{% comment %}
  Your explanation: weight decay penalizes large-norm memorizing solutions and
  pushes toward a lower-norm solution that generalizes. Any evidence (weight norms over time)?
{% endcomment %}

## What surprised me
{% comment %}Honest notes: bugs, dead ends, things that did not match the papers.{% endcomment %}

## What's next
{% comment %}The experiments you would run next; link the grokking case study once it's published.{% endcomment %}
