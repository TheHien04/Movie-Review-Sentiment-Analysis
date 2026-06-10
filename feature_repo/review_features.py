from datetime import timedelta

from feast import Entity, FeatureView, Field, FileSource
from feast.types import Float32, String

review = Entity(name="review_id", join_keys=["review_id"])

review_source = FileSource(
    name="review_features_source",
    path="data/feast/review_features.parquet",
    timestamp_field="event_timestamp",
)

review_features = FeatureView(
    name="review_features",
    entities=[review],
    ttl=timedelta(days=365),
    schema=[
        Field(name="char_count", dtype=Float32),
        Field(name="word_count", dtype=Float32),
        Field(name="avg_word_len", dtype=Float32),
        Field(name="exclamation_count", dtype=Float32),
        Field(name="text_preview", dtype=String),
    ],
    source=review_source,
    online=True,
)
