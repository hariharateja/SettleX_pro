// minimal helpers using ethers
import { BigNumber, ethers } from "ethers";
import settlexJson from "../contracts/settlex.json";

export const CONTRACT_ADDRESS = settlexJson.address;
export const ABI = settlexJson.abi;

export function getProvider() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const p = new ethers.providers.Web3Provider((window as any).ethereum);
    return p;
  }
  // fallback to read-only via env RPC (optional)
  return null;
}

export async function connectWallet() {
  const provider = getProvider();
  if (!provider) throw new Error("No web3 provider");
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  return signer;
}

export function getContract(signerOrProvider?: ethers.Signer | ethers.providers.Provider) {
  const provider = signerOrProvider ?? (typeof window !== "undefined" ? new ethers.providers.Web3Provider((window as any).ethereum) : null);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider as any);
}

// encode preimage: abi.encode(token, to, amount)
export function encodePreimage(token: string, to: string, amount: string | number) {
  const abi = new ethers.utils.AbiCoder();
  const amountBN = BigNumber.from(amount.toString());
  return abi.encode(["address","address","uint256"], [token, to, amountBN]);
}

export function keccak256OfPreimage(encodedHex: string) {
  return ethers.utils.keccak256(encodedHex);
}

export function toWei(amount: string|number, decimals = 18){
  return ethers.utils.parseUnits(amount.toString(), decimals);
}

export function getSigner() {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  const provider = new ethers.providers.Web3Provider((window as any).ethereum);
  return provider.getSigner();
}

export function getSignerContract() {
  const signer = getSigner();
  if (!signer) throw new Error("No signer (connect your wallet)");
  return new ethers.Contract(settlexJson.address, settlexJson.abi, signer);
}