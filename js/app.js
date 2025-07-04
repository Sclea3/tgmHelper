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

    populateSelect('network-select-1', 'rpc-url-1');
    populateSelect('network-select-2', 'rpc-url-2');
    populateSelect('network-select-3', 'rpc-url-3');
    populateSelect('network-select-4', 'rpc-url-4');

    // Инициализация: активировать первую вкладку и секцию
    tabs[0].click();

    tabs.forEach(tab => tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tool).classList.add('active');
        resultEl.textContent = '';
    });

    async function callRPC(rpc, method, params) {
        const response = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.result;
    }

    document.getElementById('run-tx-status').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx = document.getElementById('network-select-1').value;
            const base = document.getElementById('rpc-url-1').value;
            const rpc = idx === '0' ? `${base}/${ETH_API_KEY}` : base;
            const hash = document.getElementById('tx-hash').value.trim();
            resultEl.textContent += `Fetching transaction ${hash}
`;
            const tx = await callRPC(rpc, 'eth_getTransactionByHash', [hash]);
            const nonceHex = tx.nonce;
            const nonceDec = parseInt(nonceHex.slice(2), 16);
            resultEl.textContent += `From: ${tx.from}
Nonce: ${nonceHex} → ${nonceDec}
`;
            if (tx.blockNumber) {
                const blkHex = tx.blockNumber;
                const blkDec = parseInt(blkHex.slice(2), 16);
                resultEl.textContent += `Included in block ${blkHex} (${blkDec})
`;
            } else {
                resultEl.textContent += 'Pending (not yet mined)';
            }
            const hexCount = await callRPC(rpc, 'eth_getTransactionCount', [tx.from, 'pending']);
            const pending = parseInt(hexCount.slice(2), 16);
            resultEl.textContent += `Pending-nonce: ${hexCount} → ${pending}
`;
            if (!tx.blockNumber && pending > nonceDec + 1) resultEl.textContent += 'Replacement detected';
        else if (!tx.blockNumber) resultEl.textContent += 'No replacement detected';
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `
Check RPC endpoint: ${document.getElementById('rpc-url-1').value}`;
            resultEl.textContent = `ERROR: ${msg}
`;
        }
    };

    document.getElementById('run-gas-report').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx = document.getElementById('network-select-2').value;
            const base = document.getElementById('rpc-url-2').value;
            const rpc = idx === '0' ? `${base}/${ETH_API_KEY}` : base;
            const gasHex = await callRPC(rpc, 'eth_gasPrice', []);
            const price = (parseInt(gasHex.slice(2), 16) / 1e9).toFixed(3);
            resultEl.textContent += `Current gasPrice: ${price} Gwei
To stall: use gasPrice < ${price} Gwei
`;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `
Check RPC endpoint: ${document.getElementById('rpc-url-2').value}`;
            resultEl.textContent = `ERROR: ${msg}
`;
        }
    };

    document.getElementById('run-pending-nonce').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx = document.getElementById('network-select-3').value;
            const base = document.getElementById('rpc-url-3').value;
            const rpc = idx === '0' ? `${base}/${ETH_API_KEY}` : base;
            const addr = document.getElementById('account').value.trim();
            const countHex = await callRPC(rpc, 'eth_getTransactionCount', [addr, 'pending']);
            const pending = parseInt(countHex.slice(2), 16);
            resultEl.textContent += `Pending-nonce for ${addr}: ${pending}
`;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `
Check RPC endpoint: ${document.getElementById('rpc-url-3').value}`;
            resultEl.textContent = `ERROR: ${msg}
`;
        }
    };

    document.getElementById('run-nonce-range').onclick = async () => {
        resultEl.textContent = 'Loading...';
        try {
            const idx = document.getElementById('network-select-4').value;
            const base = document.getElementById('rpc-url-4').value;
            const rpc = idx === '0' ? `${base}/${ETH_API_KEY}` : base;
            const from = parseInt(document.getElementById('from-nonce').value, 10);
            const to = parseInt(document.getElementById('to-nonce').value, 10);
            const addr = document.getElementById('target-address').value.trim();

            const headHex = await callRPC(rpc, 'eth_blockNumber', []);
            const maxBlock = parseInt(headHex.slice(2), 16);
            let output = '';

            for (let n = from; n <= to; n++) {
                let low = 0;
                let high = maxBlock;
                while (low < high) {
                    const mid = Math.floor((low + high) / 2);
                    const cntHex = await callRPC(rpc, 'eth_getTransactionCount', [addr, `0x${mid.toString(16)}`]);
                    const cnt = parseInt(cntHex.slice(2), 16);
                    if (cnt < n + 1) low = mid + 1;
                    else high = mid;
                }
                const finalHex = await callRPC(rpc, 'eth_getTransactionCount', [addr, `0x${low.toString(16)}`]);
                const finalCnt = parseInt(finalHex.slice(2), 16);
                if (finalCnt < n + 1) output += `Nonce ${n} not found (up to block ${maxBlock})
`;
                else output += `Nonce ${n} included in block ${low}
`;
            }

            resultEl.textContent = output;
        } catch (e) {
            let msg = e.message;
            if (msg.includes('Failed to fetch')) msg += `
Check RPC endpoint: ${document.getElementById('rpc-url-4').value}`;
            resultEl.textContent = `ERROR: ${msg}`;
        }
    };
});