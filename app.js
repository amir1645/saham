// Contract Configuration
const CONTRACT_ADDRESS = "0x93796012ae35e91e946b3b016f5218191a021557";
const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

// High Gas Configuration (50% extra for safety)
const GAS_LIMIT_MULTIPLIER = 1.5;
const DEFAULT_GAS_LIMIT = 1000000;

// USDT ABI (minimal for required operations)
const USDT_ABI = [
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

// Contract ABI
const CONTRACT_ABI = [
    "function USDT() view returns (address)",
    "function REGISTRATION_FEE() view returns (uint256)",
    "function REFERRAL_REWARD() view returns (uint256)",
    "function MAX_WITHDRAWAL() view returns (uint256)",
    "function MAX_REGISTRATIONS() view returns (uint256)",
    "function totalRegistrations() view returns (uint256)",
    "function totalActiveUsers() view returns (uint256)",
    "function totalPoolBalance() view returns (uint256)",
    "function teamWallet() view returns (address)",
    "function owner() view returns (address)",
    "function getUserInfo(address user) view returns (uint256, uint256, uint256, address, bool, bool, bool)",
    "function getPoolInfo() view returns (uint256, uint256, uint256, bool, uint256, uint256, uint256)",
    "function getRemainingWithdrawal(address user) view returns (uint256)",
    "function isWithinDistributionWindow() view returns (bool)",
    "function register(address _referrer)",
    "function withdraw()",
    "function cancel()"
];

let web3;
let contract;
let usdtContract;
let userAddress;
let refreshInterval;

// Helper Functions
function showAlert(message, type = "info") {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert ${type}`;
    alertDiv.innerHTML = message;
    const container = document.getElementById("alertContainer");
    container.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

function formatUSDT(amount) {
    if (!amount && amount !== 0) return "-";
    return (Number(amount) / 1e6).toFixed(2) + " USDT";
}

function formatAddress(addr) {
    if (!addr || addr === "0x0000000000000000000000000000000000000000") return "-";
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Estimate gas with 50% buffer
async function estimateGasWithBuffer(method, from, params = []) {
    try {
        let estimatedGas;
        if (params.length > 0) {
            estimatedGas = await method(...params).estimateGas({ from });
        } else {
            estimatedGas = await method().estimateGas({ from });
        }
        // Add 50% buffer for safety
        const gasWithBuffer = Math.floor(estimatedGas * GAS_LIMIT_MULTIPLIER);
        const finalGas = Math.min(gasWithBuffer, DEFAULT_GAS_LIMIT * 2);
        console.log(`Estimated gas: ${estimatedGas}, With 50% buffer: ${finalGas}`);
        return finalGas;
    } catch (error) {
        console.warn("Gas estimation failed, using default:", error);
        return DEFAULT_GAS_LIMIT;
    }
}

// Load Pool Information
async function loadPoolInfo() {
    if (!contract) return;
    try {
        const poolInfo = await contract.methods.getPoolInfo().call();
        document.getElementById("totalUsers").innerText = poolInfo[0].toString();
        document.getElementById("poolBalance").innerHTML = formatUSDT(poolInfo[1]);
        document.getElementById("currentMonth").innerText = poolInfo[2].toString();
        document.getElementById("monthStatus").innerHTML = poolInfo[3] ? "✅ Active" : "⏳ Inactive";
        document.getElementById("sharePerUser").innerHTML = formatUSDT(poolInfo[4]);
        document.getElementById("totalRegs").innerText = poolInfo[5].toString();
    } catch (error) {
        console.error("Error loading pool info:", error);
    }
}

// Load User Information
async function loadUserInfo() {
    if (!contract || !userAddress) return;
    try {
        const userInfo = await contract.methods.getUserInfo(userAddress).call();
        const remaining = await contract.methods.getRemainingWithdrawal(userAddress).call();
        
        const joinTime = new Date(Number(userInfo[0]) * 1000).toLocaleDateString();
        const isRegistered = userInfo[4];
        
        if (!isRegistered) {
            document.getElementById("userInfoSection").innerHTML = `
                <div class="info-box" style="background: #fff8e1;">
                    <p>❌ <strong>You are not registered yet</strong></p>
                    <p>Register with 1 USDT to start earning monthly profits!</p>
                    <p style="margin-top: 10px;">🔹 <strong>How to register:</strong></p>
                    <p>1. Enter referrer address (optional)</p>
                    <p>2. Click the Register button</p>
                    <p>3. Confirm the transaction in your wallet</p>
                    <p style="margin-top: 10px;">💰 <strong>Expected Profit:</strong> Up to 100% (2 USDT total)</p>
                </div>
            `;
            return;
        }
        
        document.getElementById("userInfoSection").innerHTML = `
            <div class="user-details">
                <div class="detail-row">
                    <span class="detail-label">📅 Join Date:</span>
                    <span class="detail-value">${joinTime}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">💰 Total Withdrawn:</span>
                    <span class="detail-value">${formatUSDT(userInfo[1])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">📊 Remaining:</span>
                    <span class="detail-value ${Number(remaining) > 0 ? 'success' : 'warning'}">${formatUSDT(remaining)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">📆 Last Withdraw Month:</span>
                    <span class="detail-value">${userInfo[2] && userInfo[2] != 0 ? userInfo[2] : "Never"}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">👥 Referrer:</span>
                    <span class="detail-value">${formatAddress(userInfo[3])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🔘 Status:</span>
                    <span class="detail-value ${userInfo[5] ? 'success' : 'warning'}">${userInfo[5] ? "✅ Active" : "❌ Inactive"}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🔄 Withdrawn This Month:</span>
                    <span class="detail-value">${userInfo[6] ? "✅ Yes" : "⏳ No"}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error loading user info:", error);
        document.getElementById("userInfoSection").innerHTML = `
            <div class="info-box" style="background: #f8d7da; border-left-color: #e74c3c;">
                <p>⚠️ <strong>Error loading user data</strong></p>
                <p>Please make sure you're connected to the Polygon network</p>
                <p>Error: ${error.message.slice(0, 100)}</p>
            </div>
        `;
    }
}

// Check USDT Allowance
async function checkAllowance() {
    if (!usdtContract || !userAddress) return 0;
    try {
        const allowance = await usdtContract.methods.allowance(userAddress, CONTRACT_ADDRESS).call();
        return allowance;
    } catch (error) {
        console.error("Error checking allowance:", error);
        return 0;
    }
}

// Approve USDT
async function approveUSDT(amount) {
    if (!usdtContract || !userAddress) return false;
    try {
        showAlert("Approving USDT... Please confirm the transaction", "info");
        const gasLimit = await estimateGasWithBuffer(usdtContract.methods.approve, userAddress, [CONTRACT_ADDRESS, amount]);
        const tx = await usdtContract.methods.approve(CONTRACT_ADDRESS, amount).send({
            from: userAddress,
            gas: gasLimit
        });
        showAlert("✅ USDT approved successfully!", "success");
        return true;
    } catch (error) {
        console.error("Approve error:", error);
        showAlert("❌ Approval failed: " + error.message, "error");
        return false;
    }
}

// Register User
async function register() {
    if (!contract || !userAddress) {
        showAlert("Please connect your wallet first", "error");
        return;
    }
    
    const referrer = document.getElementById("referrerAddress").value.trim();
    let referrerAddress = "0x0000000000000000000000000000000000000000";
    
    if (referrer && referrer !== "") {
        if (!web3.utils.isAddress(referrer)) {
            showAlert("Invalid referrer address format", "error");
            return;
        }
        referrerAddress = referrer;
    }
    
    try {
        // Check and handle allowance
        const allowance = await checkAllowance();
        const fee = await contract.methods.REGISTRATION_FEE().call();
        
        if (Number(allowance) < Number(fee)) {
            const approved = await approveUSDT(fee);
            if (!approved) return;
        }
        
        showAlert("Registering... Please confirm the transaction", "info");
        
        const gasLimit = await estimateGasWithBuffer(contract.methods.register, userAddress, [referrerAddress]);
        const tx = await contract.methods.register(referrerAddress).send({
            from: userAddress,
            gas: gasLimit
        });
        
        showAlert("✅ Registration successful! Transaction: " + formatAddress(tx.transactionHash), "success");
        document.getElementById("referrerAddress").value = "";
        await loadUserInfo();
        await loadPoolInfo();
        
    } catch (error) {
        console.error("Register error:", error);
        if (error.message.includes("user rejected")) {
            showAlert("You rejected the transaction", "warning");
        } else if (error.message.includes("Max regs")) {
            showAlert("❌ Maximum registrations reached (10,000 users)", "error");
        } else if (error.message.includes("Registered")) {
            showAlert("❌ You are already registered", "error");
        } else {
            showAlert("❌ Registration failed: " + error.message.slice(0, 150), "error");
        }
    }
}

// Withdraw Profit
async function withdraw() {
    if (!contract || !userAddress) {
        showAlert("Please connect your wallet first", "error");
        return;
    }
    
    try {
        showAlert("Withdrawing profit... Please confirm the transaction", "info");
        
        const gasLimit = await estimateGasWithBuffer(contract.methods.withdraw, userAddress, []);
        const tx = await contract.methods.withdraw().send({
            from: userAddress,
            gas: gasLimit
        });
        
        showAlert("✅ Withdrawal successful! Transaction: " + formatAddress(tx.transactionHash), "success");
        await loadUserInfo();
        await loadPoolInfo();
        
    } catch (error) {
        console.error("Withdraw error:", error);
        if (error.message.includes("user rejected")) {
            showAlert("You rejected the transaction", "warning");
        } else if (error.message.includes("Month not init")) {
            showAlert("❌ Current month not initialized yet. Wait for admin to distribute rewards", "warning");
        } else if (error.message.includes("Already withdrawn")) {
            showAlert("❌ You have already withdrawn this month", "warning");
        } else if (error.message.includes("Not active")) {
            showAlert("❌ Your account is not active. You may have cancelled or been removed", "error");
        } else {
            showAlert("❌ Withdrawal failed: " + error.message.slice(0, 150), "error");
        }
    }
}

// Cancel Registration
async function cancel() {
    if (!contract || !userAddress) {
        showAlert("Please connect your wallet first", "error");
        return;
    }
    
    if (!confirm("⚠️ WARNING: Are you sure you want to cancel?\n\nAfter cancellation:\n• You will no longer receive monthly profits\n• Registration fee is non-refundable\n• Only amounts you've already withdrawn remain yours\n• You cannot re-register\n\nAre you absolutely sure?")) {
        return;
    }
    
    try {
        showAlert("Cancelling registration... Please confirm the transaction", "info");
        
        const gasLimit = await estimateGasWithBuffer(contract.methods.cancel, userAddress, []);
        const tx = await contract.methods.cancel().send({
            from: userAddress,
            gas: gasLimit
        });
        
        showAlert("✅ Cancellation successful! Transaction: " + formatAddress(tx.transactionHash), "success");
        await loadUserInfo();
        await loadPoolInfo();
        
    } catch (error) {
        console.error("Cancel error:", error);
        if (error.message.includes("user rejected")) {
            showAlert("You rejected the transaction", "warning");
        } else if (error.message.includes("Not active")) {
            showAlert("❌ Your account is already inactive", "warning");
        } else {
            showAlert("❌ Cancellation failed: " + error.message.slice(0, 150), "error");
        }
    }
}

// Switch to Polygon Network
async function switchToPolygon() {
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x89" }]
        });
        return true;
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: "0x89",
                        chainName: "Polygon Mainnet",
                        nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                        rpcUrls: ["https://polygon-rpc.com"],
                        blockExplorerUrls: ["https://polygonscan.com"]
                    }]
                });
                return true;
            } catch (addError) {
                console.error("Add network error:", addError);
                return false;
            }
        }
        return false;
    }
}

// Auto Connect Wallet
async function autoConnectWallet() {
    if (typeof window.ethereum === "undefined") {
        document.getElementById("statusText").innerHTML = "⚠️ Please install MetaMask";
        showAlert("Please install MetaMask to use this DApp", "warning");
        return;
    }
    
    try {
        // Request accounts automatically
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        
        // Check and switch network if needed
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== "0x89") {
            showAlert("Please switch to Polygon Mainnet", "info");
            const switched = await switchToPolygon();
            if (!switched) {
                document.getElementById("statusText").innerHTML = "⚠️ Please switch to Polygon";
                return;
            }
        }
        
        web3 = new Web3(window.ethereum);
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        usdtContract = new web3.eth.Contract(USDT_ABI, USDT_ADDRESS);
        
        document.getElementById("statusText").innerHTML = `✅ Connected | ${formatAddress(userAddress)}`;
        document.getElementById("mainContent").style.display = "block";
        
        // Check USDT balance
        const usdtBalance = await usdtContract.methods.balanceOf(userAddress).call();
        if (Number(usdtBalance) < 1e6) {
            showAlert("⚠️ Your USDT balance is less than 1 USDT. You need 1 USDT to register", "warning");
        }
        
        // Load initial data
        await loadPoolInfo();
        await loadUserInfo();
        
        // Setup event listeners
        document.getElementById("registerBtn").onclick = register;
        document.getElementById("withdrawBtn").onclick = withdraw;
        document.getElementById("cancelBtn").onclick = cancel;
        
        // Refresh data every 30 seconds
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            if (userAddress) {
                loadPoolInfo();
                loadUserInfo();
            }
        }, 30000);
        
    } catch (error) {
        console.error("Auto-connect error:", error);
        document.getElementById("statusText").innerHTML = "❌ Connection failed";
        showAlert("Failed to connect wallet. Please make sure MetaMask is unlocked and on Polygon network", "error");
    }
}

// Handle account changes
if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            window.location.reload();
        } else {
            userAddress = accounts[0];
            document.getElementById("statusText").innerHTML = `✅ Connected | ${formatAddress(userAddress)}`;
            loadUserInfo();
            loadPoolInfo();
        }
    });
    
    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}

// Initialize on page load
window.addEventListener("load", () => {
    autoConnectWallet();
});
