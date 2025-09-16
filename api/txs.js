// /api/txs.js

export default async function handler(req, res) {
  // CORS Origin Restriction
  const allowedOrigin = 'https://my-warden-explorer.vercel.app';
  const origin = req.headers.origin;

  if (origin !== allowedOrigin) {
    return res.status(403).json({ error: 'Forbidden: Origin not allowed' });
  }

  // Set CORS headers for allowed origin
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Wallet address validation
  const address = (req.query.address || "").toLowerCase().trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid or missing address' });
  }

  const apiKey = "GASGF2JMJHGTT42NG1QCH2VZAZW5FJVB9W";
  const chainId = 8453; // Base Mainnet
  const messariAddress = "0x2847a369b2f886d5b5acfbb86dc4e1f5ca8869be";

  const ethTxUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;
  const tokenTxUrl = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;

  try {
    // Fetch ETH transactions
    const ethResponse = await fetch(ethTxUrl);
    const ethData = await ethResponse.json();

    if (ethData.status !== "1" || !Array.isArray(ethData.result)) {
      return res.status(404).json({ error: 'Transactions not found' });
    }

    // Fetch token transfers
    const tokenResponse = await fetch(tokenTxUrl);
    const tokenData = await tokenResponse.json();

    let deposits = 0;
    let withdrawals = 0;
    let swaps = 0;
    let messari = 0;

    const minMessari = BigInt("50000000000000");
    const maxMessari = BigInt("60000000000000");

    // Process ETH transactions
    for (const tx of ethData.result) {
      const from = tx.from.toLowerCase();
      const to = tx.to.toLowerCase();
      const value = BigInt(tx.value || "0");
      const isSwap = tx.functionName?.toLowerCase().includes("swap") || (tx.input && tx.input !== "0x");

      if (isSwap) {
        swaps++;
      } else if (to === address && from !== address) {
        deposits++;
      } else if (from === address && to !== address) {
        withdrawals++;

        // ETH withdrawal to Messari address within value range counts as Messari
        if (to === messariAddress && value >= minMessari && value <= maxMessari) {
          messari++;
        }
      }
    }

    // Process token transfers for USDC Messari counting
    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
      for (const tokenTx of tokenData.result) {
        const tokenTo = tokenTx.to.toLowerCase();
        const tokenFrom = tokenTx.from.toLowerCase();
        const tokenAmount = tokenTx.value; // smallest unit, USDC has 6 decimals
        const tokenSymbol = tokenTx.tokenSymbol;

        if (
          tokenFrom === address &&
          tokenTo === messariAddress &&
          tokenSymbol === "USDC" &&
          tokenAmount === "250000" // 0.25 USDC = 250,000 units (6 decimals)
        ) {
          messari++;
        }
      }
    }

    const total = ethData.result.length - messari;

    const result = {};
    if (swaps > 0) result.swaps = swaps;
    if (withdrawals > 0) result.withdrawals = withdrawals;
    if (deposits > 0) result.deposits = deposits;
    if (messari > 0) result.messari = messari;
    if (total > 0) result.total = total;

    return res.status(200).json(result);

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
