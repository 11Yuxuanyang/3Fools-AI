/**
 * 向量数据库服务
 * 使用 LanceDB 进行向量存储和检索
 */

import * as lancedb from '@lancedb/lancedb';
import { DocumentChunk } from './chunking.js';
import path from 'path';
import fs from 'fs';

// 向量记录类型
interface VectorRecord {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
  metadata: string; // JSON 字符串
  createdAt: number;
  [key: string]: unknown; // 添加索引签名以兼容 LanceDB
}

// 检索结果类型
export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

/**
 * LanceDB 向量存储
 */
export class VectorStore {
  private db: lancedb.Connection | null = null;
  private tableName: string = 'documents';
  private dbPath: string;
  private dimension: number;

  constructor(options?: { dbPath?: string; dimension?: number }) {
    this.dbPath = options?.dbPath || path.join(process.cwd(), '.lancedb');
    this.dimension = options?.dimension || 1536;
  }

  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    if (this.db) return;

    // 确保目录存在
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }

    this.db = await lancedb.connect(this.dbPath);
    console.log(`[VectorStore] 已连接到 LanceDB: ${this.dbPath}`);
  }

  /**
   * 确保表存在
   */
  private async ensureTable(): Promise<lancedb.Table> {
    if (!this.db) {
      await this.init();
    }

    const tables = await this.db!.tableNames();

    if (tables.includes(this.tableName)) {
      return await this.db!.openTable(this.tableName);
    }

    // 创建新表，需要至少一条记录来定义 schema
    const emptyRecord: VectorRecord = {
      id: '__init__',
      documentId: '__init__',
      content: '',
      vector: new Array(this.dimension).fill(0),
      metadata: '{}',
      createdAt: Date.now(),
    };

    const table = await this.db!.createTable(this.tableName, [emptyRecord]);
    console.log(`[VectorStore] 创建表: ${this.tableName}`);

    // 删除初始化记录
    await table.delete('id = "__init__"');

    return table;
  }

  /**
   * 存储文档片段及其向量
   */
  async store(chunks: DocumentChunk[], vectors: number[][]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new Error('片段数量与向量数量不匹配');
    }

    if (chunks.length === 0) return;

    const table = await this.ensureTable();

    const records: VectorRecord[] = chunks.map((chunk, idx) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      content: chunk.content,
      vector: vectors[idx],
      metadata: JSON.stringify(chunk.metadata),
      createdAt: Date.now(),
    }));

    await table.add(records);
    console.log(`[VectorStore] 存储了 ${records.length} 个向量`);
  }

  /**
   * 语义检索
   */
  async search(
    queryVector: number[],
    options?: {
      limit?: number;
      documentId?: string; // 限制在特定文档内搜索
      minScore?: number;
    }
  ): Promise<SearchResult[]> {
    const table = await this.ensureTable();
    const limit = options?.limit || 5;

    // LanceDB 的 where 子句在 vectorSearch 后有兼容性问题，改为获取更多结果后在代码中过滤
    const expandedLimit = options?.documentId ? limit * 5 : limit * 2;
    const query = table.vectorSearch(queryVector).limit(expandedLimit);
    let results = await query.toArray();

    // 手动过滤 documentId
    if (options?.documentId && results.length > 0) {
      results = results.filter((row: Record<string, unknown>) => row.documentId === options.documentId);
    }

    // 转换结果
    const searchResults: SearchResult[] = results
      .map((row: Record<string, unknown>) => {
        const metadata = JSON.parse(row.metadata as string);
        // LanceDB 返回的距离越小越相似，转换为相似度分数
        const distance = row._distance as number;
        const score = 1 / (1 + distance); // 转换为 0-1 的相似度

        return {
          chunk: {
            id: row.id as string,
            documentId: row.documentId as string,
            content: row.content as string,
            metadata,
          },
          score,
        };
      })
      .filter((r: SearchResult) => !options?.minScore || r.score >= options.minScore)
      .slice(0, limit);

    return searchResults;
  }

  /**
   * 删除文档的所有向量
   */
  async deleteDocument(documentId: string): Promise<void> {
    // 验证 documentId 格式，防止注入攻击
    if (!/^doc_[a-f0-9-]{36}$/.test(documentId)) {
      throw new Error('无效的文档 ID 格式');
    }
    const table = await this.ensureTable();
    await table.delete(`"documentId" = '${documentId}'`);
    console.log(`[VectorStore] 删除文档向量: ${documentId}`);
  }

  /**
   * 获取文档列表
   */
  async listDocuments(): Promise<Array<{ documentId: string; fileName: string; chunkCount: number }>> {
    const table = await this.ensureTable();

    // 查询所有记录
    const results = await table.query().toArray();

    // 按文档 ID 分组
    const docMap = new Map<string, { fileName: string; count: number }>();

    for (const row of results) {
      const docId = row.documentId as string;
      const metadata = JSON.parse(row.metadata as string);

      if (!docMap.has(docId)) {
        docMap.set(docId, { fileName: metadata.fileName, count: 0 });
      }
      docMap.get(docId)!.count++;
    }

    return Array.from(docMap.entries()).map(([documentId, { fileName, count }]) => ({
      documentId,
      fileName,
      chunkCount: count,
    }));
  }

  /**
   * 检查文档是否已存在
   */
  async documentExists(documentId: string): Promise<boolean> {
    // 验证 documentId 格式
    if (!/^doc_[a-f0-9-]{36}$/.test(documentId)) {
      return false;
    }
    const table = await this.ensureTable();
    const results = await table.query()
      .where(`"documentId" = '${documentId}'`)
      .limit(1)
      .toArray();
    return results.length > 0;
  }
}

// 导出默认实例
export const vectorStore = new VectorStore();
