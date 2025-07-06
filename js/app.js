import { networks } from './networks.js';
import { ETH_API_KEY } from './networks.config.js';

document.addEventListener('DOMContentLoaded', () => {
    const resultEl = document.getElementById('result');
    const tabs = document.querySelectorAll('.tab');
    const sections = document.querySelectorAll('.section');

    function populateSelect(id, rpcId) {
        const sel = document.getElementById(id);
        const inp = document.getElementById(rpcId);
        networks.forEach((net, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = net.name;
            sel.appendChild(opt);
        });
        sel.onchange = () => inp.value = networks[sel.value].rpcBase;
        inp.value = networks[sel.value].rpcBase;
    }

    populateSelect('network-select-1','rpc-url-1');
    populateSelect('network-select-2','rpc-url-2');
    populateSelect('network-select-3','rpc-url-3');
    populateSelect('network-select-4','rpc-url-4');
    populateSelect('network-select-5','rpc-url-5');

    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tool).classList.add('active');
            resultEl.textContent = '';
        };
    });
    tabs[0].click();

    async function callRPC(rpc, method, params) {
        const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params })
        });
        const j = await res.json();
        if (j.error) throw new Error(j.error.message);
        return j.result;
    }

    // Tx Status Inspector
    document.getElementById('run-tx-status').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx   = document.getElementById('network-select-1').value;
            const base  = document.getElementById('rpc-url-1').value;
            const rpc   = idx==='0' ? `${base}/${ETH_API_KEY}` : base;
            const hash  = document.getElementById('tx-hash').value.trim();
            resultEl.textContent = `Fetching transaction ${hash}\n`;
            const tx = await callRPC(rpc,'eth_getTransactionByHash',[hash]);
            const nHex = tx.nonce;
            const nDec = parseInt(nHex.slice(2),16);
            resultEl.textContent += `From: ${tx.from}\nNonce: ${nHex} → ${nDec}\n`;
            if (tx.blockNumber) {
                const bHex = tx.blockNumber;
                const bDec = parseInt(bHex.slice(2),16);
                resultEl.textContent += `Included in block ${bHex} (${bDec})\n`;
            } else {
                resultEl.textContent += `Pending (not yet mined)\n`;
            }
            const pHex = await callRPC(rpc,'eth_getTransactionCount',[tx.from,'pending']);
            const pDec = parseInt(pHex.slice(2),16);
            resultEl.textContent += `Pending-nonce: ${pHex} → ${pDec}\n`;
            if (!tx.blockNumber && pDec>nDec+1) {
                resultEl.textContent += `Replacement detected\n`;
            } else if (!tx.blockNumber) {
                resultEl.textContent += `No replacement detected\n`;
            }
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `\nCheck RPC endpoint: ${document.getElementById('rpc-url-1').value}`;
            resultEl.textContent = `ERROR: ${msg}\n`;
        }
    };

    // Gas Price Checker
    document.getElementById('run-gas-report').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx  = document.getElementById('network-select-2').value;
            const base = document.getElementById('rpc-url-2').value;
            const rpc  = idx==='0' ? `${base}/${ETH_API_KEY}` : base;
            const gHex = await callRPC(rpc,'eth_gasPrice',[]);
            const gGwei = (parseInt(gHex.slice(2),16)/1e9).toFixed(3);
            resultEl.textContent = `Current gasPrice: ${gGwei} Gwei\nTo stall: use gasPrice < ${gGwei} Gwei\n`;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `\nCheck RPC endpoint: ${document.getElementById('rpc-url-2').value}`;
            resultEl.textContent = `ERROR: ${msg}\n`;
        }
    };

    // Pending Nonce Check
    document.getElementById('run-pending-nonce').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx  = document.getElementById('network-select-3').value;
            const base = document.getElementById('rpc-url-3').value;
            const rpc  = idx==='0' ? `${base}/${ETH_API_KEY}` : base;
            const addr = document.getElementById('account').value.trim();
            const cHex = await callRPC(rpc,'eth_getTransactionCount',[addr,'pending']);
            const pDec = parseInt(cHex.slice(2),16);
            resultEl.textContent = `Pending-nonce for ${addr}: ${pDec}\n`;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `\nCheck RPC endpoint: ${document.getElementById('rpc-url-3').value}`;
            resultEl.textContent = `ERROR: ${msg}\n`;
        }
    };

    // Nonce Range Finder
    document.getElementById('run-nonce-range').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx  = document.getElementById('network-select-4').value;
            const base = document.getElementById('rpc-url-4').value.trim();
            const rpc  = idx==='0' ? `${base}/${ETH_API_KEY}` : base;
            const from = parseInt(document.getElementById('from-nonce').value,10);
            const to   = parseInt(document.getElementById('to-nonce').value,10);
            const addr = document.getElementById('target-address').value.trim();

            const headHex = await callRPC(rpc,'eth_blockNumber',[]);
            const maxBlock = parseInt(headHex.slice(2),16);
            let out = '';

            for (let n=from; n<=to; n++){
                let low=0, high=maxBlock;
                while(low<high){
                    const mid = Math.floor((low+high)/2);
                    const cntHex = await callRPC(rpc,'eth_getTransactionCount',[addr,`0x${mid.toString(16)}`]);
                    const cnt = parseInt(cntHex.slice(2),16);
                    cnt< n+1 ? low=mid+1 : high=mid;
                }
                const fHex = await callRPC(rpc,'eth_getTransactionCount',[addr,`0x${low.toString(16)}`]);
                const fCnt = parseInt(fHex.slice(2),16);
                out += fCnt< n+1
                    ? `Nonce ${n} not found (up to block ${maxBlock})\n`
                    : `Nonce ${n} included in block ${low}\n`;
            }
            resultEl.textContent = out;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `\nCheck RPC endpoint: ${document.getElementById('rpc-url-4').value}`;
            resultEl.textContent = `ERROR: ${msg}\n`;
        }
    };

    // Nonce Timeline Analyzer
    document.getElementById('run-nonce-timeline').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx   = document.getElementById('network-select-5').value;
            const base  = document.getElementById('rpc-url-5').value.trim();
            const rpc   = idx==='0' ? `${base}/${ETH_API_KEY}` : base;
            const fromN = parseInt(document.getElementById('from-nonce-5').value,10);
            const toN   = parseInt(document.getElementById('to-nonce-5').value,10);
            const addr  = document.getElementById('target-address-5').value.trim().toLowerCase();

            const headHex = await callRPC(rpc,'eth_blockNumber',[]);
            const maxBlock = parseInt(headHex.slice(2),16);

            let prevTs = 0, prevN = null, output = '';

            for (let n=fromN; n<=toN; n++){
                let low=0, high=maxBlock;
                while(low<high){
                    const mid = Math.floor((low+high)/2);
                    const cntHex = await callRPC(rpc,'eth_getTransactionCount',[addr,`0x${mid.toString(16)}`]);
                    const cnt = parseInt(cntHex.slice(2),16);
                    cnt< n+1 ? low=mid+1 : high=mid;
                }
                const blk = low;
                const block = await callRPC(rpc,'eth_getBlockByNumber',[`0x${blk.toString(16)}`,true]);
                const ts = parseInt(block.timestamp.slice(2),16);
                let txHash = '';
                for (const tx of block.transactions){
                    if (parseInt(tx.nonce.slice(2),16)===n && tx.from.toLowerCase()===addr){
                        txHash = tx.hash;
                        break;
                    }
                }
                if (prevTs){
                    output += `nonce ${prevN}→${n}: ${ts-prevTs} s\n`;
                }
                output += `nonce ${n} in block ${blk} at ${new Date(ts*1000).toISOString()}, hash: ${txHash}\n`;
                prevTs = ts; prevN = n;
            }
            resultEl.textContent = output;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `\nCheck RPC endpoint: ${document.getElementById('rpc-url-5').value}`;
            resultEl.textContent = `ERROR: ${msg}`;
        }
    };
});