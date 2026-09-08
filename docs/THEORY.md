# Theoretical Framework — CineSentiment

**Document type:** Curriculum alignment (Stanford, MIT, Harvard, NUS) mapped onto artefacts  
**Audience:** Examiners who know *courses*, not a paper dump  
**Companion:** [METHODOLOGY.md](METHODOLOGY.md) · [STATS_REPORT.md](STATS_REPORT.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

This chapter records **only methods that exist in code**. Framing is the standard machine-learning and inference syllabus at four schools — the same ideas, different course codes. Figure prefix **T.**

You do **not** need to read a stack of authors. If you have taken (or can name) **CS229 + CS224N**, **6.036 + 6.041**, **CS181 + Stat 110**, or **CS3244 + CS4248 + ST2132**, you already have the theory. This repo is those modules applied to IMDB sentiment.

---

## T.0 Curriculum map — four schools, one project

| What the repo does | Stanford | MIT | Harvard | NUS |
|--------------------|----------|-----|---------|-----|
| Supervised binary classification, logistic / NB / SVM baselines | **CS229** | **6.036** (now 6.390) | **CS181** | **CS3244** |
| Train / val / test split; select on val; test once | CS229 | 6.036 | CS181 | CS3244 |
| TF-IDF, n-grams, text classification | **CS224N** (vector space) | **6.861** NLP | CS181 + text labs | **CS4248** |
| Transformers, self-attention, BERT-style fine-tune | **CS224N** | 6.S191 / 6.861 | CS287 (grad NLP) | CS4248 / **CS5242** |
| Cross-entropy, softmax, SGD-style training | CS229 / CS231N | 6.036 / 6.S191 | CS181 | CS3244 / CS5242 |
| Confusion matrix, F1, ROC | CS229 | 6.036 | CS181 | CS3244 |
| Bootstrap CI, hypothesis tests, paired comparison | **CS109** / STATS 200 | **6.041** / **18.05** | **Stat 110** + CS109 | **ST2131** + **ST2132** |
| Gradient saliency (input × gradient) | **CS231N** | 6.S191 | CS181 interpretability | CS5242 |
| Optional retrieval (neighbours, not fused) | CS224N retrieval | 6.861 | CS287 | CS4248 |

```mermaid
flowchart TB
    subgraph Stanford["Stanford"]
        S229["CS229  supervised ML"]
        S224["CS224N  NLP / Transformers"]
        S231["CS231N  saliency"]
        S109["CS109  bootstrap / reporting"]
    end

    subgraph MIT["MIT"]
        M036["6.036  ML"]
        M041["6.041 / 18.05  probability"]
        M191["6.S191  DL"]
    end

    subgraph Harvard["Harvard"]
        H181["CS181  ML"]
        H110["Stat 110  probability"]
    end

    subgraph NUS["NUS"]
        N3244["CS3244  ML"]
        N4248["CS4248  NLP"]
        N2132["ST2132  statistical inference"]
    end

    subgraph Repo["This capstone"]
        Prot["70/15/15  val select  test once"]
        Base["TF-IDF + logistic / NB / SVM"]
        Enc["DistilBERT fine-tune"]
        Inf["Bootstrap CI  McNemar"]
        XAI["Input x gradient"]
    end

    S229 --> Prot
    N3244 --> Prot
    M036 --> Prot
    H181 --> Prot
    S224 --> Enc
    N4248 --> Enc
    M191 --> Enc
    S224 --> Base
    N4248 --> Base
    S109 --> Inf
    N2132 --> Inf
    M041 --> Inf
    H110 --> Inf
    S231 --> XAI
```

**Figure T.0.** Same undergraduate/MSc ML stack, four course-number systems. Defence language: “hold-out like CS229/CS3244; encoder like CS224N/CS4248; inference like ST2132/CS109.”

---

## T.0b What lands in which file

| Syllabus topic | Instantiation |
|----------------|---------------|
| Binary labels \(y\in\{0,1\}\) | Fresh / Rotten |
| Hold-out generalisation | Test reported **once** |
| Stratified split | 70/15/15, seed 42 |
| Linear baselines | `baseline_tfidf.py` |
| Transformer fine-tune | `model_training.py` → `sentiment_model/` |
| Cross-entropy + AdamW | Hugging Face Trainer |
| Threshold \(\tau=0.5\) | Equal costs, balanced classes |
| F1, ROC, confusion rates | `evaluation.json` |
| Bootstrap 95% CI | `ml_core.py`, \(B=500\) |
| Paired test of two classifiers | McNemar + bootstrap \(\Delta\) on the **same** 7,500 rows |
| Saliency | `POST /api/explain` |
| Retrieval optional | Chroma; **not** fused into logits |

**Not in the syllabus of this repo.** MCP servers; SHAP/LIME as the live explainer; *k*-fold CV; claiming RAG improved F1.

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

**Figure T.1.** Theoretical framework of the capstone. CS229/CS3244 constrain the **protocol**; CS224N/CS4248 supply **two model families**; ST2132/CS109 turn logits into a reportable claim. Everything terminates in files examiners can open.

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

**Figure T.2.** Supervised classification as conditional probability + threshold (CS229 / CS181 / CS3244). Training minimises empirical risk on **train.csv only**. Test labels are used solely in `evaluate_model.py` / `STATS_REPORT.md`.

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

**Figure T.3.** Hold-out protocol (CS229, 6.036, CS3244). The test split estimates risk; it is not a tuning knob. Stratification keeps the 50/50 prior so accuracy is not an artefact of imbalance.

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

**Figure T.4.** Two feature geometries on the same \((x,y)\) (CS224N / CS4248). The paired test asks whether **error patterns** differ.

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

**Figure T.5.** TF-IDF + logistic regression is the **pre-registered** CS229/CS3244 baseline. Naïve Bayes and a margin SVM are nested comparators; calibrated SVM probabilities make Brier/ECE defined.

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

**Figure T.6.** Scaled dot-product attention as in CS224N / 6.S191, inside DistilBERT. We fine-tune Hugging Face weights; we do not re-implement attention. Truncation at 256 is ablated.

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

**Figure T.7.** CS224N-style transfer: a BERT-family student encoder, then IMDB fine-tune. This repo does not pre-train BERT-base.

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

**Figure T.8.** Cross-entropy as NLL of a two-class softmax (CS229). **Selection uses validation F1, never test F1** (CS3244 / 6.036).

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

**Figure T.9.** Default \(\tau=0.5\) is the equal-cost Bayes point on a balanced problem (CS229). The UI slider is **validation**; primary tables freeze \(\tau=0.5\) on test.

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

**Figure T.10.** Three questions from CS229 / CS181: (i) labels, (ii) ranking, (iii) calibration. Lead metrics: **test F1 + ROC-AUC**.

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

**Figure T.11.** Percentile bootstrap in `ml_core.py` (CS109 / 18.05 / ST2132). The interval is sampling variability of the **test estimator**. \(B=500\) is a compute compromise.

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

**Figure T.12.** Two complementary ST2132/CS109 tests. McNemar: do **error patterns** differ? Bootstrap \(\Delta\): does **metric magnitude** differ? On this split both fail to reject at 5%. **Report the tie.**

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

**Figure T.13.** High AUC can still be miscalibrated (CS229 evaluation). Insights plots the reliability diagram. Calibration is **reported**, not temperature-scaled at serve time by default.

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

**Figure T.14.** Live XAI is first-order **input × gradient** (CS231N saliency). Not SHAP, not integrated gradients. The UI lexicon fallback is labelled as a heuristic.

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

**Figure T.15.** LoRA is an **offline** CS224N-style PEFT comparator (`make lora-quick`). Serving still uses one DistilBERT checkpoint.

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

**Figure T.16.** Dense retrieval (CS224N / CS4248) as **display context**. Neighbours are not concatenated into DistilBERT, so we do not claim a retrieval-augmented **F1** gain.

---

## How to use this chapter in a defence

1. Show **T.0** — four schools, one stack.  
2. Protocol **T.3** — CS229 / CS3244 hold-out.  
3. Two geometries **T.4** — CS224N / CS4248.  
4. Tests **T.12** — ST2132 / CS109; say the models are **tied**.  
5. Point to `evaluation.json`.

---

*If a method is not in T.0, do not imply it was used. Course numbers are the syllabus names, not a claim that the author enrolled at those universities.*
