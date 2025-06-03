// PlansComponent.jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { abi } from '../EtherSub.json';
import './PlansComponent.css';

const CONTRACT_ADDRESS = '0x78d75aB348c07E7095c83F104e91Ee98F406E723';
const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex

const PlansComponent = () => {
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState({});
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState({});
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [error, setError] = useState('');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  // Check if user is on Sepolia network
  const checkNetwork = async () => {
    if (!window.ethereum) return false;
    
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      return chainId === SEPOLIA_CHAIN_ID;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  };

  // Switch to Sepolia network
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://sepolia.infura.io/v3/'],
                blockExplorerUrls: ['https://sepolia.etherscan.io/'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError);
          setError('Failed to add Sepolia network to MetaMask');
        }
      } else {
        console.error('Error switching to Sepolia:', switchError);
        setError('Failed to switch to Sepolia network');
      }
    }
  };

  // Initialize Web3 connection
  useEffect(() => {
    const initWeb3 = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          console.log('Initializing Web3...');
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          
          // Check network first
          const networkCorrect = await checkNetwork();
          setIsCorrectNetwork(networkCorrect);
          
          // Check if already connected
          const accounts = await window.ethereum.request({
            method: 'eth_accounts'
          });
          
          if (accounts.length > 0 && networkCorrect) {
            const signer = await web3Provider.getSigner();
            const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
            
            setProvider(web3Provider);
            setContract(contractInstance);
            setAccount(accounts[0]);
            console.log('Web3 initialized successfully with account:', accounts[0]);
          } else {
            setProvider(web3Provider);
            console.log('Web3 provider initialized, waiting for proper connection');
          }
        } catch (error) {
          console.error('Failed to initialize Web3:', error);
          setError(`Failed to connect to wallet: ${error.message}`);
        }
      } else {
        setError('Please install MetaMask to use this feature');
      }
    };

    initWeb3();

    // Listen for network changes
    if (window.ethereum) {
      const handleChainChanged = async () => {
        const networkCorrect = await checkNetwork();
        setIsCorrectNetwork(networkCorrect);
        
        if (networkCorrect) {
          window.location.reload();
        }
      };

      const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
          setAccount(null);
          setContract(null);
        } else {
          window.location.reload();
        }
      };

      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Fetch plans and features - only when properly connected
  useEffect(() => {
    const fetchPlansAndFeatures = async () => {
      // Only fetch if we have a contract instance and user is connected to correct network
      if (!contract || !account || !isCorrectNetwork) {
        console.log('Not fetching plans - missing requirements:', { 
          contract: !!contract, 
          account: !!account, 
          isCorrectNetwork 
        });
        return;
      }

      const timeoutId = setTimeout(() => {
        setError('Request timed out. Please check your network connection.');
        setLoading(false);
      }, 30000); // 30 second timeout

      try {
        console.log('Starting to fetch plans and features...');
        setLoading(true);
        setError('');
        
        // Fetch all plans
        console.log('Fetching plans...');
        const plansData = await contract.viewPlans();
        console.log('Plans data:', plansData);
        
        if (plansData.length === 0) {
          console.log('No plans found in contract');
          setError('No plans have been created yet. Please contact the administrator.');
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }
        
        // Fetch all features
        console.log('Fetching features...');
        const featuresData = await contract.viewFeatures();
        console.log('Features data:', featuresData);
        
        // Create features lookup
        const featuresMap = {};
        featuresData.forEach(feature => {
          featuresMap[feature.featureId] = {
            name: feature.name,
            description: feature.description
          };
        });
        console.log('Features map:', featuresMap);
        
        // Get detailed plan information with costs
        console.log('Fetching plan costs...');
        const plansWithDetails = await Promise.all(
          plansData.map(async (plan, index) => {
            try {
              console.log(`Fetching costs for plan ${index}: ${plan.name}`);
              
              // Get costs for both 1 month and 12 months
              const [ethCost1Month, usdCost1Month] = await contract.getSubscriptionCost(plan.name, 1);
              const [ethCost12Month, usdCost12Month] = await contract.getSubscriptionCost(plan.name, 12);
              
              console.log(`Plan ${plan.name} costs:`, {
                ethCost1Month: ethCost1Month.toString(),
                usdCost1Month: usdCost1Month.toString(),
                ethCost12Month: ethCost12Month.toString(),
                usdCost12Month: usdCost12Month.toString()
              });
              
              return {
                name: plan.name,
                monthlyUsdAmount: ethers.formatEther(plan.amountPerMonth),
                features: plan.allowedFeatures.map(featureId => featuresMap[featureId]).filter(Boolean),
                costs: {
                  oneMonth: {
                    eth: ethers.formatEther(ethCost1Month),
                    usd: ethers.formatEther(usdCost1Month)
                  },
                  twelveMonth: {
                    eth: ethers.formatEther(ethCost12Month),
                    usd: ethers.formatEther(usdCost12Month)
                  }
                }
              };
            } catch (err) {
              console.error(`Error fetching costs for plan ${plan.name}:`, err);
              // Return plan without costs if price fetch fails
              return {
                name: plan.name,
                monthlyUsdAmount: ethers.formatEther(plan.amountPerMonth),
                features: plan.allowedFeatures.map(featureId => featuresMap[featureId]).filter(Boolean),
                costs: {
                  oneMonth: { eth: '0', usd: '0' },
                  twelveMonth: { eth: '0', usd: '0' }
                },
                error: 'Could not fetch current prices'
              };
            }
          })
        );
        
        console.log('Final plans with details:', plansWithDetails);
        setPlans(plansWithDetails.filter(Boolean));
        setFeatures(featuresMap);
        clearTimeout(timeoutId);
        
      } catch (error) {
        console.error('Error fetching plans:', error);
        clearTimeout(timeoutId);
        setError(`Failed to load plans: ${error.message}`);
      } finally {
        console.log('Finished fetching plans');
        setLoading(false);
      }
    };

    fetchPlansAndFeatures();
  }, [contract, account, isCorrectNetwork]);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // First check if we're on the right network
        const networkCorrect = await checkNetwork();
        
        if (!networkCorrect) {
          await switchToSepolia();
          return;
        }

        await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        window.location.reload();
      } catch (error) {
        setError('Failed to connect wallet');
      }
    }
  };

  const handlePurchase = async (planName, duration) => {
    if (!account || !contract) {
      setError('Please connect your wallet first');
      return;
    }

    if (!isCorrectNetwork) {
      setError('Please switch to Sepolia network');
      return;
    }

    const purchaseKey = `${planName}-${duration}`;
    setPurchasing(prev => ({ ...prev, [purchaseKey]: true }));
    setError('');

    try {
      // Get the required ETH amount
      const [ethCost] = await contract.getSubscriptionCost(planName, duration);
      
      // Add 5% slippage tolerance
      const maxSlippage = 5;
      const ethWithSlippage = (ethCost * 105n) / 100n;

      // Call subscribe function
      const tx = await contract.subscribe(planName, duration, maxSlippage, {
        value: ethWithSlippage,
        gasLimit: 300000
      });

      // Wait for transaction confirmation
      await tx.wait();
      
      alert(`Successfully subscribed to ${planName} for ${duration} month(s)!`);
      
    } catch (error) {
      console.error('Purchase failed:', error);
      if (error.code === 4001) {
        setError('Transaction cancelled by user');
      } else if (error.message.includes('insufficient funds')) {
        setError('Insufficient ETH balance');
      } else {
        setError('Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(prev => ({ ...prev, [purchaseKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="plans-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="plans-container">
      <div className="header">
        <h1>Choose Your Plan</h1>
        <p>Select the perfect subscription plan for your needs</p>
      </div>

      {!account ? (
        <div className="wallet-status">
          <p>Connect your wallet to purchase plans</p>
          <button onClick={connectWallet} className="connect-wallet-btn">
            Connect Wallet
          </button>
        </div>
      ) : !isCorrectNetwork ? (
        <div className="wallet-status">
          <p>Please switch to Sepolia testnet to continue</p>
          <button onClick={switchToSepolia} className="connect-wallet-btn">
            Switch to Sepolia
          </button>
        </div>
      ) : (
        <div className="wallet-status connected">
          <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {account && isCorrectNetwork && plans.length === 0 && !loading && (
        <div className="no-plans">
          <p>No plans available at the moment. Please check back later.</p>
        </div>
      )}

      <div className="plans-grid">
        {plans.map((plan, index) => (
          <div key={plan.name} className={`plan-card ${index === 1 ? 'popular' : ''}`}>
            {index === 1 && <div className="popular-badge">Most Popular</div>}
            
            <div className="plan-header">
              <h3>{plan.name}</h3>
              <div className="plan-price">
                <span className="price">${parseFloat(plan.monthlyUsdAmount).toFixed(0)}</span>
                <span className="period">/month</span>
              </div>
            </div>
            <h4>Features</h4>
           <br></br>
            <div className="features-list">
              
              {plan.features.map((feature, idx) => (
                <div key={idx} className="feature-item">
                  <span className="check-icon">✓</span>
                  <div>
                    <strong>{feature.name}</strong>
                    <p>{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pricing-options">
              <div className="pricing-option">
                <div className="option-header">
                  <h4>1 Month</h4>
                  <div className="option-price">
                    <span className="eth-price">{parseFloat(plan.costs.oneMonth.eth).toFixed(4)} ETH</span>
                    <span className="usd-price">${parseFloat(plan.costs.oneMonth.usd).toFixed(0)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handlePurchase(plan.name, 1)}
                  disabled={purchasing[`${plan.name}-1`] || !account || !isCorrectNetwork}
                  className="buy-btn"
                >
                  {purchasing[`${plan.name}-1`] ? 'Processing...' : 'Buy 1 Month'}
                </button>
              </div>

              <div className="pricing-option discount">
                <div className="discount-badge">10% OFF</div>
                <div className="option-header">
                  <h4>12 Months</h4>
                  <div className="option-price">
                    <span className="eth-price">{parseFloat(plan.costs.twelveMonth.eth).toFixed(4)} ETH</span>
                    <span className="usd-price">${parseFloat(plan.costs.twelveMonth.usd).toFixed(0)}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handlePurchase(plan.name, 12)}
                  disabled={purchasing[`${plan.name}-12`] || !account || !isCorrectNetwork}
                  className="buy-btn primary"
                >
                  {purchasing[`${plan.name}-12`] ? 'Processing...' : 'Buy 12 Months'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlansComponent;