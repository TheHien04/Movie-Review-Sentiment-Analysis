from datasets import load_dataset
import pandas as pd
import re

# Load IMDB dataset from Hugging Face
dataset = load_dataset("imdb")
df = pd.concat([pd.DataFrame(dataset['train']), pd.DataFrame(dataset['test'])], ignore_index=True)

def clean_html_text(text):
    # Replaces all occurrences of the pattern <.*?> with an empty string
    text = re.sub(r"<.*?>", "", text)
    return text

# Apply cleaning to the text column
df['text'] = df['text'].apply(clean_html_text)

# Stratified split: 70% train, 15% val, 15% test
def stratified_split(df):
    class_0 = df[df['label']==0]
    class_1 = df[df['label']==1]

    def split_class(df_class, seed=42):
        df_class = df_class.sample(frac=1, random_state=seed)  # Shuffle
        n = len(df_class)
        n_train = int(0.7 * n) # 70% for training
        n_val = int(0.15 * n) # 15% for validation
        df_train = df_class.iloc[:n_train]
        df_val = df_class.iloc[n_train:n_train+n_val]
        df_test = df_class.iloc[n_train+n_val:]

        return df_train, df_val, df_test
    
    train_0, val_0, test_0 = split_class(class_0)
    train_1, val_1, test_1 = split_class(class_1)

    df_train = pd.concat([train_0, train_1], ignore_index=True).sample(frac=1, random_state=42)
    df_val = pd.concat([val_0, val_1], ignore_index=True).sample(frac=1, random_state=42)
    df_test = pd.concat([test_0, test_1], ignore_index=True).sample(frac=1, random_state=42)

    return df_train, df_val, df_test

df_train, df_val, df_test = stratified_split(df)

# Save the splits to CSV files
df_train.to_csv("train.csv", index=False)
df_val.to_csv("val.csv", index=False)
df_test.to_csv("test.csv", index=False)
