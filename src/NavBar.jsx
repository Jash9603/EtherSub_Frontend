import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './NavBar.css';
import MenuIcon from './assets/MenuIcon';

function NavBar({ onNavigate, activeComponent }) {
    const [connect, setConnect] = useState(false);
    const [walletAddress, setWalletAddress] = useState('');
    const [ethPrice, setEthPrice] = useState('Loading...');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
    
    const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in decimal
    const SEPOLIA_CHAIN_ID_DECIMAL = 11155111;
    
    // Function to check and switch to Sepolia network
    const checkAndSwitchToSepolia = async () => {
        if (!window.ethereum) {
            alert('Please install MetaMask or another Web3 wallet');
            return false;
        }

        try {
            // Get current chain ID
            const currentChainId = await window.ethereum.request({
                method: 'eth_chainId'
            });

            if (currentChainId !== SEPOLIA_CHAIN_ID) {
                // Ask user to switch to Sepolia
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: SEPOLIA_CHAIN_ID }]
                    });
                    setIsCorrectNetwork(true);
                    return true;
                } catch (switchError) {
                    // If chain doesn't exist, add it
                    if (switchError.code === 4902) {
                        try {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: SEPOLIA_CHAIN_ID,
                                    chainName: 'Sepolia Test Network',
                                    rpcUrls: ['https://sepolia.infura.io/v3/'], // You can add your Infura key here
                                    nativeCurrency: {
                                        name: 'Sepolia Ether',
                                        symbol: 'SEP',
                                        decimals: 18
                                    },
                                    blockExplorerUrls: ['https://sepolia.etherscan.io/']
                                }]
                            });
                            setIsCorrectNetwork(true);
                            return true;
                        } catch (addError) {
                            console.error('Failed to add Sepolia network:', addError);
                            alert('Failed to add Sepolia network. Please add it manually.');
                            return false;
                        }
                    } else {
                        console.error('Failed to switch to Sepolia:', switchError);
                        alert('Please switch to Sepolia network manually to use this application.');
                        return false;
                    }
                }
            }
            
            setIsCorrectNetwork(true);
            return true; // Already on Sepolia
        } catch (error) {
            console.error('Error checking chain:', error);
            return false;
        }
    };

    // Function to check current network
    const checkNetwork = async () => {
        if (window.ethereum) {
            try {
                const chainId = await window.ethereum.request({ method: 'eth_chainId' });
                const isOnSepolia = chainId === SEPOLIA_CHAIN_ID;
                setIsCorrectNetwork(isOnSepolia);
                
                if (!isOnSepolia && connect) {
                    // If wallet is connected but not on Sepolia, prompt to switch
                    const switched = await checkAndSwitchToSepolia();
                    if (!switched) {
                        // Optionally disconnect wallet if user refuses to switch
                        // setConnect(false);
                        // setWalletAddress('');
                    }
                }
            } catch (error) {
                console.error('Error checking network:', error);
            }
        }
    };
    
    // Function to connect to the wallet
    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                // First check and switch to Sepolia
                const isSepoliaActive = await checkAndSwitchToSepolia();
                
                if (!isSepoliaActive) {
                    return; // Don't connect if user didn't switch to Sepolia
                }

                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setWalletAddress(accounts[0]);
                setConnect(true);
                setIsMenuOpen(false); // Close menu after connecting
            } catch (error) {
                console.error("Error connecting to wallet:", error);
            }
        } else {
            alert('Please install MetaMask!');
        }
    };
    
    // Fetch ETH price from an API
    const fetchEthPrice = async () => {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const data = await response.json();
            setEthPrice(data.ethereum.usd);
        } catch (error) {
            console.error("Error fetching ETH price:", error);
            setEthPrice('Error');
        }
    };
    
    useEffect(() => {
        fetchEthPrice();
        checkNetwork(); // Check network on component mount
        
        // Optional: Set up interval to refresh price every minute
        const interval = setInterval(fetchEthPrice, 60000);
        
        // Listen for network changes
        const handleChainChanged = (chainId) => {
            const isOnSepolia = chainId === SEPOLIA_CHAIN_ID;
            setIsCorrectNetwork(isOnSepolia);
            
            if (!isOnSepolia) {
                alert('Please switch back to Sepolia network to continue using this application.');
            }
        };

        // Listen for account changes
        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                setConnect(false);
                setWalletAddress('');
            } else {
                setWalletAddress(accounts[0]);
            }
        };

        if (window.ethereum) {
            window.ethereum.on('chainChanged', handleChainChanged);
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }
        
        return () => {
            clearInterval(interval);
            if (window.ethereum) {
                window.ethereum.removeListener('chainChanged', handleChainChanged);
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    const handleNavigation = (component) => {
        onNavigate(component);
        setIsMenuOpen(false); // Close menu after navigation
    };
    
    return (
        <div className='navbar'>
            <div className='navbar-container'>
                <div className='eth-price'>
                    <span>ETH Price: ${ethPrice}</span>
                </div>
                
                {/* Network status indicator */}
                {connect && !isCorrectNetwork && (
                    <div className='network-warning' style={{
                        color: '#ff6b6b',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }} onClick={checkAndSwitchToSepolia}>
                        ⚠️ Switch to Sepolia
                    </div>
                )}
                
                <div className='desktop-menu'>
                    <button 
                        className={`nav-button ${activeComponent === 'plans' ? 'active' : ''}`}
                        onClick={() => handleNavigation('plans')}
                    >
                        Plans
                    </button>
                    <button 
                        className={`nav-button ${activeComponent === 'manage' ? 'active' : ''}`}
                        onClick={() => handleNavigation('manage')}
                    >
                        Manage Subscription
                    </button>
                    <button 
                        className={`nav-button ${activeComponent === 'admin' ? 'active' : ''}`}
                        onClick={() => handleNavigation('admin')}
                    >
                        Admin
                    </button>
                    
                    {/* Desktop wallet connection */}
                    {!connect ? (
                        <button className='connect-wallet' onClick={connectWallet}>
                            Connect Wallet
                        </button>
                    ) : (
                        <span className='wallet-address' style={{
                            backgroundColor: isCorrectNetwork ? '#4caf50' : '#ff6b6b',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '12px'
                        }}>
                            {walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)}
                        </span>
                    )}
                </div>

                <div className='mobile-menu-icon' onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    <MenuIcon />
                </div>

                <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
                    {!connect && (
                        <button className='connect-wallet-mobile' onClick={connectWallet}>
                            Connect Wallet
                        </button>
                    )}
                    
                    {connect && !isCorrectNetwork && (
                        <button 
                            className='network-switch-button'
                            onClick={checkAndSwitchToSepolia}
                            style={{
                                backgroundColor: '#ff6b6b',
                                color: 'white',
                                padding: '8px 12px',
                                border: 'none',
                                borderRadius: '4px',
                                margin: '8px 0'
                            }}
                        >
                            ⚠️ Switch to Sepolia
                        </button>
                    )}
                    
                    <button 
                        className={`nav-button ${activeComponent === 'plans' ? 'active' : ''}`}
                        onClick={() => handleNavigation('plans')}
                    >
                        Plans
                    </button>
                    <button 
                        className={`nav-button ${activeComponent === 'manage' ? 'active' : ''}`}
                        onClick={() => handleNavigation('manage')}
                    >
                        Manage Subscription
                    </button>
                    <button 
                        className={`nav-button ${activeComponent === 'admin' ? 'active' : ''}`}
                        onClick={() => handleNavigation('admin')}
                    >
                        Admin
                    </button>
                    {connect && (
                        <span className='wallet-address' style={{
                            backgroundColor: isCorrectNetwork ? '#4caf50' : '#ff6b6b',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '12px',
                            display: 'block',
                            textAlign: 'center',
                            marginTop: '8px'
                        }}>
                            {walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default NavBar;