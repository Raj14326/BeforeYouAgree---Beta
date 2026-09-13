# Fixed-weight threshold comparison

On the 2,253-row validation split, changing only content_removal and arbitration to F0.5 with per-category recall >=0.70 selected exactly the original thresholds. No accuracy or F1 improvement was found. Retain the original four-epoch 256-token checkpoint. Weights and source configuration checksums are unchanged.

Eight-label validation scores, exhaustive precision-recall curves, policy metrics and selection guards are included. No historical test was scored for this decision. Fresh independent labelled data is unavailable, so external confirmation remains pending. The original public dataset lacks service IDs; exact-text checks cannot prove service-level independence or exclude near-duplicates.
