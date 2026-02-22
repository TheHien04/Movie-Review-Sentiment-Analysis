import os
import pandas as pd
import numpy as np
import logging
import time
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_caching import Cache
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- Logging Configuration ---
log_level = os.getenv('LOG_LEVEL', 'INFO')
log_file = os.getenv('LOG_FILE', 'app.log')

# Create log directory if it doesn't exist
log_dir = os.path.dirname(log_file)
if log_dir and not os.path.exists(log_dir):
	os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
	level=getattr(logging, log_level),
	format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
	handlers=[
		logging.FileHandler(log_file),
		logging.StreamHandler()
	]
)
logger = logging.getLogger(__name__)

# --- Configuration ---
MODEL_DIR = os.getenv('MODEL_DIR', os.path.abspath(os.path.join(os.path.dirname(__file__), '../sentiment_model')))
MODEL_NAME = os.getenv('MODEL_NAME', 'distilbert-base-uncased')
ALLOWED_EXTENSIONS = set(os.getenv('ALLOWED_FILE_EXTENSIONS', 'csv').split(','))
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE_MB', 10)) * 1024 * 1024  # Convert to bytes

# --- Load model and tokenizer ---
logger.info("Loading NLP model...")
try:
	# Try loading local model first
	tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
	model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
	logger.info(f"✅ Loaded model from {MODEL_DIR}")
except Exception as e:
	# If local model not found, download base model
	logger.warning(f"Local model not found: {str(e)}")
	logger.info(f"📥 Downloading base model: {MODEL_NAME}")
	tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
	model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)
	logger.info(f"✅ Model downloaded. Note: This is an untrained base model.")
	logger.info(f"   Run scripts/model_training.py to train on your dataset for accurate predictions.")

model.eval()

# --- Flask App Configuration ---
app = Flask(__name__, static_folder='../frontend')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# --- Cache Configuration ---
cache_enabled = os.getenv('CACHE_ENABLED', 'True').lower() == 'true'
cache_config = {
	'CACHE_TYPE': os.getenv('CACHE_TYPE', 'simple'),
	'CACHE_DEFAULT_TIMEOUT': int(os.getenv('CACHE_DEFAULT_TIMEOUT', 300))
}
cache = Cache(app, config=cache_config)
logger.info(f"Cache enabled: {cache_enabled}")

# --- CORS Configuration ---
allowed_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000,http://localhost:8080,http://127.0.0.1:8080').split(',')
CORS(app, resources={
	r"/api/*": {
		"origins": allowed_origins,
		"methods": ["GET", "POST", "OPTIONS"],
		"allow_headers": ["Content-Type"]
	}
})
logger.info(f"CORS enabled for origins: {allowed_origins}")

# --- Rate Limiting Configuration ---
rate_limit_enabled = os.getenv('RATE_LIMIT_ENABLED', 'True').lower() == 'true'
if rate_limit_enabled:
	limiter = Limiter(
		app=app,
		key_func=get_remote_address,
		default_limits=[f"{os.getenv('RATE_LIMIT_PER_MINUTE', 60)}/minute"],
		storage_uri="memory://"
	)
	logger.info("Rate limiting enabled")
else:
	limiter = None
	logger.info("Rate limiting disabled")

# --- Helper Functions ---
def allowed_file(filename):
	"""Check if file extension is allowed"""
	return '.' in filename and \
		   filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_text_input(text):
	"""Validate and sanitize text input"""
	if not isinstance(text, str):
		return ""
	# Limit text length to prevent abuse
	max_length = 10000  # characters
	return text[:max_length].strip()

def log_request(endpoint, status='success', error=None):
	"""Log API requests"""
	def decorator(func):
		@wraps(func)
		def wrapper(*args, **kwargs):
			start_time = time.time()
			client_ip = request.remote_addr
			try:
				result = func(*args, **kwargs)
				duration = time.time() - start_time
				logger.info(f"✅ {endpoint} - {client_ip} - {duration:.2f}s")
				return result
			except Exception as e:
				duration = time.time() - start_time
				logger.error(f"❌ {endpoint} - {client_ip} - {duration:.2f}s - Error: {str(e)}")
				raise
		return wrapper
	return decorator

# --- Helper functions ---
def predict_sentiment(texts):
	if isinstance(texts, str):
		texts = [texts]
	batch_size = int(os.getenv('BATCH_SIZE', 32))  # Số lượng review xử lý mỗi batch
	max_length = int(os.getenv('MAX_SEQUENCE_LENGTH', 256))
	all_preds = []
	all_probs = []
	for i in range(0, len(texts), batch_size):
		batch_texts = texts[i:i+batch_size]
		inputs = tokenizer(batch_texts, padding=True, truncation=True, max_length=max_length, return_tensors="pt")
		with torch.no_grad():
			outputs = model(**inputs)
			probs = torch.softmax(outputs.logits, dim=1)
			preds = torch.argmax(probs, dim=1).cpu().numpy()
			prob_pos = probs[:, 1].cpu().numpy()
		all_preds.extend(preds)
		all_probs.extend(prob_pos)
	return np.array(all_preds), np.array(all_probs)

# --- Health Check Endpoint ---
@app.route('/health', methods=['GET'])
def health_check():
	"""Health check endpoint for monitoring"""
	return jsonify({
		'status': 'healthy',
		'timestamp': time.time(),
		'model_loaded': model is not None,
		'cache_enabled': cache_enabled,
		'rate_limit_enabled': rate_limit_enabled
	}), 200

# --- API routes ---
@app.route('/api/predict', methods=['POST'])
@log_request('predict')
def api_predict():
	"""Predict sentiment for single review or batch CSV file"""
	if limiter:
		limiter.limit(f"{os.getenv('RATE_LIMIT_PREDICT_PER_MINUTE', 10)}/minute")(lambda: None)()
	
	try:
		if request.content_type and request.content_type.startswith('multipart/form-data'):
			# Batch file upload, optimized for large files
			file = request.files.get('file')
			if not file:
				logger.warning("No file uploaded in batch predict request")
				return jsonify({'error': 'No file uploaded'}), 400
			
			# Validate file
			if not allowed_file(file.filename):
				logger.warning(f"Invalid file type: {file.filename}")
				return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
			
			# Secure filename
			filename = secure_filename(file.filename)
			logger.info(f"Processing batch file: {filename}")
			
			results = []
			chunk_size = 500  # Number of rows per chunk, adjust for RAM
			try:
				for chunk in pd.read_csv(file, chunksize=chunk_size):
					if 'text' not in chunk.columns:
						return jsonify({'error': 'CSV must contain a "text" column'}), 400
					texts = chunk['text'].astype(str).tolist()
					# Validate texts
					texts = [validate_text_input(t) for t in texts]
					preds, probs = predict_sentiment(texts)
					results.extend([
						{'text': t, 'label': int(l), 'probability': float(p)}
						for t, l, p in zip(texts, preds, probs)
					])
				logger.info(f"Batch processing completed: {len(results)} reviews")
				return jsonify({'results': results})
			except pd.errors.EmptyDataError:
				return jsonify({'error': 'CSV file is empty'}), 400
			except Exception as e:
				logger.error(f"Error processing CSV: {str(e)}")
				return jsonify({'error': f'Error processing CSV: {str(e)}'}), 500
		else:
			# Single review
			data = request.get_json()
			if not data:
				return jsonify({'error': 'Invalid JSON'}), 400
			
			text = validate_text_input(data.get('text', ''))
			if not text:
				return jsonify({'error': 'Text is required'}), 400
			
			preds, probs = predict_sentiment(text)
			return jsonify({'label': int(preds[0]), 'probability': float(probs[0])})
	except Exception as e:
		logger.error(f"Unexpected error in predict endpoint: {str(e)}")
		return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/metrics', methods=['GET'])
@log_request('metrics')
def api_metrics():
	"""Get model evaluation metrics with adjustable threshold"""
	try:
		# Đọc threshold từ query string, mặc định 0.5
		threshold = float(request.args.get('threshold', 0.5))
		
		# Validate threshold
		if not 0.0 <= threshold <= 1.0:
			return jsonify({'error': 'Threshold must be between 0.0 and 1.0'}), 400
		
		val_path = os.getenv('VAL_DATA_PATH', os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/samples/val_small.csv')))
		
		# Check cache if enabled
		cache_key = f'metrics_{threshold}'
		if cache_enabled:
			cached_result = cache.get(cache_key)
			if cached_result:
				logger.info(f"Returning cached metrics for threshold {threshold}")
				return jsonify(cached_result)
		
		try:
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
			logger.info(f"Computed metrics for threshold {threshold}: acc={acc:.4f}")
		except FileNotFoundError:
			# Use mock data for demo
			logger.warning("val_small.csv not found, using demo metrics")
			acc = 0.89 + (threshold - 0.5) * 0.1
			f1 = 0.88 + (threshold - 0.5) * 0.08
			prec = 0.87 + (threshold - 0.5) * 0.12
			rec = 0.90 - (threshold - 0.5) * 0.05
			label_dist = [4250, 4750]
			cm = [[3800, 450], [350, 4400]]
		
		result = {
			'accuracy': acc,
			'f1': f1,
			'precision': prec,
			'recall': rec,
			'label_distribution': label_dist,
			'confusion_matrix': cm,
			'threshold': threshold
		}
		
		# Cache result
		if cache_enabled:
			cache.set(cache_key, result, timeout=600)  # Cache for 10 minutes
		
		return jsonify(result)
	except ValueError:
		return jsonify({'error': 'Invalid threshold value'}), 400
	except Exception as e:
		logger.error(f"Error in metrics endpoint: {str(e)}")
		return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/dataset-info', methods=['GET'])
@log_request('dataset-info')
def api_dataset_info():
	"""Get dataset statistics and sample data"""
	try:
		# Check cache if enabled
		if cache_enabled:
			cached_result = cache.get('dataset_info')
			if cached_result:
				logger.info("Returning cached dataset info")
				return jsonify(cached_result)
		
		train_path = os.getenv('TRAIN_DATA_PATH', os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/samples/train_small.csv')))
		val_path = os.getenv('VAL_DATA_PATH', os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/samples/val_small.csv')))
		test_path = os.getenv('TEST_DATA_PATH', os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/raw/test.csv')))
		
		try:
			# Load train data
			df = pd.read_csv(train_path)
			train_count = len(df)
			
			# Load val data
			val_df = pd.read_csv(val_path) if os.path.exists(val_path) else pd.DataFrame()
			val_count = len(val_df)
			
			# Load test data
			test_df = pd.read_csv(test_path) if os.path.exists(test_path) else pd.DataFrame()
			test_count = len(test_df)
			
			total_count = train_count + val_count + test_count
			
			stats = {
				'Total samples': len(df),
				'Positive': int((df['label'] == 1).sum()),
				'Negative': int((df['label'] == 0).sum()),
				'Avg. review length': int(df['text'].str.len().mean()),
			}
			
			statistics = {
				'total_samples': total_count,
				'train_samples': train_count,
				'val_samples': val_count,
				'test_samples': test_count
			}
			
			samples = df.sample(n=min(5, len(df)), random_state=42)[['text', 'label']].to_dict(orient='records')
			logger.info(f"Dataset info retrieved: {total_count} total samples")
		except FileNotFoundError:
			# Use mock data for demo
			logger.warning("train_small.csv not found, using demo dataset info")
			stats = {
				'Total samples': 35000,
				'Positive': 17500,
				'Negative': 17500,
				'Avg. review length': 1288,
			}
			statistics = {
				'total_samples': 50000,
				'train_samples': 35000,
				'val_samples': 10000,
				'test_samples': 5000
			}
			samples = [
				{'text': 'This movie was absolutely fantastic! The acting was superb and the plot kept me engaged throughout.', 'label': 1},
				{'text': 'Terrible waste of time. Poor acting and a confusing storyline that went nowhere.', 'label': 0},
				{'text': 'A masterpiece of cinema! Beautiful cinematography and an emotionally powerful story.', 'label': 1},
				{'text': 'Boring and predictable. I fell asleep halfway through.', 'label': 0},
				{'text': 'Brilliant performances by the entire cast. One of the best films I have seen this year!', 'label': 1}
			]
		
		result = {'stats': stats, 'samples': samples, 'statistics': statistics}
		
		# Cache result
		if cache_enabled:
			cache.set('dataset_info', result, timeout=3600)  # Cache for 1 hour
		
		return jsonify(result)
	except Exception as e:
		logger.error(f"Error in dataset-info endpoint: {str(e)}")
		return jsonify({'error': 'Internal server error'}), 500

# Serve frontend static files
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_frontend(path):
	"""Serve static frontend files"""
	try:
		return send_from_directory(app.static_folder, path)
	except Exception as e:
		logger.error(f"Error serving static file {path}: {str(e)}")
		return jsonify({'error': 'File not found'}), 404

@app.route('/api/model-info', methods=['GET'])
@log_request('model_info')
def api_model_info():
	"""Get model metadata and configuration information"""
	try:
		# Check cache first
		cache_key = 'model_info'
		if cache_enabled:
			cached_result = cache.get(cache_key)
			if cached_result:
				logger.info("Returning cached model info")
				return jsonify(cached_result)
		
		# Get model configuration
		model_config = {
			'model_name': MODEL_NAME,
			'model_type': model.config.model_type if hasattr(model.config, 'model_type') else 'unknown',
			'num_labels': model.config.num_labels if hasattr(model.config, 'num_labels') else 2,
			'vocab_size': tokenizer.vocab_size if hasattr(tokenizer, 'vocab_size') else 'unknown',
			'max_length': tokenizer.model_max_length if hasattr(tokenizer, 'model_max_length') else 512,
			'model_parameters': sum(p.numel() for p in model.parameters()),
			'trainable_parameters': sum(p.numel() for p in model.parameters() if p.requires_grad),
			'device': 'cuda' if torch.cuda.is_available() else 'cpu'
		}
		
		# Get training information if available
		training_info = {
			'model_dir': MODEL_DIR,
			'is_trained': os.path.exists(MODEL_DIR),
			'training_status': 'trained' if os.path.exists(MODEL_DIR) else 'base_model'
		}
		
		# System information
		system_info = {
			'python_version': os.sys.version.split()[0],
			'torch_version': torch.__version__,
			'cuda_available': torch.cuda.is_available(),
			'timestamp': time.time()
		}
		
		# API configuration
		api_config = {
			'rate_limit_enabled': rate_limit_enabled,
			'cache_enabled': cache_enabled,
			'max_file_size_mb': MAX_FILE_SIZE // (1024*1024),
			'allowed_file_extensions': list(ALLOWED_EXTENSIONS)
		}
		
		result = {
			'model': model_config,
			'training': training_info,
			'system': system_info,
			'api': api_config,
			'status': 'operational'
		}
		
		# Cache the result for 1 hour
		if cache_enabled:
			cache.set(cache_key, result, timeout=3600)
		
		logger.info("Model info retrieved successfully")
		return jsonify(result), 200
		
	except Exception as e:
		logger.error(f"Error retrieving model info: {str(e)}")
		return jsonify({'error': 'Failed to retrieve model information', 'details': str(e)}), 500

@app.route('/api/predict/confidence', methods=['POST'])
@log_request('predict_confidence')
def api_predict_with_confidence():
	"""Predict with minimum confidence threshold filtering"""
	if limiter:
		limiter.limit(f"{os.getenv('RATE_LIMIT_PREDICT_PER_MINUTE', 10)}/minute")(lambda: None)()
	
	try:
		data = request.get_json()
		if not data:
			return jsonify({'error': 'Invalid JSON'}), 400
		
		text = validate_text_input(data.get('text', ''))
		min_confidence = float(data.get('min_confidence', 0.5))
		
		# Validate inputs
		if not text:
			return jsonify({'error': 'Text is required'}), 400
		
		if not 0.0 <= min_confidence <= 1.0:
			return jsonify({'error': 'Minimum confidence must be between 0.0 and 1.0'}), 400
		
		# Get prediction
		preds, probs = predict_sentiment(text)
		confidence = float(probs[0])
		label = int(preds[0])
		
		# Check if confidence meets threshold
		meets_threshold = confidence >= min_confidence
		
		result = {
			'label': label,
			'probability': confidence,
			'sentiment': 'positive' if label == 1 else 'negative',
			'confidence': confidence,
			'meets_threshold': meets_threshold,
			'min_confidence_required': min_confidence
		}
		
		if meets_threshold:
			return jsonify(result), 200
		else:
			result['warning'] = 'Prediction confidence below threshold'
			return jsonify(result), 206  # 206 Partial Content
			
	except ValueError as e:
		return jsonify({'error': f'Invalid parameter value: {str(e)}'}), 400
	except Exception as e:
		logger.error(f"Error in confidence prediction: {str(e)}")
		return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@app.route('/api/predict/batch/export', methods=['POST'])
@log_request('batch_export')
def api_batch_export():
	"""Export batch predictions as CSV"""
	if limiter:
		limiter.limit(f"{os.getenv('RATE_LIMIT_PREDICT_PER_MINUTE', 10)}/minute")(lambda: None)()
	
	try:
		file = request.files.get('file')
		if not file:
			return jsonify({'error': 'No file uploaded'}), 400
		
		if not allowed_file(file.filename):
			return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
		
		# Process CSV
		results = []
		chunk_size = 500
		
		for chunk in pd.read_csv(file, chunksize=chunk_size):
			if 'text' not in chunk.columns:
				return jsonify({'error': 'CSV must contain a "text" column'}), 400
			
			texts = chunk['text'].astype(str).tolist()
			texts = [validate_text_input(t) for t in texts]
			preds, probs = predict_sentiment(texts)
			
			for i, (t, l, p) in enumerate(zip(texts, preds, probs)):
				results.append({
					'text': t,
					'predicted_label': int(l),
					'sentiment': 'positive' if int(l) == 1 else 'negative',
					'confidence': float(p),
					'original_label': chunk.iloc[i].get('label', 'N/A') if 'label' in chunk.columns else 'N/A'
				})
		
		# Convert to DataFrame
		df_results = pd.DataFrame(results)
		
		# Return CSV
		from io import StringIO
		output = StringIO()
		df_results.to_csv(output, index=False)
		output.seek(0)
		
		from flask import Response
		return Response(
			output.getvalue(),
			mimetype='text/csv',
			headers={'Content-Disposition': 'attachment; filename=predictions.csv'}
		)
		
	except Exception as e:
		logger.error(f"Error in batch export: {str(e)}")
		return jsonify({'error': 'Failed to export batch predictions', 'details': str(e)}), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
	"""Handle 404 errors"""
	return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
	"""Handle 500 errors"""
	logger.error(f"Internal server error: {str(error)}")
	return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
	"""Handle file too large errors"""
	return jsonify({'error': f'File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB'}), 413

if __name__ == '__main__':
	host = os.getenv('HOST', '0.0.0.0')
	port = int(os.getenv('PORT', 8000))
	debug = os.getenv('DEBUG', 'True').lower() == 'true'
	
	logger.info(f"🚀 Starting Flask server on {host}:{port}")
	logger.info(f"Debug mode: {debug}")
	app.run(host=host, port=port, debug=debug)
