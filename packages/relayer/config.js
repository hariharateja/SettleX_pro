require("dotenv").config();
module.exports = {
  rpc: process.env.SEPOLIA_RPC_URL,
  key: process.env.RELAYER_PRIVATE_KEY,
  contract: process.env.CONTRACT_ADDRESS,
  pollInterval: Number(process.env.POLL_INTERVAL_MS || 8000)
};