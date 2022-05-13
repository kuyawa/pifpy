// main.js

const config = {
	network: 'testnet',
	contractId: '0.0.34744982'
};

const appMetadata = {
	name: 'PIFPY',
	description: 'Profiles in the blockchain',
	icon: window.location.origin+'/media/icon-dapp.png'
};

var session = {
	root: window.location.origin,
	network: 'testnet',
	isLoaded: false,
	state: null,
	topic: null,
	accountId: null,
	publicKey: null,
	privateKey: null,
	pairingString: null,
	pairedWalletData: null,
	pairedAccounts: []
};

function $(id){ return document.getElementById(id); }

function randomAddress() {
    let buf = crypto.getRandomValues(new Uint8Array(20));
    let adr = '0x'+Array.from(buf).map(x=>{return x.toString(16).padStart(2,'0')}).join('');
    return adr;
}

function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    let value = null;
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') { c = c.substring(1, c.length); }
        if (c.indexOf(nameEQ) == 0) { value = c.substring(nameEQ.length, c.length); break; }
    }
    return value;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        console.log('Copying to clipboard was successful!');
    }, function(err) {
        console.error('Could not copy text:', err);
    });
}

function saveLocalData() {
	console.log('Saving local data...', session);
    let ok = localStorage.setItem("hashconnectdata", JSON.stringify(session));
}

function loadLocalData() {
	console.log('Loading local data...');
    let foundData = localStorage.getItem("hashconnectdata");
    if(foundData){
        session = JSON.parse(foundData);
        session.isLoaded = true;
		console.log('Local data loaded', session);
        return true;
    } else {
		console.log('No local data');
        return false;
    }
}

async function getAccountInfo(actId) {
	console.log('Account info for', actId);
	let res = await fetch('https://testnet.mirrornode.hedera.com/api/v1/accounts/'+actId);
	let inf = await res.json();
	console.log('Act info', inf);
	if(inf.key) { 
		let pub = inf.key.key;
		session.publicKey = inf.key.key;
		console.log('Public key', inf.key.key);
		saveLocalData();
	}
}

async function hashEvents() {
	// Events
	hashconnect.foundExtensionEvent.on((walletMetadata) => {
		console.log('Wallet metadata', walletMetadata);
		session.walletMetadata = walletMetadata;
		console.log('Connecting to wallet...');
        hashconnect.connectToLocalWallet(session.pairingString, walletMetadata);
	});

	hashconnect.pairingEvent.on((pairingData) => {
		console.log('Pairing data received', pairingData);
		session.pairingData = pairingData;
		session.pairedWalletData = pairingData.metadata;
		let cnt = 0;
    	pairingData.accountIds.forEach(actid => {
			console.log('Pairing data id', actid);
	        if(session.pairedAccounts.indexOf(actid) == -1) {
    		    session.pairedAccounts.push(actid);
	        }
			if(cnt==0) { 
				console.log('First wallet', actid);
				session.accountId = actid;
				setProfileLink();
				getAccountInfo(actid);
				saveLocalData();
				setCookie('user', actid);
			}
	        cnt+=1;
		});
		console.log('Pairing done');
	})

	hashconnect.acknowledgeMessageEvent.on((acknowledgeData) => {
		console.log('Acknowledge event', acknowledgeData);
	});

	hashconnect.connectionStatusChange.on((connectionStatus) => {
		console.log('Connection event:', connectionStatus);
	});

	hashconnect.transactionEvent.on((transaction) => {
		console.log('Transaction event:', transaction);
	});
}

async function connect() {
	console.log('> Connecting...', session);
	if(session.isLoaded){
		console.log('Session already loaded', session);
		// Connect second time, use topic
		await hashconnect.init(appMetadata, session.privateKey);
		//await hashconnect.connect(session.topic, session.pairingString);
		await hashconnect.connect(session.topic, session.pairedWalletData);
		setProfileLink();
		hashEvents();
	} else {
		console.log('Hashconnect init...', session);
		session.initData = await hashconnect.init(appMetadata);
		session.privateKey = session.initData.privKey; 
		console.log('Init', session.initData);
		console.log('PKey', session.privateKey);
		hashEvents();

		// Connect first time
		console.log('First time...', session);
		session.state = await hashconnect.connect();
		session.topic = session.state.topic;
		console.log('State', session.state);
		console.log('Topic', session.state.topic);
		session.isLoaded = true;
		
		// Pair sessions
		console.log('Pairing...', session);
		session.pairingString = await hashconnect.generatePairingString(session.state, session.network, false);
        console.log('Paired', session.pairingString);
        saveLocalData();

        // Find wallets
        if(session.accountId){
        	setProfileLink();
    	} else {
        	hashconnect.findLocalWallets();
        	console.log('Finding wallets...');
        }
	}
}

function parseMessage(data){
	let jsonString = Buffer.from(data).toString('utf8'); // data is Uint8Array
	let parsedData = JSON.parse(jsonString);
	return parsedData;
}

async function requestAdditionalAccounts() {
    let request = {
    	id: null,
        topic: session.topic,
        network: session.network,
        multiAccount: false
    } 
    let response = await hashconnect.requestAdditionalAccounts(session.topic, request);
    console.log('Response', response);
}

var txtest; // REMOVE

function onLogin() {
	hashconnect.findLocalWallets();
	console.log('Finding wallets...');
}

function setProfileLink() {
	if(session.accountId){
		$('menu-account').innerHTML = session.accountId;
		$('link-profile').classList.remove('disabled');
		//$('link-profile').href = '/profile/'+session.accountId;
		getProfile();
	}
}

function onAuthenticate() {
	authenticate('0.0.34142794');
}

async function authenticate(accountId) {
	console.log('Authenticate...');
	let res = await hashconnect.authenticate(session.topic, accountId);
	console.log('Res', res);
	console.log('Authenticated', res.success);
	if(res.success){
		// TODO: Pass signature to server for verification
	    //let trans = Transaction.fromBytes(res.signedTransaction); // tx is a Uint8Array
	    let trans = res.signedTransaction; // tx is a Uint8Array
		console.log('Trans', trans);
	    let tx = res.signedTransaction; // tx is a Uint8Array
	    let ts = encodeURIComponent(Buffer.from(tx).toString('base64'));
	    txtest = tx; // For debugging
	    //tx = parseMessage(res.signedTransaction); // debug this
	    let rx = await fetch('/verify/'+ts);
	    console.log('verify', rx);
	} else {
		console.log('User rejected authentication request');
		return false;
	}
}


//---- UTILS

function fromHex(hex) {
    var str = '';
    for (var i=0; i<hex.length; i+=2) {
        var v = parseInt(hex.substr(i, 2), 16);
        if(v){ str += String.fromCharCode(v); }
    }
    //console.log(hex);
    //console.log(str);
    return str;
    //process.exit(0);
}

async function getTransaction(txid){
    try {
        let url = 'https://testnet.mirrornode.hedera.com/api/v1/contracts/results/'+txid; //0.0.243343-1651769629-171820468
        let res = await fetch(url);
        let tx  = await res.json();
        console.log('Tx', tx);
        return tx;
    } catch(ex){
        console.log('Error processing transaction:', ex);
    }
}

function generateTransactionId(actId){
	console.log('Generating transaction for', actId);
    let acct = hederasdk.AccountId.fromString(actId);
    let tid  = hederasdk.TransactionId.generate(acct);
    let acc  = tid.accountId.num.toString();
    let sec  = tid.validStart.seconds.toString();
    let nano = tid.validStart.nanos.toString();
    let idx  = `0.0.${acc}-${sec}-${nano}`;
    return {tid, idx};
}

function parseError(hex){
    let fnc = hex.substr(2,8);
    let cnt = hex.substr(10,64);
    let chr = parseInt(hex.substr(74,64),16);
    let txt = hex.substr(138,chr*2);
    let res = fromHex(txt);
    //console.log('Fnc', fnc);
    //console.log('Cnt', cnt);
    //console.log('Chr', chr);
    //console.log('Txt', txt);
    //console.log('Res', res);
    return res;
}

async function getErrorMessage(txid){
    let tx = await getTransaction(txid);
    if(tx.error_message){
        let txt = parseError(tx.error_message);
        console.log('ERROR:', txt);
        return txt;
    } else {
        console.log('No error');
        return '';
    }
}

async function checkTxError(txId, msg, msgr) {
    let txt = await getErrorMessage(txId);
    console.log(msg);
    console.log('https://testnet.mirrornode.hedera.com/api/v1/contracts/results/'+txId);
    $(msgr).innerHTML = msg+` <a href="https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${txId}" target="_blank">[TX]</a> ${txt}`;
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

async function getProfile() {
 	if(!session.accountId){ return; }
 	let res = await fetch('/api/profile/'+session.accountId);
 	let pfp = await res.json();
 	console.log('PFP', pfp);
 	if(pfp && !pfp.error){
		$('menu-account').innerHTML = pfp.username;
 	}
}


async function main() {
	console.log('PIFPY is starting...');
	pifpy = PIFPY();
	pifpy.getVersion();
	hashconnect.debug = true;
	loadLocalData()
	await connect();
	getProfile();
}

window.onload = main;

// END