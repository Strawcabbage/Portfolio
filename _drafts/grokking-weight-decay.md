---
title: "Grokking, weight decay, and the dip at step 55k"
summary: "My transformer memorized modular addition in 200 steps and generalized 38,000 steps later. A 27-run sweep showed weight decay sets that clock almost exactly."
description: "Reproducing grokking on (a + b) mod 97 with a from-scratch transformer, sweeping weight decay, width and Adam's beta2, and tracing post-grokking collapses."
tags: [grokking, optimization, pytorch]
math: true
---
{% comment %}
  OUTLINE: replace each prompt with your own writing (~1,000–1,500 words).
  The DATA NOTES under each heading are facts from the sweep logs
  (github.com/Strawcabbage/grokking, logs/{wd,width,dip}) to draw on; they never
  appear on the page. Charts are already embedded and interactive.
{% endcomment %}

{% comment %}
  HOOK (2–3 sentences): lead with the surprising result.
  DATA NOTES (original run, logs/log_wd0.1_tf0.3_d128.json: λ = 0.1, β2 = 0.999):
  train ≥ 99% at step 200, validation ≥ 99% at step 38,200 (~190× later).
{% endcomment %}
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
  DATA NOTES:
  - Task: (a + b) mod 97; 30% of the 9,409 pairs (2,822) for training, full batch.
  - Model: 2-layer transformer, d = 128, 4 heads, written from scratch (link the repo).
  - Optimizer: AdamW, lr 1e-3, β = (0.9, 0.98), 10-step warmup (Power et al. settings).
  - Sweeps: λ ∈ {0, 0.1, 0.3, 1, 3} × 3 seeds; width d ∈ {64, 128, 256, 512} × 2 seeds;
    β2 ∈ {0.999, 0.98} at λ = 0.1 for the full 100k steps × 2 seeds. 27 runs, on an RTX A2000.
  - "Grokked" = first logged step with validation accuracy ≥ 99% (logged every 100 steps).
  AdamW's update, with decoupled weight decay λ:
{% endcomment %}

$$
\theta_{t+1} = \theta_t - \eta\left(\hat m_t / (\sqrt{\hat v_t} + \epsilon) + \lambda\,\theta_t\right)
$$

## Weight decay sets the clock
{% include visuals/grokking-wd.html start="0.1" %}

{% comment %}
  DATA NOTES (mean of 3 seeds; spread in brackets):
  - λ = 0:   never grokked in 100k steps (final val 7–20%); ‖w‖ grew from 121 to 2,050–2,260.
  - λ = 0.1: 35,767 steps [33,200–38,800]
  - λ = 0.3: 10,633 [10,200–11,200]
  - λ = 1:    2,800 [2,700–2,900]
  - λ = 3:    1,000 [900–1,100]; memorizing took slightly longer (step 200 vs 100).
  - λ × steps ≈ 3,000 for every λ (2,800–3,577; mean 3,142), i.e. steps ∝ 1/λ.
    With lr = 1e-3 that is lr·λ·t ≈ 3: decay alone would shrink the weights to e^-3 ≈ 5% of their size
    (observed: 121 → ~30, about 25%, because gradients push back).
{% endcomment %}

{% include visuals/grokking-scaling.html %}

{% comment %}
  DATA NOTES (width, λ = 1): d = 64 → 3,400 steps; 128 → 2,750; 256 → 2,650; 512 → 2,250.
  8× wider ≈ 1.5× fewer steps, but each step costs ~16× more compute, so wall-clock is slower.
  (My earlier "bigger d isn't faster" experience: probably wall-clock, not steps.)
{% endcomment %}

## Why does weight decay matter?
{% comment %}
  DATA NOTES, the key evidence: every run that grokked did so when its weight norm had
  fallen from ~121 to 27–35, whatever λ was (λ = 0.1: 34.5–35.1; 0.3: 32.5–33.1;
  1: 28.7–30.4; 3: 26.9–27.5). With λ = 0 the norm only grew (>2,000) and it never grokked.
  See the weight-norm panel under the chart above. Connects to Liu et al. (2022), "Omnigrok":
  generalization when the norm shrinks into a "Goldilocks zone", and to Nanda et al. (2023):
  a memorizing circuit is cleaned up by weight decay, leaving the general algorithm.
  Your explanation: why would a smaller norm favor the general solution?
{% endcomment %}

## The dip at step 55k
{% include visuals/grokking-dip.html seed=0 %}

{% comment %}
  DATA NOTES:
  - The original run (β2 = 0.999) had validation collapses AFTER grokking at
    40.4k, 55.2k, 69.2k, 73.2k, 77k and 91k steps. The "dip at 55k" was one of several.
  - Rerunning λ = 0.1 for 100k steps: β2 = 0.999 → 5 and 8 post-grok validation collapses
    (seeds 0, 1); β2 = 0.98 → 1 brief drop right after grokking (seed 0, step 36k) and one
    soft dip to 96% (seed 1, ~70k). Training-accuracy collapses BEFORE grokking happen
    with both β2 values (2–6 per run); with λ = 3 there were none.
  - Weight norm after grokking: β2 = 0.999 stays ~30–50 while training loss stays ~1e-3;
    β2 = 0.98 drives training loss to ~1e-7 while ‖w‖ climbs from ~35 to ~390–450.
  - Related: Thilak et al. (2022), "The Slingshot Mechanism": cyclic norm growth and loss
    spikes with adaptive optimizers. Hypothesis to discuss (state it as one): with β2 = 0.999
    Adam's second-moment estimate lags the shrinking gradients, so steps periodically
    become too large and knock the model off its solution; β2 = 0.98 adapts faster.
  - Only 2 seeds per setting, so say "consistent with", not "proves".
{% endcomment %}

## What surprised me
{% comment %}Honest notes: bugs, dead ends, things that did not match the papers or your predictions.{% endcomment %}

## What's next
{% comment %}
  Ideas: more seeds for the β2 result; log the update size ‖Δθ‖ around collapses; vary the
  training fraction; check whether the norm band (27–35) moves with width or task size.
  Link the grokking case study once it's published.
{% endcomment %}
