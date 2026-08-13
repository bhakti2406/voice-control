# 🎙️ Voice-Enabled RAG Pipeline

### HH Goa 2026 — Task 2

**Voice → Speech-to-Text → Multi-Strategy Chunking → Hybrid Retrieval → Grounded Answer → Guardrails**

A production-oriented voice-enabled Retrieval-Augmented Generation (RAG) application built for **HH Goa 2026 Task 2**.

The system allows a user to ask a question using voice, transcribes the audio using **Sarvam Speech-to-Text**, retrieves relevant information using a custom hybrid vector + lexical retrieval engine, generates an answer using either an ultra-fast extractive mode or **Google Gemini**, and verifies the result using grounding and safety guardrails.

---

## 🚀 Live Demo

**Live Application:**

https://voice-enabled-rag-pipeline-757450955879.asia-southeast1.run.app

**GitHub Repository:**

https://github.com/bhakti2406/voice-control

---

# 🧠 What We Built

The application implements an end-to-end voice RAG pipeline:

```text
                    USER
                     │
                     │ Voice
                     ▼
              🎙️ MICROPHONE
                     │
                     ▼
              ┌──────────────┐
              │  SARVAM STT  │
              │  Saaras v1   │
              └──────┬───────┘
                     │
                 Transcript
                     │
                     ▼
             Query Preprocessing
                     │
                     ▼
              Input Guardrails
                     │
                     ▼
          ┌──────────────────────┐
          │   HYBRID RETRIEVAL   │
          │                      │
          │ Dense Vector Search  │
          │        +             │
          │ BM25 Lexical Search  │
          └──────────┬───────────┘
                     │
               Top Documents
                     │
                     ▼
             Context Selection
                     │
              ┌──────┴───────┐
              │              │
              ▼              ▼
        Extractive         Gemini
        Generation         Generation
              │              │
              └──────┬───────┘
                     ▼
             Grounding Check
                     │
                     ▼
               FINAL ANSWER
                     │
              ┌──────┴──────┐
              ▼             ▼
           Sources       Confidence
```

---

# ✨ Key Features

## 🎙️ Voice-First RAG

Users can ask questions using their microphone.

The voice pipeline sends recorded audio to the server, where it is transcribed using Sarvam's Speech-to-Text API before entering the RAG pipeline. The server measures transcription latency separately and includes it in the total latency calculation.

---

## 🧩 Multi-Strategy Chunking

The system does not rely on a single fixed-size chunking strategy.

The custom `DocumentChunker` currently supports:

1. **Fixed Overlap**
2. **Semantic Sentence**
3. **Hierarchical Metadata**
4. **Recursive Character**

Each generated chunk maintains metadata including:

* Document ID
* Title
* Chunking strategy
* Category
* Passage ID
* Character count
* Word count
* Chunk index

The application can re-index the knowledge base using a selected strategy, allowing the effect of different chunking approaches to be inspected and compared.

---

# 🔎 Hybrid Retrieval Engine

The project uses a custom server-side retrieval engine combining:

### Dense Retrieval

Text is represented using normalized fixed-dimensional embeddings.

### Lexical Retrieval

A BM25-style inverted index is maintained using:

* Term frequency
* Document frequency
* IDF
* Document length statistics

The retrieval engine is therefore designed around a combination of **semantic similarity and lexical relevance**, rather than relying on a single search mechanism.

---

# 🗂️ Knowledge Base

The current application contains a structured TypeScript knowledge base with documents categorized into areas including:

* Hardware
* Networking
* AI & Machine Learning
* Operating Systems
* General Science
* Digital India

The knowledge-base records contain:

```text
id
title
category
content
url
```

The repository labels this knowledge base as **MS MARCO-XI**.

> **Note:** The current repository contains a curated/hard-coded knowledge base representation. It does not currently include a visible Hugging Face download-and-ingestion script for the complete `ai4bharat/MSMARCO-XI` dataset.

---

# 🤖 Answer Generation

The RAG harness supports two generation modes:

### 1. Extractive Mode

The system selects the most relevant sentence/span from the retrieved source.

This mode is designed for very low latency.

### 2. Gemini Mode

When configured with `GEMINI_API_KEY`, the system can use Google Gemini to generate a concise answer based only on retrieved context.

The generation prompt explicitly instructs Gemini to:

* Answer only from supplied context
* Avoid unsupported information
* Avoid speculation
* Keep answers concise
* Refuse when the retrieved context does not contain the answer

The current implementation uses the Gemini API through `@google/genai`.

---

# 🛡️ Guardrails

Guardrails operate both **before retrieval** and **after generation**.

## Input Safety

The system checks for:

* Empty/very short queries
* Prompt injection attempts
* Requests to reveal system instructions
* Attempts to bypass guardrails
* Unsafe/inappropriate queries

Examples of detected prompt-injection patterns include attempts to ignore previous instructions or reveal system prompts.

## Grounding Verification

After generation, the system evaluates:

* Retrieved-source availability
* Top retrieval score
* Lexical overlap between answer and sources
* Grounding score
* Confidence
* Domain relevance
* Hallucination safety

If the retrieved evidence is insufficient, the system can refuse to provide an unsupported answer.

---

# 🧠 RAG Harness

The `RAGHarness` provides structured orchestration around the model and retrieval system.

The pipeline is:

```text
Query
 ↓
Preprocessing
 ↓
Input Safety Check
 ↓
Hybrid Retrieval
 ↓
Context Selection
 ↓
Answer Generation
 ↓
Grounding Evaluation
 ↓
Guardrails
 ↓
Structured Response
```

The harness also handles:

* Strategy selection
* Re-indexing
* Timing instrumentation
* Generator selection
* Transcription timing
* Retrieval timing
* Generation timing
* Guardrail timing
* Refusal handling
* Fallback from Gemini to extractive generation

The implementation exposes a structured response containing the answer, sources, confidence, grounding status, latency timings, guardrail result, generator and selected chunking strategy.

---

# ⚡ Latency Engineering

The project is designed around the HH Goa target of **200 ms**.

The system measures:

```text
Speech-to-Text
      +
Preprocessing
      +
Retrieval
      +
Generation
      +
Guardrails
      =
Total Latency
```

The server exposes a latency target of:

```text
200 ms
```

and records individual pipeline timings.

For low-latency execution, the application provides an extractive generation mode that avoids an external LLM call.

---

# 📊 Benchmarking

The backend includes a dedicated benchmark endpoint:

```text
POST /api/benchmark/run
```

The benchmark runs the predefined test suite and records:

* Query
* Answer
* Grounded status
* Confidence
* Latency
* Timing breakdown
* Status
* Query category

The benchmark calculates:

* Average latency
* P50
* P70
* P90
* P100
* Minimum latency
* Successful queries

The HH Goa requirement specifically asks for **P50 / P70 / P100** across multiple test queries.

> Benchmark numbers should always be generated from actual runs and should not be hard-coded.

---

# 🖥️ Interface

The application includes dedicated interfaces for:

* Voice recording
* Answer presentation
* Dataset inspection
* Chunking inspection
* Guardrail status
* Latency analytics
* Search history

The UI is designed around a technical, dark, experimental aesthetic suitable for a voice-first RAG system.

---

# 🏗️ Project Architecture

```text
voice-control/
│
├── App.tsx
├── main.tsx
├── index.html
├── index.css
│
├── VoiceRecorder.tsx
├── AnswerCard.tsx
├── ChunkingInspector.tsx
├── DatasetViewer.tsx
├── GuardrailCard.tsx
├── LatencyAnalytics.tsx
├── SearchHistory.tsx
│
├── dataset.ts
├── chunker.ts
├── vectorEngine.ts
├── harness.ts
├── guardrails.ts
├── sarvam.ts
├── server.ts
│
├── types.ts
├── metadata.json
├── vite.config.ts
├── tsconfig.json
├── package.json
│
├── .env.example
└── README.md
```

---

# 📁 Core Modules

| File                    | Responsibility                               |
| ----------------------- | -------------------------------------------- |
| `App.tsx`               | Main application UI                          |
| `VoiceRecorder.tsx`     | Microphone and voice recording               |
| `AnswerCard.tsx`        | Displays generated answers and evidence      |
| `ChunkingInspector.tsx` | Visualizes chunking configuration/statistics |
| `DatasetViewer.tsx`     | Displays knowledge-base information          |
| `GuardrailCard.tsx`     | Displays safety and grounding information    |
| `LatencyAnalytics.tsx`  | Displays performance metrics                 |
| `SearchHistory.tsx`     | Displays previous queries                    |
| `dataset.ts`            | Knowledge-base and benchmark data            |
| `chunker.ts`            | Multi-strategy document chunking             |
| `vectorEngine.ts`       | Dense + lexical retrieval                    |
| `harness.ts`            | End-to-end RAG orchestration                 |
| `guardrails.ts`         | Input safety and grounding verification      |
| `sarvam.ts`             | Sarvam speech-to-text integration            |
| `server.ts`             | Express API and application server           |
| `types.ts`              | Shared TypeScript types                      |

---

# 🔌 API Endpoints

## Health Check

```http
GET /health
```

or:

```http
GET /api/health
```

Returns service status, dataset name, retrieval engine and latency target.

---

## Dataset

```http
GET /api/dataset
```

Returns information about the current knowledge base.

---

## Chunking Statistics

```http
GET /api/chunking-stats
```

Returns:

* Current strategy
* Document count
* Chunk count
* Average chunk size
* Indexing time
* Embedding dimension

---

## Re-index

```http
POST /api/chunking/reindex
```

Example request:

```json
{
  "strategy": "semantic_sentence"
}
```

---

## Text Query

```http
POST /api/query
```

Example:

```json
{
  "query": "What is RAM?",
  "generator": "llm",
  "strategy": "semantic_sentence"
}
```

---

## Voice Query

```http
POST /api/voice-query
```

Accepts audio data or a supplied transcript.

The server:

```text
Audio
 ↓
Sarvam STT
 ↓
Transcript
 ↓
RAG Harness
 ↓
Answer
```

---

## Benchmark

```http
POST /api/benchmark/run
```

Runs the benchmark test suite and returns latency statistics.

---

# 🧰 Tech Stack

### Frontend

* React 19
* TypeScript
* Vite
* Tailwind CSS
* Motion
* Lucide React

### Backend

* Node.js
* Express
* TypeScript
* TSX

### AI

* Google Gemini API
* Sarvam Speech-to-Text

### Retrieval

* Custom dense vector engine
* BM25-style lexical retrieval
* Hybrid ranking

The current `package.json` confirms the React, Vite, Express, Gemini, TypeScript, Tailwind and Motion stack.

---

# 🚀 Run Locally

## Prerequisites

Install:

* Node.js
* npm

Check:

```bash
node --version
npm --version
```

---

## 1. Clone the repository

```bash
git clone https://github.com/bhakti2406/voice-control.git
```

```bash
cd voice-control
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create:

```text
.env.local
```

Configure the required API credentials.

Example:

```env
GEMINI_API_KEY=your_gemini_api_key
SARVAM_API_KEY=your_sarvam_api_key
```

Do **not** commit real API keys.

Use `.env.example` as the configuration template.

---

## 4. Start development server

```bash
npm run dev
```

The current project uses the `dev` script to launch the TypeScript Express server with the Vite development middleware.

The application is normally available at:

```text
http://localhost:3000
```

---

# 🏭 Production Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

Type-check the project:

```bash
npm run lint
```

The available scripts are defined in `package.json`.

---

# 🔐 Environment Variables

| Variable         | Purpose                      |
| ---------------- | ---------------------------- |
| `GEMINI_API_KEY` | Google Gemini API access     |
| `SARVAM_API_KEY` | Sarvam Speech-to-Text access |

### Security

**Never commit API keys to GitHub.**

Use environment variables or the secret-management system of your deployment provider.

---

# 🧪 Example Query Flow

A typical voice query looks like:

```text
User:
"What is RAG?"
        │
        ▼
Sarvam STT
        │
        ▼
"What is RAG?"
        │
        ▼
Input Guardrail
        │
        ▼
Hybrid Retrieval
        │
        ├── Dense similarity
        │
        └── BM25 lexical search
        │
        ▼
Top retrieved sources
        │
        ▼
Answer Generation
        │
        ▼
Grounding Check
        │
        ▼
Answer + Sources + Confidence + Latency
```

---

# 🛡️ Failure Handling

The system handles several failure cases gracefully.

### Empty Query

Returns a validation error rather than executing the pipeline.

### Unsafe Query

The request is rejected by the input guardrail.

### No Relevant Context

The system returns a refusal instead of generating an unsupported answer.

### Sarvam Failure

The voice endpoint returns a controlled transcription error.

### Gemini Failure

The current harness can fall back to extractive generation.

### Internal Server Error

The API returns a structured error response instead of crashing the request.

---

# 🎯 HH Goa Task 2 Mapping

| HH Goa Requirement           | Implementation          |
| ---------------------------- | ----------------------- |
| Voice input                  | `VoiceRecorder.tsx`     |
| Speech-to-text               | `sarvam.ts`             |
| Dataset knowledge base       | `dataset.ts`            |
| Multiple chunking strategies | `chunker.ts`            |
| Vector retrieval             | `vectorEngine.ts`       |
| Hybrid retrieval             | Vector + BM25           |
| Answer generation            | Extractive + Gemini     |
| Harness                      | `harness.ts`            |
| Guardrails                   | `guardrails.ts`         |
| Latency analytics            | `LatencyAnalytics.tsx`  |
| P50/P70/P100                 | `/api/benchmark/run`    |
| Source evidence              | `AnswerCard.tsx`        |
| Dataset inspection           | `DatasetViewer.tsx`     |
| Chunk inspection             | `ChunkingInspector.tsx` |
| Live application             | Cloud Run deployment    |

---

# 📈 Engineering Highlights

### Multi-Strategy Indexing

The system can re-index the knowledge base using different chunking strategies instead of committing to a single fixed-size approach.

### Hybrid Search

The retrieval engine combines dense embeddings with BM25-style lexical statistics.

### Structured Harness

The RAG harness coordinates preprocessing, guardrails, retrieval, generation, grounding and latency measurement.

### Grounded Responses

Answers are evaluated against retrieved sources before being marked as grounded.

### Voice Pipeline

Audio is processed through Sarvam STT before being passed into the RAG pipeline.

---

# ⚠️ Current Implementation Notes

This repository is an actively developed HH Goa Task 2 implementation.

The current codebase contains a knowledge base represented directly in `dataset.ts`. It is labeled as `ai4bharat/MSMARCO-XI`, but the repository does **not currently show a Hugging Face download/ingestion script for the complete dataset**.

For a final submission, the dataset provenance and ingestion process should be documented clearly so that the implementation can be independently verified.

Similarly, latency results shown in the application should come from actual benchmark runs and should not be presented as guaranteed performance figures without measurement.

---

# 🗺️ Future Improvements

Potential improvements include:

* Direct automated ingestion of the official Hugging Face MSMARCO-XI dataset
* Persistent external vector database
* Improved embedding model
* Cross-encoder reranking
* Streaming Sarvam STT
* More comprehensive multilingual support
* Larger evaluation benchmark
* Retrieval-quality metrics such as Recall@K
* Automated regression testing
* Distributed production deployment
* More sophisticated hallucination evaluation

---

# 👥 Team Solar

**HH Goa 2026 — Task 2**

Add team members here:

```text
Devanshi Modi
Diya Pagi
Bhakti Sudhir
```

---

# 📜 License

This project was developed for **HH Goa 2026 Task 2**.

Add an appropriate open-source license if the project is intended for public reuse.

---

## ⭐ Project Summary

**Voice-Enabled RAG Pipeline** combines:

```text
🎙️ Voice
   +
📝 Speech-to-Text
   +
✂️ Multi-Strategy Chunking
   +
🔎 Hybrid Retrieval
   +
🤖 Gemini
   +
🛡️ Guardrails
   +
📊 Latency Benchmarking
```

to create a fast, grounded and inspectable voice-first RAG experience for **HH Goa 2026**.
