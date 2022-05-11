// profile.js

function showMessage(txt) {
    $('msg-update').innerHTML = txt;
}

function showMessage2(txt) {
    $('msg-fields').innerHTML = txt;
}

function onSale() {
    setPrice();
}

async function setPrice() {
    console.log('Setting price...');
    $('action-price').classList.add('disabled');
    let val  = $('price').value;
    let tin  = new hederasdk.Hbar(val).toTinybars().toNumber(); //tinybar
    let trx  = generateTransactionId(session.accountId); //{tid, idx}
    let node = new hederasdk.AccountId(3);
    let par  = new hederasdk.ContractFunctionParameters().addUint256(tin);
    let tx   = await new hederasdk.ContractExecuteTransaction()
        .setContractId(config.contractId)  //Set the contract ID
        .setGas(1000000)                   //Set the gas for the contract call
        .setFunction("setPrice", par)      //Set the contract function to call
        .setMaxTransactionFee(new hederasdk.Hbar(0.5))
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
        showMessage('Price set, profile on sale');
        let res = await fetch('/api/setprice/'+val);
        let rex = await res.json();
        console.log('Price saved', rex);
    } else {
        //let txt = await getErrorMessage(txId);
        showMessage('Error saving price');
        setTimeout(checkTxError, 5000, trx.idx, 'Error saving price', 'msg-update');
    }
    $('action-price').classList.remove('disabled');
}

function onTransfer() {
    let actid = $('destin').value;
    transferProfile(actid);
}

async function transferProfile(actid) {
    console.log('Transferring profile', session.accountId);
    if(!session.accountId){ alert("Must login to transfer"); return; }
    if(session.accountId==actid){ alert("Can't transfer to yourself"); return; }
    $('action-send').classList.add('disabled');
    let act = hederasdk.AccountId.fromString(actid);
    let adr = act.toSolidityAddress();
    //let pay  = new hederasdk.Hbar(price).toTinybars().toNumber(); //tinybar
    let trx  = generateTransactionId(session.accountId); //{tid, idx}
    let node = new hederasdk.AccountId(3);
    let par  = new hederasdk.ContractFunctionParameters().addAddress(adr);
    let tx   = await new hederasdk.ContractExecuteTransaction()
        .setContractId(config.contractId)  //Set the contract ID
        .setGas(1000000)                   //Set the gas for the contract call
        .setFunction("transfer", par)      //Set the contract function to call
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
        console.log('Profile transferred', rex);
        $('action-send').innerHTML = 'PROFILE SENT';
    } else {
        //let txt = await getErrorMessage(txId);
        //showMessage('Error buying profile');
        $('action-send').innerHTML = 'ERROR';
        setTimeout(checkTxError, 5000, trx.idx, 'Error transferring profile', 'msg-update');
    }
}

function onDelete() {
    deleteProfile();
}

async function deleteProfile() {
    console.log('Deleting profile...');
    let node = new hederasdk.AccountId(3);
    let acct = hederasdk.AccountId.fromString(session.accountId);
    let txId = hederasdk.TransactionId.generate(acct);
    let acc  = txId.accountId.num.toString();
    let sec  = txId.validStart.seconds.toString();
    let nano = txId.validStart.nanos.toString();
    let idx  = `0.0.${acc}-${sec}-${nano}`;

    let tx = await new hederasdk.ContractExecuteTransaction()
        .setContractId(config.contractId)   //Set the ID of the contract
        .setGas(1000000)             //Set the gas for the contract call
        .setFunction("deleteUser")   //Set the contract function to call
        .setMaxTransactionFee(new hederasdk.Hbar(0.5))
        .setNodeAccountIds([node])
        .setTransactionId(txId)
        .freeze();
    let bytes = tx.toBytes();
    console.warn('Ctr', config.contractId);
    console.warn('Tx', tx);
    console.log('Bytes', bytes);
    console.warn(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${idx}`);
    // sign and send to hashconnect
    let transaction = {
        topic: session.topic,
        byteArray: bytes,
        metadata: {
            accountToSign: session.accountId,
            returnTransaction: false
        }
    }
    console.warn('Trans', transaction);
    let response = await hashconnect.sendTransaction(session.topic, transaction);
    console.log('Tx response:', response);
    if(response.success){
        showMessage('Profile deleted');
    } else {
        //let txt = await getErrorMessage(txId);
        showMessage('Error deleting profile');
        $('action-mod').classList.remove('disabled');
        setTimeout(checkTxError, 5000, idx, 'Error deleting profile', 'msg-update');
    }
}

async function onProperties() {
    console.log('Updating properties...');
    updateProperties()
}

async function updateProperties() {
    console.log('Updating properties...');
    showMessage2('Updating properties, wait...');
    $('action-key').classList.add('disabled');
    let dict = {};
    let keys = [];
    let vals = [];
    let data = [];
    for (var i=0; i<10; i++) {
        let key = $('key'+i).value.toLowerCase();
        let val = $('val'+i).value;
        console.log(key, val);
        if(key&&val){
            keys.push(key);
            vals.push(val);
            dict[key] = val;
        }
    }
    if(keys.length<1){
        showMessage2('Nothing to update');
        $('action-key').classList.remove('disabled');
        return;
    }
    // Gather array of key/val
    data = keys.concat(vals);
    console.log('Dict', dict);
    console.log('Data', data);
    // send to contract.setValues(data)
    let node = new hederasdk.AccountId(3);
    let act  = hederasdk.AccountId.fromString(session.accountId);
    let txId = hederasdk.TransactionId.generate(act);
    let acc  = txId.accountId.num.toString();
    let sec  = txId.validStart.seconds.toString();
    let nano = txId.validStart.nanos.toString();
    let idx  = `0.0.${acc}-${sec}-${nano}`;
    let pars = new hederasdk.ContractFunctionParameters().addStringArray(data);
    let tx = await new hederasdk.ContractExecuteTransaction()
        .setContractId(config.contractId)  //Set the contract ID
        .setGas(1000000)                   //Set the gas for the contract call
        .setFunction("setValues", pars)    //Set the contract function to call
        .setMaxTransactionFee(new hederasdk.Hbar(0.5))
        .setNodeAccountIds([node])
        .setTransactionId(txId)
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
    console.log('Tx response:' ,response);
    if(response.success){
        showMessage2('Properties updated');
        let dixx = JSON.stringify(dict);
        let opts = {method: "POST", headers: {'Content-Type': 'application/json'}, body: dixx};
        console.log('Dixx', dixx);
        let res = await fetch('/api/metadata', opts);
        let rex = await res.json();
        console.log('Metadata saved', rex);
    } else {
        showMessage2('Error updating properties');
        setTimeout(checkTxError, 5000, txId, 'Error updating properties', 'msg-fields');
    }
    $('action-key').classList.remove('disabled');
}

// END