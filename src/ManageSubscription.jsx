import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Clock, AlertCircle, CheckCircle, X, Loader2, Calendar, DollarSign } from 'lucide-react';
import { abi } from '../EtherSub.json';
import './Managesubscription.css';

const CONTRACT_ADDRESS = '0x78d75aB348c07E7095c83F104e91Ee98F406E723';

const SubscriptionManager = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize Web3 connection
  useEffect(() => {
    const initWeb3 = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          console.log('Initializing Web3...');
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          
          // Check if already connected
          const accounts = await window.ethereum.request({
            method: 'eth_accounts'
          });
          
          if (accounts.length > 0) {
            const signer = await web3Provider.getSigner();
            const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
            
            setProvider(web3Provider);
            setContract(contractInstance);
            setAccount(accounts[0]);
            console.log('Web3 initialized successfully with account:', accounts[0]);
          } else {
            // Create contract instance without signer for read-only operations
            const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, web3Provider);
            setProvider(web3Provider);
            setContract(contractInstance);
            console.log('Web3 initialized for read-only operations');
          }
        } catch (error) {
          console.error('Failed to initialize Web3:', error);
          setError(`Failed to connect to wallet: ${error.message}`);
        }
      } else {
        setError('Please install MetaMask to use this feature');
      }
      setLoading(false);
    };

    initWeb3();
  }, []);

  // Load subscriptions when contract and account are available
  useEffect(() => {
    if (contract && account) {
      loadSubscriptions();
    }
  }, [contract, account]);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setIsConnecting(true);
        setError('');
        
        await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        
        // Reinitialize with signer after connection
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await web3Provider.getSigner();
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
        const accounts = await signer.getAddress();
        
        setProvider(web3Provider);
        setContract(contractInstance);
        setAccount(accounts);
        console.log('Wallet connected successfully:', accounts);
        
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        setError('Failed to connect wallet');
      } finally {
        setIsConnecting(false);
      }
    } else {
      setError('Please install MetaMask to use this feature');
    }
  };

  const loadSubscriptions = async () => {
    if (!contract || !account) {
      setError('Please connect your wallet first');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Loading subscriptions for account:', account);
      
      // Get user's active subscriptions from contract
      const [activePlanNames, timesLeft] = await contract.getUserActiveSubscriptions(account);
      
      const subscriptionData = [];
      
      for (let i = 0; i < activePlanNames.length; i++) {
        const planName = activePlanNames[i];
        const timeLeft = parseInt(timesLeft[i].toString());
        
        try {
          // Get subscription details
          const [active, , amountPaid] = await contract.getSubscriptionStatus(account, planName);
          
          // Get plan details including features
          const [, , , planFeatures] = await contract.getPlanDetails(planName);
          
          if (active) {
            subscriptionData.push({
              planName,
              timeLeft,
              amountPaid: (parseInt(amountPaid.toString()) / 1e18).toFixed(4), // Convert from wei to ETH
              startTime: Date.now() - (timeLeft * 1000), // Approximate start time
              duration: timeLeft, // This would need to be stored or calculated differently
              features: planFeatures.map(feature => feature.name)
            });
          }
        } catch (err) {
          console.error(`Error loading subscription details for ${planName}:`, err);
          // Continue with other subscriptions even if one fails
        }
      }
      
      setSubscriptions(subscriptionData);
      console.log('Loaded subscriptions:', subscriptionData);
      
    } catch (err) {
      console.error('Error loading subscriptions:', err);
      setError('Failed to load subscriptions. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeLeft = (seconds) => {
    if (seconds <= 0) return 'Expired';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days} days, ${hours}h`;
    if (hours > 0) return `${hours}h, ${minutes}m`;
    return `${minutes}m`;
  };

  const getProgressPercentage = (timeLeft, duration) => {
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(100, ((duration - timeLeft) / duration) * 100));
  };

  const getStatusColor = (timeLeft) => {
    if (timeLeft <= 0) return 'expired';
    if (timeLeft < 604800) return 'warning'; // Less than 7 days
    return 'active';
  };

  const getFormattedAddress = () => {
    if (!account) return '';
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  };

  const handleCancelSubscription = async (planName) => {
    if (!contract) {
      setError('Contract not connected');
      return;
    }

    setCanceling(planName);
    setError('');
    setSuccess('');
    
    try {
      console.log(`Canceling subscription: ${planName}`);
      
      // Call contract's cancelSubscription function
      const tx = await contract.cancelSubscription(planName);
      await tx.wait(); // Wait for transaction confirmation
      
      // Remove the subscription from local state
      setSubscriptions(prev => prev.filter(s => s.planName !== planName));
      setSuccess(`Subscription "${planName}" canceled successfully! Refund has been processed.`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (err) {
      console.error('Error canceling subscription:', err);
      if (err.code === 4001) {
        setError('Transaction cancelled by user');
      } else if (err.message.includes('insufficient funds')) {
        setError('Insufficient ETH for gas fees');
      } else {
        setError('Failed to cancel subscription. Please try again.');
      }
    } finally {
      setCanceling(null);
    }
  };

  // Show loading while wallet is initializing
  if (loading && !account) {
    return (
      <div className="subscription-manager">
        <div className="loading-container">
          <Loader2 className="loading-spinner" />
          <p>Initializing wallet connection...</p>
        </div>
      </div>
    );
  }

  // Show loading while fetching subscriptions
  if (loading && subscriptions.length === 0 && account) {
    return (
      <div className="subscription-manager">
        <div className="loading-container">
          <Loader2 className="loading-spinner" />
          <p>Loading your subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-manager">
      <div className="header">
        <h2>Manage Subscriptions</h2>
        {account && (
          <div className="header-info">
            <span className="wallet-address">{getFormattedAddress()}</span>
            
          </div>
        )}
      </div>

      {/* Show component errors */}
      {error && (
        <div className="alert error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="close-btn">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Show success messages */}
      {success && (
        <div className="alert success">
          <CheckCircle size={16} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="close-btn">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Show MetaMask not installed warning */}
      {typeof window.ethereum === 'undefined' && (
        <div className="alert warning">
          <AlertCircle size={16} />
          <span>MetaMask is not installed. Please install MetaMask to continue.</span>
        </div>
      )}

      {/* Main content */}
      {!account ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Wallet Not Connected</h3>
          <p>Please connect your wallet to view your subscriptions.</p>
          <button
            className="connect-btn"
            onClick={connectWallet}
            disabled={isConnecting || typeof window.ethereum === 'undefined'}
          >
            {isConnecting ? (
              <>
                <Loader2 size={16} />
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
        </div>
      ) : subscriptions.length === 0 && !loading ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>No Active Subscriptions</h3>
          <p>You don't have any active subscriptions at the moment.</p>
        </div>
      ) : (
        <div className="subscriptions-grid">
          {subscriptions.map((subscription, index) => (
            <div key={index} className={`subscription-card ${getStatusColor(subscription.timeLeft)}`}>
              <div className="card-header">
                <h3>{subscription.planName}</h3>
                <div className={`status-badge ${getStatusColor(subscription.timeLeft)}`}>
                  {subscription.timeLeft <= 0 ? 'Expired' : 'Active'}
                </div>
              </div>

              <div className="card-content">
                <div className="time-info">
                  <Clock size={16} />
                  <span>Time Left: {formatTimeLeft(subscription.timeLeft)}</span>
                </div>

                <div className="progress-container">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ 
                        width: `${getProgressPercentage(subscription.timeLeft, subscription.duration)}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="subscription-details">
                  <div className="detail-item">
                    <DollarSign size={14} />
                    <span>Amount Paid: {subscription.amountPaid} ETH</span>
                  </div>

                  {subscription.features && subscription.features.length > 0 && (
                    <div className="features-section">
                      <h4>Included Features:</h4>
                      <div className="features-list">
                        {subscription.features.map((feature, idx) => (
                          <span key={idx} className="feature-tag">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-actions">
                {subscription.timeLeft > 0 ? (
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelSubscription(subscription.planName)}
                    disabled={canceling === subscription.planName}
                  >
                    {canceling === subscription.planName ? (
                      <>
                        <Loader2 size={16} />
                        Canceling...
                      </>
                    ) : (
                      <>
                        <X size={16} />
                        Cancel Subscription
                      </>
                    )}
                  </button>
                ) : (
                  <div className="expired-notice">
                    <AlertCircle size={16} />
                    <span>This subscription has expired</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="info-section">
        <h3>Important Information</h3>
        <ul>
          <li>Canceling a subscription will provide a prorated refund based on remaining time</li>
          <li>Expired subscriptions are automatically cleaned up but you can trigger cleanup manually</li>
          <li>Refunds are processed immediately to your wallet address</li>
          <li>12-month subscriptions include a 10% discount</li>
          <li>All transactions require Sepolia testnet ETH for gas fees</li>
        </ul>
      </div>
    </div>
  );
};

export default SubscriptionManager;
