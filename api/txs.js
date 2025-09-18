// /api/txs.js

export default async function handler(req, res) {
  const allowedOrigin = 'https://my-warden-explorer.vercel.app';
  const origin = req.headers.origin;

  if (origin !== allowedOrigin) {
    return res.status(403).json({ error: 'Forbidden: Origin not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const address = (req.query.address || "").toLowerCase().trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid or missing address' });
  }

  const apiKey = "GASGF2JMJHGTT42NG1QCH2VZAZW5FJVB9W";
  const chainId = 8453;
  const messariAddress = "0x2847a369b2f886d5b5acfbb86dc4e1f5ca8869be";

  const ethTxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;
  const tokenTxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;

  try {
    const ethResponse = await fetch(ethTxUrl);
    const ethData = await ethResponse.json();

    if (ethData.status !== "1" || !Array.isArray(ethData.result)) {
      return res.status(404).json({ error: 'Transactions not found' });
    }

    const tokenResponse = await fetch(tokenTxUrl);
    const tokenData = await tokenResponse.json();

    let deposits = 0;
    let withdrawals = 0;
    let swaps = 0;
    let messari = 0;

    const minMessari = BigInt("50000000000000");
    const maxMessari = BigInt("60000000000000");

    for (const tx of ethData.result) {
      const from = tx.from.toLowerCase();
      const to = tx.to?.toLowerCase() || "";
      const value = BigInt(tx.value || "0");
      const functionName = tx.functionName?.toLowerCase() || "";
      const isSwap = functionName.includes("swap");

      if (isSwap) {
        swaps++;
      } else if (to === address && from !== address) {
        deposits++;
      } else if (
        from === address &&
        to !== address &&
        value > 0n &&
        tx.input === "0x" &&
        tx.isError === "0"
      ) {
        withdrawals++;

        if (to === messariAddress && value >= minMessari && value <= maxMessari) {
          messari++;
        }
      }
    }

    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
      for (const tokenTx of tokenData.result) {
        const tokenFrom = tokenTx.from.toLowerCase();
        const tokenTo = tokenTx.to.toLowerCase();
        const tokenSymbol = tokenTx.tokenSymbol;
        const tokenDecimal = parseInt(tokenTx.tokenDecimal || "6", 10);
        const rawValue = BigInt(tokenTx.value || "0");

        const usdcTargetValue = BigInt("250000");

        if (
          tokenFrom === address &&
          tokenTo === messariAddress &&
          tokenSymbol === "USDC" &&
          rawValue === usdcTargetValue
        ) {
          messari++;
        }

        // ✅ Don't count tokenTxs as withdrawals or swaps
      }
    }

    const total = deposits + withdrawals + swaps;

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
