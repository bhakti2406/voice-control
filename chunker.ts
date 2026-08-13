import { ChunkingStrategy } from '../src/types.ts';
import { RawDocument } from './dataset.ts';

export interface TextChunk {
  id: string;
  docId: string;
  title: string;
  text: string;
  strategy: ChunkingStrategy;
  metadata: {
    category: string;
    passageId: string;
    charCount: number;
    wordCount: number;
    chunkIndex: number;
  };
}

export class DocumentChunker {
  /**
   * Chunks a collection of documents according to the chosen strategy
   */
  static chunkDocuments(docs: RawDocument[], strategy: ChunkingStrategy): TextChunk[] {
    const chunks: TextChunk[] = [];

    for (const doc of docs) {
      const docChunks = this.chunkSingleDocument(doc, strategy);
      chunks.push(...docChunks);
    }

    return chunks;
  }

  static chunkSingleDocument(doc: RawDocument, strategy: ChunkingStrategy): TextChunk[] {
    switch (strategy) {
      case 'fixed_overlap':
        return this.fixedOverlapChunking(doc, 220, 45);
      case 'semantic_sentence':
        return this.semanticSentenceChunking(doc, 2);
      case 'hierarchical':
        return this.hierarchicalMetadataChunking(doc);
      case 'recursive_char':
        return this.recursiveCharacterChunking(doc, 250);
      default:
        return this.fixedOverlapChunking(doc, 220, 45);
    }
  }

  /**
   * 1. Fixed-Size Overlap Chunking
   */
  private static fixedOverlapChunking(doc: RawDocument, chunkSize = 220, overlap = 45): TextChunk[] {
    const text = doc.content.trim();
    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    if (text.length <= chunkSize) {
      chunks.push({
        id: `${doc.id}_fix_0`,
        docId: doc.id,
        title: doc.title,
        text,
        strategy: 'fixed_overlap',
        metadata: {
          category: doc.category,
          passageId: doc.id,
          charCount: text.length,
          wordCount: text.split(/\s+/).length,
          chunkIndex: 0
        }
      });
      return chunks;
    }

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      // Try to break at a space boundary if not end of string
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start + (chunkSize * 0.6)) {
          end = lastSpace;
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 20) {
        chunks.push({
          id: `${doc.id}_fix_${index}`,
          docId: doc.id,
          title: doc.title,
          text: chunkText,
          strategy: 'fixed_overlap',
          metadata: {
            category: doc.category,
            passageId: doc.id,
            charCount: chunkText.length,
            wordCount: chunkText.split(/\s+/).length,
            chunkIndex: index
          }
        });
        index++;
      }

      if (end >= text.length) break;
      start = end - overlap;
    }

    return chunks;
  }

  /**
   * 2. Semantic Sentence Boundary Chunking
   */
  private static semanticSentenceChunking(doc: RawDocument, sentencesPerChunk = 2): TextChunk[] {
    // Regex splits on sentence terminators while preserving words
    const rawSentences = doc.content
      .split(/(?<=[.?!])\s+(?=[A-Z0-9])/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const chunks: TextChunk[] = [];
    let index = 0;

    for (let i = 0; i < rawSentences.length; i += sentencesPerChunk) {
      const group = rawSentences.slice(i, i + sentencesPerChunk);
      const chunkText = group.join(' ');

      chunks.push({
        id: `${doc.id}_sem_${index}`,
        docId: doc.id,
        title: doc.title,
        text: chunkText,
        strategy: 'semantic_sentence',
        metadata: {
          category: doc.category,
          passageId: doc.id,
          charCount: chunkText.length,
          wordCount: chunkText.split(/\s+/).length,
          chunkIndex: index
        }
      });
      index++;
    }

    return chunks;
  }

  /**
   * 3. Hierarchical & Metadata-Aware Chunking
   */
  private static hierarchicalMetadataChunking(doc: RawDocument): TextChunk[] {
    // Prefix each chunk with structural context: [Category] Title: Content
    const sentences = doc.content.split(/(?<=[.?!])\s+/g).filter(s => s.trim().length > 0);
    const chunks: TextChunk[] = [];

    // Summary head chunk
    const headText = `[${doc.category} | ${doc.title}] ${sentences.slice(0, 2).join(' ')}`;
    chunks.push({
      id: `${doc.id}_hie_head`,
      docId: doc.id,
      title: doc.title,
      text: headText,
      strategy: 'hierarchical',
      metadata: {
        category: doc.category,
        passageId: doc.id,
        charCount: headText.length,
        wordCount: headText.split(/\s+/).length,
        chunkIndex: 0
      }
    });

    // Body chunks if passage is longer
    if (sentences.length > 2) {
      const bodyText = `[Context: ${doc.title}] ${sentences.slice(2).join(' ')}`;
      chunks.push({
        id: `${doc.id}_hie_body`,
        docId: doc.id,
        title: doc.title,
        text: bodyText,
        strategy: 'hierarchical',
        metadata: {
          category: doc.category,
          passageId: doc.id,
          charCount: bodyText.length,
          wordCount: bodyText.split(/\s+/).length,
          chunkIndex: 1
        }
      });
    }

    return chunks;
  }

  /**
   * 4. Recursive Character Splitting
   */
  private static recursiveCharacterChunking(doc: RawDocument, maxChunkSize = 250): TextChunk[] {
    const text = doc.content;
    const separators = ['\n\n', '\n', '. ', ', ', ' '];
    const rawPieces = this.splitRecursive(text, separators, maxChunkSize);
    
    return rawPieces.map((piece, idx) => ({
      id: `${doc.id}_rec_${idx}`,
      docId: doc.id,
      title: doc.title,
      text: piece,
      strategy: 'recursive_char',
      metadata: {
        category: doc.category,
        passageId: doc.id,
        charCount: piece.length,
        wordCount: piece.split(/\s+/).length,
        chunkIndex: idx
      }
    }));
  }

  private static splitRecursive(text: string, separators: string[], maxSize: number): string[] {
    const output: string[] = [];
    if (text.length <= maxSize || separators.length === 0) {
      if (text.trim().length > 0) output.push(text.trim());
      return output;
    }

    const sep = separators[0];
    const nextSeps = separators.slice(1);
    const splits = text.split(sep);

    let currentChunk = '';
    for (const split of splits) {
      if (!split) continue;
      const candidate = currentChunk ? `${currentChunk}${sep}${split}` : split;
      if (candidate.length <= maxSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          output.push(currentChunk.trim());
          currentChunk = '';
        }
        if (split.length > maxSize) {
          const subSplits = this.splitRecursive(split, nextSeps, maxSize);
          output.push(...subSplits);
        } else {
          currentChunk = split;
        }
      }
    }
    if (currentChunk.trim().length > 0) {
      output.push(currentChunk.trim());
    }

    return output;
  }
}
