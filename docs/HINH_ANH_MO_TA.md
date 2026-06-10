# Mô tả hình minh họa — Báo cáo môn Học Thống Kê

**Dự án:** CineSentiment — Phân loại cảm xúc đánh giá phim (IMDB)  
**Mô hình:** DistilBERT fine-tune, so sánh với baseline TF-IDF + logistic regression  
**Phiên bản hệ thống:** 2.3.0

Tài liệu này mô tả từng ảnh chụp giao diện theo chuẩn báo cáo DS/CS: mục đích, thành phần thống kê hoặc kỹ thuật, và cách trích dẫn trong luận văn/bài nộp.

---

## Hình 1 — Trang chủ: giới thiệu mô hình và chỉ số tổng quan

**Tệp:** `Images/home-landing-hero.jpg`

Giao diện landing trình bày bài toán phân loại nhị phân (Fresh / Rotten) trên văn bản đánh giá phim. Khối thông số hiển thị điểm ước lượng trên tập validation/test đã lưu trong `evaluation.json`: Accuracy ≈ 91,8%, F1 ≈ 91,8%, ROC-AUC ≈ 97,3%. Đây là lớp trình bày kết quả cho người dùng phi kỹ thuật; số liệu chính thức cho báo cáo nằm ở tập **test** (mục 3, `docs/STATS_REPORT.md`).

**Trích dẫn gợi ý:** *Hình 1. Giao diện trang chủ CineSentiment: tóm tắt hiệu năng mô hình DistilBERT trên dữ liệu IMDB.*

---

## Hình 2 — Trang chủ: luồng nghiệp vụ và khả năng hệ thống

**Tệp:** `Images/home-workflows.jpg`

Phần *Example Output* minh họa nhãn dự đoán kèm độ tin cậy. Lưới *Built for Real Workflows* mô tả các module: suy luận đơn lẻ và batch CSV, giải thích mô hình (XAI), so sánh A/B, API REST, preview thời gian thực, phân tích arc câu, và aspect-based sentiment. Đây là sơ đồ chức năng ứng dụng web bọc quanh pipeline ML đã huấn luyện.

**Trích dẫn gợi ý:** *Hình 2. Các luồng sử dụng: từ nhập liệu đến xuất báo cáo và tích hợp API.*

---

## Hình 3 — Phân tích đơn lẻ: nhập văn bản và draft inference

**Tệp:** `Images/analyze-single-review.jpg`

Trang *Analyze* cho phép nhập một đoạn review. Thanh *Live Draft* cập nhật nhãn và xác suất P(Fresh) khi gõ — minh họa inference latency thấp trên CPU/GPU. Nút *Rate this review* kích hoạt pipeline đầy đủ: dự đoán, XAI (gradient × input), tone arc, aspect ML.

**Trích dẫn gợi ý:** *Hình 3. Giao diện phân tích đơn lẻ với xem trước nhãn theo thời gian thực.*

---

## Hình 4 — Phân tích batch: upload CSV và bảng kết quả

**Tệp:** `Images/analyze-batch-csv.jpg`

Module batch đọc cột văn bản từ CSV, chạy suy luận hàng loạt và hiển thị bảng (review, verdict, confidence). Hỗ trợ SSE cho tiến trình dài. Phù hợp mô tả *throughput inference* và kiểm thử hồi quy trên mẫu `train_small.csv`.

**Trích dẫn gợi ý:** *Hình 4. Xử lý batch CSV và bảng kết quả phân loại.*

---

## Hình 5 — Nhập giọng nói (speech-to-text)

**Tệp:** `Images/analyze-voice-input.jpg`

Tích hợp Web Speech API: thu âm, hiển thị waveform, chuyển thành văn bản rồi đưa vào cùng pipeline sentiment. Minh họa đa phương thức nhập liệu (multimodal input ở tầng UI).

**Trích dẫn gợi ý:** *Hình 5. Nhập liệu bằng giọng nói trước bước phân loại.*

---

## Hình 6 — So sánh hai review: song song và XAI

**Tệp:** `Images/compare-side-by-side.jpg`

Trang *Compare* chạy hai suy luận độc lập. Mỗi panel: nhãn, độ tin cậy, và *top drivers* (input × gradient) — giải thích cục bộ theo token. Dùng để minh họa so sánh định tính giữa hai văn bản cùng độ dài.

**Trích dẫn gợi ý:** *Hình 6. So sánh song song hai review kèm attribution từng từ.*

---

## Hình 7 — So sánh hai review: biểu đồ confidence

**Tệp:** `Images/compare-charts.jpg`

Biểu đồ cột và donut so sánh P(Fresh) giữa Review A và Review B. Phần *Comparison Summary* tóm tắt bằng ngôn ngữ tự nhiên khi hai nhãn đối lập.

**Trích dẫn gợi ý:** *Hình 7. Trực quan hóa độ tin cậy dự đoán trong chế độ so sánh.*

---

## Hình 8 — Bảng điều khiển metrics: tổng quan dữ liệu

**Tệp:** `Images/metrics-dataset-overview.jpg`

Trang *Model Accuracy* mô tả protocol: hold-out 70/15/15, n = 50 000 mẫu gốc IMDB. Biểu đồ cột thể hiện |train| = 35 000, |val| = |test| = 7 500 — stratified, `random_state = 42`.

**Trích dẫn gợi ý:** *Hình 8. Phân hoạch tập huấn luyện, validation và test.*

---

## Hình 9 — So sánh mô hình và phân tích lỗi

**Tệp:** `Images/metrics-model-comparison.jpg`

Bảng so sánh **DistilBERT** vs **TF-IDF + logistic regression** trên cùng split test, kèm **khoảng tin cậy bootstrap 95%**. Dòng Δ báo chênh lệch theo đơn vị percentage point. Phần *Error analysis* liệt kê FP/FN mẫu (tối đa 30 dòng trên UI) phục vụ phân tích định tính lỗi.

**Trích dẫn gợi ý:** *Hình 9. So sánh điểm ước lượng và CI 95% giữa mô hình transformer và baseline cổ điển.*

---

## Hình 10 — Metrics validation và thống kê suy diễn

**Tệp:** `Images/metrics-validation-summary.jpg`

Thẻ metric (Accuracy, F1, Precision, Recall, ROC-AUC, AP) trên split **validation** với CI bootstrap. Khối *Statistical summary* liệt kê sensitivity, specificity, FPR, FNR, PPV, NPV, balanced accuracy — suy ra từ ma trận nhầm lẫn.

**Trích dẫn gợi ý:** *Hình 10. Chỉ số validation và các tỷ lệ suy ra từ confusion matrix.*

---

## Hình 11 — Ma trận nhầm lẫn, phân bố nhãn, so sánh metric

**Tệp:** `Images/metrics-confusion-label-bars.jpg`

Ba panel: (1) confusion matrix 2×2 trên validation (TN, FP, FN, TP); (2) biểu đồ donut cân bằng lớp 50/50; (3) biểu đồ cột các metric trên thang 0–100%. Thể hiện đồng thời calibration điểm cắt 0,5 và ranking quality (ROC-AUC cao).

**Trích dẫn gợi ý:** *Hình 11. Ma trận nhầm lẫn, cân bằng lớp và so sánh đa chỉ số trên validation.*

---

## Hình 12 — Modal chi tiết metrics

**Tệp:** `Images/metrics-detail-modal.jpg`

Hộp thoại *Metrics details*: bảng Accuracy, F1, Precision, Recall, ROC-AUC với cột CI 95% (bootstrap 500 lần, percentile). Split: validation, ngưỡng 0,5.

**Trích dẫn gợi ý:** *Hình 12. Bảng chi tiết chỉ số phân loại kèm khoảng tin cậy bootstrap.*

---

## Hình 13 — Modal chi tiết ma trận nhầm lẫn

**Tệp:** `Images/metrics-confusion-modal.jpg`

Hiển thị TN = 3 415, FP = 335, FN = 268, TP = 3 482 (validation, n = 7 500). Kèm sensitivity 92,85%, specificity 91,07%, balanced accuracy 91,96%.

**Trích dẫn gợi ý:** *Hình 13. Ma trận nhầm lẫn và các tỷ lệ TPR/TNR trên validation.*

---

## Hình 14 — Modal phân bố nhãn

**Tệp:** `Images/metrics-label-modal.jpg`

Bảng tần suất lớp: Rotten (0) và Fresh (1) mỗi lớp 3 750 mẫu (50%). Xác nhận stratified split không gây lệch lớp trên tập đánh giá.

**Trích dẫn gợi ý:** *Hình 14. Phân bố nhãn cân bằng trên tập validation.*

---

## Hình 15 — Summary & Actions: ngưỡng và xuất báo cáo

**Tệp:** `Images/metrics-summary-actions.jpg`

Tóm tắt n, ngưỡng quyết định 50%, tỷ lệ Rotten/Fresh. Thanh trượt cho phép khám phá trade-off precision–recall (recompute trên CPU). Nút xuất PDF và xem chi tiết metrics / confusion / label distribution.

**Trích dẫn gợi ý:** *Hình 15. Panel tổng kết đánh giá và điều chỉnh ngưỡng phân loại.*

---

## Hình 16 — Minh bạch mô hình và quy trình ba bước

**Tệp:** `Images/pricing-transparency.jpg`

Phần *Model transparency*: liên kết tới báo cáo thống kê, insights (ROC/PR/calibration), EDA. Quy trình Analyze → Compare → Integrate mô tả vòng đời sử dụng từ thí nghiệm đến triển khai API.

**Trích dẫn gợi ý:** *Hình 16. Minh bạch methodology và luồng tích hợp sản phẩm.*

---

## Liên kết tài liệu học thuật

| Tài liệu | Nội dung |
|----------|----------|
| [docs/STATS_REPORT.md](STATS_REPORT.md) | Kết quả test chính thức, CI bootstrap |
| [docs/METHODOLOGY.md](METHODOLOGY.md) | Quy trình thực nghiệm |
| [docs/MODEL_CARD.md](MODEL_CARD.md) | Thẻ mô hình |
| [notebooks/](notebooks/) | EDA, error analysis, so sánh mô hình |
| `make capstone` | Pipeline tái lập kết quả |
