import { useState, useEffect } from 'react';
import { useWallet } from '@meshsdk/react';
import Link from 'next/link';
import { fetchAddressTransactions, getMockTransactions, isBlockfrostAvailable } from '../utils/blockchain';
import { categorizeTransactionsWithAI, AVAILABLE_CATEGORIES, getAvailableProviders, isAICategorationAvailable } from '../utils/aiCategorization';

interface Transaction {
  id: string;
  timestamp: number;
  amount: string;
  recipient?: string;
  sender?: string;
  message?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  txHash?: string;
  hash?: string;
  network: string;
  fees?: string;
  blockHeight?: number;
  confirmations?: number;
  balance?: string;
}

interface TransactionCategory {
  title: string;
  transactions: Transaction[];
  color: string;
  icon: string;
}

interface MessageCategory {
  category: string;
  transactions: Transaction[];
  color: string;
  icon: string;
  confidence?: number;
  reasoning?: string;
}

export default function Dashboard() {
  const { connected, wallet } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('gemini');
  const [aiCategories, setAiCategories] = useState<MessageCategory[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory | null>(null);

  // Load blockchain transactions when component mounts
  useEffect(() => {
    if (connected && wallet && walletAddress) {
      fetchBlockchainTransactions();
    }
  }, [connected, wallet, walletAddress]);

  // Auto-categorize with AI when transactions are loaded
  useEffect(() => {
    if (transactions.length > 0 && !aiCategorizing && aiCategories.length === 0) {
      const txsWithMessages = transactions.filter(tx => tx.message && tx.message.trim() !== '');
      if (txsWithMessages.length > 0) {
        console.log('Auto-categorizing transactions with AI...');
        categorizeByMessagesWithAI();
      }
    }
  }, [transactions, aiCategorizing, aiCategories.length]);

  // Get wallet address when connected
  useEffect(() => {
    if (connected && wallet) {
      getWalletAddress();
    } else {
      setTransactions([]);
      setWalletAddress('');
      setError('');
    }
  }, [connected, wallet]);

  const getWalletAddress = async () => {
    try {
      if (wallet) {
        const addresses = await wallet.getUsedAddresses();
        if (addresses.length > 0) {
          setWalletAddress(addresses[0]);
        }
      }
    } catch (error) {
      console.error('Error getting wallet address:', error);
    }
  };

  const fetchBlockchainTransactions = async () => {
    if (!walletAddress) {
      setError('No wallet address available');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let blockchainTxs: Transaction[] = [];

      if (isBlockfrostAvailable()) {
        // Use real Blockfrost API for Preprod network
        const fetchedTxs = await fetchAddressTransactions(walletAddress, 'preprod', 1, 50);
        blockchainTxs = fetchedTxs.map(tx => ({
          id: tx.hash,
          timestamp: tx.timestamp,
          amount: tx.amount,
          recipient: tx.recipient || 'Unknown',
          sender: tx.sender,
          message: tx.message,
          status: tx.status,
          txHash: tx.hash,
          hash: tx.hash,
          network: 'preprod',
          fees: tx.fees,
          blockHeight: tx.blockHeight,
          confirmations: tx.confirmations
        }));
      } else {
        // Use mock data for development
        const mockTxs = getMockTransactions(walletAddress);
        blockchainTxs = mockTxs.map(tx => ({
          id: tx.hash,
          timestamp: tx.timestamp,
          amount: tx.amount,
          recipient: tx.recipient || 'Unknown',
          sender: tx.sender,
          message: tx.message,
          status: tx.status,
          txHash: tx.hash,
          hash: tx.hash,
          network: 'preprod',
          fees: tx.fees,
          blockHeight: tx.blockHeight,
          confirmations: tx.confirmations
        }));
      }

      setTransactions(blockchainTxs);
    } catch (error) {
      console.error('Error fetching blockchain transactions:', error);
      setError(`Failed to fetch blockchain data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Categorize transactions by status and error types
  const categorizeTransactions = (): TransactionCategory[] => {
    const successful = transactions.filter(tx => tx.status === 'success');
    const pending = transactions.filter(tx => tx.status === 'pending');
    const failed = transactions.filter(tx => tx.status === 'failed');

    // Group failed transactions by error type
    const failedByError = failed.reduce((acc, tx) => {
      const errorType = getErrorCategory(tx.errorMessage || '');
      if (!acc[errorType]) {
        acc[errorType] = [];
      }
      acc[errorType].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const categories: TransactionCategory[] = [
      {
        title: 'Successful Transactions',
        transactions: successful,
        color: 'bg-green-100 border-green-300 text-green-800',
        icon: '✅'
      },
      {
        title: 'Pending Transactions',
        transactions: pending,
        color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        icon: '⏳'
      }
    ];

    // Add failed transaction categories
    Object.entries(failedByError).forEach(([errorType, txs]) => {
      categories.push({
        title: `Failed: ${errorType}`,
        transactions: txs,
        color: 'bg-red-100 border-red-300 text-red-800',
        icon: '❌'
      });
    });

    return categories;
  };

  // AI-powered categorization of transactions by message content
  const categorizeByMessagesWithAI = async (): Promise<void> => {
    // Only include transactions with messages
    const txsWithMessages = transactions.filter(tx => tx.message && tx.message.trim() !== '');

    console.log('Starting AI categorization...');
    console.log('Transactions with messages:', txsWithMessages.length);
    console.log('AI Provider:', aiProvider);
    console.log('Sample messages:', txsWithMessages.slice(0, 3).map(tx => tx.message));

    if (txsWithMessages.length === 0) {
      setError('No transactions with messages found. AI categorization requires transactions that have message content.');
      setAiCategories([]);
      return;
    }

    setAiCategorizing(true);
    setError(''); // Clear any previous errors

    try {
      // Extract messages for AI processing
      const messages = txsWithMessages.map(tx => tx.message!);
      console.log('Sending messages to AI:', messages);

      // Get AI categorization
      const aiResults = await categorizeTransactionsWithAI(messages, aiProvider);
      console.log('AI Results received:', aiResults);

      // Group transactions by AI categories
      const categoryMap = new Map<string, MessageCategory>();

      // Initialize categories from AI results
      aiResults.forEach((result, index) => {
        const transaction = txsWithMessages[index];
        const categoryName = result.category.category;

        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            category: categoryName,
            transactions: [],
            color: result.category.color,
            icon: result.category.icon,
            confidence: result.category.confidence,
            reasoning: result.category.reasoning
          });
        }

        categoryMap.get(categoryName)!.transactions.push(transaction);
      });

      // Convert to array and sort by transaction count
      const categories = Array.from(categoryMap.values())
        .sort((a, b) => b.transactions.length - a.transactions.length);

      console.log('Final categories:', categories);
      setAiCategories(categories);

      // Show success message
      if (categories.length > 0) {
        setError(''); // Clear any errors
      }

    } catch (error) {
      console.error('AI categorization failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`AI categorization failed: ${errorMessage}`);
      setAiCategories([]);
    } finally {
      setAiCategorizing(false);
    }
  };

  // Legacy keyword-based categorization (fallback)
  const categorizeByMessages = (): MessageCategory[] => {
    return aiCategories;
  };

  // Categorize error messages
  const getErrorCategory = (errorMessage: string): string => {
    const message = errorMessage.toLowerCase();

    if (message.includes('insufficient') || message.includes('depleted')) {
      return 'Insufficient Funds';
    }
    if (message.includes('declined') || message.includes('cancelled')) {
      return 'User Cancelled';
    }
    if (message.includes('network') || message.includes('connection')) {
      return 'Network Issues';
    }
    if (message.includes('address') || message.includes('invalid')) {
      return 'Invalid Address';
    }
    if (message.includes('timeout')) {
      return 'Timeout';
    }
    return 'Other Errors';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString() + ' ' +
      new Date(timestamp).toLocaleTimeString();
  };

  const formatAmount = (amount: string) => {
    return `${parseFloat(amount).toFixed(6)} ADA`;
  };

  const categories = categorizeTransactions();
  const messageCategories = categorizeByMessages();

  if (loading) {
    return (
      <div className="min-h-screen geometric-pattern rule-book-pattern flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 border text-center">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <div className="text-gray-600">Fetching transactions from Cardano Preprod network...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="geometric-pattern">
      <div className="page-container">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-heading">
                Transaction Dashboard
              </h1>
              <p className="text-slate-300">
                View and analyze your Cardano transaction history on Preprod network
              </p>
            </div>
            <Link
              href="/"
              className="btn btn-secondary"
            >
              ← Back to Wallet
            </Link>
          </div>
        </div>

        {/* Connection Status */}
        {!connected && (
          <div className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="text-yellow-600 mr-3 text-2xl">⚠️</div>
                <div>
                  <h3 className="font-medium text-yellow-800">Wallet Not Connected</h3>
                  <p className="text-yellow-700 text-sm">
                    Connect your wallet from the main page to see live transaction data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Source Controls */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">

              <div className="flex items-center justify-between">
                <div >
                  <h3 className="text-subheading mb-0">Blockchain Transaction Data</h3>
                  <p className="text-sm text-slate-500 ">
                    Real-time data from Cardano Preprod (Testnet) network
                  </p>
                </div>

                <div className="flex items-center gap-4 ml-5 space-x-2">
                  <div className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    PREPROD
                  </div>
                  <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Blockchain Data
                  </div>
                </div>
              </div>
              {connected && walletAddress && (
                <div className="mt-3 text-xs text-gray-500">
                  <span className="font-medium">Wallet Address:</span>
                  <span className="font-mono ml-1">{walletAddress.slice(0, 20)}...{walletAddress.slice(-10)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="card-body">
            <div className="flex flex-wrap gap-3">
              {isAICategorationAvailable() && (
                <button
                  onClick={categorizeByMessagesWithAI}
                  disabled={aiCategorizing || transactions.filter(tx => tx.message && tx.message.trim() !== '').length === 0}
                  className={`btn ${aiCategorizing ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                >
                  {aiCategorizing ? (
                    <>
                      <div className="spinner mr-2"></div>
                      AI Analyzing...
                    </>
                  ) : aiCategories.length > 0 ? (
                    <>
                      🔄 Re-categorize with AI
                    </>
                  ) : (
                    <>
                      🤖 Categorize with AI
                    </>
                  )}
                </button>
              )}

              <button
                onClick={fetchBlockchainTransactions}
                disabled={loading}
                className={`btn btn-secondary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="spinner mr-2"></div>
                    Loading...
                  </>
                ) : (
                    <>
                   
                    Refresh Data
                    </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* AI Categories Bar Graph */}
        {aiCategories.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-subheading mb-0 flex items-center">
                📊 AI Transaction Categories
                <span className="ml-3 text-sm px-3 py-1 rounded-full bg-purple-100 text-purple-800 font-normal">
                  🤖 Auto-categorized using {aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)}
                </span>
              </h3>
              <p className="text-gray-600 text-sm">
                Intelligent categorization of transactions based on message content
              </p>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {aiCategories.map((category, index) => {
                  const maxTransactions = Math.max(...aiCategories.map(c => c.transactions.length));
                  const percentage = (category.transactions.length / maxTransactions) * 100;

                  return (
                    <div key={index} className="group">
                      {/* Category Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{category.icon}</span>
                          <div>
                            <h4 className="font-semibold text-slate-200 text-xl">{category.category}</h4>
                            {category.reasoning && (
                              <p className="text-xs text-gray-500">
                                {category.reasoning}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {category.transactions.length}
                          </div>
                        </div>
                      </div>

                      {/* Bar Graph */}
                      <div
                        className="relative h-12 bg-gray-100 rounded-xl overflow-hidden shadow-inner cursor-pointer hover:shadow-md transition-shadow duration-200"
                        onClick={() => {
                          setSelectedCategory(category);
                          setModalVisible(true);
                        }}
                      >
                        <div
                          className={`absolute left-0 top-0 h-full rounded-xl transition-all duration-1000 ease-out ${category.color.replace('bg-', 'bg-gradient-to-r from-').replace('-100', '-400 to-').replace(' text-', '-300 shadow-lg')}`}
                          style={{ width: `${percentage}%` }}
                        >
                          <div className="absolute inset-0 bg-white bg-opacity-20 rounded-xl"></div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black from-0% to-transparent to-30% opacity-10 rounded-xl"></div>
                        </div>

                        {/* Transaction Count Label */}
                        <div className="absolute inset-0 flex items-center justify-center text-gray-700 font-medium text-sm">
                          {category.transactions.length} transaction{category.transactions.length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Transaction Details - Expandable */}
                      <div className="mt-3 space-y-2 max-h-0 group-hover:max-h-96 overflow-hidden transition-all duration-300">
                        {category.transactions.slice(0, 3).map((tx) => (
                          <div key={tx.id} className="bg-gray-50 rounded-lg p-3 border-l-4" style={{ borderLeftColor: category.color.includes('blue') ? '#3b82f6' : category.color.includes('green') ? '#10b981' : category.color.includes('purple') ? '#8b5cf6' : category.color.includes('orange') ? '#f59e0b' : '#6b7280' }}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-1">
                                  <span className="font-medium text-gray-900">
                                    {tx.recipient === walletAddress ? (
                                      <span className="text-green-700">↓ Received {formatAmount(tx.amount)}</span>
                                    ) : tx.sender === walletAddress ? (
                                      <span className="text-red-600">↑ Sent {formatAmount(tx.amount)}</span>
                                    ) : (
                                      <span className="text-gray-600">↔ Transfer {formatAmount(tx.amount)}</span>
                                    )}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {formatDate(tx.timestamp)}
                                  </span>
                                </div>
                                {tx.message && (
                                  <div className="text-sm text-gray-700 bg-white p-2 rounded border-l-4 border-blue-300">
                                    <span className="font-medium">Message:</span> "{tx.message}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {category.transactions.length > 3 && (
                          <div className="text-center py-2">
                            <span className="text-sm text-gray-500">
                              +{category.transactions.length - 3} more transaction{category.transactions.length - 3 !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="card">
            <div className="card-body">
              <div className="status-error">
                <div className="flex items-center">
                  <div className="text-red-600 mr-3 text-2xl">❌</div>
                  <div>
                    <h3 className="font-medium text-red-800">Error</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl mb-2">📊</div>
              <div>
                <p className="text-sm text-slate-500 ">Total Transactions</p>
                <p className="text-2xl font-bold text-slate-200">{transactions.length}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl mb-2">↑</div>
              <div>
                <p className="text-sm text-slate-500 ">Sent</p>
                <p className="text-2xl font-bold text-red-600">
                  {transactions.filter(tx => tx.status === 'success' && tx.sender === walletAddress).length}
                </p>
                <p className="text-xs text-gray-500">
                  {transactions
                    .filter(tx => tx.status === 'success' && tx.sender === walletAddress)
                    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
                    .toFixed(2)} ADA
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl mb-2">↓</div>
              <div>
                <p className="text-sm text-slate-500 ">Received</p>
                <p className="text-2xl font-bold text-green-600">
                  {transactions.filter(tx => tx.status === 'success' && tx.recipient === walletAddress).length}
                </p>
                <p className="text-xs text-gray-500">
                  {transactions
                    .filter(tx => tx.status === 'success' && tx.recipient === walletAddress)
                    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
                    .toFixed(2)} ADA
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl mb-2">❌</div>
              <div>
                <p className="text-sm text-slate-500 ">Failed</p>
                <p className="text-2xl font-bold text-red-600">
                  {transactions.filter(tx => tx.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl mb-2">⏳</div>
              <div>
                <p className="text-sm text-slate-500 ">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {transactions.filter(tx => tx.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Categories */}
        {transactions.length === 0 && !loading ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center border">
            <div className="text-4xl mb-4">�</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Blockchain Transactions Found</h3>
            <p className="text-gray-600 mb-4">
              {!connected
                ? "Connect your wallet to view blockchain transaction history."
                : !walletAddress
                  ? "Getting wallet address..."
                  : "No transactions found for this wallet address on the blockchain."
              }
            </p>
            {!connected && (
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Connect Wallet →
              </Link>
            )}
            {connected && walletAddress && (
              <button
                onClick={fetchBlockchainTransactions}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {loading ? 'Loading...' : 'Refresh Blockchain Data'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((category, index) => (
              category.transactions.length > 0 && (
                <div key={index} className="bg-white rounded-lg shadow-md border overflow-hidden">
                  <div className={`p-4 border-b ${category.color}`}>
                    <h3 className="font-semibold flex items-center">
                      <span className="mr-2">{category.icon}</span>
                      {category.title}
                      <span className="ml-2 text-sm font-normal">
                        ({category.transactions.length})
                      </span>
                    </h3>
                  </div>
                  <div className="divide-y">
                    {category.transactions.map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-2">
                              {/* Payment Direction and Amount */}
                              <div className="flex items-center space-x-2">
                                {tx.recipient === walletAddress ? (
                                  <span className="text-green-600 font-semibold">
                                    ↓ Received {formatAmount(tx.amount)}
                                  </span>
                                ) : tx.sender === walletAddress ? (
                                  <>
                                    <span className="text-red-600 font-semibold">
                                      ↑ Sent {formatAmount(tx.amount)}
                                    </span>
                                    {
                                      tx.balance &&
                                      <span className="ml-3 text-xs text-gray-700">
                                        | Balance: {formatAmount(String(tx.balance))}
                                      </span>
                                    }
                                  </>
                                ) : (
                                  <span className="text-gray-600 font-semibold">
                                    ⚡ Transfer {formatAmount(tx.amount)}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">
                                {formatDate(tx.timestamp)}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${tx.network === 'preprod'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                                }`}>
                                {tx.network}
                              </span>
                              {tx.confirmations && (
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                  {tx.confirmations} confirmations
                                </span>
                              )}
                            </div>

                            {/* Transfer Details */}
                            {tx.recipient === walletAddress ? (
                              // Received payment
                              tx.sender && (
                                <div className="text-sm text-slate-500  mb-1">
                                  <span className="text-green-600 font-medium">From:</span>
                                  <span className="font-mono text-xs ml-1">
                                    {tx.sender.slice(0, 20)}...{tx.sender.slice(-10)}
                                  </span>
                                </div>
                              )
                            ) : tx.sender === walletAddress ? (
                              // Sent payment
                              tx.recipient && (
                                <div className="text-sm text-slate-500  mb-1">
                                  <span className="text-red-600 font-medium">To:</span>
                                  <span className="font-mono text-xs ml-1">
                                    {tx.recipient.slice(0, 20)}...{tx.recipient.slice(-10)}
                                  </span>
                                </div>
                              )
                            ) : (
                              // Unknown direction - show both if available
                              <div className="text-sm text-slate-500  mb-1">
                                {tx.sender && (
                                  <div>
                                    <span className="text-gray-600 font-medium">From:</span>
                                    <span className="font-mono text-xs ml-1">
                                      {tx.sender.slice(0, 20)}...{tx.sender.slice(-10)}
                                    </span>
                                  </div>
                                )}
                                {tx.recipient && (
                                  <div>
                                    <span className="text-gray-600 font-medium">To:</span>
                                    <span className="font-mono text-xs ml-1">
                                      {tx.recipient.slice(0, 20)}...{tx.recipient.slice(-10)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            {tx.fees && (
                              <div className="text-sm text-slate-500  mb-1">
                                Fees: <span className="font-medium">{parseFloat(tx.fees).toFixed(6)} ADA</span>
                              </div>
                            )}
                            {tx.blockHeight && (
                              <div className="text-sm text-slate-500  mb-1">
                                Block: <span className="font-mono">{tx.blockHeight}</span>
                              </div>
                            )}
                            {tx.message && (
                              <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded border-l-4 border-blue-200 mb-2">
                                <span className="font-medium">Message:</span> "{tx.message}"
                              </div>
                            )}
                            {tx.errorMessage && (
                              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border-l-4 border-red-200">
                                <span className="font-medium">Error:</span> {tx.errorMessage}
                              </div>
                            )}
                            {(tx.txHash || tx.hash) && (
                              <div className="text-xs text-blue-600 mt-2">
                                <a
                                  href={tx.network === 'preprod'
                                    ? `https://preprod.cardanoscan.io/transaction/${tx.txHash || tx.hash}`
                                    : `https://cardanoscan.io/transaction/${tx.txHash || tx.hash}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline inline-flex items-center"
                                >
                                  View on Explorer
                                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Category Details Modal */}
      {modalVisible && selectedCategory && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setModalVisible(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{selectedCategory.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold">{selectedCategory.category}</h2>
                    <p className="text-purple-100 text-sm">
                      {selectedCategory.transactions.length} transaction{selectedCategory.transactions.length !== 1 ? 's' : ''}

                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalVisible(false)}
                  className="text-white hover:text-purple-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedCategory.reasoning && (
                <div className="mt-3 p-3 bg-white bg-opacity-20 rounded-lg">
                  <p className="text-sm text-purple-100">
                    <span className="font-medium">AI Reasoning:</span> {selectedCategory.reasoning}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {selectedCategory.transactions.map((tx) => (
                  <div key={tx.id} className="bg-gray-50 rounded-xl p-4 border-l-4 hover:bg-gray-100 transition-colors"
                    style={{ borderLeftColor: selectedCategory.color.includes('blue') ? '#3b82f6' : selectedCategory.color.includes('green') ? '#10b981' : selectedCategory.color.includes('purple') ? '#8b5cf6' : selectedCategory.color.includes('orange') ? '#f59e0b' : '#6b7280' }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="font-medium text-gray-900">
                            {tx.recipient === walletAddress ? (
                              <span className="text-green-700 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                </svg>
                                Received {formatAmount(tx.amount)}
                              </span>
                            ) : tx.sender === walletAddress ? (
                              <span className="text-red-600 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                </svg>
                                Sent {formatAmount(tx.amount)}
                              </span>
                            ) : (
                              <span className="text-gray-600 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                Transfer {formatAmount(tx.amount)}
                              </span>
                            )}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(tx.timestamp)}
                          </span>
                        </div>

                        {tx.message && (
                          <div className="text-sm text-gray-700 bg-white p-3 rounded-lg border-l-4 border-blue-300 mb-2">
                            <span className="font-medium">Message:</span> "{tx.message}"
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          <span className="bg-gray-200 px-2 py-1 rounded">
                            Status: <span className={tx.status === 'success' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}>
                              {tx.status}
                            </span>
                          </span>
                          <span className="bg-gray-200 px-2 py-1 rounded">
                            Network: {tx.network}
                          </span>
                          {tx.fees && (
                            <span className="bg-gray-200 px-2 py-1 rounded">
                              Fees: {formatAmount(tx.fees)}
                            </span>
                          )}
                          {tx.confirmations && (
                            <span className="bg-gray-200 px-2 py-1 rounded">
                              Confirmations: {tx.confirmations}
                            </span>
                          )}
                        </div>

                        {(tx.txHash || tx.hash) && (
                          <div className="mt-2">
                            <a
                              href={`https://cardanoscan.io/transaction/${tx.txHash || tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs inline-flex items-center"
                            >
                              View on Explorer
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setModalVisible(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}