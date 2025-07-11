const { ethers } = require("ethers");
const axios = require("axios");

const chains = [
  {
    name: "Base",
    rpc: "https://base-mainnet.g.alchemy.com/v2/Ecb6PRdlznM-EzAkL9-H_gyvomlNYd6X",
    chainId: 8453,
    defiLlamaSlug: "base",
  },
  {
    name: "BSC",
    rpc: "https://bnb-mainnet.g.alchemy.com/v2/Ecb6PRdlznM-EzAkL9-H_gyvomlNYd6X",
    chainId: 56,
    defiLlamaSlug: "bsc",
  }
];

/**
 * Tính block time trung bình hiện tại và % thay đổi so với 24h trước
 * @param {ethers.JsonRpcProvider} provider - RPC provider của chain
 * @param {number} BLOCK_WINDOW - số block dùng để tính trung bình (mặc định 100)
 * @returns {Promise<{currentAvg: number, changePercent: number, formattedChange: string}>}
 */
async function getBlockTimeChange(provider, BLOCK_WINDOW = 100) {
  const latestBlock = await provider.getBlock("latest");

  // 1. Block time hiện tại
  const currentEnd = latestBlock.number;
  const currentStart = currentEnd - BLOCK_WINDOW;
  const currentStartBlock = await provider.getBlock(currentStart);
  const currentAvg =
    (latestBlock.timestamp - currentStartBlock.timestamp) / BLOCK_WINDOW;

  // 2. Ước lượng số block trong 24h
  const blocksPerDay = Math.ceil(86400 / currentAvg); // 86400s = 24h
  const pastEnd = currentEnd - blocksPerDay;
  const pastStart = pastEnd - BLOCK_WINDOW;

  // 3. Block time cách đây 24h
  const [pastEndBlock, pastStartBlock] = await Promise.all([
    provider.getBlock(pastEnd),
    provider.getBlock(pastStart),
  ]);
  const pastAvg =
    (pastEndBlock.timestamp - pastStartBlock.timestamp) / BLOCK_WINDOW;

  // 4. Tính % thay đổi
  const changePercent = ((currentAvg - pastAvg) / pastAvg) * 100;

  // 5. Hiển thị kết quả đẹp
  const performance =
    Math.abs(changePercent) < 0.01
      ? "~0.00%"
      : `${changePercent >= 0 ? "+" : "-"}${changePercent.toFixed(2)}%`;

  return {
    currentAvg,
    changePercent,
    performance,
  };
}


async function getVolumeUSD(slug) {
  try {
    const url = `https://api.llama.fi/overview/dexs/${slug}`;
    const res = await axios.get(url);
    return res.data.total24h;
  } catch {
    return null;
  }
}

function formatUSDNumber(num) {
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  if (num === 0) return "$0";
  return "-";
}

async function fetchChainStats(chain) {
  try {
    const provider = new ethers.JsonRpcProvider(chain.rpc);

    const [blockStats, volume] = await Promise.all([
      getBlockTimeChange(provider),
      getVolumeUSD(chain.defiLlamaSlug),
    ]);

    const formattedVolume = formatUSDNumber(volume ?? 0);

    return `${chain.name.padEnd(10)} Avg: ${blockStats.currentAvg.toFixed(
      2
    )}s\t${blockStats.performance}\t${formattedVolume}`;
  } catch (err) {
    return `❌ Error: ${chain.name} – ${err.message}`;
  }
}

(async () => {
  console.log("⏱️ Chain Performance:\n");

  const results = await Promise.allSettled(chains.map(fetchChainStats));

  results.forEach((res) => {
    if (res.status === "fulfilled") console.log(res.value);
    else console.error("Unhandled error:", res.reason);
  });
})();
