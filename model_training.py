import pandas as pd
from datasets import Dataset
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification, 
    Trainer, 
    TrainingArguments,
    DataCollatorWithPadding
)
import numpy as np
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import matplotlib.pyplot as plt

# Load CSVs
train_df = pd.read_csv("train.csv")
val_df = pd.read_csv("val.csv")
test_df = pd.read_csv("test.csv")

# Convert pandas DataFrames to Hugging Face Datasets
train_ds = Dataset.from_pandas(train_df[['text', 'label']])
val_ds = Dataset.from_pandas(val_df[['text', 'label']])
test_ds = Dataset.from_pandas(test_df[['text', 'label']])

# Initialize tokenizer using AutoTokenizer (more robust)
tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

def tokenize_function(examples):
    """Updated tokenization function"""
    return tokenizer(
        examples['text'], 
        padding=False,
        truncation=True,
        max_length=512
    )

# Tokenize the datasets
train_ds = train_ds.map(tokenize_function, batched=True)
val_ds = val_ds.map(tokenize_function, batched=True)
test_ds = test_ds.map(tokenize_function, batched=True)

# Remove the original text column to avoid issues
train_ds = train_ds.remove_columns(['text'])
val_ds = val_ds.remove_columns(['text'])
test_ds = test_ds.remove_columns(['text'])

# Load pre-trained model using AutoModel
model = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased", 
    num_labels=2
)

# Data collator for dynamic padding
data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

def compute_metrics(eval_pred):
    """Manual metrics computation without sklearn"""
    predictions, labels = eval_pred
    predictions = np.argmax(predictions, axis=1)
    
    # Convert to numpy arrays if they aren't already
    predictions = np.array(predictions)
    labels = np.array(labels)
    
    # Initialize counters
    TP = FP = TN = FN = 0
    
    for pred, true in zip(predictions, labels):
        if pred == 1 and true == 1:
            TP += 1
        elif pred == 1 and true == 0:
            FP += 1
        elif pred == 0 and true == 0:
            TN += 1
        elif pred == 0 and true == 1:
            FN += 1
    
    # Compute metrics with safe division
    total = TP + TN + FP + FN
    accuracy = (TP + TN) / total if total > 0 else 0.0
    precision = TP / (TP + FP) if (TP + FP) > 0 else 0.0
    recall = TP / (TP + FN) if (TP + FN) > 0 else 0.0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1
    }

training_args = TrainingArguments(
    output_dir="./results",
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=2e-5,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    num_train_epochs=3,
    weight_decay=0.01,
    logging_dir="./logs",
    logging_steps=100,
    load_best_model_at_end=True,
    metric_for_best_model="f1",  # Using f1 for better model selection
    greater_is_better=True,
    save_total_limit=2,  # Only keep 2 best checkpoints
    report_to=None,  # Disable wandb/tensorboard logging
    dataloader_pin_memory=False,  # Helps with memory issues
    remove_unused_columns=True,
)

# Initialize trainer with data collator
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    tokenizer=tokenizer,
    data_collator=data_collator,  # Add data collator for dynamic padding
    compute_metrics=compute_metrics
)

# Train the model
print("Starting training...")
trainer.train(resume_from_checkpoint=True)

# Evaluate on test set
print("Evaluating on test set...")
preds_output = trainer.predict(test_ds)
metrics = compute_metrics((preds_output.predictions, preds_output.label_ids))
print("Test metrics:", metrics)

# Confusion Matrix
preds = np.argmax(preds_output.predictions, axis=1)
cm = confusion_matrix(preds_output.label_ids, preds)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Negative", "Positive"])
disp.plot(cmap='Blues')
plt.savefig("confusion_matrix.png")

# Save metrics
with open("metrics.txt", "w") as f:
    for k, v in metrics.items():
        f.write(f"{k}: {v:.4f}\n")

# Save the model and tokenizer
print("Saving model...")
trainer.save_model("./sentiment_model")
tokenizer.save_pretrained("./sentiment_model")