import React, { useState } from 'react';
import { ethers } from 'ethers';
import NavBar from './NavBar';
import Admin from './AdminDashboard';
import Plans from './PlansComponent';
import ManageSubscription from './ManageSubscription'; // Assuming you have this component

function App() {
  // State to track which component to display
  const [activeComponent, setActiveComponent] = useState('plans'); // default to plans

  // Function to handle navigation
  const handleNavigation = (componentName) => {
    setActiveComponent(componentName);
  };

  // Function to render the active component
  const renderActiveComponent = () => {
    switch(activeComponent) {
      case 'plans':
        return <Plans />;
      case 'manage':
        return <ManageSubscription />;
      case 'admin':
        return <Admin />;
      default:
        return <Plans />;
    }
  };

  return (
    <>
      <NavBar onNavigate={handleNavigation} activeComponent={activeComponent} />
      {renderActiveComponent()}
    </>
  );
}

export default App;