const axios = require("axios");

// ⚙️ Config common
const dummyAddress = "0x34Dd4B1035A245886e2ca84f7D00a2e7236C13A3"; // fake user
const ETH = "0x0000000000000000000000000000000000000000";

// 🟢 LI.FI latency test
async function testLiFiQuote() {
    const url = "https://li.quest/v1/quote";
    const params = {
        fromChain: 8453,
        toChain: 8453,
        fromToken: "0x0000000000000000000000000000000000000000",
        toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        fromAddress: "0xb033F119A9ED1eBB9a628861CeD9E3B636742069",
        toAddress: "0xb033F119A9ED1eBB9a628861CeD9E3B636742069",
        fromAmount: "10000000000000000000", // 10 ETH
        order: "FASTEST",
        preferExchanges: "lifidexaggregator",
        integrator: "moonx-farm",
        referrer: "0xb033F119A9ED1eBB9a628861CeD9E3B636742069",
        slippage: 0.005,
    };
    await axios.get(url, { params });
}

// 🟢 Relay.link latency test (ETH → ETH)
async function testRelayQuote() {
    const url = "https://api.relay.link/quote";
    const payload = {
        user: dummyAddress,
        originChainId: 1,
        destinationChainId: 42161,
        originCurrency: ETH,
        destinationCurrency: ETH,
        recipient: dummyAddress,
        tradeType: "EXACT_INPUT",
        amount: "100000000000000000", // 0.1 ETH
        referrer: "relay.link",
        useExternalLiquidity: false,
        useDepositAddress: false,
        topupGas: false,
    };

    await axios.post(url, payload);
}

// ⚡ Measure latency
async function measureLatency(name, fn) {
    try {
        const start = Date.now();
        await fn();
        const end = Date.now();
        const duration = end - start;
        console.log(`${name.padEnd(12)} latency: ${duration} ms`);
    } catch (err) {
        console.error(`❌ ${name} failed:`, err.message);
    }
}

// 🚀 Run all
async function run() {
    console.log("🔍 Measuring Bridge Latency...\n");
    await Promise.all([
        measureLatency("LI.FI", testLiFiQuote),
        measureLatency("Relay.link", testRelayQuote),
    ]);
}

run();
