// Market.js

function showMessage(txt) {
    $('msg-buy').innerHTML = txt;
}

function onBuy(actid, price) {
	buyProfile(actid, price);
}

async function buyProfile(actid, price) {
	console.log('Buying profile', actid, price);
	if(!session.accountId){ alert("Must login to buy"); return; }
	if(session.accountId==actid){ alert("Can't buy your own profile"); return; }
    $('action-buy').classList.add('disabled');
    let act = hederasdk.AccountId.fromString(actid);
    let adr = act.toSolidityAddress();
    //let pay  = new hederasdk.Hbar(price).toTinybars().toNumber(); //tinybar
    let trx  = generateTransactionId(session.accountId); //{tid, idx}
    let node = new hederasdk.AccountId(3);
    let par  = new hederasdk.ContractFunctionParameters().addAddress(adr);
    let tx   = await new hederasdk.ContractExecuteTransaction()
        .setContractId(config.contractId)  //Set the contract ID
        .setGas(1000000)                   //Set the gas for the contract call
        .setFunction("buy", par)           //Set the contract function to call
        .setPayableAmount(new hederasdk.Hbar(price))
        .setMaxTransactionFee(new hederasdk.Hbar(1))
        .setNodeAccountIds([node])
        .setTransactionId(trx.tid)
        .freeze();
    console.warn('Ctr', config.contractId);
    console.warn('Tx', tx);
    let bytes = tx.toBytes();
    // sign and send to hashconnect
    let trans = {
        topic: session.topic,
        byteArray: bytes,
        metadata: {
            accountToSign: session.accountId,
            returnTransaction: false
        }
    }
    console.warn('Trans', trans);
    let response = await hashconnect.sendTransaction(session.topic, trans);
    console.log('Tx response:',response);
    if(response.success){
        let res = await fetch('/api/transfer/'+actid);
        let rex = await res.json();
        console.log('Profile sold', rex);
    	$('action-buy').innerHTML = 'SOLD';
    } else {
    	$('action-buy').innerHTML = 'ERROR';
        setTimeout(checkTxError, 5000, trx.idx, 'Error buying profile', 'msg-buy');
    }
}

// END