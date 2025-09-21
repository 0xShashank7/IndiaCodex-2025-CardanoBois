// Blockchain API utilities for fetching Cardano transaction data
// Note: Install @blockfrost/blockfrost-js package for full functionality

interface BlockchainTransaction {
  hash: string;
  block: string;
  block_height: number;
  block_time: number;
  slot: number;
  index: number;
  output_amount: Array<{
    unit: string;
    quantity: string;
  }>;
  fees: string;
  deposit: string;
  size: number;
  invalid_before?: string;
  invalid_hereafter?: string;
  utxo_count: number;
  withdrawal_count: number;
  mir_cert_count: number;
  delegation_count: number;
  stake_cert_count: number;
  pool_update_count: number;
  pool_retire_count: number;
  asset_mint_or_burn_count: number;
  redeemer_count: number;
  valid_contract: boolean;
}

interface TransactionMetadata {
  label: string;
  json_metadata: any;
}

interface ParsedTransaction {
  id: string;
  hash: string;
  timestamp: number;
  amount: string;
  recipient?: string;
  sender?: string;
  message?: string;
  status: 'success' | 'failed' | 'pending';
  fees: string;
  network: string;
  blockHeight: number;
  confirmations?: number;
  errorMessage?: string;
}

// Blockfrost API configuration
const BLOCKFROST_CONFIG = {
  preprod: {
    url: 'https://cardano-preprod.blockfrost.io/api/v0',
    // Use preprod key if available, otherwise fall back to mock data
    apiKey: process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || 'preprod_mock'
  },
  mainnet: {
    url: 'https://cardano-mainnet.blockfrost.io/api/v0',
    apiKey: process.env.NEXT_PUBLIC_BLOCKFROST_MAINNET_API_KEY || 'mainnet_mock'
  }
};

/**
 * Fetch transaction history for a given address from Cardano blockchain
 */
export async function fetchAddressTransactions(
  address: string, 
  network: 'preprod' | 'mainnet' = 'preprod',
  page: number = 1,
  count: number = 50
): Promise<ParsedTransaction[]> {
  try {
    const config = BLOCKFROST_CONFIG[network];
    
    // Fetch address transactions
    const response = await fetch(
      `${config.url}/addresses/${address}/transactions?page=${page}&count=${count}&order=desc`,
      {
        headers: {
          'project_id': config.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    const transactions = await response.json();
    
    // Parse each transaction
    const parsedTransactions: ParsedTransaction[] = [];
    
    for (const tx of transactions) {
      try {
        const txDetails = await fetchTransactionDetails(tx.tx_hash, network);
        const txMetadata = await fetchTransactionMetadata(tx.tx_hash, network);
        
        parsedTransactions.push({
          id: tx.tx_hash,
          hash: tx.tx_hash,
          timestamp: tx.block_time * 1000, // Convert to milliseconds
          amount: await calculateAccurateTransactionAmount(tx.tx_hash, address, network),
          recipient: getTransactionRecipient(txDetails, address),
          sender: getTransactionSender(txDetails, address),
          message: extractMessageFromMetadata(txMetadata),
          status: 'success', // If it's on blockchain, it's successful
          fees: (parseInt(txDetails.fees) / 1_000_000).toString(),
          network,
          blockHeight: tx.block_height,
          confirmations: await getCurrentBlockHeight(network) - tx.block_height
        });
      } catch (error) {
        console.error(`Error parsing transaction ${tx.tx_hash}:`, error);
      }
    }
    
    return parsedTransactions;
  } catch (error) {
    console.error('Error fetching address transactions:', error);
    throw error;
  }
}

/**
 * Fetch detailed transaction information
 */
async function fetchTransactionDetails(txHash: string, network: 'preprod' | 'mainnet'): Promise<BlockchainTransaction> {
  const config = BLOCKFROST_CONFIG[network];
  
  const response = await fetch(`${config.url}/txs/${txHash}`, {
    headers: {
      'project_id': config.apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transaction details: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch transaction metadata
 */
async function fetchTransactionMetadata(txHash: string, network: 'preprod' | 'mainnet'): Promise<TransactionMetadata[]> {
  const config = BLOCKFROST_CONFIG[network];
  
  try {
    const response = await fetch(`${config.url}/txs/${txHash}/metadata`, {
      headers: {
        'project_id': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return []; // No metadata found
      }
      throw new Error(`Failed to fetch transaction metadata: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching transaction metadata:', error);
    return [];
  }
}

/**
 * Get current block height
 */
async function getCurrentBlockHeight(network: 'preprod' | 'mainnet'): Promise<number> {
  const config = BLOCKFROST_CONFIG[network];
  
  const response = await fetch(`${config.url}/blocks/latest`, {
    headers: {
      'project_id': config.apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch current block height: ${response.status}`);
  }

  const block = await response.json();
  return block.height;
}

/**
 * Calculate accurate transaction amount by analyzing UTXOs
 */
async function calculateAccurateTransactionAmount(txHash: string, address: string, network: 'preprod' | 'mainnet'): Promise<string> {
  try {
    const utxos = await fetchTransactionUTXOs(txHash, network);
    
    // Calculate total ADA received by this address (outputs)
    let receivedAmount = 0;
    for (const output of utxos.outputs) {
      if (output.address === address) {
        const adaAmount = output.amount.find((a: any) => a.unit === 'lovelace');
        if (adaAmount) {
          receivedAmount += parseInt(adaAmount.quantity);
        }
      }
    }
    
    // Calculate total ADA spent by this address (inputs)
    let spentAmount = 0;
    for (const input of utxos.inputs) {
      if (input.address === address) {
        const adaAmount = input.amount.find((a: any) => a.unit === 'lovelace');
        if (adaAmount) {
          spentAmount += parseInt(adaAmount.quantity);
        }
      }
    }
    
    // Net amount for this address (positive = received, negative = sent)
    const netAmount = receivedAmount - spentAmount;
    
    // Convert from Lovelace to ADA and return absolute value
    return (Math.abs(netAmount) / 1_000_000).toString();
    
  } catch (error) {
    console.error('Error calculating accurate transaction amount:', error);
    // Fallback to simplified calculation
    return '0';
  }
}

/**
 * Calculate transaction amount for a specific address
 * This function needs proper UTXO analysis for accurate amounts
 */
function calculateTransactionAmount(txDetails: BlockchainTransaction, address: string): string {
  // TODO: This is a simplified calculation that doesn't give accurate per-address amounts
  // For proper implementation, we need to:
  // 1. Fetch transaction UTXOs (inputs and outputs)
  // 2. Calculate the difference for the specific address
  // 3. Account for fees and change outputs
  
  // For now, return a reasonable default based on output amounts
  // This will need to be replaced with proper UTXO analysis
  const lovelaceAmount = txDetails.output_amount.find(output => output.unit === 'lovelace');
  if (lovelaceAmount) {
    // Return a fraction of total output as a temporary workaround
    // In reality, this should be calculated from UTXO differences
    const totalAmount = parseInt(lovelaceAmount.quantity) / 1_000_000;
    
    // Simple heuristic: if it's a large amount, assume it's a balance transfer
    // and return a smaller portion as the actual transfer amount
    if (totalAmount > 1000) {
      return (totalAmount * 0.1).toFixed(6); // Return 10% as transfer amount
    } else if (totalAmount > 100) {
      return (totalAmount * 0.3).toFixed(6); // Return 30% as transfer amount  
    } else {
      return totalAmount.toFixed(6); // Return full amount for small transactions
    }
  }
  return '0';
}

/**
 * Get transaction recipient (simplified)
 */
function getTransactionRecipient(txDetails: BlockchainTransaction, senderAddress: string): string {
  // This would require fetching UTXOs to determine actual recipient
  return 'Unknown Recipient';
}

/**
 * Get transaction sender (simplified)
 */
function getTransactionSender(txDetails: BlockchainTransaction, address: string): string {
  return address; // Simplified - the address we're querying is the sender/receiver
}

/**
 * Extract message from transaction metadata
 */
function extractMessageFromMetadata(metadata: TransactionMetadata[]): string | undefined {
  for (const meta of metadata) {
    if (meta.label === '674' && meta.json_metadata) {
      // Standard message metadata label
      if (meta.json_metadata.msg && Array.isArray(meta.json_metadata.msg)) {
        return meta.json_metadata.msg.join(' ');
      }
      if (typeof meta.json_metadata === 'string') {
        return meta.json_metadata;
      }
    }
  }
  return undefined;
}

/**
 * Fetch transaction UTXOs for detailed input/output analysis
 */
export async function fetchTransactionUTXOs(txHash: string, network: 'preprod' | 'mainnet') {
  const config = BLOCKFROST_CONFIG[network];
  
  const response = await fetch(`${config.url}/txs/${txHash}/utxos`, {
    headers: {
      'project_id': config.apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transaction UTXOs: ${response.status}`);
  }

  return response.json();
}

/**
 * Mock function for development when Blockfrost API is not available
 * Generates realistic payment transfer scenarios
 */
export function getMockTransactions(address: string): ParsedTransaction[] {
  const currentTime = Date.now();
  
  return [
    {
      id: 'payment_001',
      hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
      timestamp: currentTime - 3600000, // 1 hour ago
      amount: '25.0',
      recipient: 'addr_test1qpw3sjcca3w0lkqfqfmu8me4m9vz4g2z8kqlu9l2j8h4z9kx7l8f9',
      sender: address,
      message: 'Payment for coffee and lunch',
      status: 'success',
      fees: '0.2',
      network: 'preprod',
      blockHeight: 98765,
      confirmations: 15
    },
    {
      id: 'payment_002', 
      hash: 'b2c3d4e5f67890123456789012345678901234567890123456789012345bcde',
      timestamp: currentTime - 7200000, // 2 hours ago
      amount: '50.0',
      recipient: 'addr_test1qqz4w3m6r8t9y5u7i1o3p4a5s6d7f8g9h0j2k3l4m5n6b8c9d0e1f2',
      sender: address,
      message: 'Rent payment for this month',
      status: 'success',
      fees: '0.18',
      network: 'preprod',
      blockHeight: 98760,
      confirmations: 20
    },
    {
      id: 'payment_003',
      hash: 'c3d4e5f678901234567890123456789012345678901234567890123456cdef',
      timestamp: currentTime - 86400000, // 1 day ago
      amount: '5.5',
      recipient: 'addr_test1qr5t6y7u8i9o0p1q2w3e4r5t6y7u8i9o0p1q2w3e4r5t6y7u8i9o0',
      sender: address,
      message: 'Gift for birthday',
      status: 'success',
      fees: '0.15',
      network: 'preprod',
      blockHeight: 98650,
      confirmations: 120
    },
    {
      id: 'payment_004',
      hash: 'd4e5f67890123456789012345678901234567890123456789012345678def0',
      timestamp: currentTime - 172800000, // 2 days ago
      amount: '15.75',
      recipient: 'addr_test1qqs6d7f8g9h0j1k2l3m4n5b6v7c8x9z0a1s2d3f4g5h6j7k8l9m0',
      sender: address,
      message: 'Freelance work payment',
      status: 'success',
      fees: '0.22',
      network: 'preprod',
      blockHeight: 98500,
      confirmations: 280
    },
    {
      id: 'payment_005',
      hash: 'e5f6789012345678901234567890123456789012345678901234567890ef01',
      timestamp: currentTime - 259200000, // 3 days ago
      amount: '8.25',
      recipient: 'addr_test1qqg7h8j9k0l1m2n3b4v5c6x7z8a9s0d1f2g3h4j5k6l7m8n9b0v1',
      sender: address,
      message: 'Dinner at restaurant',
      status: 'success',
      fees: '0.17',
      network: 'preprod',
      blockHeight: 98400,
      confirmations: 380
    },
    {
      id: 'payment_006',
      hash: 'f67890123456789012345678901234567890123456789012345678901234f012',
      timestamp: currentTime - 345600000, // 4 days ago
      amount: '100.0',
      recipient: 'addr_test1qqx8z9a0s1d2f3g4h5j6k7l8m9n0b1v2c3x4z5a6s7d8f9g0h1j2k3',
      sender: address,
      message: 'Investment in crypto portfolio',
      status: 'success',
      fees: '0.25',
      network: 'preprod',
      blockHeight: 98300,
      confirmations: 480
    },
    {
      id: 'received_001',
      hash: '789012345678901234567890123456789012345678901234567890123456780',
      timestamp: currentTime - 432000000, // 5 days ago
      amount: '75.0',
      recipient: address,
      sender: 'addr_test1qqa9s0d1f2g3h4j5k6l7m8n9b0v1c2x3z4a5s6d7f8g9h0j1k2l3m4',
      message: 'Salary payment received',
      status: 'success',
      fees: '0.19',
      network: 'preprod',
      blockHeight: 98200,
      confirmations: 580
    },
    {
      id: 'payment_007',
      hash: '890123456789012345678901234567890123456789012345678901234567890',
      timestamp: currentTime - 518400000, // 6 days ago
      amount: '3.5',
      recipient: 'addr_test1qqb0v1c2x3z4a5s6d7f8g9h0j1k2l3m4n5b6v7c8x9z0a1s2d3f4g5',
      sender: address,
      message: 'Tip for delivery',
      status: 'success',
      fees: '0.14',
      network: 'preprod',
      blockHeight: 98100,
      confirmations: 680
    },
    {
      id: 'failed_001',
      hash: '901234567890123456789012345678901234567890123456789012345678901',
      timestamp: currentTime - 604800000, // 7 days ago
      amount: '20.0',
      recipient: 'addr_test1qqc1x2z3a4s5d6f7g8h9j0k1l2m3n4b5v6c7x8z9a0s1d2f3g4h5j6',
      sender: address,
      message: 'Testing transaction - failed',
      status: 'failed',
      fees: '0.2',
      network: 'preprod',
      blockHeight: 98000,
      confirmations: 0,
      errorMessage: 'Insufficient funds in wallet'
    }
  ];
}

/**
 * Check if Blockfrost API is available for Preprod
 */
export function isBlockfrostAvailable(): boolean {
  const preprodKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
  
  // Check if we have a real preprod API key
  return !!(preprodKey && preprodKey !== 'preprod_mock' && preprodKey.startsWith('preprod'));
}

/**
 * Get network based on available API keys
 */
export function getAvailableNetwork(): 'preprod' | 'mainnet' | null {
  const preprodKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
  const mainnetKey = process.env.NEXT_PUBLIC_BLOCKFROST_MAINNET_API_KEY;
  
  if (preprodKey && preprodKey.startsWith('preprod')) {
    return 'preprod';
  }
  if (mainnetKey && mainnetKey.startsWith('mainnet')) {
    return 'mainnet';
  }
  return null;
}