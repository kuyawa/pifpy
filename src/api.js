//let fetch = require('node-fetch');
let crypto = require('crypto'); 
let fetch  = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
let hedera = require('@hashgraph/sdk');
//let DB     = require('./database'); 
//console.warn('--> HEDERA', hedera);


async function randomAddress() {
    let buf = await crypto.randomBytes(20);
    let adr = '0x'+buf.toString('hex');
    return adr;
}

function alphaNum(txt) {
    // username must be ascii a-z and less than 20 chars
    for(let i=0; i<txt.length; i++){
        let char = txt.charCodeAt(i);
        if(i==0 && (char >= 0x30 && char <= 0x39)){ return false; }
        if(
            !(char >= 0x30 && char <= 0x39) && //9-0
            !(char >= 0x41 && char <= 0x5A) && //A-Z
            !(char >= 0x61 && char <= 0x7A)    //a-z
        ){ return false; }
    }
    return true;
}

async function verifySignature(tx64){
	console.warn('tx64', tx64);
	//tx64 = 'Cr4BKrsBClEKGwoMCKum15IGEN/0448BEgkIABAAGMr0oxAYABIGCAAQABgDGIDC1y8iAgh4MgwwLjAuMzQxNDI3OTRyEwoRCg8KCQgAEAAYyvSjEBAAGAASZgpkCiAifU2/clUUsYRFnEmuv3L97pzvTYypiB+VsznM3OpVwRpA5yvnsL/LCWvMbkwlByFCxpD2h+fwRXKN1357aBwWnARZkGOKqxFhaVQ9o97GQXXzHCTh63ofKnasCq1f2D7mBw==';
	let token = null;
	try {	
		let bytes = new Uint8Array(Buffer.from(decodeURIComponent(tx64), 'base64'));
		//console.warn('bytes', bytes);
		let tx = hedera.Transaction.fromBytes(bytes);
		//console.warn('tx', tx);

		// Memo actid should be the same as user
		let act = tx.transactionMemo;
		console.warn('Act', act);
		
		// Fetch account public key from hedera
		//let data = await fetch('https://testnet.mirrornode.hedera.com/api/v1/accounts/'+act);
		//let info = await data.json();
		//let key  = info.key.key;
		//let pub = hedera.PublicKey.fromString(key);

		// Better get pubkey from tx
		let pub = tx._publicKeys[0]; // Get first key, authenticate only user
        let ok  = pub.verifyTransaction(tx);

        if(ok){
			// TODO: get/save token to db
			token = randomAddress();
			console.warn('Authenticated');
        } else {
			console.warn('Unauthorized');
        }
	} catch(ex) {
		console.error('Error', ex);
	}
	return token;
}

async function checkName(name){
	console.warn('Validating user name:', name);
	if(!name || name.length<1){ 
		console.warn('Empty user name is not allowed'); 
		return {valid:false, reason:'Empty user name is not allowed'}; 
	}
	let nlow = name.toLowerCase();
    if(nlow.charCodeAt(0) >= 0x30 && nlow.charCodeAt(0) <= 0x39){
		console.warn('User name can not start with a number');
		return {valid:false, reason:'User name can not start with a number'};
    }
	if(nlow.length>20){
		console.warn('User name should be up to 20 chars');
		return {valid:false, reason:'User name should be up to 20 chars'};
	}
	if(!alphaNum(nlow)){
		console.warn('User name should be lowercase a-z and 0-9 only');
		return {valid:false, reason:'User name should be lowercase a-z and 0-9 only'};
	}
	// check name in contract
	let taken = await isTaken(nlow);
	if(taken){
		console.warn('User name already taken');
		return {valid:false, reason:'User name already taken'};
	}
	console.warn('Valid: true');
	return {valid:true};
}


async function isTaken(name) {
	let client = hedera.Client.forTestnet().setOperator(process.env.OPERATORACT, process.env.OPERATORKEY);
	let ctrId  = process.env.CONTRACT;
    // Calls a function of the smart contract
    //let acctId = hedera.AccountId.fromString(process.env.OPERATORACT);
    //let actHex = acctId.toSolidityAddress();
    let params = new hedera.ContractFunctionParameters().addString(name);
    let query  = await new hedera.ContractCallQuery()
         .setGas(100000)
         .setContractId(ctrId)
         .setFunction("isTaken", params)
         .setMaxQueryPayment(new hedera.Hbar(0.01));
     let response = await query.execute(client);
     let result = response.getUint8(0); // Get as bool
     console.warn("Taken?", result);
     return result>0;
}

async function signAndBuild(tx64) {
	//tx64 = 'Cr4BKrsBClEKGwoMCKum15IGEN/0448BEgkIABAAGMr0oxAYABIGCAAQABgDGIDC1y8iAgh4MgwwLjAuMzQxNDI3OTRyEwoRCg8KCQgAEAAYyvSjEBAAGAASZgpkCiAifU2/clUUsYRFnEmuv3L97pzvTYypiB+VsznM3OpVwRpA5yvnsL/LCWvMbkwlByFCxpD2h+fwRXKN1357aBwWnARZkGOKqxFhaVQ9o97GQXXzHCTh63ofKnasCq1f2D7mBw==';
	let client = hedera.Client.forTestnet().setOperator(process.env.OPERATORACT, process.env.OPERATORKEY);
	let bytes  = new Uint8Array(Buffer.from(decodeURIComponent(tx64), 'base64'));
	//console.warn('bytes', bytes);
	let node = new hedera.AccountId(3);
    let act  = hedera.AccountId.fromString(process.env.OPERATORACT);
	let tx   = hedera.Transaction.fromBytes(bytes);
	let txId = hedera.TransactionId.generate(act);
    tx.setTransactionId(txId);
    tx.setNodeAccountIds([node]);
    await tx.freeze();
    let txBytes = tx.toBytes();
}

async function txNewUser(name, avatar) {
	console.warn('NEW USER:', name, avatar);
	try {
		let client = hedera.Client.forTestnet().setOperator(process.env.OPERATORACT, process.env.OPERATORKEY);
	    let prvKey = hedera.PrivateKey.fromString(process.env.OPERATORKEY);
        let pubKey = prvKey.publicKey;
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
	    pay = 4;
		console.warn('PAY:', pay);
		let node = new hedera.AccountId(3);
	    let act  = hedera.AccountId.fromString(process.env.OPERATORACT);
		let txId = hedera.TransactionId.generate(act);
		let acc  = txId.accountId.num.toString();
		let sec  = txId.validStart.seconds.toString();
		let nano = txId.validStart.nanos.toString();
		let idx  = `0.0.${acc}-${sec}-${nano}`;
	    let params = new hedera.ContractFunctionParameters().addString(name).addString(avatar);
	    let tx = await new hedera.ContractExecuteTransaction()
	        .setContractId(process.env.CONTRACT)
	        .setGas(1000000)
            .setMaxTransactionFee(new hedera.Hbar(8))
	        .setFunction('newUser', params)
	        .setPayableAmount(new hedera.Hbar(pay))
			.setNodeAccountIds([node])
			.setTransactionId(txId)
	        .freeze();
	    console.warn('Ctr', process.env.CONTRACT);
	    console.warn('Tx', tx);
        let byt  = tx.toBytes();
		//let sig  = await prvKey.signTransaction(hedera.Transaction.fromBytes(byt));
        //let txo  = tx.addSignature(pubKey, sig);
        //let out  = txo.toBytes();
        let out  = byt;
		let tx64 = encodeURIComponent(Buffer.from(out).toString('base64'));
	    console.warn('Bytes', out);
	    console.warn('Tx64', tx64);
	    console.warn('TxId', idx);
		console.warn(`https://testnet.mirrornode.hedera.com/api/v1/transactions/${idx}`);
	    return {status:'ok', id:idx, tx:tx64};
	} catch(ex) {
		console.error('Txerror:', ex);
		return {status:'error', error:ex.message};
	}
}

async function getUserById(actId) {
	console.warn('- Get user by id', actId);
	let user = null;
	try {
		let client = hedera.Client.forTestnet().setOperator(process.env.OPERATORACT, process.env.OPERATORKEY);
		let ctrId  = process.env.CONTRACT;
	    let acctId = hedera.AccountId.fromString(actId);
	    let actHex = acctId.toSolidityAddress();
		console.warn('Contract', ctrId);
		console.warn('UserId', actHex);
	    let params = new hedera.ContractFunctionParameters().addAddress(actHex);
	    let query  = await new hedera.ContractCallQuery()
	         .setGas(100000)
	         .setContractId(ctrId)
	         .setFunction("getUser", params)
	         .setQueryPayment(new hedera.Hbar(0.01));
	     let response = await query.execute(client);
	     let result = response.getString(0); // Get a string from the result at index 0
	     user = JSON.parse(result);
	     console.warn("Result:", result);
	     console.warn("User:", user);
	 } catch(ex){
	 	 console.error('Error:', ex);
	 	 user = {error:ex.message}; 	
	 }
     return user;
}


exports.verifySignature = verifySignature;
exports.checkName       = checkName;
exports.txNewUser       = txNewUser;
exports.getUserById     = getUserById;
exports.signAndBuild    = signAndBuild; // deprecate


// END