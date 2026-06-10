# CineSentiment — Phân loại cảm xúc đánh giá phim (IMDB)

[![CI](https://github.com/TheHien04/Movie-Review-Sentiment-Analysis/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/TheHien04/Movie-Review-Sentiment-Analysis/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)

Ứng dụng học máy và kỹ thuật phần mềm cho **môn Học Thống Kê / Statistical Machine Learning**: phân loại nhị phân đánh giá phim (Fresh vs Rotten) bằng **DistilBERT** fine-tune, đánh giá bằng chỉ số có **khoảng tin cậy bootstrap 95%**, so sánh với baseline **TF-IDF + logistic regression**, và triển khai qua API REST cùng giao diện web.

**Tác giả:** The Hien · **Phiên bản:** 2.3.0 · **Giấy phép:** MIT

---

## Tóm tắt

| Hạng mục | Nội dung |
|----------|----------|
| Bài toán | Phân loại sentiment nhị phân trên review phim tiếng Anh |
| Dữ liệu | IMDB 50 000 mẫu, chia 70% / 15% / 15% (stratified, seed 42) |
| Mô hình chính | DistilBERT (`distilbert-base-uncased`) fine-tune |
| Baseline | TF-IDF + logistic regression (cùng protocol) |
| Kết quả test (n = 7 500) | Accuracy 91,76%, F1 91,80%, ROC-AUC 97,35% |
| Bất định | Bootstrap 500 lần, percentile CI 95% |
| Kiểm định | McNemar (DistilBERT vs TF-IDF) — báo cáo trong `docs/STATS_REPORT.md` |

Tài liệu thống kê đầy đủ: [docs/STATS_REPORT.md](docs/STATS_REPORT.md) · Phương pháp: [docs/METHODOLOGY.md](docs/METHODOLOGY.md) · Mô tả từng hình: [docs/HINH_ANH_MO_TA.md](docs/HINH_ANH_MO_TA.md)

---

## Câu hỏi nghiên cứu

Một bộ phân loại **DistilBERT** fine-tune có dự đoán sentiment review phim trên **tập test hold-out** với hiệu năng báo cáo được (điểm ước lượng + CI) và có vượt baseline cổ điển **TF-IDF + logistic regression** trên cùng phân hoạch dữ liệu hay không?

---

## Minh họa hệ thống (screenshots)

Mỗi hình kèm chú thích học thuật; mô tả chi tiết bằng tiếng Việt: [docs/HINH_ANH_MO_TA.md](docs/HINH_ANH_MO_TA.md).

### Giao diện người dùng

**Hình 1.** Trang chủ — tóm tắt bài toán và chỉ số hiệu năng mô hình trên IMDB.

![Trang chủ — hero và chỉ số mô hình](Images/home-landing-hero.jpg)

**Hình 2.** Trang chủ — ví dụ đầu ra và các luồng nghiệp vụ (đơn lẻ, batch, XAI, so sánh, API).

![Trang chủ — workflows](Images/home-workflows.jpg)

**Hình 3.** Phân tích đơn lẻ — nhập review, live draft inference, Rottenmeter.

![Phân tích đơn lẻ](Images/analyze-single-review.jpg)

**Hình 4.** Phân tích batch — upload CSV, bảng verdict và confidence, xuất CSV/Excel.

![Phân tích batch CSV](Images/analyze-batch-csv.jpg)

**Hình 5.** Nhập liệu giọng nói — speech-to-text trước bước phân loại.

![Voice input](Images/analyze-voice-input.jpg)

**Hình 6.** So sánh hai review — nhãn, confidence, attribution theo token (input × gradient).

![So sánh song song](Images/compare-side-by-side.jpg)

**Hình 7.** So sánh hai review — biểu đồ confidence và tóm tắt đối lập Fresh/Rotten.

![Biểu đồ so sánh](Images/compare-charts.jpg)

### Đánh giá mô hình và thống kê

**Hình 8.** Tổng quan dữ liệu — quy mô train / validation / test (35k / 7,5k / 7,5k).

![Tổng quan dataset](Images/metrics-dataset-overview.jpg)

**Hình 9.** So sánh DistilBERT vs TF-IDF trên test, kèm CI 95% và error analysis (FP/FN).

![So sánh mô hình](Images/metrics-model-comparison.jpg)

**Hình 10.** Chỉ số validation, statistical summary (sensitivity, specificity, PPV, NPV).

![Validation metrics](Images/metrics-validation-summary.jpg)

**Hình 11.** Confusion matrix, phân bố nhãn (50/50), biểu đồ so sánh metric.

![Confusion matrix và biểu đồ](Images/metrics-confusion-label-bars.jpg)

**Hình 12–14.** Modal chi tiết: metrics, confusion matrix, phân bố nhãn (bootstrap CI).

| Metrics | Confusion | Label distribution |
|---------|-----------|-------------------|
| ![Metrics modal](Images/metrics-detail-modal.jpg) | ![Confusion modal](Images/metrics-confusion-modal.jpg) | ![Label modal](Images/metrics-label-modal.jpg) |

**Hình 15.** Summary & Actions — ngưỡng 0,5, xuất PDF, xem chi tiết.

![Summary and actions](Images/metrics-summary-actions.jpg)

**Hình 16.** Minh bạch methodology và quy trình Analyze → Compare → Integrate.

![Pricing và transparency](Images/pricing-transparency.jpg)

---

## Cài đặt và tái lập kết quả

```bash
git clone https://github.com/TheHien04/Movie-Review-Sentiment-Analysis.git
cd Movie-Review-Sentiment-Analysis
make install
make capstone    # baseline → train → evaluate → tests → báo cáo
make serve       # http://127.0.0.1:8000
```

Pipeline capstone ghi log tái lập: `artifacts/results/capstone_run_log.json`.

Trước khi push: `make github-check`

---

## Cấu trúc dự án

| Thư mục | Vai trò |
|---------|---------|
| `backend/` | Flask API, inference, ML core |
| `frontend/` | Giao diện cinema (HTML/JS) |
| `scripts/` | Huấn luyện, đánh giá, baseline, kiểm định giả thuyết |
| `notebooks/` | EDA, error analysis, so sánh mô hình (nbconvert → HTML) |
| `artifacts/results/` | `evaluation.json`, báo cáo, biểu đồ |
| `docs/` | Methodology, stats report, model card, mô tả hình |
| `tests/` | 102+ pytest (API, capstone, modern stack) |

Chi tiết: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

## API chính

| Endpoint | Mô tả |
|----------|--------|
| `GET /health` | Trạng thái dịch vụ và model |
| `POST /api/predict` | Suy luận đơn hoặc batch CSV |
| `GET /api/metrics` | Metric theo split và ngưỡng |
| `GET /api/model-comparison` | Bảng so sánh mô hình |
| `GET /artifacts/results/evaluation.json` | Artifact đánh giá đầy đủ |

OpenAPI: `/api/docs` · File: [docs/openapi.yaml](docs/openapi.yaml)

---

## Kiểm thử

```bash
make test                 # pytest toàn bộ
make e2e-playwright       # E2E trình duyệt (tùy chọn)
```

---

## Tài liệu học thuật

| Tài liệu | Mục đích |
|----------|----------|
| [docs/STATS_REPORT.md](docs/STATS_REPORT.md) | Bảng kết quả test, CI, confusion matrix |
| [docs/METHODOLOGY.md](docs/METHODOLOGY.md) | Thiết kế thực nghiệm |
| [docs/MODEL_CARD.md](docs/MODEL_CARD.md) | Thẻ mô hình |
| [docs/DEFENSE_SLIDE_LIMITATIONS.md](docs/DEFENSE_SLIDE_LIMITATIONS.md) | Hạn chế (McNemar, chọn DistilBERT) |
| [docs/HINH_ANH_MO_TA.md](docs/HINH_ANH_MO_TA.md) | Chú thích từng screenshot |
| [docs/SILICON_VALLEY_STACK.md](docs/SILICON_VALLEY_STACK.md) | MLflow, RAG, K8s (mở rộng SE) |

---

## Trích dẫn

```bibtex
@misc{cinesentiment2026,
  author = {The Hien},
  title  = {CineSentiment: IMDB Movie Review Sentiment Analysis with DistilBERT},
  year   = {2026},
  url    = {https://github.com/TheHien04/Movie-Review-Sentiment-Analysis}
}
```

---

**Môn học:** Học Thống Kê / Statistical Machine Learning — Đồ án cuối kỳ  
**Cập nhật:** June 2026
