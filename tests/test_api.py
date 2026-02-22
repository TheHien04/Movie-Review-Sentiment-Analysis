"""
Unit tests for API endpoints
"""
import pytest
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestPredictAPI:
    """Test /api/predict endpoint"""
    
    def test_predict_single_review_positive(self, client):
        """Test predicting positive sentiment"""
        response = client.post('/api/predict',
                               json={'text': 'This movie was absolutely fantastic! Amazing acting and plot.'},
                               content_type='application/json')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'label' in data
        assert 'probability' in data
        assert isinstance(data['label'], int)
        assert 0 <= data['probability'] <= 1
    
    def test_predict_single_review_negative(self, client):
        """Test predicting negative sentiment"""
        response = client.post('/api/predict',
                               json={'text': 'Terrible movie. Waste of time. Very disappointing.'},
                               content_type='application/json')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'label' in data
        assert 'probability' in data
    
    def test_predict_empty_text(self, client):
        """Test with empty text"""
        response = client.post('/api/predict',
                               json={'text': ''},
                               content_type='application/json')
        assert response.status_code == 200  # Should still return prediction
    
    def test_predict_missing_text_field(self, client):
        """Test with missing text field"""
        response = client.post('/api/predict',
                               json={},
                               content_type='application/json')
        assert response.status_code == 200  # Gets empty string as default


class TestMetricsAPI:
    """Test /api/metrics endpoint"""
    
    def test_metrics_default_threshold(self, client):
        """Test metrics with default threshold"""
        response = client.get('/api/metrics')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'accuracy' in data
        assert 'f1' in data
        assert 'precision' in data
        assert 'recall' in data
        assert 'confusion_matrix' in data
        assert 'label_distribution' in data
        assert data['threshold'] == 0.5
    
    def test_metrics_custom_threshold(self, client):
        """Test metrics with custom threshold"""
        response = client.get('/api/metrics?threshold=0.7')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['threshold'] == 0.7
        assert 0 <= data['accuracy'] <= 1
        assert 0 <= data['f1'] <= 1
    
    def test_metrics_extreme_thresholds(self, client):
        """Test metrics with extreme thresholds"""
        for threshold in [0.1, 0.9]:
            response = client.get(f'/api/metrics?threshold={threshold}')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['threshold'] == threshold


class TestDatasetAPI:
    """Test /api/dataset-info endpoint"""
    
    def test_dataset_info(self, client):
        """Test dataset info endpoint"""
        response = client.get('/api/dataset-info')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'stats' in data
        assert 'samples' in data
        assert 'statistics' in data
        
        # Check stats structure
        stats = data['stats']
        assert 'Total samples' in stats
        assert 'Positive' in stats
        assert 'Negative' in stats
        assert 'Avg. review length' in stats
        
        # Check samples
        assert isinstance(data['samples'], list)
        assert len(data['samples']) > 0
        
        # Check statistics
        statistics = data['statistics']
        assert 'total_samples' in statistics
        assert 'train_samples' in statistics
        assert 'val_samples' in statistics
        assert 'test_samples' in statistics


class TestStaticFiles:
    """Test static file serving"""
    
    def test_serve_index(self, client):
        """Test serving index.html"""
        response = client.get('/')
        assert response.status_code == 200
        assert b'<!DOCTYPE html>' in response.data
    
    def test_serve_batch_html(self, client):
        """Test serving batch.html"""
        response = client.get('/batch.html')
        assert response.status_code == 200
        assert b'<!DOCTYPE html>' in response.data


class TestCORS:
    """Test CORS configuration"""
    
    def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = client.get('/api/metrics')
        # Should have CORS headers in development mode
        assert response.status_code == 200


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
