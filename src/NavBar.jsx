import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './NavBar.css';

function NavBar({ onNavigate, activeComponent }) {
    const [connect, setConnect] = useState(false);
    const [walletAddress, setWalletAddress] = useState('');
    const [ethPrice, setEthPrice] = useState('Loading...');
    
    // Function to connect to the wallet
    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setWalletAddress(accounts[0]);
                setConnect(true);
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
    
    return (
        <div className='navbar'>
            <div className='left'>
                <span>ETH Price: ${ethPrice}</span>
            </div>
            <div className='center'>
                <button 
                    className={`Plans ${activeComponent === 'plans' ? 'active' : ''}`}
                    onClick={() => onNavigate('plans')}
                >
                    Plans
                </button>
                <button 
                    className={`Manage ${activeComponent === 'manage' ? 'active' : ''}`}
                    onClick={() => onNavigate('manage')}
                >
                    Manage Subscription
                </button>
                <button 
                    className={`Admin ${activeComponent === 'admin' ? 'active' : ''}`}
                    onClick={() => onNavigate('admin')}
                >
                    Admin
                </button>
            </div>
            <div className='right'>
                {connect ? (
                    <span>{walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)}</span>
                ) : (
                    <button className='Wallet' onClick={connectWallet}>Connect Wallet</button>
                )}
            </div>
        </div>
    );
}

export default NavBar;