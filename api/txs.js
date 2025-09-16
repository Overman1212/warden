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
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "1" || !Array.isArray(data.result)) {
      return res.status(404).json({ error: 'Transactions not found' });
    }

    const txs = data.result;
    let deposits = 0;
    let withdrawals = 0;
    let swaps = 0;
    let messari = 0;

    const minMessari = BigInt("50000000000000");
    const maxMessari = BigInt("60000000000000");

    for (const tx of txs) {
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
        if (value >= minMessari && value <= maxMessari) {
          messari++;
        }
      }
    }

    const total = txs.length - messari;

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
