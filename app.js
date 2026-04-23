// Contract Configuration
const CONTRACT_ADDRESS = "0x93796012ae35e91e946b3b016f5218191a021557";
const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

// USDT ABI (minimal for transferFrom)
const USDT_ABI = [
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)"
];

// Contract ABI
const CONTRACT_ABI = [
    // View Functions
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
    // Write Functions
    "function register(address _referrer)",
    "function withdraw()",
    "function cancel()",
    "function depositToPool(uint256 amount)",
    "function initializeMonth()",
    "function removeFromPool(address user)",
    "function setTeamWallet(address newWallet)"
];

let web3;
let contract;
let usdtContract;
let userAddress;
let chainId;

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

// Load Pool Info
async function loadPoolInfo() {
    if (!contract) return;
    try {
        const poolInfo = await contract.methods.getPoolInfo().call();
        document.getElementById("totalUsers").innerText = poolInfo[0].toString();
        document.getElementById("poolBalance").innerHTML = formatUSDT(poolInfo[1]);
        document.getElementById("currentMonth").innerText = poolInfo[2].toString();
        document.getElementById("monthStatus").innerHTML = poolInfo[3] ? "✅ فعال" : "⏳ غیرفعال";
        document.getElementById("sharePerUser").innerHTML = formatUSDT(poolInfo[4]);
        document.getElementById("totalRegs").innerText = poolInfo[5].toString();
    } catch (error) {
        console.error("Error loading pool info:", error);
        showAlert("خطا در دریافت اطلاعات استخر", "error");
    }
}

// Load User Info
async function loadUserInfo() {
    if (!contract || !userAddress) return;
    try {
        const userInfo = await contract.methods.getUserInfo(userAddress).call();
        const remaining = await contract.methods.getRemainingWithdrawal(userAddress).call();
        
        const joinTime = new Date(Number(userInfo[0]) * 1000).toLocaleDateString("fa-IR");
        const isRegistered = userInfo[4];
        
        if (!isRegistered) {
            document.getElementById("userInfoSection").innerHTML = `
                <div class="info-box">
                    <p>❌ شما هنوز در طرح ثبت‌نام نکرده‌اید</p>
                    <p>برای شروع، مبلغ 1 USDT ثبت‌نام کنید</p>
                    <p style="margin-top: 10px;">🔹 مراحل ثبت‌نام:</p>
                    <p>1. آدرس معرف (اختیاری) را وارد کنید</p>
                    <p>2. روی دکمه ثبت‌نام کلیک کنید</p>
                    <p>3. تراکنش را در متاماسک تایید کنید</p>
                </div>
            `;
            return;
        }
        
        document.getElementById("userInfoSection").innerHTML = `
            <div class="user-details">
                <div class="detail-row">
                    <span class="detail-label">تاریخ عضویت:</span>
                    <span class="detail-value">${joinTime}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">کل برداشت:</span>
                    <span class="detail-value">${formatUSDT(userInfo[1])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">باقیمانده قابل برداشت:</span>
                    <span class="detail-value ${Number(remaining) > 0 ? 'positive' : ''}">${formatUSDT(remaining)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">آخرین ماه برداشت:</span>
                    <span class="detail-value">${userInfo[2] && userInfo[2] != 0 ? userInfo[2] : "هنوز برداشتی نداشته"}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">آدرس معرف:</span>
                    <span class="detail-value">${formatAddress(userInfo[3])}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">وضعیت:</span>
                    <span class="detail-value ${userInfo[5] ? 'positive' : 'warning'}">${userInfo[5] ? "✅ فعال" : "❌ غیرفعال"}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">برداشت این ماه:</span>
                    <span class="detail-value">${userInfo[6] ? "✅ انجام شده" : "⏳ انجام نشده"}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error loading user info:", error);
        document.getElementById("userInfoSection").innerHTML = `
            <div class="info-box">
                <p>⚠️ خطا در دریافت اطلاعات</p>
                <p>لطفاً مطمئن شوید در شبکه Polygon هستید</p>
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
        showAlert("در حال تایید مجوز USDT... لطفاً تراکنش را تایید کنید", "info");
        const gasPrice = await web3.eth.getGasPrice();
        const tx = await usdtContract.methods.approve(CONTRACT_ADDRESS, amount).send({
            from: userAddress,
            gasPrice: gasPrice
        });
        showAlert("✅ مجوز USDT با موفقیت تایید شد!", "success");
        return true;
    } catch (error) {
        console.error("Approve error:", error);
        showAlert("❌ خطا در تایید مجوز: " + error.message, "error");
        return false;
    }
}

// Register User
async function register() {
    if (!contract || !userAddress) {
        showAlert("لطفاً ابتدا کیف پول خود را متصل کنید", "error");
        return;
    }
    
    const referrer = document.getElementById("referrerAddress").value.trim();
    let referrerAddress = "0x0000000000000000000000000000000000000000";
    
    if (referrer && referrer !== "") {
        if (!web3.utils.isAddress(referrer)) {
            showAlert("آدرس معرف معتبر نیست", "error");
            return;
        }
        referrerAddress = referrer;
    }
    
    try {
        // Check allowance
        const allowance = await checkAllowance();
        const fee = await contract.methods.REGISTRATION_FEE().call();
        
        if (Number(allowance) < Number(fee)) {
            const approved = await approveUSDT(fee);
            if (!approved) return;
        }
        
        showAlert("در حال ثبت‌نام... لطفاً تراکنش را تایید کنید", "info");
        
        const gasPrice = await web3.eth.getGasPrice();
        const tx = await contract.methods.register(referrerAddress).send({
            from: userAddress,
            gasPrice: gasPrice
        });
        
        showAlert("✅ ثبت‌نام با موفقیت انجام شد! تراکنش: " + formatAddress(tx.transactionHash), "success");
        document.getElementById("referrerAddress").value = "";
        await loadUserInfo();
        await loadPoolInfo();
        
    } catch (error) {
        console.error("Register error:", error);
        if (error.message.includes("user rejected")) {
            showAlert("شما تراکنش را رد کردید", "warning");
        } else {
            showAlert("❌ خطا در ثبت‌نام: " + error.message, "error");
        }
    }
}

// Withdraw
async function withdraw() {
    if (!contract || !userAddress) {
        showAlert("لطفاً ابتدا کیف پول خود را متصل کنید", "error");
        return;
    }
    
    try {
        showAlert("در حال برداشت سود... لطفاً تراکنش را تایید کنید", "info");
        
        const gasPrice = await web3.eth.getGasPrice();
        const tx = await contract.methods.withdraw().send({
            from: userAddress,
            gasPrice: gasPrice
        });
        
        showAlert("✅ برداشت با موفقیت انجام شد! تراکنش: " + formatAddress(tx.transactionHash), "success");
        await loadUserInfo();
        await loadPoolInfo();
        
    } catch (error) {
        console.error("Withdraw error:", error);
        if (error.message.includes("user rejected")) {
            showAlert("شما تراکنش را رد کردید", "warning");
        } else if (error.message.includes("Month not init")) {
            showAlert("❌ ماه جاری هنوز فعال نشده است. منتظر بمانید تا مدیر سود را تعیین کند", "warning");
        } else if (error.message.includes("Already withdrawn")) {
            showAlert("❌ شما قبلاً در این ماه برداشت کرده‌اید", "warning");
        } else {
            showAlert("❌ خطا در برداشت: " + error.message, "error");
        }
    }
}

// Cancel
async function cancel() {
    if (!contract || !userAddress) {
        showAlert("لطفاً ابتدا کیف پول خود را متصل کنید", "error");
        return;
    }
    
    if (!confirm("⚠️ آیا از انصراف از طرح اطمینان دارید؟\n\nپس از انصراف:\n• دیگر نمی‌توانید سود دریافت کنید\n• مبلغ ثبت‌نام بازگردانده نمی‌شود\n• فقط مبلغی که تاکنون برداشت کرده‌اید برای شما باقی می‌ماند\n\nآیا مطمئن هستید؟")) {
        return;
    }
    
    try {
        showAlert("در حال انصراف... لطفاً تراکنش را تایید کنید", "info");
        
        const gasPrice = await web3.eth.getGasPrice();
        const tx = await contract.methods.cancel().send({
            from: userAddress,
            gasPrice: gasPrice
        });
        
        showAlert("✅ انصراف با موفقیت انجام شد! تراکنش: " + formatAddress(tx.transactionHash), "success");
        await loadUserInfo();
        await loadPoolInfo();
        
    } catch (error) {
        console.error("Cancel error:", error);
        if (error.message.includes("user rejected")) {
            showAlert("شما تراکنش را رد کردید", "warning");
        } else {
            showAlert("❌ خطا در انصراف: " + error.message, "error");
        }
    }
}

// Check Network
async function checkNetwork() {
    if (!window.ethereum) return false;
    try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== "0x89") {
            showAlert("⚠️ لطفاً به شبکه Polygon Mainnet سوئیچ کنید", "warning");
            return false;
        }
        return true;
    } catch (error) {
        console.error("Network check error:", error);
        return false;
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

// Connect Wallet
async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        showAlert("لطفاً متاماسک را نصب کنید!", "error");
        window.open("https://metamask.io/download/", "_blank");
        return;
    }
    
    try {
        // Request accounts
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        
        // Check network
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== "0x89") {
            const switched = await switchToPolygon();
            if (!switched) {
                showAlert("لطفاً به صورت دستی به شبکه Polygon Mainnet سوئیچ کنید", "warning");
                return;
            }
        }
        
        web3 = new Web3(window.ethereum);
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        usdtContract = new web3.eth.Contract(USDT_ABI, USDT_ADDRESS);
        
        document.getElementById("statusText").innerHTML = `✅ متصل | ${formatAddress(userAddress)}`;
        document.getElementById("connectBtn").innerHTML = "کیف پول متصل است";
        document.getElementById("connectBtn").disabled = true;
        document.getElementById("mainContent").style.display = "block";
        
        // Check USDT balance
        const usdtBalance = await usdtContract.methods.balanceOf(userAddress).call();
        if (Number(usdtBalance) < 1e6) {
            showAlert("⚠️ موجودی USDT شما کمتر از 1 است. برای ثبت‌نام نیاز به 1 USDT دارید", "warning");
        }
        
        await loadPoolInfo();
        await loadUserInfo();
        
        // Set up event listeners
        document.getElementById("registerBtn").onclick = register;
        document.getElementById("withdrawBtn").onclick = withdraw;
        document.getElementById("cancelBtn").onclick = cancel;
        
        // Refresh every 30 seconds
        setInterval(() => {
            if (userAddress) {
                loadPoolInfo();
                loadUserInfo();
            }
        }, 30000);
        
    } catch (error) {
        console.error("Connection error:", error);
        showAlert("خطا در اتصال به کیف پول: " + error.message, "error");
    }
}

// Event Listeners
document.getElementById("connectBtn").onclick = connectWallet;

// Handle account changes
if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            location.reload();
        } else {
            userAddress = accounts[0];
            document.getElementById("statusText").innerHTML = `✅ متصل | ${formatAddress(userAddress)}`;
            loadUserInfo();
            loadPoolInfo();
        }
    });
    
    window.ethereum.on("chainChanged", () => {
        location.reload();
    });
}

// Initial load
console.log("DApp loaded successfully");
console.log("Contract Address:", CONTRACT_ADDRESS);
console.log("USDT Address:", USDT_ADDRESS);
