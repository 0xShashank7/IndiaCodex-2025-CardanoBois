import { useState, useEffect } from "react";
import type { NextPage } from "next";
import { useWallet } from '@meshsdk/react';
import { CardanoWallet, MeshProvider } from '@meshsdk/react';
import { Transaction, resolveScriptHash } from '@meshsdk/core';
import Link from 'next/link';

const Home: NextPage = () => {
  const { connected, wallet } = useWallet();
  const [assets, setAssets] = useState<null | any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Network is fixed to preprod
  const [network, setNetwork] = useState('preprod');
  
  // Send money states
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [sendMessage, setSendMessage] = useState<string>("");
  const [sendLoading, setSendLoading] = useState<boolean>(false);
  const [sendStatus, setSendStatus] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [sentMessage, setSentMessage] = useState<string>(""); // Store sent message for success display
  const [balance, setBalance] = useState<string>("0");
  const [balanceError, setBalanceError] = useState<string>("");

  async function getAssets() {
    if (wallet) {
      try {
        setLoading(true);
        setBalanceError("");
        
        console.log('Fetching wallet assets and balance...');
        
        // Get assets
        const _assets = await wallet.getAssets();
        setAssets(_assets);
        console.log('Assets fetched:', _assets);
        
        // Get ADA balance with improved error handling
        const _balance = await wallet.getBalance();
        console.log('Raw balance data:', _balance);
        
        if (!_balance || _balance.length === 0) {
          setBalanceError("No balance data received from wallet");
          setBalance("0");
        } else {
          const adaBalance = _balance.find(asset => asset.unit === 'lovelace');
          console.log('ADA balance found:', adaBalance);
          
          if (adaBalance) {
            const balanceInAda = (parseInt(adaBalance.quantity) / 1_000_000).toFixed(6);
            setBalance(balanceInAda);
            console.log('Balance set to:', balanceInAda, 'ADA');
          } else {
            setBalanceError("No ADA (lovelace) found in wallet");
            setBalance("0");
            console.log('No lovelace unit found in balance array');
          }
        }
        
      } catch (error) {
        console.error('Error fetching assets/balance:', error);
        setBalanceError(`Error: ${error instanceof Error ? error.message : 'Failed to fetch balance'}`);
        setBalance("0");
      } finally {
        setLoading(false);
      }
    }
  }

  // Function to save transaction to localStorage
  const saveTransaction = (transaction: {
    amount: string;
    recipient: string;
    message?: string;
    status: 'success' | 'failed' | 'pending';
    errorMessage?: string;
    txHash?: string;
  }) => {
    try {
      const storedTransactions = localStorage.getItem('cardano_transactions');
      const transactions = storedTransactions ? JSON.parse(storedTransactions) : [];
      
      const newTransaction = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        network,
        ...transaction
      };
      
      transactions.unshift(newTransaction); // Add to beginning
      
      // Keep only last 100 transactions
      if (transactions.length > 100) {
        transactions.splice(100);
      }
      
      localStorage.setItem('cardano_transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  // Automatically fetch balance when wallet connects
  useEffect(() => {
    if (connected && wallet) {
      console.log('Wallet connected, automatically fetching balance...');
      getAssets();
    } else if (!connected) {
      // Reset states when wallet disconnects
      setAssets(null);
      setBalance("0");
      setBalanceError("");
      setSendStatus("");
      setTxHash("");
      setSentMessage("");
      setRecipientAddress("");
      setSendAmount("");
      setSendMessage("");
    }
  }, [connected, wallet]);

  async function sendAda() {
    if (!wallet || !recipientAddress || !sendAmount) return;
    
    try {
      setSendLoading(true);
      setSendStatus("Validating transaction...");
      setTxHash("");

      // Validate address format (network-specific check)
      const addressPrefix = network === 'preprod' ? 'addr_test1' : 'addr1';
      if (!recipientAddress.startsWith(addressPrefix)) {
        throw new Error(`Invalid ${network} address format. Address must start with "${addressPrefix}"`);
      }

      // Validate amount
      const sendAmountNum = parseFloat(sendAmount);
      if (sendAmountNum <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Check balance before proceeding
      setSendStatus("Checking balance...");
      const walletBalance = await wallet.getBalance();
      const adaBalance = walletBalance.find(asset => asset.unit === 'lovelace');
      
      if (!adaBalance) {
        throw new Error('Unable to retrieve wallet balance');
      }

      const balanceInAda = parseInt(adaBalance.quantity) / 1_000_000;
      const minRequired = sendAmountNum + 2; // Add 2 ADA buffer for fees
      
      if (balanceInAda < minRequired) {
        throw new Error(`Insufficient balance. You have ${balanceInAda.toFixed(6)} ADA, but need at least ${minRequired.toFixed(6)} ADA (including ~2 ADA for fees)`);
      }

      // Convert ADA to Lovelace (1 ADA = 1,000,000 Lovelace)
      const amountInLovelace = (sendAmountNum * 1_000_000).toString();

      setSendStatus("Building transaction...");
      
      // Build transaction with message metadata
      const tx = new Transaction({ initiator: wallet });
      tx.sendLovelace(recipientAddress, amountInLovelace);
      
      // Add message metadata if provided
      if (sendMessage.trim()) {
        const metadata = {
          "674": {
            "msg": [sendMessage.trim()]
          }
        };
        tx.setMetadata(674, metadata[674]);
        console.log('Adding metadata to transaction:', metadata);
      }

      const unsignedTx = await tx.build();
      
      setSendStatus("Waiting for signature...");
      const signedTx = await wallet.signTx(unsignedTx);
      
      setSendStatus("Submitting transaction...");
      const txHash = await wallet.submitTx(signedTx);
      
      setTxHash(txHash);
      setSentMessage(sendMessage); // Store the sent message for display
      setSendStatus("success");
      
      // Save successful transaction to localStorage
      saveTransaction({
        amount: sendAmount,
        recipient: recipientAddress,
        message: sendMessage || undefined,
        status: 'success',
        txHash: txHash
      });
      
      // Clear form
      setRecipientAddress("");
      setSendAmount("");
      setSendMessage("");
      
      // Refresh assets after successful transaction
      setTimeout(() => getAssets(), 2000);
      
    } catch (error) {
      console.error('Transaction failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Transaction failed';
      
      if (error instanceof Error) {
        if (error.message.includes('UTxO Fully Depleted')) {
          errorMessage = 'Insufficient funds. Please ensure you have enough ADA to cover the transaction amount plus network fees (~2 ADA).';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds in your wallet.';
        } else if (error.message.includes('User declined')) {
          errorMessage = 'Transaction was cancelled by user.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setSendStatus(`Error: ${errorMessage}`);
      
      // Save failed transaction to localStorage
      saveTransaction({
        amount: sendAmount,
        recipient: recipientAddress,
        message: sendMessage || undefined,
        status: 'failed',
        errorMessage: errorMessage
      });
    } finally {
      setSendLoading(false);
    }
  }

  return (
    <div className="geometric-pattern">
      <div className="page-container">
        {/* Header Section */}
        <div className="text-center mb-2">
          <div className="flex justify-between items-start ">
            <div></div> {/* Empty div for balance */}
            <div className="flex-1">
              <h1 className="text-heading text-left">
                Cardano Bois
              </h1>
              <p className="text-lg text-slate-300 max-w-xl text-left font-light leading-relaxed">
                A minimal interface for your Cardano wallet connection
              </p>
              <div className="w-24 h-px bg-gradient-to-r from-transparent via-slate-500 to-transparent mx-auto my-6"></div>
            </div>
            <div className="flex items-center">
              <Link 
                href="/dashboard"
                className="btn btn-secondary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Network Information */}
        <div className="flex justify-center mb-8">
          <div className="card w-full">
            <div className="card-body">
              <div className="flex items-center space-x-6">
                <span className="text-sm font-medium text-slate-300">Network:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setNetwork('preprod')}
                    disabled={connected}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      network === 'preprod'
                        ? 'bg-blue-900 text-blue-300 border border-blue-700'
                        : connected
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                        : 'bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${network === 'preprod' ? 'bg-blue-400' : 'bg-slate-500'}`}></div>
                      <span>Preprod (Testnet)</span>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Network Status */}
              {connected && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-xs text-orange-700 font-medium text-center">
                    💡 Disconnect wallet to switch networks. Network changes require reconnection.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Wallet Connection Card */}
          <div className="card wallet-card">
            <div className="card-body text-center">
              <h2 className="text-subheading">Connect Wallet</h2>
              <p className="text-slate-500 mb-8 font-light">Choose your preferred Cardano wallet</p>
              
              <div className="inline-block text-black transform transition-all duration-300 hover:scale-105">
                <CardanoWallet 
                  // Force re-render when network changes by adding key
                  key={network}
                />
              </div>
              
              {/* Network Status */}
              <div className="mt-6 text-sm text-slate-500 font-light">
                {connected ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Wallet Connected</span>
                    </div>
                    <div>
                      Network: <span className={`font-medium ${network === 'preprod' ? 'text-blue-600' : 'text-red-600'}`}>
                        {network === 'preprod' ? 'Preprod Testnet' : 'Cardano Mainnet'}
                      </span>
                    </div>
                    {loading && (
                      <div className="text-xs text-blue-600 flex items-center justify-center space-x-2">
                        <div className="spinner"></div>
                        <span>Loading wallet data...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    Ready to connect to: <span className={`font-medium ${network === 'preprod' ? 'text-blue-600' : 'text-red-600'}`}>
                      {network === 'preprod' ? 'Preprod Testnet' : 'Cardano Mainnet'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Connected State */}
          {connected && (
            <>
              {/* Zero Balance Troubleshooting */}
              {parseFloat(balance) === 0 && !balanceError && !loading && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-xl font-medium text-orange-800 mb-0">Zero Balance Detected</h3>
                  </div>
                  <div className="card-body">
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-orange-600 text-sm font-medium">1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-orange-800">Check Network</p>
                          <p className="text-xs text-orange-700 mt-1">
                            You're currently on <strong>{network === 'preprod' ? 'Preprod Testnet' : 'Mainnet'}</strong>. 
                            Make sure this matches where you have ADA.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-orange-600 text-sm font-medium">2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-orange-800">Wallet Network Setting</p>
                          <p className="text-xs text-orange-700 mt-1">
                            Check your wallet's network setting. It should match the network selected above.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5">
                          <span className="text-orange-600 text-sm font-medium">3</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-orange-800">Get ADA</p>
                          <p className="text-xs text-orange-700 mt-1">
                            {network === 'preprod' ? (
                              <>Get free test ADA from the <a href="https://docs.cardano.org/cardano-testnet/tools/faucet" target="_blank" rel="noopener noreferrer" className="underline font-medium">Cardano Faucet</a></>
                            ) : (
                              'Purchase ADA from an exchange and send it to your wallet address'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance Display */}
              {(assets || balanceError) && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="text-subheading mb-0">Wallet Balance</h3>
                  </div>
                  <div className="card-body">
                    {balanceError ? (
                      <div className="status-error">
                        <p className="font-medium mb-2">❌ Error loading balance:</p>
                        <p className="text-sm">{balanceError}</p>
                        <button
                          onClick={getAssets}
                          disabled={loading}
                          className="btn btn-secondary mt-4"
                        >
                          {loading ? <div className="spinner mr-2"></div> : null}
                          Try Again
                        </button>
                      </div>
                    ) : (
                      <div className="balance-display">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Available Balance</p>
                            <p className="text-3xl font-bold text-slate-200">{balance} ADA</p>
                          </div>
                          <button
                            onClick={getAssets}
                            disabled={loading}
                            className={`btn btn-secondary ${loading ? 'opacity-50' : ''}`}
                            title="Refresh balance"
                          >
                            {loading ? <div className="spinner"></div> : '↻'}
                          </button>
                        </div>
                        {loading && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                            <div className="flex items-center space-x-2">
                              <div className="spinner"></div>
                              <p className="text-sm text-blue-700">Fetching balance from wallet...</p>
                            </div>
                          </div>
                        )}
                        {!loading && parseFloat(balance) === 0 && (
                          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                            <p className="text-sm text-orange-700">
                              ⚠️ Zero balance detected. Make sure you're on the correct network where you have ADA.
                              {network === 'preprod' && (
                                <span className="block mt-2">
                                  For testnet ADA, visit the{' '}
                                  <a 
                                    href="https://docs.cardano.org/cardano-testnet/tools/faucet" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="underline hover:no-underline font-medium"
                                  >
                                    Cardano Faucet
                                  </a>
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                        {parseFloat(balance) > 0 && (
                          <p className="text-sm text-slate-500 mt-2">
                            ~2 ADA will be reserved for network fees
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Send Money Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-subheading mb-0 font-semibold">Send ADA</h3>
                  <p className="text-slate-500 font-light">Transfer ADA to another wallet</p>
                  
                </div>

                <div className="max-w-md mx-auto space-y-6 my-4">
                  {/* Recipient Address Input */}
                  <div>
                    <label className="block text-sm  text-slate-200 mb-2 font-semibold">
                      Recipient Address ({network === 'preprod' ? 'Testnet' : 'Mainnet'})
                    </label>
                    <input
                      type="text"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder={network === 'preprod' ? 'addr_test1...' : 'addr1...'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all duration-300 bg-white/80 text-gray-700 font-light"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {network === 'preprod' 
                        ? 'Use testnet addresses starting with "addr_test1"' 
                        : 'Use mainnet addresses starting with "addr1"'
                      }
                    </p>
                  </div>

                  {/* Message Input */}
                  <div>
                    <label className="block text-sm font-light text-slate-200 mb-2 font-semibold">
                      Transaction Message (Optional)
                    </label>
                    <textarea
                      value={sendMessage}
                      onChange={(e) => setSendMessage(e.target.value)}
                      placeholder="Add a note or message to this transaction..."
                      maxLength={64}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all duration-300 bg-white/80 text-gray-700 font-light resize-none"
                      rows={3}
                    />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-500">
                        Message will be stored permanently on the blockchain
                      </p>
                      <p className="text-xs text-gray-400">
                        {sendMessage.length}/64
                      </p>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-light text-slate-200 mb-2 font-semibold">
                      Amount (ADA)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.000001"
                        min="1"
                        max={Math.max(0, parseFloat(balance) - 2).toString()}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all duration-300 bg-white/80 text-gray-700 font-light"
                      />
                      <button
                        type="button"
                        onClick={() => setSendAmount(Math.max(0, parseFloat(balance) - 2).toFixed(6))}
                        disabled={parseFloat(balance) <= 2}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Max
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Maximum sendable: {Math.max(0, parseFloat(balance) - 2).toFixed(6)} ADA
                    </p>
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={sendAda}
                    disabled={sendLoading || !recipientAddress || !sendAmount}
                    className={`
                      w-full font-light py-4 px-8 rounded-xl transition-all duration-300 border mb-4
                      ${sendLoading || !recipientAddress || !sendAmount
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white border-gray-800 hover:border-gray-700'
                      }
                    `}
                  >
                    {sendLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-3"></div>
                        Sending...
                      </div>
                    ) : (
                      'Send ADA'
                    )}
                  </button>

                  {/* Transaction Status */}
                  {sendStatus && (
                    <div className={`p-4 rounded-xl border text-center ${
                      sendStatus === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : sendStatus.startsWith('Error') 
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}>
                      {sendStatus === 'success' ? (
                        <div>
                          <p className="font-medium">Transaction Successful!</p>
                          {sentMessage && (
                            <div className="text-sm mt-2 p-2 bg-gray-50 rounded-lg border">
                              <span className="font-medium">Message:</span>
                              <p className="text-gray-700 mt-1 italic">"{sentMessage}"</p>
                            </div>
                          )}
                          {txHash && (
                            <div className="text-sm mt-2">
                              <span className="font-medium">TX Hash:</span>
                              <br />
                              <span className="font-mono break-all text-blue-600">{txHash}</span>
                              <br />
                              <a 
                                href={network === 'preprod' 
                                  ? `https://preprod.cardanoscan.io/transaction/${txHash}`
                                  : `https://cardanoscan.io/transaction/${txHash}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-600 hover:text-blue-800 underline text-xs mt-1"
                              >
                                View on {network === 'preprod' ? 'Preprod' : 'Mainnet'} Explorer
                                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="font-light">{sendStatus}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </div>

        {/* Footer */}
        
      </div>
    </div>
  );
};

export default Home;