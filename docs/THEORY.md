# Theoretical Framework — CineSentiment

**Document type:** Mapping from statistical / ML theory to artefacts in this repository  
**Audience:** Examiners (statistics, machine learning, software)  
**Companion:** [METHODOLOGY.md](METHODOLOGY.md) · [STATS_REPORT.md](STATS_REPORT.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

This chapter records **only theories that are instantiated in code or evaluation artefacts**. Each figure is a *theory → implementation* architecture. Figure prefix **T.** does not collide with C4 (**A.**), ML runtime (**M.**), or UI screenshots (**1–16**).

Principal diagrams **T.1–T.12** are reproduced in README §4. Figures **T.13–T.16** live here.

---

## T.0 Inventory — theory used, and where it lands

This table is a **lookup**, not a bibliography to paste into the report. Cite a row only if that chapter actually discusses the method.

| Theory | Canonical reference | Instantiation in this project |
|--------|---------------------|-------------------------------|
| Supervised binary classification | Vapnik (1998); Hastie et al. (2009) | \(y \in \{0,1\}\), Fresh vs Rotten |
| i.i.d. + held-out generalisation | Devroye et al. (1996) | Test split reported **once**; no test tuning |
| Stratified sampling | Cochran (1977) | 70/15/15 by label, seed 42 |
| Bag-of-words / TF-IDF | Salton & Buckley (1988) | `TfidfVectorizer` unigrams+bigrams, `sublinear_tf` |
| Logistic regression (Bernoulli GLM) | McCullagh & Nelder (1989) | Primary classical baseline |
| Naïve Bayes + Laplace smoothing | Manning et al. (2008) | `MultinomialNB(alpha=1.0)` |
| Soft-margin linear SVM + calibration | Cortes & Vapnik (1995); Platt (1999) | `CalibratedClassifierCV(LinearSVC)` |
| Self-attention / Transformer | Vaswani et al. (2017) | DistilBERT 6-block encoder |
| BERT pre-training + fine-tuning | Devlin et al. (2019) | `distilbert-base-uncased` then IMDB head |
| Knowledge distillation | Hinton et al. (2015); Sanh et al. (2019) | DistilBERT instead of BERT-base |
| Cross-entropy / softmax | Goodfellow et al. (2016) | Sequence-classification loss |
| AdamW, weight decay, warmup | Loshchilov & Hutter (2019) | Trainer defaults in `model_training.py` |
| Model selection on validation F1 | Hastie et al. (2009) | `load_best_model_at_end` on F1 |
| Bayes decision / threshold \(\tau\) | Duda et al. (2001) | \(\hat{y}=\mathbb{1}[P\ge 0.5]\) unless swept |
| Confusion-matrix rates | Fawcett (2006) | TPR, TNR, FPR, FNR, PPV, NPV |
| F1 (harmonic mean) | van Rijsbergen (1979) | Primary academic metric with accuracy |
| ROC-AUC / PR-AP | Hanley & McNeil (1982); Manning et al. | Insights curves |
| Probability calibration, Brier, ECE | Brier (1950); Guo et al. (2017) | 10-bin reliability, Insights page |
| Percentile bootstrap CI | Efron & Tibshirani (1993) | 500 resamples, seed 42 |
| McNemar paired test | McNemar (1947) | Continuity-corrected χ² vs TF-IDF |
| Bootstrap difference test | Efron & Tibshirani (1993) | Δ accuracy, Δ F1 |
| Bonferroni correction | Bonferroni (1936) | When >1 baseline is tested |
| Effect size (Cohen’s *h*, OR) | Cohen (1988) | Discordant pairs in `ml_core` |
| Ablation | Cohen & Howe (1988) | max_length, lr, epochs |
| Input × gradient saliency | Simonyan et al. (2014); Sundararajan et al. (2017) | `/api/explain` (first-order, not IG/SHAP) |
| LoRA | Hu et al. (2022) | Offline PEFT comparator only |
| Dense retrieval / RAG | Lewis et al. (2020); Reimers & Gurevych (2019) | MiniLM + Chroma; **not** fused into logits |
| Cross-lingual transfer | Conneau et al. (2020) | Optional XLM-R if `lang ≠ en` |

**Not claimed.** MCP servers; SHAP/LIME as the live explainer (cited as related work only); *k*-fold CV; retrieval-augmented *accuracy* without an ablation.

---

## T.1 Knowledge architecture — how theory drives the system

```mermaid
flowchart TB
    subgraph Stats["Statistical learning theory"]
        IID["i.i.d. assumption"]
        Split["Train / val / test isolation"]
        Boot["Percentile bootstrap"]
        Hyp["McNemar + Bonferroni"]
    end

    subgraph Rep["Representation learning"]
        Sparse["TF-IDF n-grams"]
        Ctx["Contextual Transformer"]
        Dist["Knowledge distillation"]
    end

    subgraph Dec["Decision theory"]
        CE["Cross-entropy + softmax"]
        Thr["Threshold τ"]
        Cal["Calibration Brier / ECE"]
    end

    subgraph XAI["Attribution theory"]
        IxG["Input × gradient"]
    end

    subgraph Art["Artefacts"]
        CSV["data/raw/*.csv"]
        W["sentiment_model/"]
        EJ["evaluation.json"]
        API["POST /api/predict"]
        EX["POST /api/explain"]
    end

    IID --> Split --> CSV
    Sparse --> EJ
    Ctx --> Dist --> W
    Dist --> CE --> Thr --> API
    Boot --> EJ
    Hyp --> EJ
    Cal --> EJ
    IxG --> EX
    W --> API
```

**Figure T.1.** Theoretical framework of the capstone. Statistics constrain the **protocol**; representation learning supplies **two model families**; decision theory turns logits into labels and probabilities; attribution is a separate first-order map. Everything terminates in files examiners can open.

---

## T.2 Problem formulation

Let \(x\) be review text and \(y \in \{0,1\}\) with \(1 =\) Fresh. We estimate \(f_\theta(x) = P_\theta(y=1 \mid x)\) and apply

\[
\hat{y} = \mathbf{1}[f_\theta(x) \ge \tau], \quad \tau = 0.5 \text{ unless swept}.
\]

```mermaid
flowchart LR
    X["x  review text"] --> Enc["Encoder f_θ"]
    Enc --> P["P(y=1 | x)"]
    P --> G{"≥ τ ?"}
    G -->|yes| Pos["ŷ = 1 Fresh"]
    G -->|no| Neg["ŷ = 0 Rotten"]
    Y["y true label"] -.-> Loss["ℓ(y, P) train only"]
    Loss --> Enc
```

**Figure T.2.** Supervised classification as conditional probability + threshold (Duda et al., 2001). Training minimises empirical risk on **train.csv only**. Test labels are used solely in `evaluate_model.py` / `STATS_REPORT.md`.

---

## T.3 Generalisation protocol (no leakage)

```mermaid
flowchart TB
    D["IMDB 50k labelled reviews"] --> S["Stratify by y · seed 42"]
    S --> TR["Train 35k — fit θ"]
    S --> VA["Val 7.5k — select checkpoint / τ"]
    S --> TE["Test 7.5k — report once"]

    TR --> Fit["DistilBERT + TF-IDF"]
    VA --> Sel["Best F1 / threshold explorer"]
    Fit --> Sel
    Sel --> Once["evaluate on TE a single time"]
    Once --> CI["Bootstrap 95% CI on TE"]
    Once --> Test["McNemar on paired TE errors"]
```

**Figure T.3.** Statistical learning protocol. The test split is an **estimator of risk**, not a tuning knob (Hastie et al., 2009). Stratification preserves the 50/50 class prior so accuracy is not dominated by imbalance.

---

## T.4 Two representation families

```mermaid
flowchart TB
    X["Tokenised review"]

    subgraph Sparse["Sparse lexical family"]
        Bow["Bag-of-words / n-grams"]
        Idf["TF-IDF  ·  max_features 50k  ·  ngram 1-2  ·  sublinear_tf"]
        Phi["φ(x) ∈ R^d  sparse"]
        Bow --> Idf --> Phi
    end

    subgraph Dense["Dense contextual family"]
        Tok["WP tokenizer  max_len 256"]
        Att["Self-attention over tokens"]
        H["h_[CLS] ∈ R^768"]
        Tok --> Att --> H
    end

    X --> Bow
    X --> Tok
    Phi --> LR["Logistic / NB / SVM"]
    H --> Head["Linear 2-way head"]
```

**Figure T.4.** The academic comparison is **not** “neural vs magic”; it is two feature geometries on the **same** \((x,y)\) (Salton & Buckley, 1988 vs Vaswani et al., 2017). McNemar tests whether their **error patterns** differ, not whether embeddings “exist”.

---

## T.5 Classical stack — TF-IDF to linear models

```mermaid
flowchart LR
    subgraph Vec["Vector space retrieval"]
        TF["term frequency"]
        IDF["inverse document frequency"]
        Sub["sublinear tf  log(1+tf)"]
        TF --> Sub --> IDF
    end

    subgraph Models["Probabilistic / geometric classifiers"]
        LR["Logistic regression<br/>P = σ(wᵀφ + b)  ·  balanced"]
        NB["Multinomial NB<br/>Laplace α = 1"]
        SVM["Linear SVM<br/>then Platt-style calibration"]
    end

    IDF --> LR
    IDF --> NB
    IDF --> SVM
    LR --> Comp["Primary nested comparator"]
```

**Figure T.5.** TF-IDF + logistic regression is the **pre-registered** baseline (GLM with logit link). Naïve Bayes adds a generative independence assumption; Linear SVM maximises margin, then `CalibratedClassifierCV` supplies probabilities so Brier/ECE are defined.

---

## T.6 Self-attention as used in DistilBERT

```mermaid
flowchart TB
    Xin["X ∈ R^{n×d}  n ≤ 256"]
    Q["Q = X W_Q"]
    K["K = X W_K"]
    V["V = X W_V"]
    A["A = softmax(Q Kᵀ / √d_k)"]
    O["A V  →  residual + LayerNorm  →  FFN"]
    Blk["Repeat 6 DistilBERT blocks"]
    CLS["Take [CLS]"]

    Xin --> Q
    Xin --> K
    Xin --> V
    Q --> A
    K --> A
    A --> O
    V --> O
    O --> Blk --> CLS
```

**Figure T.6.** Scaled dot-product attention (Vaswani et al., 2017, Eq. 1) inside each DistilBERT block. We do **not** re-implement attention; we fine-tune Hugging Face `DistilBertForSequenceClassification`. Sequence length 256 is a **truncation bias** quantified in ablation (`max_length` ∈ {64, 128, 256, 512}).

---

## T.7 Distillation and transfer learning

```mermaid
flowchart LR
    Books["Unlabelled text  BooksCorpus + Wiki"]
    BERT["BERT-base  12 layers  teacher"]
    Distil["DistilBERT  6 layers  student"]
    IMDB["IMDB train labels"]
    Head["+ 2-way classifier"]
    Serve["sentiment_model/"]

    Books --> BERT
    BERT -->|"KD: match teacher logits / hidden"| Distil
    Distil --> Head
    IMDB --> Head
    Head --> Serve
```

**Figure T.7.** Two stacked transfers. (1) **Knowledge distillation** (Hinton et al., 2015; Sanh et al., 2019) compresses BERT-base into DistilBERT *before* this project. (2) **Inductive transfer**: we fine-tune that student on IMDB. We do not train BERT-base from scratch; compute is the reason DistilBERT was chosen (ARCHITECTURE ADR).

---

## T.8 Empirical risk, optimiser, and selection

```mermaid
flowchart TB
    Risk["R_emp(θ) = 1/N Σ CE(y_i, softmax(z_i))"]
    Opt["AdamW  lr 2e-5  wd 0.01  linear warmup"]
    Val["Each epoch: F1 on val.csv"]
    Best["Keep θ* with best val F1"]
    Stop["3 epochs default  load_best_model_at_end"]

    Risk --> Opt --> Val --> Best --> Stop
```

**Figure T.8.** Cross-entropy is the negative log-likelihood of a Bernoulli (via softmax on 2 logits). AdamW decouples weight decay from the adaptive step (Loshchilov & Hutter, 2019). **Selection uses validation F1, never test F1.**

---

## T.9 Decision theory and operating point

```mermaid
flowchart LR
    P["P(Fresh | x)"]
    T["τ  default 0.5"]
    Yhat["ŷ"]
    Sweep["Threshold sweep on val<br/>Insights / Metrics slider"]
    Costs["If FP ≠ FN cost  pick τ* ≠ 0.5"]

    P --> T --> Yhat
    Sweep --> T
    Costs -.-> Sweep
```

**Figure T.9.** The default 0.5 threshold is Bayes-optimal when classes are balanced and costs are equal (Duda et al., 2001). The UI slider is **exploratory on validation**; primary tables freeze \(\tau=0.5\) on test.

---

## T.10 Evaluation taxonomy

```mermaid
flowchart TB
    subgraph Disc["Discrimination  hard labels"]
        Acc["Accuracy"]
        F1["F1"]
        CM["Confusion  TPR TNR PPV NPV"]
    end

    subgraph Rank["Ranking  scores"]
        ROC["ROC-AUC"]
        PR["Average precision"]
    end

    subgraph Prob["Probabilistic  calibration"]
        Brier["Brier score"]
        ECE["ECE  10 bins"]
        Rel["Reliability diagram"]
    end

    Pred["ŷ and P on a frozen split"] --> Disc
    Pred --> Rank
    Pred --> Prob
```

**Figure T.10.** Three questions that must not be collapsed (Guo et al., 2017; Fawcett, 2006): (i) are labels right, (ii) are scores ranked, (iii) are probabilities honest. This project reports all three; lead metrics for the capstone are **test F1 + ROC-AUC**, with CIs on the discrimination block.

---

## T.11 Percentile bootstrap

```mermaid
flowchart TB
    TE["Test set  n = 7500"]
    Draw["Draw n rows with replacement  B = 500  seed 42"]
    Met["Compute metric m*_b"]
    Q["2.5th and 97.5th percentiles"]
    CI["95% CI  no normality assumption"]

    TE --> Draw --> Met --> Q --> CI
```

**Figure T.11.** Percentile bootstrap (Efron & Tibshirani, 1993) in `backend/ml_core.py`. The interval is a statement about **sampling variability of the test estimator**, not about Bayesian parameter posteriors. \(B=500\) is a compute compromise; it is not an infinite bootstrap.

---

## T.12 Paired hypothesis tests

```mermaid
flowchart TB
    Pair["Same 7500 test reviews"]
    D["DistilBERT ŷ"]
    B["TF-IDF+LR ŷ"]
    Pair --> D
    Pair --> B

    subgraph Mc["McNemar  H0: equal error rates"]
        Tab["Discordant  b, c"]
        Chi["χ² continuity correction"]
        P1["p ≈ 0.15  not rejected at α = 0.05"]
        Tab --> Chi --> P1
    end

    subgraph Bd["Bootstrap difference  H0: Δ = 0"]
        Dlt["Δ acc  Δ F1"]
        P2["percentile CI includes 0"]
        Dlt --> P2
    end

    subgraph Mult["Multiple comparisons"]
        Bon["Bonferroni if >1 baseline"]
        Eff["Cohen h  odds ratio"]
    end

    D --> Tab
    B --> Tab
    D --> Dlt
    B --> Dlt
    P1 --> Bon
    P2 --> Bon
```

**Figure T.12.** Two complementary tests (Dietterich, 1998; McNemar, 1947). McNemar asks whether **error patterns** differ; bootstrap Δ asks whether **metric magnitude** differs. On this split both fail to reject at 5%. Bonferroni guards the family when NB and SVM are added. **We report non-significance rather than p-hack a winner.**

---

## T.13 Calibration theory (extra)

```mermaid
flowchart LR
    P["P_i in bins"]
    Acc["Observed Fresh rate per bin"]
    Rel["Reliability diagram vs identity"]
    Brier["Brier = 1/n Σ (P_i − y_i)²"]
    ECE["ECE = Σ (|B|/n) |acc(B) − conf(B)|"]

    P --> Acc --> Rel
    P --> Brier
    P --> ECE
```

**Figure T.13.** A high-AUC model can still be miscalibrated (Guo et al., 2017). Insights (`/insights.html`) plots the reliability diagram. We do **not** apply temperature scaling at serve time in the default path; calibration is a **reported property**, not a post-hoc fix unless an operator chooses a new \(\tau\).

---

## T.14 Attribution theory vs implementation (extra)

```mermaid
flowchart TB
    subgraph Theory["Literature"]
        Grad["Vanilla gradient saliency"]
        IG["Integrated gradients"]
        SHAP["SHAP"]
        LIME["LIME"]
    end

    subgraph Ours["This repository"]
        IxG["Input × gradient on embedding"]
        Lex["Lexicon heuristic  UI fallback"]
    end

    Grad --> IxG
    IG -.->|"too slow for interactive API"| IxG
    SHAP -.->|"not implemented"| Lex
    LIME -.->|"not implemented"| Lex
```

**Figure T.14.** Related work cites Ribeiro (2016) and Lundberg & Lee (2017). **Live XAI is first-order input × gradient** (Simonyan et al., 2014; cf. Sundararajan et al., 2017). That is an honest subset of the attribution literature, not a SHAP clone.

---

## T.15 LoRA as low-rank transfer (extra, offline)

```mermaid
flowchart LR
    W["Frozen W_0"]
    BA["ΔW = B A  r = 8"]
    W2["W_0 + BA"]
    QV["target q_lin, v_lin"]
    BA --> QV --> W2
    W --> W2
```

**Figure T.15.** LoRA (Hu et al., 2022) is an **offline comparator** (`make lora-quick`). Adapters are not merged into the Flask serving bundle. The theory is parameter-efficient fine-tuning; the engineering choice is to keep one DistilBERT checkpoint on the predict path.

---

## T.16 Dense retrieval (extra, not fused)

```mermaid
flowchart TB
    q["Query embedding  MiniLM"]
    d["Document embeddings  cosine / HNSW"]
    q --> Sim["s(q,d) = cos(q,d)"]
    d --> Sim
    Sim --> TopK["top-k neighbours"]
    TopK --> UX["Display beside ŷ"]
    Cls["DistilBERT ŷ"] -.->|"no concat  no extra loss"| UX
```

**Figure T.16.** Dense passage retrieval (Karpukhin et al., 2020; Lewis et al., 2020) as **user context**. We do not train a RAG reader that conditions DistilBERT on neighbours, so we do not claim a retrieval-augmented **F1** gain.

---

## How to cite this chapter in a report

1. Draw **T.1** on the theory slide.  
2. State the protocol with **T.3**.  
3. Contrast representations with **T.4**.  
4. Put McNemar on **T.12** and say the models are tied.  
5. Point to `evaluation.json` as the empirical realisation of T.10–T.12.

---

*Theory version 2.3.0. If a method is not in T.0, do not imply it was used.*
