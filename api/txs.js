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
  const chainId = 8453; // Base
  const messariAddress = "0x2847a369b2f886d5b5acfbb86dc4e1f5ca8869be";

  const ethTxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;
  const tokenTxUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${apiKey}`;

  try {
    const ethResponse = await fetch(ethTxUrl);
    const ethData = await ethResponse.json();
    if (ethData.status !== "1" || !Array.isArray(ethData.result)) {
      return res.status(404).json({ error: 'ETH transactions not found' });
    }

    const tokenResponse = await fetch(tokenTxUrl);
    const tokenData = await tokenResponse.json();

    let deposits = 0;
    let withdrawals = 0;
    let swaps = 0;
    let messari = 0;

    const minMessari = BigInt("50000000000000");
    const maxMessari = BigInt("60000000000000");

    const knownSwapMethodIds = new Set([
      "0xd0e30db0",  // deposit()
      "0x2e1a7d4d",  // withdraw()
      "0xb80c2f09",  // smartSwapByOrderId
      "0x3593564c",  // execute(... commands etc)
      // add more as you see them
    ]);

    const swapTxHashes = new Set();

    // ETH txs
    for (const tx of ethData.result) {
      const txHash = tx.hash;
      const from = tx.from.toLowerCase();
      const to = (tx.to || "").toLowerCase();
      const methodId = (tx.methodId || "").toLowerCase();
      const fnName = (tx.functionName || "").toLowerCase();
      const input = tx.input || "";
      const value = BigInt(tx.value || "0");
      const isError = tx.isError === "1";

      let isSwap = false;

      // Check swap via methodId or functionName
      if (fnName.includes("swap") 
          || knownSwapMethodIds.has(methodId) 
          || fnName.includes("execute(")
          || fnName.includes("deposit(")  // maybe wrap
          || fnName.includes("withdraw(")
      ) {
        isSwap = true;
      }

      if (isSwap) {
        if (!swapTxHashes.has(txHash)) {
          swaps++;
          swapTxHashes.add(txHash);
        }
        // do not treat further as deposit/withdrawal
      } else {
        // Not swap: check ETH deposit
        if (to === address && from !== address && value > 0n && !isError) {
          deposits++;
        }
        // Not swap: check ETH withdrawal
        else if (
          from === address &&
          to !== address &&
          value > 0n &&
          input === "0x" &&
          !isError
        ) {
          withdrawals++;
          if (to === messariAddress && value >= minMessari && value <= maxMessari) {
            messari++;
          }
        }
      }
    }

    // Token transactions
    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
      for (const tokenTx of tokenData.result) {
        const txHash = tokenTx.hash;
        const tokenFrom = tokenTx.from.toLowerCase();
        const tokenTo = tokenTx.to.toLowerCase();
        const methodIdToken = (tokenTx.methodId || "").toLowerCase();
        const fnNameToken = (tokenTx.functionName || "").toLowerCase();
        const rawValue = BigInt(tokenTx.value || "0");
        const tokenSymbol = tokenTx.tokenSymbol;

        let isTokenSwap = false;
        if (fnNameToken.includes("swap") 
            || knownSwapMethodIds.has(methodIdToken) 
            || fnNameToken.includes("execute(")
        ) {
          isTokenSwap = true;
        }

        if (isTokenSwap) {
          if (!swapTxHashes.has(txHash)) {
            swaps++;
            swapTxHashes.add(txHash);
          }
        } else {
          // Not a swap token tx: deposit or withdrawal
          if (tokenTo === address && tokenFrom !== address && rawValue > 0n) {
            deposits++;
          } else if (tokenFrom === address && tokenTo !== address && rawValue > 0n) {
            withdrawals++;
          }
        }

        // Messari via token transfers
        const usdcTargetValue = BigInt("250000");
        if (
          tokenFrom === address &&
          tokenTo === messariAddress &&
          tokenSymbol === "USDC" &&
          rawValue === usdcTargetValue
        ) {
          messari++;
        }
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

  } catch (err) {
    console.error("Error in handler:", err);
    return res.status(500).json({ error: 'Internal server error' });
  }
      }      const from = tx.from.toLowerCase();
      const to = (tx.to || "").toLowerCase();
      const value = BigInt(tx.value || "0");
      const methodId = (tx.methodId || "").toLowerCase();
      const functionName = (tx.functionName || "").toLowerCase();
      const input = tx.input || "";
      const isError = tx.isError === "1";

      // Check if this tx should be considered a swap
      let isSwap = false;

      if (functionName.includes("swap")) {
        isSwap = true;
      } else if (knownSwapMethodIds.has(methodId)) {
        isSwap = true;
      }

      if (isSwap && !swapTxHashes.has(tx.hash)) {
        swaps++;
        swapTxHashes.add(tx.hash);
      } else if (!isSwap && to === address && from !== address) {
        // ETH deposit (incoming)
        deposits++;
      } else if (
        !isSwap &&
        from === address &&
        to !== address &&
        value > 0n &&
        input === "0x" &&
        !isError
      ) {
        withdrawals++;
        if (to === messariAddress && value >= minMessari && value <= maxMessari) {
          messari++;
        }
      }
    }

    // Process token transfers
    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
      for (const tokenTx of tokenData.result) {
        const tokenFrom = tokenTx.from.toLowerCase();
        const tokenTo = tokenTx.to.toLowerCase();
        const tokenSymbol = tokenTx.tokenSymbol;
        const rawValue = BigInt(tokenTx.value || "0");
        const methodIdToken = (tokenTx.methodId || "").toLowerCase();
        const functionNameToken = (tokenTx.functionName || "").toLowerCase();

        // If this tokenTx belongs to a swap by the universal router or known swap method, count it as swap if not already
        let isTokenSwap = false;
        if (functionNameToken.includes("swap")) {
          isTokenSwap = true;
        } else if (knownSwapMethodIds.has(methodIdToken)) {
          isTokenSwap = true;
        }

        if (isTokenSwap && !swapTxHashes.has(tokenTx.hash)) {
          swaps++;
          swapTxHashes.add(tokenTx.hash);
        } else {
          // Not swap: classify deposit or withdrawal in tokens
          if (tokenTo === address && tokenFrom !== address) {
            deposits++;
          } else if (tokenFrom === address && tokenTo !== address) {
            withdrawals++;
          }
        }

        // Special: messari via USDC token transfers
        const usdcTargetValue = BigInt("250000"); // as example threshold
        if (
          tokenFrom === address &&
          tokenTo === messariAddress &&
          tokenSymbol === "USDC" &&
          rawValue === usdcTargetValue
        ) {
          messari++;
        }
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
          }    // Process ETH transactions
    for (const tx of ethData.result) {
      const from = tx.from.toLowerCase();
      const to = (tx.to || "").toLowerCase();
      const value = BigInt(tx.value || "0");
      const methodId = (tx.methodId || "").toLowerCase();
      const functionName = (tx.functionName || "").toLowerCase();
      const input = tx.input || "";

      // isSwap = if functionName has “swap” OR methodId in knownSwapMethodIds OR deposit()/withdraw()/unwrap etc from examples
      let isSwap = false;

      if (functionName.includes("swap")) {
        isSwap = true;
      } else if (knownSwapMethodIds.has(methodId)) {
        isSwap = true;
      }

      // From your examples, deposit() (methodId 0xd0e30db0) you consider as ETH→token
      // Withdraw (0x2e1a7d4d) as token→ETH
      // We treat those as swaps as well (they are part of swap flow)

      if (isSwap) {
        swaps++;
      } else if (to === address && from !== address) {
        // Incoming ETH, deposit
        deposits++;
      } else if (
        from === address &&
        to !== address &&
        value > 0n &&
        input === "0x" &&
        tx.isError === "0"
      ) {
        // Pure ETH withdrawal
        withdrawals++;

        if (to === messariAddress && value >= minMessari && value <= maxMessari) {
          messari++;
        }
      }
    }

    // Process token transfers primarily for deposits/withdrawals and messari
    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
      for (const tokenTx of tokenData.result) {
        const tokenFrom = tokenTx.from.toLowerCase();
        const tokenTo = tokenTx.to.toLowerCase();
        const tokenSymbol = tokenTx.tokenSymbol;
        //const tokenDecimal = parseInt(tokenTx.tokenDecimal || "6", 10);
        const rawValue = BigInt(tokenTx.value || "0");
        const methodIdToken = (tokenTx.methodId || "").toLowerCase();
        const functionNameToken = (tokenTx.functionName || "").toLowerCase();

        // If this tokenTx matches known swap (methodId or functionName), count it as swap rather than withdrawal or deposit
        let isTokenSwap = false;
        if (functionNameToken.includes("swap")) {
          isTokenSwap = true;
        } else if (knownSwapMethodIds.has(methodIdToken)) {
          isTokenSwap = true;
        }

        if (isTokenSwap) {
          swaps++;
        } else {
          // Not swap: decide deposit or withdrawal of tokens
          if (tokenTo === address && tokenFrom !== address) {
            deposits++;
          } else if (tokenFrom === address && tokenTo !== address) {
            withdrawals++;
          }
        }

        // Special: messari via token transfers if applicable
        const usdcTargetValue = BigInt("250000"); // example threshold
        if (
          tokenFrom === address &&
          tokenTo === messariAddress &&
          tokenSymbol === "USDC" &&
          rawValue === usdcTargetValue
        ) {
          messari++;
        }
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
