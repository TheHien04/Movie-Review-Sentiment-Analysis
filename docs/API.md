# API Documentation - Movie Review Sentiment Analysis

## Overview

RESTful API for movie review sentiment analysis powered by DistilBERT transformer model. All responses are JSON-formatted.

## Base URL

```
http://localhost:8000/api
```

## Authentication

Currently no authentication required (local development). For production, implement API key or token-based authentication.

## Response Format

All successful responses return HTTP 200 with JSON:
```json
{
  "status": "success",
  "data": { ... }
}
```

Error responses return appropriate HTTP status with:
```json
{
  "status": "error",
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

---

## Endpoints

### 1. Predict Sentiment (Single Review)

**POST** `/api/predict`

Analyze sentiment of a single movie review.

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "text": "This movie was absolutely amazing with great cinematography!"
}
```

#### Parameters

| Parameter | Type | Required | Description | Max Length |
|-----------|------|----------|-------------|------------|
| `text` | string | Yes | Movie review text | 2000 chars |

#### Response

**Status:** 200 OK

```json
{
  "prediction": "positive",
  "label": 1,
  "confidence": 0.9823,
  "probability": 0.9823,
  "model_version": "1.0"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `prediction` | string | Sentiment label: "positive" or "negative" |
| `label` | integer | 0 = negative, 1 = positive |
| `confidence` | float | Confidence score (0.0-1.0) |
| `probability` | float | Probability of positive sentiment |
| `model_version` | string | Model version used |

#### Example cURL

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "Great movie!"}'
```

#### Example JavaScript

```javascript
const response = await fetch('http://localhost:8000/api/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "Excellent film!" })
});
const data = await response.json();
console.log(data.prediction);  // "positive"
```

---

### 2. Batch Predict (CSV File Upload)

**POST** `/api/predict` (with file)

Analyze sentiment of multiple reviews from a CSV file.

#### Request

**Headers:**
```
Content-Type: multipart/form-data
```

**Form Data:**
```
file: <CSV_FILE>
```

#### CSV Format

File must be CSV with `review` column:

```csv
review
This movie was fantastic!
I didn't enjoy it
Best film of the year
Terrible acting
```

#### Response

**Status:** 200 OK

```json
{
  "results": [
    {
      "review": "This movie was fantastic!",
      "prediction": "positive",
      "confidence": 0.987
    },
    {
      "review": "I didn't enjoy it",
      "prediction": "negative",
      "confidence": 0.876
    }
  ],
  "total": 2,
  "download_url": "/download/results_2025_02_06_123456.csv"
}
```

#### Constraints

| Constraint | Value |
|-----------|-------|
| Max file size | 10 MB |
| Max rows | 10,000 |
| Supported formats | CSV, TXT |
| Processing timeout | 300 seconds |

#### Example cURL

```bash
curl -X POST http://localhost:8000/api/predict \
  -F "file=@reviews.csv"
```

#### Example JavaScript

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:8000/api/predict', {
  method: 'POST',
  body: formData
});
const data = await response.json();
```

---

### 3. Get Model Metrics

**GET** `/api/metrics`

Retrieve comprehensive model evaluation metrics and dataset statistics.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | float | 0.5 | Classification threshold (0.0-1.0) |

#### Response

**Status:** 200 OK

```json
{
  "metrics": {
    "accuracy": 0.8901,
    "f1_score": 0.8856,
    "precision": 0.8734,
    "recall": 0.8985,
    "threshold": 0.5
  },
  "confusion_matrix": [
    [3800, 450],
    [350, 4400]
  ],
  "label_distribution": {
    "negative": 17500,
    "positive": 17500
  },
  "model_info": {
    "name": "distilbert-base-uncased",
    "version": "1.0",
    "training_samples": 35000
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `accuracy` | float | Overall accuracy (0.0-1.0) |
| `f1_score` | float | F1 score (0.0-1.0) |
| `precision` | float | Precision (0.0-1.0) |
| `recall` | float | Recall/Sensitivity (0.0-1.0) |
| `confusion_matrix` | array | [[TN, FP], [FN, TP]] |
| `label_distribution` | object | Count per sentiment label |
| `threshold` | float | Classification threshold used |

#### Example cURL

```bash
# Default threshold (0.5)
curl http://localhost:8000/api/metrics

# Custom threshold
curl "http://localhost:8000/api/metrics?threshold=0.6"
```

#### Example JavaScript

```javascript
const response = await fetch('http://localhost:8000/api/metrics?threshold=0.5');
const data = await response.json();
console.log(`Accuracy: ${data.metrics.accuracy * 100}%`);
```

---

### 4. Get Dataset Information

**GET** `/api/dataset`

Get dataset statistics and sample data.

#### Query Parameters

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `limit` | integer | 5 | 100 |
| `offset` | integer | 0 | N/A |

#### Response

**Status:** 200 OK

```json
{
  "total_samples": 35000,
  "samples": [
    {
      "id": 1,
      "review": "Great movie with amazing cast",
      "label": "positive"
    },
    {
      "id": 2,
      "review": "Boring and slow",
      "label": "negative"
    }
  ],
  "label_counts": {
    "positive": 17500,
    "negative": 17500
  }
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "status": "error",
  "error": "Missing required field: text",
  "code": "INVALID_INPUT"
}
```

### 413 Payload Too Large

```json
{
  "status": "error",
  "error": "File size exceeds 10MB limit",
  "code": "FILE_TOO_LARGE"
}
```

### 415 Unsupported Media Type

```json
{
  "status": "error",
  "error": "Only CSV files are supported",
  "code": "INVALID_FILE_TYPE"
}
```

### 500 Internal Server Error

```json
{
  "status": "error",
  "error": "Model inference failed",
  "code": "INFERENCE_ERROR"
}
```

## Status Codes

| Code | Meaning | Cause |
|------|---------|-------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input parameters |
| 413 | Payload Too Large | File exceeds size limit |
| 415 | Unsupported Media Type | Invalid file format |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Model not loaded |

## Rate Limiting

**Development:** No limit (localhost only)

**Production:** 
- 100 requests per minute per IP
- 1000 requests per day

Headers returned:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707471600
```

## Performance

| Metric | Value |
|--------|-------|
| Avg response time (single) | 50-100ms |
| Avg response time (batch/100) | 5-10 seconds |
| Model inference speed | 100-200 reviews/sec |
| Memory usage | ~1GB with model loaded |

## Examples

### Python

```python
import requests
import json

# Single prediction
url = "http://localhost:8000/api/predict"
payload = {"text": "Best movie ever!"}
response = requests.post(url, json=payload)
result = response.json()
print(f"Prediction: {result['prediction']}")

# Batch with file
files = {'file': open('reviews.csv', 'rb')}
response = requests.post(url, files=files)
results = response.json()
```

### JavaScript

```javascript
// Single prediction
async function predictSentiment(text) {
  const response = await fetch('http://localhost:8000/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return await response.json();
}

const result = await predictSentiment("Amazing film!");
console.log(result.prediction);
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2025 | Initial release |

## Support

For API issues:
1. Check error code and description
2. Verify input format
3. Check server logs
4. Open GitHub issue

---

**Last Updated:** February 2025  
**API Status:** Stable
