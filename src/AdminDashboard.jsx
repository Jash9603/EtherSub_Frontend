import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, Download, DollarSign, Users, Settings, Package, Loader2, Calendar } from 'lucide-react';
import { ethers } from 'ethers';
import { abi } from '../EtherSub.json';
import './AdminDashboard.css';

const CONTRACT_ADDRESS = '0x78d75aB348c07E7095c83F104e91Ee98F406E723';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('features');
  const [isOwner, setIsOwner] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [contractBalance, setContractBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  
  // Contract instances
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  
  // Features state
  const [features, setFeatures] = useState([]);
  const [newFeature, setNewFeature] = useState({
    featureId: '',
    name: '',
    description: ''
  });
  
  // Plans state
  const [plans, setPlans] = useState([]);
  const [newPlan, setNewPlan] = useState({
    name: '',
    amountInUsd: '',
    selectedFeatures: []
  });

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

      setProvider(provider);
      setSigner(signer);
      setContract(contract);
      setAccount(accounts[0]);
      setIsConnected(true);

      // Check if user is owner
      const owner = await contract.owner();
      const currentAccount = await signer.getAddress();
      setIsOwner(owner.toLowerCase() === currentAccount.toLowerCase());

      // Load initial data
      await loadContractData(contract, provider);

    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Error connecting wallet: ' + error.message);
    }
  };

  // Load contract data
  const loadContractData = async (contractInstance, providerInstance) => {
    try {
      setLoading(true);

      // Get contract balance
      const balance = await providerInstance.getBalance(CONTRACT_ADDRESS);
      setContractBalance(ethers.formatEther(balance));

      // Load features
      const featuresData = await contractInstance.viewFeatures();
      setFeatures(featuresData.map(f => ({
        featureId: f.featureId,
        name: f.name,
        description: f.description
      })));

      // Load plans
      const plansData = await contractInstance.viewPlans();
      setPlans(plansData.map(p => ({
        name: p.name,
        amountPerMonth: p.amountPerMonth.toString(),
        allowedFeatures: p.allowedFeatures
      })));

    } catch (error) {
      console.error('Error loading contract data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle creating feature
  const handleCreateFeature = async () => {
    if (!newFeature.featureId || !newFeature.name) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      const tx = await contract.createFeature(
        newFeature.featureId, 
        newFeature.name, 
        newFeature.description
      );
      
      await tx.wait();
      
      // Reload features
      await loadContractData(contract, provider);
      setNewFeature({ featureId: '', name: '', description: '' });
      alert('Feature created successfully!');
      
    } catch (error) {
      console.error('Error creating feature:', error);
      alert('Error creating feature: ' + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle creating plan
  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.amountInUsd || newPlan.selectedFeatures.length === 0) {
      alert('Please fill in all required fields and select at least one feature');
      return;
    }
    
    try {
      setLoading(true);
      const tx = await contract.createPlan(
        newPlan.name,
        newPlan.amountInUsd,
        newPlan.selectedFeatures
      );
      
      await tx.wait();
      
      // Reload plans
      await loadContractData(contract, provider);
      setNewPlan({ name: '', amountInUsd: '', selectedFeatures: [] });
      alert('Plan created successfully!');
      
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('Error creating plan: ' + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!window.confirm('Are you sure you want to withdraw all funds?')) return;
    
    try {
      setLoading(true);
      const tx = await contract.withdraw();
      await tx.wait();
      
      // Reload contract balance
      const balance = await provider.getBalance(CONTRACT_ADDRESS);
      setContractBalance(ethers.formatEther(balance));
      
      alert('Funds withdrawn successfully!');
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Error withdrawing funds: ' + (error.reason || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle auto cleanup
  const handleAutoCleanup = async () => {
    if (!window.confirm('Are you sure you want to cleanup expired subscriptions? This will remove all expired subscriptions from the contract.')) return;
    
    try {
      setCleanupLoading(true);
      console.log('Running auto cleanup...');
      
      const tx = await contract.autoCleanup();
      await tx.wait();
      
      alert('Auto cleanup completed successfully! Expired subscriptions have been removed.');
      
    } catch (error) {
      console.error('Error during auto cleanup:', error);
      alert('Error during auto cleanup: ' + (error.reason || error.message));
    } finally {
      setCleanupLoading(false);
    }
  };

  const formatUsdAmount = (weiAmount) => {
    return (parseInt(weiAmount) / 1e18).toFixed(2);
  };

  // Auto-connect on component mount
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            connectWallet();
          }
        });
    }
  }, []);

  if (!isConnected) {
    return (
      <div className="connect-wallet-screen">
        <div className="connect-wallet-card">
          <h1 className="connect-wallet-title">Connect Your Wallet</h1>
          <p className="connect-wallet-text">Connect your wallet to access the EtherSub Admin panel</p>
          <button
            onClick={connectWallet}
            className="btn btn-primary btn-lg"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="access-denied-screen">
        <div className="access-denied-card">
          <h1 className="access-denied-title">Access Denied</h1>
          <p className="access-denied-text">Only the contract owner can access this admin panel.</p>
          <p className="access-denied-account">Connected account: {account}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-container">
          <div className="admin-header-content">
            <div>
              <h1 className="admin-header-title">EtherSub Admin</h1>
              <p className="admin-header-subtitle">Manage your subscription service</p>
              <p className="admin-header-account">Connected: {account}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleAutoCleanup}
                disabled={cleanupLoading}
                className="btn btn-warning"
              >
                {cleanupLoading ? <Loader2 size={20} className="spinner" /> : <Calendar size={20} />}
                Auto Cleanup
              </button>
              <button
                onClick={handleWithdraw}
                disabled={loading || contractBalance === '0'}
                className="btn btn-success"
              >
                {loading ? <Loader2 size={20} className="spinner" /> : <Download size={20} />}
                Withdraw ({contractBalance} ETH)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main">
        {/* Stats Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <DollarSign className="stat-icon green" />
              <div>
                <p className="stat-label">Contract Balance</p>
                <p className="stat-value">{contractBalance} ETH</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <Package className="stat-icon purple" />
              <div>
                <p className="stat-label">Active Plans</p>
                <p className="stat-value">{plans.length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <Settings className="stat-icon orange" />
              <div>
                <p className="stat-label">Features</p>
                <p className="stat-value">{features.length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-content">
              <Eye className="stat-icon blue" />
              <div>
                <p className="stat-label">Contract</p>
                <p className="stat-value small">{CONTRACT_ADDRESS.slice(0, 10)}...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <nav className="nav-tabs-list">
            {[
              { id: 'features', name: 'Features' },
              { id: 'plans', name: 'Plans' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'features' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Create Feature Form */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Create New Feature</h3>
              </div>
              <div className="card-content">
                <div className="form-grid cols-3">
                  <input
                    type="text"
                    placeholder="Feature ID (e.g., api-access)"
                    value={newFeature.featureId}
                    onChange={(e) => setNewFeature({...newFeature, featureId: e.target.value})}
                    className="form-input"
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="Feature Name"
                    value={newFeature.name}
                    onChange={(e) => setNewFeature({...newFeature, name: e.target.value})}
                    className="form-input"
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newFeature.description}
                    onChange={(e) => setNewFeature({...newFeature, description: e.target.value})}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <button
                    onClick={handleCreateFeature}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? <Loader2 size={20} className="spinner" /> : <Plus size={20} />}
                    Create Feature
                  </button>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title" >Existing Features ({features.length})</h3>
              </div>
              {features.length === 0 ? (
                <div className="empty-state">
                  No features created yet. Create your first feature above.
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Feature ID</th>
                        <th>Name</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((feature, index) => (
                        <tr key={index}>
                          <td className="table-text-primary table-text-nowrap">
                            {feature.featureId}
                          </td>
                          <td className="table-text-secondary table-text-nowrap">
                            {feature.name}
                          </td>
                          <td className="table-text-secondary">
                            {feature.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Create Plan Form */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Create New Plan</h3>
              </div>
              <div className="card-content">
                <div className="form-grid cols-2">
                  <input
                    type="text"
                    placeholder="Plan Name"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({...newPlan, name: e.target.value})}
                    className="form-input"
                    disabled={loading}
                  />
                  <input
                    type="number"
                    placeholder="Amount in USD per month"
                    value={newPlan.amountInUsd}
                    onChange={(e) => setNewPlan({...newPlan, amountInUsd: e.target.value})}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
                
                {features.length === 0 ? (
                  <div className="alert-warning">
                    <p className="alert-warning-text">Please create features first before creating plans.</p>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Select Features</label>
                    <div className="checkbox-group">
                      {features.map((feature) => (
                        <label key={feature.featureId} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={newPlan.selectedFeatures.includes(feature.featureId)}
                            onChange={(e) => {
                              const updatedFeatures = e.target.checked
                                ? [...newPlan.selectedFeatures, feature.featureId]
                                : newPlan.selectedFeatures.filter(id => id !== feature.featureId);
                              setNewPlan({...newPlan, selectedFeatures: updatedFeatures});
                            }}
                            className="checkbox-input"
                            disabled={loading}
                          />
                          <span className="checkbox-label">{feature.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleCreatePlan}
                  disabled={loading || features.length === 0}
                  className="btn btn-primary"
                >
                  {loading ? <Loader2 size={20} className="spinner" /> : <Plus size={20} />}
                  Create Plan
                </button>
              </div>
            </div>

            {/* Plans List */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Existing Plans ({plans.length})</h3>
              </div>
              {plans.length === 0 ? (
                <div className="empty-state">
                  No plans created yet. Create your first plan above.
                </div>
              ) : (
                <div className="plans-grid">
                  {plans.map((plan, index) => (
                    <div key={index} className="plan-card">
                      <h4 className="plan-title">{plan.name}</h4>
                      <p className="plan-price">
                        ${formatUsdAmount(plan.amountPerMonth)}/month
                      </p>
                      <div className="plan-features">
                        <p className="plan-features-title">Features:</p>
                        {plan.allowedFeatures.map((featureId) => {
                          const feature = features.find(f => f.featureId === featureId);
                          return (
                            <p key={featureId} className="plan-feature">
                              • {feature?.name || featureId}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;