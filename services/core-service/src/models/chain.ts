import { DatabaseManager } from '@moonx-farm/infrastructure';

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

export interface RpcProviders {
  primary: string;
  secondary?: string;
  fallback?: string;
}

export interface AggregatorProvider {
  enabled: boolean;
  functionName: string;
  priority: number;
}

export interface AggregatorProviders {
  [key: string]: AggregatorProvider;
}

export interface ChainConfig {
  gasLimit?: number;
  blockTime?: number;
  maxGasPrice?: string;
  [key: string]: any;
}

export interface Chain {
  id: string;
  chainId: number;
  name: string;
  shortName: string;
  networkType: 'mainnet' | 'testnet';
  rpcProviders: RpcProviders;
  aggregatorProviders: AggregatorProviders;
  explorerUrls: string[];
  nativeCurrency: NativeCurrency;
  iconUrl?: string;
  brandColor?: string;
  active: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  priority: number;
  isTestnet: boolean;
  diamondContractAddress?: string;
  chainConfig: ChainConfig;
  faucetUrls?: string[];
  docsUrl?: string;
  websiteUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChainRequest {
  chainId: number;
  name: string;
  shortName: string;
  networkType: 'mainnet' | 'testnet';
  rpcProviders: RpcProviders;
  aggregatorProviders?: AggregatorProviders;
  explorerUrls: string[];
  nativeCurrency: NativeCurrency;
  iconUrl?: string;
  brandColor?: string;
  active?: boolean;
  status?: 'active' | 'inactive' | 'maintenance';
  priority?: number;
  isTestnet?: boolean;
  diamondContractAddress?: string;
  chainConfig?: ChainConfig;
  faucetUrls?: string[];
  docsUrl?: string;
  websiteUrl?: string;
}

export interface UpdateChainRequest {
  chainId?: number;
  name?: string;
  shortName?: string;
  networkType?: 'mainnet' | 'testnet';
  rpcProviders?: RpcProviders;
  aggregatorProviders?: AggregatorProviders;
  explorerUrls?: string[];
  nativeCurrency?: NativeCurrency;
  iconUrl?: string;
  brandColor?: string;
  active?: boolean;
  status?: 'active' | 'inactive' | 'maintenance';
  priority?: number;
  isTestnet?: boolean;
  diamondContractAddress?: string;
  chainConfig?: ChainConfig;
  faucetUrls?: string[];
  docsUrl?: string;
  websiteUrl?: string;
}

export class ChainModel {
  constructor(private db: DatabaseManager) {}

  async createChain(chain: CreateChainRequest): Promise<Chain> {
    const query = `
      INSERT INTO chains (
        chain_id, name, short_name, network_type, rpc_providers, aggregator_providers,
        explorer_urls, native_currency, icon_url, brand_color, active, status, priority, 
        is_testnet, diamond_contract_address, chain_config, faucet_urls, docs_url, website_url
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `;

    const values = [
      chain.chainId,
      chain.name,
      chain.shortName,
      chain.networkType,
      JSON.stringify(chain.rpcProviders),
      JSON.stringify(chain.aggregatorProviders || {}),
      chain.explorerUrls,
      JSON.stringify(chain.nativeCurrency),
      chain.iconUrl || null,
      chain.brandColor || null,
      chain.active !== undefined ? chain.active : true,
      chain.status || 'active',
      chain.priority || 0,
      chain.isTestnet !== undefined ? chain.isTestnet : chain.networkType === 'testnet',
      chain.diamondContractAddress || null,
      JSON.stringify(chain.chainConfig || {}),
      chain.faucetUrls || null,
      chain.docsUrl || null,
      chain.websiteUrl || null
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToChain(result.rows[0]);
  }

  async getAllChains(): Promise<Chain[]> {
    const query = `
      SELECT * FROM chains 
      ORDER BY priority ASC, name ASC
    `;
    
    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRowToChain(row));
  }

  async getActiveChains(): Promise<Chain[]> {
    const query = `
      SELECT * FROM chains 
      WHERE status = 'active'
      ORDER BY priority ASC, name ASC
    `;
    
    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRowToChain(row));
  }

  async getChainsByNetworkType(networkType: 'mainnet' | 'testnet'): Promise<Chain[]> {
    const query = `
      SELECT * FROM chains 
      WHERE network_type = $1 AND status = 'active'
      ORDER BY priority ASC, name ASC
    `;
    
    const result = await this.db.query(query, [networkType]);
    return result.rows.map(row => this.mapRowToChain(row));
  }

  async getChainByChainId(chainId: number): Promise<Chain | null> {
    const query = `
      SELECT * FROM chains 
      WHERE chain_id = $1
    `;
    
    const result = await this.db.query(query, [chainId]);
    return result.rows[0] ? this.mapRowToChain(result.rows[0]) : null;
  }

  async getChainById(id: string): Promise<Chain | null> {
    const query = `
      SELECT * FROM chains 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [id]);
    return result.rows[0] ? this.mapRowToChain(result.rows[0]) : null;
  }

  async updateChain(id: string, updates: UpdateChainRequest): Promise<Chain | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.shortName !== undefined) {
      setClauses.push(`short_name = $${paramCount++}`);
      values.push(updates.shortName);
    }
    if (updates.networkType !== undefined) {
      setClauses.push(`network_type = $${paramCount++}`);
      values.push(updates.networkType);
    }
    if (updates.rpcProviders !== undefined) {
      setClauses.push(`rpc_providers = $${paramCount++}`);
      values.push(JSON.stringify(updates.rpcProviders));
    }
    if (updates.aggregatorProviders !== undefined) {
      setClauses.push(`aggregator_providers = $${paramCount++}`);
      values.push(JSON.stringify(updates.aggregatorProviders));
    }
    if (updates.explorerUrls !== undefined) {
      setClauses.push(`explorer_urls = $${paramCount++}`);
      values.push(updates.explorerUrls);
    }
    if (updates.nativeCurrency !== undefined) {
      setClauses.push(`native_currency = $${paramCount++}`);
      values.push(JSON.stringify(updates.nativeCurrency));
    }
    if (updates.iconUrl !== undefined) {
      setClauses.push(`icon_url = $${paramCount++}`);
      values.push(updates.iconUrl);
    }
    if (updates.brandColor !== undefined) {
      setClauses.push(`brand_color = $${paramCount++}`);
      values.push(updates.brandColor);
    }
    if (updates.active !== undefined) {
      setClauses.push(`active = $${paramCount++}`);
      values.push(updates.active);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }
    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramCount++}`);
      values.push(updates.priority);
    }
    if (updates.isTestnet !== undefined) {
      setClauses.push(`is_testnet = $${paramCount++}`);
      values.push(updates.isTestnet);
    }
    if (updates.diamondContractAddress !== undefined) {
      setClauses.push(`diamond_contract_address = $${paramCount++}`);
      values.push(updates.diamondContractAddress);
    }
    if (updates.chainConfig !== undefined) {
      setClauses.push(`chain_config = $${paramCount++}`);
      values.push(JSON.stringify(updates.chainConfig));
    }
    if (updates.faucetUrls !== undefined) {
      setClauses.push(`faucet_urls = $${paramCount++}`);
      values.push(updates.faucetUrls);
    }
    if (updates.docsUrl !== undefined) {
      setClauses.push(`docs_url = $${paramCount++}`);
      values.push(updates.docsUrl);
    }
    if (updates.websiteUrl !== undefined) {
      setClauses.push(`website_url = $${paramCount++}`);
      values.push(updates.websiteUrl);
    }

    values.push(id);

    const query = `
      UPDATE chains 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount++}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRowToChain(result.rows[0]) : null;
  }

  async deleteChain(id: string): Promise<boolean> {
    const query = `
      DELETE FROM chains 
      WHERE id = $1
    `;
    
    const result = await this.db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  async chainIdExists(chainId: number, excludeId?: string): Promise<boolean> {
    let query = `
      SELECT 1 FROM chains 
      WHERE chain_id = $1
    `;
    const values: any[] = [chainId];

    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }

    const result = await this.db.query(query, values);
    return result.rows.length > 0;
  }

  async getChainCount(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM chains
    `;
    
    const result = await this.db.query(query);
    return parseInt(result.rows[0].count);
  }

  private mapRowToChain(row: any): Chain {
    return {
      id: row.id,
      chainId: row.chain_id,
      name: row.name,
      shortName: row.short_name,
      networkType: row.network_type,
      rpcProviders: typeof row.rpc_providers === 'string' 
        ? JSON.parse(row.rpc_providers) 
        : row.rpc_providers,
      aggregatorProviders: typeof row.aggregator_providers === 'string' 
        ? JSON.parse(row.aggregator_providers) 
        : row.aggregator_providers,
      explorerUrls: row.explorer_urls,
      nativeCurrency: typeof row.native_currency === 'string' 
        ? JSON.parse(row.native_currency) 
        : row.native_currency,
      iconUrl: row.icon_url,
      brandColor: row.brand_color,
      active: row.active,
      status: row.status,
      priority: row.priority,
      isTestnet: row.is_testnet,
      diamondContractAddress: row.diamond_contract_address,
      chainConfig: typeof row.chain_config === 'string' 
        ? JSON.parse(row.chain_config) 
        : row.chain_config,
      faucetUrls: row.faucet_urls,
      docsUrl: row.docs_url,
      websiteUrl: row.website_url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
} 