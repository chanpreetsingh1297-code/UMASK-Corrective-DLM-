# UNMASK: Corrective Diffusion Language Model for Code Debugging

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-2.1%2B-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-Discrete%20Diffusion%20Transformer-06B6D4?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)

**UNMASK** is a discrete **Corrective Diffusion Language Model (dLLM)** engineered specifically for automated code repair and syntax/logical bug localization. Unlike traditional autoregressive code generators that predict tokens strictly left-to-right, UNMASK employs a **Bidirectional Transformer Encoder** trained with **Iterative Mask-Predict Denoising** conditioned on execution error traces (`<TRACE>`).

By evaluating global bidirectional context simultaneously, UNMASK identifies low-confidence or corrupted tokens (such as missing colons, inverted relational/arithmetic operators, and swapped variables), replaces them with `<MASK>`, and iteratively reconstructs valid Python code across configurable denoising steps.

---

## Key Features

- **Bidirectional Discrete Diffusion:** Uses full-sequence self-attention to inspect both prefix and suffix context around syntax and logical errors before synthesizing patches.
- **Exception Trace Conditioning (`<TRACE>`):** Conditions the denoising trajectory on runtime error metadata (`SyntaxError`, `TypeError`, `ValueError`, `IndexError`, `ZeroDivisionError`) to disambiguate structural vs. semantic bugs.
- **AST-Aware Noise Corruption Engine:** Trained on a blended corpus of **MBPP (Mostly Basic Python Problems)** and core Python control-flow patterns using synthetic AST perturbations (`flip_op`, `swap_var`, and `mask_span`).
- **Confidence-Guided Iterative Unmasking:** Dynamically computes token-level softmax probabilities at each step, masking tokens below a user-defined confidence threshold ($\tau$) and converging toward high-confidence repairs.
- **Interactive Web Workbench:** Real-time browser interface featuring step-by-step token confidence heatmaps, side-by-side diff inspection, and training loss telemetry visualization.

---

## How Corrective Diffusion Works

1. **Trace Conditioning & Tokenization:** The corrupted code snippet is tokenized using a regex-based code lexer and prefixed with its exception trace:
   ```text
   <TRACE> SyntaxError </TRACE> def add ( a , b ) print a - b <EOS>
   ```
2. **Confidence Evaluation:** A forward pass through the Bidirectional Transformer computes token-level probability distributions across the sequence.
3. **Selective Masking:** Any non-special token whose probability falls below the confidence threshold $\tau$ is replaced with `<MASK>`.
4. **Parallel Reconstruction:** The masked sequence is denoised in parallel over $T$ iterative steps (`1` to `6`), progressively locking in high-confidence tokens until a syntactically and logically sound patch emerges.

---

## Repository Structure

```text
unmask-code-debugger/
├── index.html    # Interactive web workbench & telemetry visualizer
├── style.css    # Styling of web app
├── script.js    # Scripting of web app
├── dlm.py    # diffusion language model attached python script
├── model/
│   ├── UNMASK.ipynb     # PyTorch UNMASKTransformer, ASTNoiseEngine & training loop and test dataset
└── README.md            # Project documentation
```

---

## Quick Start

### 1. Launch the Interactive Web Workbench
Open `unmask_debugger.html` directly in any modern browser—no build step or external server required:
```bash
git clone [https://github.com/your-username/unmask-code-debugger.git](https://github.com/your-username/unmask-code-debugger.git)
cd unmask-code-debugger
open unmask_debugger.html   # macOS
# or double-click unmask_debugger.html on Windows/Linux
```

### 2. Run the PyTorch Training & Inference Pipeline
To train the UNMASK Bidirectional Transformer from scratch on the blended MBPP dataset:
```bash
pip install torch datasets
python model/unmask_model.py
```

#### Example Output
```text
--- UNMASK DEBUGGER (TRAINED ON BLENDED DATA) ---
Corrupted Input : def add ( a , b ) print a - b
Step 1/3 | Masked Tokens:  3 | Output: def add(a, b): print a - b
Step 2/3 | Masked Tokens:  2 | Output: def add(a, b): return a + b
Step 3/3 | Masked Tokens:  0 | Output: def add(a, b): return a + b

Final Patch Generated: def add(a, b): return a + b
```

---

## Model Architecture & Hyperparameters

| Component | Configuration |
| :--- | :--- |
| **Backbone** | Bidirectional `nn.TransformerEncoder` (4 Layers, 4 Heads) |
| **Embedding Dimension ($d_{\text{model}}$)** | `128` (Feedforward dim: `256`) |
| **Vocabulary Size** | `2,006` tokens (Special tokens + MBPP top-2000 + core AST symbols) |
| **Max Sequence Length** | `48` tokens with `<PAD>` masking |
| **Training Objective** | Denoising Cross-Entropy Loss (`ignore_index=PAD_IDX`) |
| **Optimizer** | `AdamW` (`lr = 2e-3`) |

---

## License

This project is released under the **MIT License**. See `LICENSE` for details.
