// create.js

function showMessage(txt) {
    $('msg-create').innerHTML = txt;
}

function showMessage2(txt) {
    $('msg-fields').innerHTML = txt;
}

async function onCheck() {
    checkUserName()
}

async function checkUserName() {
    showMessage('Validating user name, please wait...');
    let name = $('username').value;
    if(name.length<1){ showMessage('Empty user name is not allowed'); return; }
    let nlow = name.toLowerCase();
    if(nlow.charCodeAt(0) >= 0x30 && nlow.charCodeAt(0) <= 0x39){ showMessage('User name can not start with a number'); return; }
    if(nlow.length>20){ showMessage('User name should be up to 20 chars'); return; }
    if(!alphaNum(name)){ showMessage('User name should be lowercase a-z and 0-9 only'); return; }
    console.log(name, nlow);
    showMessage('Verifying availability...');
    let res = await fetch('/api/checkname/'+nlow); // Check name on the server not to charge user any fee
    let inf = await res.json();
    console.log('Res', inf);
    if(inf.valid){
        showMessage('User name is available');
    } else {
        showMessage(inf.reason);
        return;
    }
    console.warn('Info', inf);
}

function onCreate() {
    createProfile();
}

async function createProfile() {
    console.log('Creating profile...');
    let name = $('username').value;
    if(name.length<1){ showMessage('Empty user name is not allowed'); return; }
    let nlow = name.toLowerCase();
    if(nlow.charCodeAt(0) >= 0x30 && nlow.charCodeAt(0) <= 0x39){ showMessage('User name can not start with a number'); return; }
    if(nlow.length>20){ showMessage('User name should be up to 20 chars'); return; }
    if(!alphaNum(name)){ showMessage('User name should be lowercase a-z and 0-9 only'); return; }
    console.log(name, nlow);
    let file = $('avatar-file').files[0];
    $('action-new').classList.add('disabled');
    upload(file, nlow, afterFile); // upload to ipfs
    // wait on success: afterFile
}

// input.file onchange
function preview(input, target) {
    let file = input.files[0];
    console.log('Preview', file);
    console.log('Size', file.size);
    if(file.size>1000000){ console.log('Size too big'); }
    var reader = new FileReader();
    reader.onload = function(obj)  {
        $(target).src = obj.target.result;
    }
    reader.readAsDataURL(file);
}


// Receives an input.file element like $('avatar').files[0]
async function upload(file, name, onSuccess) {
    console.log('Uploading file', file);
    let reader = new FileReader();
    reader.onloadend = async function(){
        try{
            // Upload to IPFS
            console.log('File is loading...');
            let ipfs = await Ipfs.create({ host: 'ipfs.infura.io', port: 5001, protocol: 'https' }); // Connect to IPFS
            //console.log('IPFS', ipfs);
            let buf = new Buffer(reader.result);            // Convert data into buffer
            let res = await ipfs.add(buf);                  // Upload buffer to IPFS
            console.log('Res', res);
            let url = 'https://ipfs.io/ipfs/'+res.path;
            let fid = 'ipfs:'+res.path;
            console.log('File Url:', url);
            // Upload to server
            let ok = await saveFile(res.path+'.jpg', file);
            if(!ok){ 
                showMessage('Error saving file');
                $('action-new').classList.remove('disabled');
                return;
            }
            onSuccess(name, fid);
        } catch(ex){
            console.error('Error:', ex);
            showMessage('Error uploading file, try again');
            $('action-new').classList.remove('disabled');
            //onFailure(ex.message);
        }
    }
    reader.readAsArrayBuffer(file); // reads file
}

async function saveFile(fileId, file) {
    console.log('Saving file', fileId, file);
    if(!fileId || !file){ return; }
    var data = new FormData();
    data.append('fileid', fileId);
    data.append('file', file);
    let res = await fetch('/api/upload/'+fileId, {method: "POST", body: data});
    let rex = await res.json();
    if(rex.error) { console.log(rex.error); return false; }
    return true;
}

async function afterFile(name, avatar) {
    console.log('After:', name, avatar);
    // Calc payment
    let pay    = 1;
    let chars  = name.length || 0;
    switch(chars){
        case  1: pay = 1000; break;
        case  2: pay =  500; break;
        case  3: pay =  100; break;
        case  4: pay =   50; break;
        case  5: pay =   10; break;
        default: pay =    1;
    }
    //pay = 4;
    console.warn('PAY:', pay);
    let node = new hederasdk.AccountId(3);
    let act  = hederasdk.AccountId.fromString(session.accountId);
    let txId = hederasdk.TransactionId.generate(act);
    let acc  = txId.accountId.num.toString();
    let sec  = txId.validStart.seconds.toString();
    let nano = txId.validStart.nanos.toString();
    let idx  = `0.0.${acc}-${sec}-${nano}`;
    let pars = new hederasdk.ContractFunctionParameters().addString(name).addString(avatar);
    let tx = await new hederasdk.ContractExecuteTransaction()
        .setContractId(config.contractId)
        .setGas(1000000)
        .setMaxTransactionFee(new hederasdk.Hbar(8))
        .setFunction('newUser', pars)
        .setPayableAmount(new hederasdk.Hbar(pay))
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
        showMessage('Avatar uploaded');
        fetch(`/api/newuser/${name}/${avatar}`);
    } else {
        //let txt = await getErrorMessage(txId);
        showMessage('Error registering avatar');
        $('action-new').classList.remove('disabled');
        setTimeout(checkTxNew, 5000, txId);
    }
}

async function afterFileSERVER(name, avatar) {
    console.log('After:', name, avatar);
    let res  = await fetch(`/api/txnewuser/${name}/${avatar}`);
    let dat  = await res.json();
    console.log('Res:', dat);
    if(dat.status=='error'){ 
        showMessage(dat.error); 
        $('action-new').classList.remove('disabled');
        return;
    }
    let txId = dat.id;
    let tx64 = dat.tx;
    console.log('Freeze', tx64);
    let bytes = new Uint8Array(Buffer.from(decodeURIComponent(tx64), 'base64'));
    console.log('Bytes', bytes);
    // sign and send to hashconnect
    let transaction = {
        topic: session.topic,
        byteArray: bytes,
        metadata: {
            accountToSign: session.accountId,
            returnTransaction: false
        }
    }
    console.warn('Tx', transaction);
    let response = await hashconnect.sendTransaction(session.topic, transaction);
    console.log('Tx response:' ,response);
    if(response.success){
        showMessage('Avatar uploaded');
    } else {
        //let txt = await getErrorMessage(txId);
        showMessage('Error registering avatar');
        $('action-new').classList.remove('disabled');
        setTimeout(checkTxNew, 5000, txId);
    }
}

async function checkTxNew(txId) {
    let txt = await getErrorMessage(txId);
    showMessage(`Error registering avatar <a href="https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${txId}" target="_blank">[TX]</a> ${txt}`);
}

async function checkTxKey(txId) {
    let txt = await getErrorMessage(txId);
    showMessage(`Error saving properties <a href="https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${txId}" target="_blank">[TX]</a> ${txt}`);
}


async function onProperties() {
    addProperties();
}

async function addProperties() {
    console.log('Adding properties...');
    showMessage2('Adding properties, wait...');
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
        showMessage2('Nothing to add');
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
        //let txt = await getErrorMessage(txId);
        showMessage2('Error saving properties');
        setTimeout(checkTxKey, 5000, txId);
    }
    $('action-key').classList.remove('disabled');
}

// END