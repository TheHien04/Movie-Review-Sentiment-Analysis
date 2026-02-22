# API Documentation - Movie Review Sentiment Analysis

## Base URL
```
http://localhost:8000
```

## Table of Contents
1. [Health Check](#health-check)
2. [Single Prediction](#single-prediction)
3. [Batch Prediction (CSV)](#batch-prediction-csv)
4. [Confidence-Based Prediction](#confidence-based-prediction)
5. [Batch Export](#batch-export)
6. [Model Metrics](#model-metrics)
7. [Model Information](#model-information)
8. [Dataset Information](#dataset-information)

---

## Health Check

Check if the API is operational.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1706180400.123,
  "model_loaded": true,
  "cache_enabled": true,
  "rate_limit_enabled": true
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `500 Internal Server Error` - Service is down

---

## Single Prediction

Analyze sentiment for a single movie review.

**Endpoint:** `POST /api/predict`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "This movie was absolutely fantastic! The acting was superb."
}
```

**Response:**
```json
{
  "label": 1,
  "probability": 0.9845,
  "sentiment": "positive",
  "confidence": 0.9845
}
```

**Field Descriptions:**
- `label`: Integer (0 = negative, 1 = positive)
- `probability`: Float (0.0 to 1.0)
- `sentiment`: String ("positive" or "negative")
- `confidence`: Float (same as probability)

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid input
- `500 Internal Server Error` - Processing error

**Rate Limit:** 10 requests per minute per IP

---

## Batch Prediction (CSV)

Analyze multiple reviews from a CSV file.

**Endpoint:** `POST /api/predict`

**Headers:**
```
Content-Type: multipart/form-data
```

**Request:**
- Upload CSV file with `text` column
- Optional: Include `label` column for comparison

**CSV Format:**
```csv
text,label
"Great movie!",1
"Terrible waste of time.",0
```

**Response:**
```json
{
  "results": [
    {
      "text": "Great movie!",
      "label": 1,
      "probability": 0.9234
    },
    {
      "text": "Terrible waste of time.",
      "label": 0,
      "probability": 0.8891
    }
  ]
}
```

**Constraints:**
- Maximum file size: 10MB (configurable)
- Supported formats: CSV only
- Processing: Chunked (500 rows per chunk)

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid file or format
- `413 Payload Too Large` - File exceeds size limit
- `500 Internal Server Error` - Processing error

---

## Confidence-Based Prediction

Get prediction with minimum confidence threshold filtering.

**Endpoint:** `POST /api/predict/confidence`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "This movie had its moments but overall was disappointing.",
  "min_confidence": 0.8
}
```

**Response (Meets Threshold):**
```json
{
  "label": 0,
  "probability": 0.8542,
  "sentiment": "negative",
  "confidence": 0.8542,
  "meets_threshold": true,
  "min_confidence_required": 0.8
}
```

**Response (Below Threshold):**
```json
{
  "label": 0,
  "probability": 0.6234,
  "sentiment": "negative",
  "confidence": 0.6234,
  "meets_threshold": false,
  "min_confidence_required": 0.8,
  "warning": "Prediction confidence below threshold"
}
```

**Status Codes:**
- `200 OK` - Confidence meets threshold
- `206 Partial Content` - Prediction made but below confidence threshold
- `400 Bad Request` - Invalid parameters
- `500 Internal Server Error` - Processing error

---

## Batch Export

Process CSV and export results as downloadable CSV.

**Endpoint:** `POST /api/predict/batch/export`

**Headers:**
```
Content-Type: multipart/form-data
```

**Request:**
- Upload CSV file with `text` column

**Response:**
- File download: `predictions.csv`

**CSV Output Format:**
```csv
text,predicted_label,sentiment,confidence,original_label
"Great movie!",1,positive,0.9234,1
"Terrible.",0,negative,0.8891,0
```

**Status Codes:**
- `200 OK` - CSV file generated and returned
- `400 Bad Request` - Invalid file
- `500 Internal Server Error` - Processing error

---

## Model Metrics

Get model performance metrics on validation set.

**Endpoint:** `GET /api/metrics`

**Query Parameters:**
- `threshold` (optional): Decision threshold (default: 0.5)
  - Range: 0.0 to 1.0
  - Example: `/api/metrics?threshold=0.7`

**Response:**
```json
{
  "accuracy": 0.9156,
  "precision": 0.9087,
  "recall": 0.9234,
  "f1_score": 0.9160,
  "confusion_matrix": {
    "true_positives": 4532,
    "false_positives": 456,
    "true_negatives": 4398,
    "false_negatives": 378
  },
  "total_samples": 9764,
  "threshold": 0.5,
  "timestamp": 1706180400.123
}
```

**Caching:**
- Results cached for 10 minutes per threshold value
- Cache key: `metrics_{threshold}`

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid threshold
- `500 Internal Server Error` - Calculation error

---

## Model Information

Get detailed model metadata and configuration.

**Endpoint:** `GET /api/model-info`

**Response:**
```json
{
  "model": {
    "model_name": "distilbert-base-uncased",
    "model_type": "distilbert",
    "num_labels": 2,
    "vocab_size": 30522,
    "max_length": 512,
    "model_parameters": 66955010,
    "trainable_parameters": 66955010,
    "device": "cpu"
  },
  "training": {
    "model_dir": "/app/sentiment_model",
    "is_trained": true,
    "training_status": "trained"
  },
  "system": {
    "python_version": "3.9.18",
    "torch_version": "2.0.1",
    "cuda_available": false,
    "timestamp": 1706180400.123
  },
  "api": {
    "rate_limit_enabled": true,
    "cache_enabled": true,
    "max_file_size_mb": 10,
    "allowed_file_extensions": ["csv"]
  },
  "status": "operational"
}
```

**Caching:**
- Results cached for 1 hour

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Retrieval error

---

## Dataset Information

Get statistics about training and validation datasets.

**Endpoint:** `GET /api/dataset-info`

**Response:**
```json
{
  "total_samples": 50000,
  "train_samples": 40000,
  "val_samples": 8000,
  "test_samples": 2000,
  "positive_samples": 25143,
  "negative_samples": 24857,
  "class_distribution": {
    "positive": 0.5029,
    "negative": 0.4971
  },
  "average_review_length": 234.5,
  "min_review_length": 12,
  "max_review_length": 1024,
  "samples": [
    {
      "text": "Amazing movie with great acting...",
      "label": 1
    }
  ],
  "timestamp": 1706180400.123
}
```

**Caching:**
- Results cached for 1 hour

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Dataset files not found
- `500 Internal Server Error` - Processing error

---

## Error Responses

All endpoints may return standard error responses:

**400 Bad Request:**
```json
{
  "error": "Invalid JSON format",
  "details": "Expecting value: line 1 column 1 (char 0)"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**413 Payload Too Large:**
```json
{
  "error": "File too large. Maximum size: 10MB"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "details": "Model prediction failed"
}
```

---

## Rate Limiting

Default rate limits per IP address:
- **General endpoints:** 60 requests/minute
- **Prediction endpoints:** 10 requests/minute

Rate limit headers included in response:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1706180460
```

---

## CORS Policy

CORS enabled for:
- `http://localhost:8000`
- `http://localhost:8080`
- `http://127.0.0.1:8000`
- `http://127.0.0.1:8080`

Allowed methods: `GET`, `POST`, `OPTIONS`

Allowed headers: `Content-Type`

---

## Examples

### cURL Examples

**Single Prediction:**
```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "This movie was amazing!"}'
```

**Batch Prediction:**
```bash
curl -X POST http://localhost:8000/api/predict \
  -F "file=@reviews.csv"
```

**Metrics with Threshold:**
```bash
curl "http://localhost:8000/api/metrics?threshold=0.7"
```

**Model Information:**
```bash
curl http://localhost:8000/api/model-info
```

### Python Examples

```python
import requests

# Single prediction
response = requests.post(
    'http://localhost:8000/api/predict',
    json={'text': 'This movie was fantastic!'}
)
result = response.json()
print(f"Sentiment: {result['sentiment']}, Confidence: {result['confidence']:.2%}")

# Batch prediction
with open('reviews.csv', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/api/predict',
        files={'file': f}
    )
results = response.json()['results']
print(f"Processed {len(results)} reviews")

# Get metrics
response = requests.get('http://localhost:8000/api/metrics?threshold=0.8')
metrics = response.json()
print(f"Accuracy: {metrics['accuracy']:.2%}")
```

### JavaScript Examples

```javascript
// Single prediction
async function analyzeSentiment(text) {
  const response = await fetch('http://localhost:8000/api/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text })
  });
  
  const result = await response.json();
  console.log(`Sentiment: ${result.sentiment}, Confidence: ${(result.confidence * 100).toFixed(1)}%`);
}

// Batch prediction
async function analyzeBatch(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('http://localhost:8000/api/predict', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  console.log(`Processed ${data.results.length} reviews`);
}

// Get model info
async function getModelInfo() {
  const response = await fetch('http://localhost:8000/api/model-info');
  const info = await response.json();
  console.log('Model:', info.model.model_name);
  console.log('Parameters:', info.model.model_parameters.toLocaleString());
}
```

---

## Testing

Run API tests:
```bash
cd /path/to/project
source venv/bin/activate
pytest tests/test_api.py -v
```

---

## Support

For issues or questions:
- GitHub: [Movie-Review-Sentiment-Analysis](https://github.com/TheHien04/Movie-Review-Sentiment-Analysis)
- Documentation: `/docs/API.md`

---

**Version:** 3.0  
**Last Updated:** February 2026  
**Maintainer:** TheHien04
