
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {AggregatorV3Interface} from "../lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract EtherSub {
    // ===== State Variables =====
    address public immutable owner;

    AggregatorV3Interface public s_priceFeed;
    // Sepolia ETH/USD price feed address (static)
    address constant SEPOLIA_ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    bool private locked;

    // ===== Events =====
    event Subscribed(address indexed user, string planName, uint256 amount);
    event Cancelled(address indexed user, string planName, uint256 refund);
    event PlanCreated(string planName, uint256 price);
    event Withdrawn(address indexed owner, uint256 amount);

    // ===== Modifiers =====
    modifier onlyOwner() {
        require(owner == msg.sender, "Only contract owner can call this");
        _;
    }

    modifier noReentrancy() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    // ===== Structs =====
    struct Subscription {
        address subscriber;
        string planName;
        uint256 amountPaid;
        uint256 startTime;
        uint256 duration;
    }

    struct Plan {
        string name;
        uint256 amountPerMonth; // stored in USD with 18 decimals
        string[] allowedFeatures; // JSON string of allowed features
    }

    struct Feature {
        string featureId; // Unique identifier for the feature
        string name;
        string description;
    }


    // ===== Mappings & Arrays =====
    mapping(string => Plan) public plans;
    string[] public planNames;
    mapping(address => mapping(string => Subscription)) public subscriptions;

    mapping(string => Feature) public features; // Mapping of feature IDs to Feature structs
    string[] public featureIds; // Array of feature IDs for iteration


    // ===== Constructor =====
    constructor() {
        owner = msg.sender;
        s_priceFeed = AggregatorV3Interface(SEPOLIA_ETH_USD_FEED);
    }

    // ===== Price Feed & Conversion Functions =====
    function getLatestPrice() public view returns (uint256) {
        (, int256 price,,,) = s_priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price); // price with 8 decimals
    }

    function getEthAmountFromUsd(uint256 usdAmount) public view returns (uint256) {
        uint256 ethPrice = getLatestPrice(); // 8 decimals
        // Convert USD amount (18 decimals) to ETH (wei) with proper decimals adjustment
        return (usdAmount * 1e18) / (ethPrice * 1e10);
    }

    //only owner can create features
    function createFeature(string memory featureId, string memory name, string memory description) public onlyOwner {
        require(bytes(features[featureId].featureId).length == 0, "Feature already exists");
        features[featureId] = Feature(featureId, name, description);
        featureIds.push(featureId);
    }

    //view all features
    function viewFeatures() public view returns (Feature[] memory) {
        Feature[] memory allFeatures = new Feature[](featureIds.length);
        for (uint256 i = 0; i < featureIds.length; i++) {
            allFeatures[i] = features[featureIds[i]];
        }
        return allFeatures;
    }

    // Get a specific feature by ID
    function getFeature(string memory featureId) public view returns (Feature memory) {
        require(bytes(features[featureId].featureId).length > 0, "Feature does not exist");
        return features[featureId];
    }

    // ===== Plan Management =====
    function createPlan(string memory name, uint256 amountInUsd, string[] memory planFeatureIds) public onlyOwner {
        require(plans[name].amountPerMonth == 0, "Plan already exists");
        uint256 amountPerMonth = amountInUsd * 1e18;
        plans[name] = Plan(name, amountPerMonth, planFeatureIds);
        planNames.push(name);
        emit PlanCreated(name, amountPerMonth);
    }

    // ===== Subscription Functions =====
    function subscribe(string memory planName, uint8 durationOption, uint8 maxSlippage) public payable {
    Plan storage plan = plans[planName];
    require(plan.amountPerMonth > 0, "Plan does not exist");
    require(durationOption == 1 || durationOption == 12, "Invalid duration");

    uint256 usdAmount = plan.amountPerMonth * durationOption;
    
    // Apply 10% discount for 12-month subscriptions
    if (durationOption == 12) {
        usdAmount = (usdAmount * 90) / 100; // 10% discount
    }
    
    uint256 requiredEth = getEthAmountFromUsd(usdAmount);

    // Slippage check
    uint256 minEth = (requiredEth * (100 - maxSlippage)) / 100;
    require(msg.value >= minEth, "ETH sent is below required min due to slippage");

    Subscription storage subscription = subscriptions[msg.sender][planName];
    uint256 addedDuration = durationOption == 1 ? 30 days : 365 days;

    if (subscription.startTime != 0) {
        uint256 timeElapsed = block.timestamp - subscription.startTime;
        uint256 timeLeft = subscription.duration > timeElapsed ? subscription.duration - timeElapsed : 0;
        subscription.startTime = block.timestamp;
        subscription.amountPaid += msg.value;
        subscription.duration = timeLeft + addedDuration;
    } else {
        subscription.subscriber = msg.sender;
        subscription.planName = planName;
        subscription.amountPaid = msg.value;
        subscription.startTime = block.timestamp;
        subscription.duration = addedDuration;
    }

    emit Subscribed(msg.sender, planName, msg.value);
}

    function checkSubscription(string memory planName) public view returns (Subscription memory, uint256 timeLeft) {
        Subscription storage subscription = subscriptions[msg.sender][planName];
        require(subscription.startTime != 0, "No active subscription for this plan");

        uint256 timeElapsed = block.timestamp - subscription.startTime;
        timeLeft = subscription.duration > timeElapsed ? subscription.duration - timeElapsed : 0;

        return (subscription, timeLeft);
    }

    function cancelSubscription(string memory planName) public noReentrancy {
        Subscription storage subscription = subscriptions[msg.sender][planName];
        require(subscription.startTime != 0, "No active subscription");

        uint256 timeElapsed = block.timestamp - subscription.startTime;
        uint256 timeLeft = subscription.duration > timeElapsed ? subscription.duration - timeElapsed : 0;
        uint256 refundAmount = (subscription.amountPaid * timeLeft) / subscription.duration;

        if (refundAmount > 0) {
            payable(msg.sender).transfer(refundAmount);
        }

        delete subscriptions[msg.sender][planName];

        emit Cancelled(msg.sender, planName, refundAmount);
    }

    //auto cleanup if plan duration is over 
    function autoCleanup() public {
        for (uint256 i = 0; i < planNames.length; i++) {
            string memory planName = planNames[i];
            Subscription storage subscription = subscriptions[msg.sender][planName];
            if (subscription.startTime != 0) {
                uint256 timeElapsed = block.timestamp - subscription.startTime;
                if (timeElapsed >= subscription.duration) {
                    delete subscriptions[msg.sender][planName];
                }
            }
        }
    }

    // ===== Utility Functions =====
    function viewPlans() public view returns (Plan[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < planNames.length; i++) {
            if (plans[planNames[i]].amountPerMonth > 0) {
                count++;
            }
        }

        Plan[] memory allPlans = new Plan[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < planNames.length; i++) {
            if (plans[planNames[i]].amountPerMonth > 0) {
                allPlans[index] = plans[planNames[i]];
                index++;
            }
        }

        return allPlans;
    }

    // Add these functions to your EtherSub contract for better frontend integration

// Get subscription status without reverting (frontend-friendly)
function getSubscriptionStatus(address user, string memory planName) 
    public view returns (bool active, uint256 timeLeft, uint256 amountPaid) 
{
    Subscription storage subscription = subscriptions[user][planName];
    if (subscription.startTime == 0) {
        return (false, 0, 0);
    }
    
    uint256 timeElapsed = block.timestamp - subscription.startTime;
    timeLeft = subscription.duration > timeElapsed ? subscription.duration - timeElapsed : 0;
    active = timeLeft > 0;
    amountPaid = subscription.amountPaid;
}

// Get required ETH for a plan with current prices (frontend helper)
function getSubscriptionCost(string memory planName, uint8 duration) 
    public view returns (uint256 ethCost, uint256 usdCost) 
{
    Plan storage plan = plans[planName];
    require(plan.amountPerMonth > 0, "Plan does not exist");
    require(duration == 1 || duration == 12, "Invalid duration");
    
    usdCost = plan.amountPerMonth * duration;
    if(duration == 12) {
        usdCost = (usdCost * 90) / 100; // Apply 10% discount for 12-month subscriptions
    }
    ethCost = getEthAmountFromUsd(usdCost);
}

// Check if user has any active subscriptions (useful for dashboard)
function hasActiveSubscription(address user) public view returns (bool) {
    for (uint256 i = 0; i < planNames.length; i++) {
        (bool active,,) = getSubscriptionStatus(user, planNames[i]);
        if (active) return true;
    }
    return false;
}

// Get all active subscriptions for a user (dashboard helper)
function getUserActiveSubscriptions(address user) 
    public view returns (string[] memory activePlanNames, uint256[] memory timesLeft) 
{
    // First count active subscriptions
    uint256 activeCount = 0;
    for (uint256 i = 0; i < planNames.length; i++) {
        (bool active,,) = getSubscriptionStatus(user, planNames[i]);
        if (active) activeCount++;
    }
    
    // Create arrays with correct size
    activePlanNames = new string[](activeCount);
    timesLeft = new uint256[](activeCount);
    
    // Fill arrays
    uint256 index = 0;
    for (uint256 i = 0; i < planNames.length; i++) {
        (bool active, uint256 timeLeft,) = getSubscriptionStatus(user, planNames[i]);
        if (active) {
            activePlanNames[index] = planNames[i];
            timesLeft[index] = timeLeft;
            index++;
        }
    }
}

// Get plan with features details (comprehensive plan info)
function getPlanDetails(string memory planName) 
    public view returns (
        string memory name,
        uint256 amountPerMonth,
        string[] memory featureIds,
        EtherSub.Feature[] memory planFeatures
    ) 
{
    Plan storage plan = plans[planName];
    require(plan.amountPerMonth > 0, "Plan does not exist");
    
    name = plan.name;
    amountPerMonth = plan.amountPerMonth;
    featureIds = plan.allowedFeatures;
    
    // Get full feature details
    planFeatures = new Feature[](featureIds.length);
    for (uint256 i = 0; i < featureIds.length; i++) {
        planFeatures[i] = features[featureIds[i]];
    }
}

    // ===== Owner-only Withdraw =====
    function withdraw() public onlyOwner noReentrancy {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);

        emit Withdrawn(msg.sender, balance);
    }
}
