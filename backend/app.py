import os
import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix

# --- Load model and tokenizer ---
MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../sentiment_model'))
tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
model.eval()

app = Flask(__name__, static_folder='../frontend')
CORS(app)

# --- Helper functions ---
def predict_sentiment(texts):
	if isinstance(texts, str):
		texts = [texts]
	batch_size = 32  # Số lượng review xử lý mỗi batch, có thể chỉnh lên/xuống tùy RAM
	all_preds = []
	all_probs = []
	for i in range(0, len(texts), batch_size):
		batch_texts = texts[i:i+batch_size]
		inputs = tokenizer(batch_texts, padding=True, truncation=True, max_length=256, return_tensors="pt")
		with torch.no_grad():
			outputs = model(**inputs)
			probs = torch.softmax(outputs.logits, dim=1)
			preds = torch.argmax(probs, dim=1).cpu().numpy()
			prob_pos = probs[:, 1].cpu().numpy()
		all_preds.extend(preds)
		all_probs.extend(prob_pos)
	return np.array(all_preds), np.array(all_probs)

# --- API routes ---
@app.route('/api/predict', methods=['POST'])
def api_predict():
	if request.content_type and request.content_type.startswith('multipart/form-data'):
		# Batch file upload, optimized for large files
		file = request.files.get('file')
		if not file:
			return jsonify({'error': 'No file uploaded'}), 400
		results = []
		chunk_size = 500  # Number of rows per chunk, adjust for RAM
		for chunk in pd.read_csv(file, chunksize=chunk_size):
			texts = chunk['text'].astype(str).tolist()
			preds, probs = predict_sentiment(texts)
			results.extend([
				{'text': t, 'label': int(l), 'probability': float(p)}
				for t, l, p in zip(texts, preds, probs)
			])
		return jsonify({'results': results})
	else:
		# Single review
		data = request.get_json()
		text = data.get('text', '')
		preds, probs = predict_sentiment(text)
		return jsonify({'label': int(preds[0]), 'probability': float(probs[0])})

@app.route('/api/metrics', methods=['GET'])
def api_metrics():
	# Đọc threshold từ query string, mặc định 0.5
	threshold = float(request.args.get('threshold', 0.5))
	val_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../val_small.csv'))
	df = pd.read_csv(val_path)
	texts = df['text'].astype(str).tolist()
	y_true = df['label'].values
	_, probs = predict_sentiment(texts)
	# Phân loại lại theo threshold
	y_pred = (probs >= threshold).astype(int)
	acc = accuracy_score(y_true, y_pred)
	f1 = f1_score(y_true, y_pred)
	prec = precision_score(y_true, y_pred)
	rec = recall_score(y_true, y_pred)
	label_dist = [int(np.sum(y_true == 0)), int(np.sum(y_true == 1))]
	cm = confusion_matrix(y_true, y_pred).tolist()
	return jsonify({
		'accuracy': acc,
		'f1': f1,
		'precision': prec,
		'recall': rec,
		'label_distribution': label_dist,
		'confusion_matrix': cm,
		'threshold': threshold
	})

@app.route('/api/dataset-info', methods=['GET'])
def api_dataset_info():
	train_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../train.csv'))
	df = pd.read_csv(train_path)
	stats = {
		'Total samples': len(df),
		'Positive': int((df['label'] == 1).sum()),
		'Negative': int((df['label'] == 0).sum()),
		'Avg. review length': int(df['text'].str.len().mean()),
	}
	samples = df.sample(n=5, random_state=42)[['text', 'label']].to_dict(orient='records')
	return jsonify({'stats': stats, 'samples': samples})

# Serve frontend static files
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_frontend(path):
	return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
	app.run(host='0.0.0.0', port=5000, debug=True)
