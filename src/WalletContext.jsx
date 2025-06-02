// contexts/WalletContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { abi } from '../EtherSub.json';

// Contract configuration
const CONTRACT_ADDRESS = '0x78d75aB348c07E7095c83F104e91Ee98F406E723';
const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex
const SEPOLIA_NETWORK = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: 'Sepolia Test Network',
  nativeCurrency: {
    name: 'SepoliaETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://sepolia.infura.io/v3/'],
  blockExplorerUrls: ['https://sepolia.etherscan.io/'],
};

// Create the context
const WalletContext = createContext();

// Custom hook to use the wallet context
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

// Wallet Provider Component
export const WalletProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');
  const [chainId, setChainId] = useState(null);

  // Check if MetaMask is installed
  const hasMetaMask = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';

  // Initialize wallet connection on component mount
  useEffect(() => {
    initializeWallet();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (hasMetaMask) {
      const handleAccountsChanged = (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
          // User disconnected
          disconnect();
        } else if (accounts[0] !== account) {
          // Account changed
          setAccount(accounts[0]);
          setupContract(accounts[0]);
        }
      };

      const handleChainChanged = (newChainId) => {
        console.log('Chain changed:', newChainId);
        setChainId(newChainId);
        // Reload the page when chain changes to avoid issues
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [account, hasMetaMask]);

  const initializeWallet = async () => {
    try {
      if (!hasMetaMask) {
        setIsInitialized(true);
        return;
      }

      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(web3Provider);

      // Get current chain ID
      const network = await web3Provider.getNetwork();
      setChainId(`0x${network.chainId.toString(16)}`);

      // Check if already connected
      const accounts = await web3Provider.listAccounts();
      
      if (accounts.length > 0) {
        const userAccount = accounts[0];
        setAccount(userAccount);
        await setupContract(userAccount);
        setIsConnected(true);
      }
    } catch (err) {
      console.error('Error initializing wallet:', err);
      setError('Failed to initialize wallet connection');
    } finally {
      setIsInitialized(true);
    }
  };

  const setupContract = async (userAccount) => {
    try {
      if (!provider) return;

      const web3Signer = provider.getSigner(userAccount);
      setSigner(web3Signer);

      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, web3Signer);
      setContract(contractInstance);
      
      console.log('Contract setup complete for account:', userAccount);
    } catch (err) {
      console.error('Error setting up contract:', err);
      setError('Failed to setup contract connection');
    }
  };

  const connectWallet = async () => {
    if (!hasMetaMask) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return false;
    }

    setIsConnecting(true);
    setError('');

    try {
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (accounts.length === 0) {
        setError('No accounts found. Please make sure MetaMask is unlocked.');
        return false;
      }

      const userAccount = accounts[0];
      setAccount(userAccount);
      await setupContract(userAccount);
      setIsConnected(true);

      console.log('Wallet connected successfully:', userAccount);
      return true;

    } catch (err) {
      console.error('Error connecting wallet:', err);
      
      if (err.code === 4001) {
        setError('Connection rejected by user');
      } else if (err.code === -32002) {
        setError('Connection request already pending. Please check MetaMask.');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setContract(null);
    setSigner(null);
    setIsConnected(false);
    setError('');
    console.log('Wallet disconnected');
  };

  const isCorrectNetwork = useCallback(() => {
    return chainId === SEPOLIA_CHAIN_ID;
  }, [chainId]);

  const switchToCorrectNetwork = async () => {
    if (!hasMetaMask) {
      setError('MetaMask is not installed');
      return false;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
      return true;
    } catch (err) {
      console.error('Error switching network:', err);
      
      // If network doesn't exist, try to add it
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SEPOLIA_NETWORK],
          });
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          setError('Failed to add Sepolia network. Please add it manually.');
          return false;
        }
      } else if (err.code === 4001) {
        setError('Network switch rejected by user');
        return false;
      } else {
        setError('Failed to switch network. Please switch to Sepolia manually.');
        return false;
      }
    }
  };

  const getFormattedAddress = useCallback(() => {
    if (!account) return '';
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  const clearError = () => {
    setError('');
  };

  const getBalance = async () => {
    if (!provider || !account) return '0';
    
    try {
      const balance = await provider.getBalance(account);
      return ethers.utils.formatEther(balance);
    } catch (err) {
      console.error('Error getting balance:', err);
      return '0';
    }
  };

  // Context value
  const value = {
    // State
    account,
    contract,
    provider,
    signer,
    isConnected,
    isConnecting,
    isInitialized,
    error,
    chainId,
    hasMetaMask,

    // Actions
    connectWallet,
    disconnect,
    initializeWallet,
    isCorrectNetwork,
    switchToCorrectNetwork,
    getFormattedAddress,
    clearError,
    getBalance,

    // Constants
    CONTRACT_ADDRESS,
    SEPOLIA_CHAIN_ID,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;