# Model weights

The trained `model.safetensors` file is approximately 438 MB, so it must not be
committed as a regular Git blob. GitHub blocks regular repository files larger
than 100 MiB.

Recommended distribution:

1. Push this source repository normally.
2. Create a GitHub Release named `bert-multilabel-base-v1`.
3. Upload `BeforeYouAgree-Multilabel-LEGAL-BERT-Base-Weights.zip` as a release asset.
4. Extract its `bert-multilabel-base-v1` directory into `ml/models/`.
5. Start inference with `./start-public-model.ps1`.

Expected archive SHA-256:

```text
f546f98128af5dd0138d691353a26ad7c56e214d8fb0555c055b5c475eb0f931
```

Git LFS is another option. The `.gitignore` excludes `ml/models/` by default;
remove that rule only after configuring Git LFS for `*.safetensors`.
