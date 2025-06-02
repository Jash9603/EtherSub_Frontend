import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './NavBar.css';
import MenuIcon from './assets/MenuIcon';

function NavBar({ onNavigate, activeComponent }) {
    const [connect, setConnect] = useState(false);
    const [walletAddress, setWalletAddress] = useState('');
    const [ethPrice, setEthPrice] = useState('Loading...');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // Function to connect to the wallet
    const connectWallet = async () => {
        if (window.ethereum) {
            try {
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
        // Optional: Set up interval to refresh price every minute
        const interval = setInterval(fetchEthPrice, 60000);
        return () => clearInterval(interval);
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
                        <span className='wallet-address'>{walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default NavBar;