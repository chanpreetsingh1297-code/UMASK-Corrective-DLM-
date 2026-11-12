
# UNMASK: Corrective Diffusion Language Model (Final Blended MVP)
# Features: MBPP Real Data + Core Python Patterns + Fixed Padding


import re
import random
import torch
import torch.nn as nn
import torch.nn.functional as F
from collections import Counter
from torch.utils.data import DataLoader, IterableDataset
from datasets import load_dataset

torch.manual_seed(42)
random.seed(42)


# 1. CORE PATTERNS & DYNAMIC VOCABULARY (FIXED)

CORE_PYTHON_PATTERNS = [
    "def add ( a , b ) : return a + b",
    "def subtract ( a , b ) : return a - b",
    "def multiply ( a , b ) : return a * b",
    "def divide ( a , b ) : return a / b",
    "if x > 0 : return True else : return False"
]

print("Scanning datasets to build a dynamic vocabulary...")
raw_dataset = load_dataset("google-research-datasets/mbpp", split="train")

SPECIAL_TOKENS = ["<PAD>", "<MASK>", "<UNK>", "<EOS>", "<TRACE>", "</TRACE>"]
pattern = r"<TRACE>|</TRACE>|==|!=|<=|>=|\+=|-=|\/\/|\*\*|\b\w+\b|[()[\]{}:,.\-+*/%><=]"

all_tokens = []
for item in raw_dataset:
    all_tokens.extend(re.findall(pattern, str(item.get("code", ""))))
for code_text in CORE_PYTHON_PATTERNS:
    all_tokens.extend(re.findall(pattern, code_text))

token_counts = Counter(all_tokens)
common_tokens = [t for t, _ in token_counts.most_common(2000)]

# COMBINE TOKENS AND GUARANTEE OUR DEMO WORDS EXIST
TOKENS = SPECIAL_TOKENS + [t for t in common_tokens if t not in SPECIAL_TOKENS]
for test_word in ["def", "add", "a", "b", "print", "-", "+", "return", ":"]:
    if test_word not in TOKENS:
        TOKENS.append(test_word)

vocab = {token: idx for idx, token in enumerate(TOKENS)}
inv_vocab = {idx: token for idx, token in enumerate(TOKENS)}
vocab_size = len(TOKENS)

PAD_IDX, MASK_IDX, EOS_IDX = vocab["<PAD>"], vocab["<MASK>"], vocab["<EOS>"]
TRACE_START, TRACE_END = vocab["<TRACE>"], vocab["</TRACE>"]

print(f"Vocabulary successfully built! Size: {vocab_size} tokens.\n")

def robust_tokenize(code_str):
    raw = re.findall(pattern, code_str)
    return [vocab.get(t, vocab["<UNK>"]) for t in raw]

def decode(token_ids):
    words = []
    in_trace = False
    for t in token_ids:
        if t in (PAD_IDX, EOS_IDX): break
        if t == TRACE_START: in_trace = True; continue
        if t == TRACE_END: in_trace = False; continue
        if not in_trace: words.append(inv_vocab.get(t, "<UNK>"))
    res = " ".join(words)
    for s in ["(", ")", "[", "]", "{", "}", ":", ",", ".", "+", "-", "*", "/", "%", "==", "=", ">", "<"]:
        res = res.replace(f" {s} ", s).replace(f" {s}", s).replace(f"{s} ", s)
    return res


# 2. AST NOISE ENGINE

class ASTNoiseEngine:
    OPS = {"+": "-", "-": "+", "*": "/", "/": "*", ">": "<", "<": ">", "==": "!="}

    @classmethod
    def corrupt(cls, token_ids):
        corrupted = list(token_ids)
        seq_len = len(corrupted)
        if seq_len < 3: return corrupted

        mode = random.choice(["flip_op", "mask_span", "swap_var"])
        if mode == "flip_op":
            for i in range(seq_len):
                if inv_vocab.get(corrupted[i], "") in cls.OPS:
                    corrupted[i] = vocab[cls.OPS[inv_vocab.get(corrupted[i], "")]]
                    return corrupted
        elif mode == "swap_var":
            var_indices = [i for i, t in enumerate(corrupted) if inv_vocab.get(t, "").islower() and len(inv_vocab.get(t, "")) <= 2]
            if len(var_indices) >= 2:
                i1, i2 = random.sample(var_indices, 2)
                corrupted[i1], corrupted[i2] = corrupted[i2], corrupted[i1]
                return corrupted

        span_len = min(random.randint(1, 2), seq_len - 1)
        start = random.randint(0, seq_len - span_len)
        for i in range(start, start + span_len): corrupted[i] = MASK_IDX
        return corrupted


# 3. BLENDED DATASET LOADER (MBPP + CORE PYTHON)

class BlendedCodeDataset(IterableDataset):
    def __init__(self, raw_dataset, max_len=48):
        self.raw_dataset = raw_dataset
        self.max_len = max_len

    def __iter__(self):
        sample_traces = ["SyntaxError", "TypeError", "IndexError", "ValueError"]

        # Mix MBPP and Core Patterns dynamically
        combined_data = [str(item.get("code", "")) for item in self.raw_dataset] + (CORE_PYTHON_PATTERNS * 20)
        random.shuffle(combined_data)

        for code_text in combined_data:
            if len(code_text.strip()) < 5: continue
            clean_tokens = robust_tokenize(code_text)
            if len(clean_tokens) < 5: continue

            clean_tokens = clean_tokens[: self.max_len - 4] + [EOS_IDX]
            trace_prefix = [TRACE_START, vocab.get(random.choice(sample_traces), vocab["<UNK>"]), TRACE_END]

            clean_full = trace_prefix + clean_tokens
            clean_full += [PAD_IDX] * max(0, self.max_len - len(clean_full))

            noisy_tokens = ASTNoiseEngine.corrupt(clean_tokens[:-1]) + [EOS_IDX]
            noisy_full = trace_prefix + noisy_tokens
            noisy_full += [PAD_IDX] * max(0, self.max_len - len(noisy_full))

            yield torch.tensor(noisy_full[:self.max_len], dtype=torch.long), torch.tensor(clean_full[:self.max_len], dtype=torch.long)


# 4. UNMASK BIDIRECTIONAL TRANSFORMER

class UNMASKTransformer(nn.Module):
    def __init__(self, vocab_size, d_model=128, nhead=4, num_layers=4, max_seq_len=48):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_embedding = nn.Parameter(torch.randn(1, max_seq_len, d_model))
        self.transformer = nn.TransformerEncoder(nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, dim_feedforward=256, batch_first=True), num_layers=num_layers)
        self.fc_out = nn.Linear(d_model, vocab_size)

    def forward(self, x):
        return self.fc_out(self.transformer(self.embedding(x) + self.pos_embedding[:, :x.size(1), :]))


# 5. TRAINING LOOP

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = UNMASKTransformer(vocab_size=vocab_size, max_seq_len=48).to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=0.002)
criterion = nn.CrossEntropyLoss(ignore_index=PAD_IDX)

print(f"Device: {device}")
print("Training UNMASK Denoising Transformer on BLENDED Python dataset...\n")

model.train()
step_count = 0
total_steps = 600

while step_count < total_steps:
    dataloader = DataLoader(BlendedCodeDataset(raw_dataset, max_len=48), batch_size=32)
    for x_noisy, x_clean in dataloader:
        step_count += 1
        x_noisy, x_clean = x_noisy.to(device), x_clean.to(device)

        optimizer.zero_grad()
        loss = criterion(model(x_noisy).view(-1, vocab_size), x_clean.view(-1))
        loss.backward()
        optimizer.step()

        if step_count % 100 == 0 or step_count == 1:
            print(f"Step {step_count:3d}/{total_steps} | Denoising Loss: {loss.item():.4f}")
        if step_count >= total_steps: break

print("\nReal Dataset Training Complete!\n")


# 6. CORRECTIVE DIFFUSION DEBUGGER

class UNMASKDebugger:
    def __init__(self, model, device, max_len=48):
        self.model = model
        self.device = device
        self.max_len = max_len

    @torch.no_grad()
    def debug_and_denoise(self, corrupted_code_str, trace_str="SyntaxError", steps=3, threshold=0.60):
        self.model.eval()

        clean_tokens = robust_tokenize(corrupted_code_str) + [EOS_IDX]
        current_seq = [TRACE_START, vocab.get(trace_str, vocab["<UNK>"]), TRACE_END] + clean_tokens

        # PROPER PADDING: Fill remaining space with PAD_IDX, not MASK_IDX
        current_seq += [PAD_IDX] * max(0, self.max_len - len(current_seq))
        current_seq = current_seq[: self.max_len]
        seq_len = len(current_seq)

        print("--- UNMASK DEBUGGER (TRAINED ON BLENDED DATA) ---")
        print(f"Corrupted Input : {corrupted_code_str}")

        for step in range(1, steps + 1):
            x_in = torch.tensor([current_seq], dtype=torch.long).to(self.device)
            probs = F.softmax(self.model(x_in), dim=-1)[0]
            confidences = probs[torch.arange(seq_len), current_seq]

            masked_count = 0
            for idx in range(seq_len):
                # Never mask padding, EOS, or trace metadata
                if current_seq[idx] in (TRACE_START, TRACE_END, PAD_IDX, EOS_IDX): continue

                # Mask tokens with low confidence
                if confidences[idx].item() < threshold or current_seq[idx] == MASK_IDX:
                    current_seq[idx] = MASK_IDX
                    masked_count += 1

            preds = torch.argmax(self.model(x_in), dim=-1)[0].cpu().tolist()
            for idx in range(seq_len):
                if current_seq[idx] == MASK_IDX:
                    current_seq[idx] = preds[idx]

            print(f"Step {step}/{steps} | Masked Tokens: {masked_count:2d} | Output: {decode(current_seq)}")

        corrected = decode(current_seq)
        print(f"\nFinal Patch Generated: {corrected}")
        return corrected


# 7. RUN DEMO

#if __name__ == "__main__":
#    debugger = UNMASKDebugger(model, device, max_len=48)
#    corrupted_input = "def add ( a , b ) print a - b"
#    debugger.debug_and_denoise(corrupted_input, trace_str="SyntaxError", steps=3)